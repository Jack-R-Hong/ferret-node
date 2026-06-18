import { describe, it, expect, vi } from 'vitest';
import { FerretClient } from './client.js';
import { FerretError } from './errors.js';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}
function textResponse(text: string, status = 200): Response {
	return new Response(text, { status, headers: { 'content-type': 'text/plain' } });
}
function noContent(): Response {
	return new Response(null, { status: 204 });
}

type Handler = (url: string, init: RequestInit) => Promise<Response>;

function makeClient(handler: Handler, baseUrl = 'https://idp.example.com') {
	const fetchMock = vi.fn(handler);
	const client = new FerretClient({ baseUrl, fetch: fetchMock as unknown as typeof fetch });
	return { client, fetchMock };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
	const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
	return { url, init, headers: (init.headers ?? {}) as Record<string, string> };
}

describe('FerretClient.request — wire shape', () => {
	it('builds the URL, sets JSON headers, body and credentials on a POST', async () => {
		const { client, fetchMock } = makeClient(async () =>
			jsonResponse({ id: 'f', ui: { method: 'POST', action: '', fields: [] }, expires_at: '' })
		);
		await client.submitLogin('flow1', { identifier: 'a@b.c', password: 'pw', csrf_token: 'tok' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const { url, init, headers } = lastCall(fetchMock);
		expect(url).toBe('https://idp.example.com/api/browser/self-service/login/flow1');
		expect(init.method).toBe('POST');
		expect(init.credentials).toBe('include');
		expect(headers['Content-Type']).toBe('application/json');
		expect(JSON.parse(init.body as string)).toEqual({
			identifier: 'a@b.c',
			password: 'pw',
			csrf_token: 'tok'
		});
	});

	it('strips a trailing slash from baseUrl', async () => {
		const { client, fetchMock } = makeClient(
			async () => jsonResponse({ id: 'x', ui: { method: '', action: '', fields: [] }, expires_at: '' }),
			'https://idp.example.com/'
		);
		await client.createLoginFlow();
		expect(lastCall(fetchMock).url).toBe('https://idp.example.com/api/browser/self-service/login');
	});

	it('omits Content-Type and body on a GET', async () => {
		const { client, fetchMock } = makeClient(async () =>
			jsonResponse({ session: { id: 's', identity: {}, authenticated_at: '', expires_at: '' } })
		);
		await client.whoami();
		const { url, init, headers } = lastCall(fetchMock);
		expect(url).toBe('https://idp.example.com/api/browser/sessions/whoami');
		expect(init.method).toBe('GET');
		expect(init.body).toBeUndefined();
		expect(headers['Content-Type']).toBeUndefined();
	});
});

describe('FerretClient.request — response handling', () => {
	it('returns undefined on 204 No Content', async () => {
		const { client } = makeClient(async () => noContent());
		await expect(client.revokeSession('sess1', 'tok')).resolves.toBeUndefined();
	});

	it('returns undefined on a 2xx non-JSON response', async () => {
		const { client } = makeClient(async () => textResponse('OK', 200));
		await expect(client.logout('tok')).resolves.toBeUndefined();
	});

	it('wraps a non-JSON error body as FerretError(invalid_response)', async () => {
		const { client } = makeClient(async () => textResponse('upstream exploded', 500));
		const err = (await client.whoami().catch((e) => e)) as FerretError;
		expect(err).toBeInstanceOf(FerretError);
		expect(err.code).toBe('invalid_response');
		expect(err.i18nKey).toBe('error.internal');
		expect(err.status).toBe(500);
		expect(err.message).toBe('upstream exploded');
	});

	it('throws a FerretError built from a JSON error body', async () => {
		const { client } = makeClient(async () =>
			jsonResponse(
				{ error: { code: 'credentials_invalid', message: 'nope', i18n_key: 'error.credentials_invalid', status: 400 } },
				400
			)
		);
		const err = (await client
			.submitLogin('f', { identifier: 'a', password: 'b', csrf_token: 'c' })
			.catch((e) => e)) as FerretError;
		expect(err).toBeInstanceOf(FerretError);
		expect(err.code).toBe('credentials_invalid');
		expect(err.status).toBe(400);
		expect(err.i18nKey).toBe('error.credentials_invalid');
	});
});

describe('FerretClient.onUnauthorized', () => {
	it('fires on a 401 with a session_/token_ code (global logout)', async () => {
		const { client } = makeClient(async () =>
			jsonResponse({ error: { code: 'session_expired', message: 'gone', status: 401 } }, 401)
		);
		const onUnauthorized = vi.fn();
		client.onUnauthorized = onUnauthorized;
		await client.whoami().catch(() => {});
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it('does NOT fire on a domain-specific 401 (e.g. wrong password)', async () => {
		const { client } = makeClient(async () =>
			jsonResponse({ error: { code: 'invalid_password', message: 'bad', status: 401 } }, 401)
		);
		const onUnauthorized = vi.fn();
		client.onUnauthorized = onUnauthorized;
		const err = (await client
			.submitEmailChange('f', { code: 'x', csrf_token: 'y' })
			.catch((e) => e)) as FerretError;
		expect(onUnauthorized).not.toHaveBeenCalled();
		expect(err).toBeInstanceOf(FerretError);
		expect(err.code).toBe('invalid_password');
	});

	it('still rejects when no onUnauthorized handler is set', async () => {
		const { client } = makeClient(async () =>
			jsonResponse({ error: { code: 'token_invalid', message: 'gone', status: 401 } }, 401)
		);
		await expect(client.whoami()).rejects.toBeInstanceOf(FerretError);
	});
});

describe('FerretClient.completeSocialLogin', () => {
	const session = { id: 's1', identity: { id: 'u1', email: 'a@b.c' }, authenticated_at: 't0', expires_at: 't1' };

	it('on ferret_status=ok, confirms via whoami and returns the session', async () => {
		const { client, fetchMock } = makeClient(async () => jsonResponse({ session }));
		const result = await client.completeSocialLogin('ferret_status=ok&foo=bar');
		expect(lastCall(fetchMock).url).toBe('https://idp.example.com/api/browser/sessions/whoami');
		expect(result).toEqual({ kind: 'ok', session });
	});

	it('returns mfa_required without any network call', async () => {
		const { client, fetchMock } = makeClient(async () => {
			throw new Error('should not fetch');
		});
		expect(await client.completeSocialLogin('ferret_status=mfa_required')).toEqual({
			kind: 'mfa_required'
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns error carrying the raw status for anything else (or missing)', async () => {
		const { client } = makeClient(async () => {
			throw new Error('no');
		});
		expect(await client.completeSocialLogin('ferret_status=access_denied')).toEqual({
			kind: 'error',
			status: 'access_denied'
		});
		expect(await client.completeSocialLogin('')).toEqual({ kind: 'error', status: null });
	});

	it('accepts a URLSearchParams instance too', async () => {
		const { client } = makeClient(async () => jsonResponse({ session }));
		const result = await client.completeSocialLogin(new URLSearchParams('ferret_status=ok'));
		expect(result.kind).toBe('ok');
	});
});

describe('FerretClient.createMagicLinkFlow', () => {
	it('posts email (+ return_to) to the magic endpoint', async () => {
		const { client, fetchMock } = makeClient(async () => textResponse('', 202));
		await client.createMagicLinkFlow('a@b.c', 'https://app/return');
		const { url, init } = lastCall(fetchMock);
		expect(url).toBe('https://idp.example.com/api/browser/self-service/login/magic');
		expect(JSON.parse(init.body as string)).toEqual({
			email: 'a@b.c',
			return_to: 'https://app/return'
		});
	});

	it('swallows backend HTTP errors so the status cannot leak account existence', async () => {
		const { client } = makeClient(async () =>
			jsonResponse({ error: { code: 'not_found', message: 'no', status: 404 } }, 404)
		);
		await expect(client.createMagicLinkFlow('ghost@b.c')).resolves.toBeUndefined();
	});

	it('rethrows genuine transport errors — they are not an enumeration signal', async () => {
		const { client } = makeClient(async () => {
			throw new TypeError('Failed to fetch');
		});
		await expect(client.createMagicLinkFlow('a@b.c')).rejects.toBeInstanceOf(TypeError);
	});
});
