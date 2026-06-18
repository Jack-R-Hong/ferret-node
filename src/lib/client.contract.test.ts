import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { FerretClient } from './client.js';
import { FerretError } from './errors.js';
import { createQrLoginStore } from './stores/qr-login.svelte.js';
import type { SessionStore } from './stores/session.svelte.js';
import type { Identity } from './types.js';

// Contract tests drive the REAL FerretClient (no injected fetch) through msw, so
// they pin the wire contract — exact path, method, request body, and which
// response fields the SDK reads — against the documented Ferret backend. These
// guard the drift classes that have already bitten this repo:
//   - 9c78cf3: login MFA must POST to /login/:id/mfa
//   - c52dddf: completion identity is read from `session.identity`, never a
//              phantom top-level `identity`

const BASE = 'https://idp.test';
const api = (p: string) => `${BASE}/api/browser/self-service${p}`;

const identity: Identity = {
	id: 'u1',
	email: 'a@b.c',
	username: 'alice',
	email_verified: true,
	status: 'active',
	created_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-02T00:00:00Z'
};
const sessionPayload = { id: 'sess-1', identity, authenticated_at: 't0', expires_at: 't1' };

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = () => new FerretClient({ baseUrl: BASE });

describe('contract: login MFA submit (regression 9c78cf3)', () => {
	it('POSTs {method,code,csrf_token} to /login/:id/mfa', async () => {
		let seen: { method: string; body: unknown; flowId: string | readonly string[] | undefined } | undefined;
		server.use(
			http.post(api('/login/:flowId/mfa'), async ({ request, params }) => {
				seen = { method: request.method, body: await request.json(), flowId: params.flowId };
				return HttpResponse.json({ identity, remaining_codes: 4 });
			})
		);
		const res = await client().submitLoginMfa('flow-123', {
			method: 'totp',
			code: '123456',
			csrf_token: 'csrf'
		});
		expect(seen?.method).toBe('POST');
		expect(seen?.flowId).toBe('flow-123');
		expect(seen?.body).toEqual({ method: 'totp', code: '123456', csrf_token: 'csrf' });
		expect(res.identity.id).toBe('u1');
		expect(res.remaining_codes).toBe(4);
	});

	it('carries recovery_code as the method', async () => {
		server.use(
			http.post(api('/login/:flowId/mfa'), async ({ request }) => {
				const body = (await request.json()) as Record<string, unknown>;
				expect(body.method).toBe('recovery_code');
				return HttpResponse.json({ identity, remaining_codes: 2 });
			})
		);
		const res = await client().submitLoginMfa('f', {
			method: 'recovery_code',
			code: 'abcd-efgh',
			csrf_token: 'c'
		});
		expect(res.remaining_codes).toBe(2);
	});
});

describe('contract: QR login poll', () => {
	it('POSTs {poll_token} to /login/qr/poll', async () => {
		let body: unknown;
		server.use(
			http.post(api('/login/qr/poll'), async ({ request }) => {
				body = await request.json();
				return HttpResponse.json({ status: 'pending' });
			})
		);
		const res = await client().pollQrLogin('ptok');
		expect(body).toEqual({ poll_token: 'ptok' });
		expect(res.status).toBe('pending');
	});

	it('authorized response carries the session — identity under session, never top-level', async () => {
		server.use(
			http.post(api('/login/qr/poll'), () =>
				HttpResponse.json({ status: 'authorized', session: sessionPayload })
			)
		);
		const res = await client().pollQrLogin('ptok');
		expect(res.status).toBe('authorized');
		if (res.status === 'authorized') {
			expect(res.session.identity.id).toBe('u1');
		}
		expect((res as Record<string, unknown>).identity).toBeUndefined();
	});
});

describe('contract: QR store hydration end-to-end (regression: phantom identity)', () => {
	it('drives create→poll over the wire and hydrates from res.session.identity', async () => {
		server.use(
			http.post(api('/login/qr'), () =>
				HttpResponse.json({
					id: 'qr1',
					scan_token: 'scan',
					qr_svg: '<svg/>',
					poll_token: 'ptok',
					expires_at: 't',
					poll_interval_ms: 5
				})
			),
			http.post(api('/login/qr/poll'), () =>
				HttpResponse.json({ status: 'authorized', session: sessionPayload })
			)
		);
		const setAuthenticated = vi.fn();
		const session = { setAuthenticated } as unknown as SessionStore;
		const qr = createQrLoginStore(client(), session);
		await qr.start();
		await vi.waitFor(() => expect(qr.state).toBe('authorized'), { timeout: 2000, interval: 10 });
		expect(setAuthenticated).toHaveBeenCalledWith(identity, 't0', 't1');
		qr.stop();
	});
});

describe('contract: recovery completion (regression c52dddf)', () => {
	it('password-step completion returns identity under session + a fresh csrf_token', async () => {
		server.use(
			http.post(api('/recovery/:flowId'), () =>
				HttpResponse.json({ session: sessionPayload, csrf_token: 'fresh-csrf' })
			)
		);
		const res = await client().submitRecovery('flow-1', {
			password: 'new-pw-123456',
			csrf_token: 'c'
		});
		expect(res.session?.identity.id).toBe('u1');
		expect(res.csrf_token).toBe('fresh-csrf');
		expect((res as Record<string, unknown>).identity).toBeUndefined();
	});
});

describe('contract: magic link neutrality over the wire', () => {
	it('resolves on a 202 Accepted', async () => {
		server.use(http.post(api('/login/magic'), () => new HttpResponse(null, { status: 202 })));
		await expect(client().createMagicLinkFlow('a@b.c')).resolves.toBeUndefined();
	});

	it('still resolves on a 404 — status must not leak account existence', async () => {
		server.use(
			http.post(api('/login/magic'), () =>
				HttpResponse.json({ error: { code: 'not_found', message: 'no', status: 404 } }, { status: 404 })
			)
		);
		await expect(client().createMagicLinkFlow('ghost@b.c')).resolves.toBeUndefined();
	});
});

describe('contract: session 401 surfaces onUnauthorized', () => {
	it('a session_* 401 on whoami fires onUnauthorized and rejects', async () => {
		server.use(
			http.get(`${BASE}/api/browser/sessions/whoami`, () =>
				HttpResponse.json({ error: { code: 'session_expired', message: 'gone', status: 401 } }, { status: 401 })
			)
		);
		const c = client();
		const onUnauthorized = vi.fn();
		c.onUnauthorized = onUnauthorized;
		await expect(c.whoami()).rejects.toBeInstanceOf(FerretError);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});
});
