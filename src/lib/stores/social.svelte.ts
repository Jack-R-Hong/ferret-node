import type { FerretClient } from '../client.js';
import type { SessionStore } from './session.svelte.js';

/** UI phase for a social-login attempt. */
export type SocialLoginState = 'idle' | 'loading' | 'mfa_required' | 'error';

/** Outcome of inspecting the provider's return trip. `none` means there was no
 *  `ferret_status` on the URL (a normal page visit, not a return). */
export type SocialReturnKind = 'ok' | 'mfa_required' | 'error' | 'none';

/**
 * Headless social-login logic, shared by the `<SocialLogin>` component and any
 * app that wants to keep its own buttons. Mirrors `createSessionStore` /
 * `createFlowStore`: holds reactive `$state`, takes its deps explicitly.
 *
 *   const social = createSocialLoginStore(getFerretClient(), getFerretSession());
 *   onMount(async () => { if (await social.complete() === 'ok') goto('/account'); });
 *   <button onclick={() => social.start('google', origin + '/login')}>…</button>
 */
export function createSocialLoginStore(client: FerretClient, session: SessionStore) {
	let state = $state<SocialLoginState>('idle');
	let errorStatus = $state<string | null>(null);

	/**
	 * Begin login: full-page navigation to the provider's begin endpoint. Not a
	 * fetch — the browser must follow the 302 to the provider so cookies + the
	 * top-level redirect chain work.
	 */
	function start(provider: string, returnTo: string) {
		state = 'loading';
		window.location.href = client.socialLoginUrl(provider, returnTo);
	}

	/**
	 * Inspect `ferret_status` (from `search`, defaulting to the current URL) and
	 * finish the round-trip. On `ok`, confirms with the backend via
	 * `completeSocialLogin` and hydrates the session store. Returns the resolved
	 * kind so the caller can route (e.g. `goto('/account')`).
	 */
	async function complete(search?: string): Promise<SocialReturnKind> {
		const raw = search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const params = new URLSearchParams(raw);
		const status = params.get('ferret_status');
		if (status === null) return 'none';
		if (status === 'mfa_required') {
			state = 'mfa_required';
			return 'mfa_required';
		}
		if (status !== 'ok') {
			errorStatus = status;
			state = 'error';
			return 'error';
		}

		state = 'loading';
		try {
			const result = await client.completeSocialLogin(params);
			if (result.kind === 'ok') {
				session.setAuthenticated(
					result.session.identity,
					result.session.authenticated_at,
					result.session.expires_at
				);
				// Stay 'loading' so the UI doesn't flash buttons before the
				// caller navigates away on the returned 'ok'.
				return 'ok';
			}
			if (result.kind === 'mfa_required') {
				state = 'mfa_required';
				return 'mfa_required';
			}
			errorStatus = result.status;
			state = 'error';
			return 'error';
		} catch {
			errorStatus = null;
			state = 'error';
			return 'error';
		}
	}

	function reset() {
		state = 'idle';
		errorStatus = null;
	}

	return {
		get state() {
			return state;
		},
		get errorStatus() {
			return errorStatus;
		},
		get isLoading() {
			return state === 'loading';
		},
		start,
		complete,
		reset
	};
}

export type SocialLoginStore = ReturnType<typeof createSocialLoginStore>;
