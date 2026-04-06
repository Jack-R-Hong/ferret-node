import type { FerretClient } from '../client.js';
import type { Identity, WhoamiResponse } from '../types.js';
import { FerretError } from '../errors.js';

export type SessionState =
	| { status: 'loading' }
	| { status: 'authenticated'; identity: Identity; authenticatedAt: string; expiresAt: string }
	| { status: 'unauthenticated' }
	| { status: 'error'; error: FerretError | Error };

export function createSessionStore(client: FerretClient) {
	let state = $state<SessionState>({ status: 'loading' });

	async function check() {
		state = { status: 'loading' };
		try {
			const res: WhoamiResponse = await client.whoami();
			state = {
				status: 'authenticated',
				identity: res.session.identity,
				authenticatedAt: res.session.authenticated_at,
				expiresAt: res.session.expires_at
			};
		} catch (err) {
			if (err instanceof FerretError && (err.status === 401 || err.status === 403)) {
				state = { status: 'unauthenticated' };
			} else {
				state = { status: 'error', error: err instanceof Error ? err : new Error(String(err)) };
			}
		}
	}

	function setAuthenticated(identity: Identity, authenticatedAt: string, expiresAt: string) {
		state = { status: 'authenticated', identity, authenticatedAt, expiresAt };
	}

	function setUnauthenticated() {
		state = { status: 'unauthenticated' };
	}

	return {
		get state() {
			return state;
		},
		get isAuthenticated() {
			return state.status === 'authenticated';
		},
		get identity() {
			return state.status === 'authenticated' ? state.identity : null;
		},
		check,
		setAuthenticated,
		setUnauthenticated
	};
}

export type SessionStore = ReturnType<typeof createSessionStore>;
