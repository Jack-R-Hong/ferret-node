import { describe, it, expect, vi } from 'vitest';
import { createSessionStore } from './session.svelte.js';
import { FerretError } from '../errors.js';
import type { FerretClient } from '../client.js';
import type { Identity } from '../types.js';

const identity: Identity = {
	id: 'u1',
	email: 'a@b.c',
	username: 'alice',
	email_verified: true,
	status: 'active',
	created_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-02T00:00:00Z'
};

function stubClient(whoami: () => Promise<unknown>): FerretClient {
	return { whoami } as unknown as FerretClient;
}

describe('createSessionStore.check', () => {
	it('becomes authenticated on a successful whoami', async () => {
		const client = stubClient(
			vi.fn(async () => ({
				session: { id: 's', identity, authenticated_at: 't0', expires_at: 't1' }
			}))
		);
		const s = createSessionStore(client);
		await s.check();
		expect(s.state.status).toBe('authenticated');
		expect(s.isAuthenticated).toBe(true);
		expect(s.identity).toEqual(identity);
	});

	it('becomes unauthenticated on a 401', async () => {
		const client = stubClient(
			vi.fn(async () => {
				throw new FerretError({ code: 'session_expired', message: 'x', status: 401 });
			})
		);
		const s = createSessionStore(client);
		await s.check();
		expect(s.state.status).toBe('unauthenticated');
		expect(s.isAuthenticated).toBe(false);
		expect(s.identity).toBeNull();
	});

	it('becomes unauthenticated on a 403', async () => {
		const client = stubClient(
			vi.fn(async () => {
				throw new FerretError({ code: 'forbidden', message: 'x', status: 403 });
			})
		);
		const s = createSessionStore(client);
		await s.check();
		expect(s.state.status).toBe('unauthenticated');
	});

	it('becomes error on a non-401/403 FerretError', async () => {
		const client = stubClient(
			vi.fn(async () => {
				throw new FerretError({ code: 'internal', message: 'boom', status: 500 });
			})
		);
		const s = createSessionStore(client);
		await s.check();
		expect(s.state.status).toBe('error');
	});

	it('becomes error on a non-FerretError throw (e.g. network)', async () => {
		const client = stubClient(
			vi.fn(async () => {
				throw new TypeError('network down');
			})
		);
		const s = createSessionStore(client);
		await s.check();
		expect(s.state.status).toBe('error');
	});
});

describe('createSessionStore manual setters', () => {
	it('setAuthenticated / setUnauthenticated flip the state', () => {
		const s = createSessionStore(stubClient(vi.fn()));
		s.setAuthenticated(identity, 't0', 't1');
		expect(s.isAuthenticated).toBe(true);
		expect(s.identity).toEqual(identity);
		s.setUnauthenticated();
		expect(s.isAuthenticated).toBe(false);
		expect(s.identity).toBeNull();
	});
});
