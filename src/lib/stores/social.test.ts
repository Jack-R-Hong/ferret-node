import { describe, it, expect, vi } from 'vitest';
import { createSocialLoginStore } from './social.svelte.js';
import type { FerretClient } from '../client.js';
import type { SessionStore } from './session.svelte.js';

const identity = { id: 'u1', email: 'a@b.c' };

function makeSession() {
	return { setAuthenticated: vi.fn() };
}

function stubClient(completeSocialLogin: (...args: unknown[]) => unknown): FerretClient {
	return { completeSocialLogin } as unknown as FerretClient;
}

describe('createSocialLoginStore.complete', () => {
	it('returns "none" and stays idle when there is no ferret_status', async () => {
		const complete = vi.fn();
		const s = createSocialLoginStore(stubClient(complete), makeSession() as unknown as SessionStore);
		expect(await s.complete('?foo=bar')).toBe('none');
		expect(complete).not.toHaveBeenCalled();
		expect(s.state).toBe('idle');
	});

	it('short-circuits mfa_required without calling the backend', async () => {
		const complete = vi.fn();
		const s = createSocialLoginStore(stubClient(complete), makeSession() as unknown as SessionStore);
		expect(await s.complete('?ferret_status=mfa_required')).toBe('mfa_required');
		expect(complete).not.toHaveBeenCalled();
		expect(s.state).toBe('mfa_required');
	});

	it('treats any other status as an error carrying the raw status', async () => {
		const s = createSocialLoginStore(stubClient(vi.fn()), makeSession() as unknown as SessionStore);
		expect(await s.complete('?ferret_status=access_denied')).toBe('error');
		expect(s.state).toBe('error');
		expect(s.errorStatus).toBe('access_denied');
	});

	it('ok → confirms with backend, hydrates session, stays loading for navigation', async () => {
		const session = makeSession();
		const sess = { id: 's', identity, authenticated_at: 't0', expires_at: 't1' };
		const s = createSocialLoginStore(
			stubClient(vi.fn(async () => ({ kind: 'ok', session: sess }))),
			session as unknown as SessionStore
		);
		expect(await s.complete('?ferret_status=ok')).toBe('ok');
		expect(session.setAuthenticated).toHaveBeenCalledWith(identity, 't0', 't1');
		expect(s.state).toBe('loading');
	});

	it('ok but backend then reports mfa_required', async () => {
		const s = createSocialLoginStore(
			stubClient(vi.fn(async () => ({ kind: 'mfa_required' }))),
			makeSession() as unknown as SessionStore
		);
		expect(await s.complete('?ferret_status=ok')).toBe('mfa_required');
		expect(s.state).toBe('mfa_required');
	});

	it('ok but the backend confirm throws → error with null status', async () => {
		const s = createSocialLoginStore(
			stubClient(
				vi.fn(async () => {
					throw new Error('boom');
				})
			),
			makeSession() as unknown as SessionStore
		);
		expect(await s.complete('?ferret_status=ok')).toBe('error');
		expect(s.state).toBe('error');
		expect(s.errorStatus).toBeNull();
	});

	it('reset returns to idle and clears errorStatus', async () => {
		const s = createSocialLoginStore(stubClient(vi.fn()), makeSession() as unknown as SessionStore);
		await s.complete('?ferret_status=access_denied');
		s.reset();
		expect(s.state).toBe('idle');
		expect(s.errorStatus).toBeNull();
	});
});
