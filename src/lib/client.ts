import { FerretError } from './errors.js';
import { b64ToBytes, bytesToB64 } from './webauthn.js';
import type {
	FerretClientConfig,
	FerretErrorResponse,
	LoginInitResponse,
	LoginSubmitResponse,
	LoginMfaResponse,
	QrLoginCreateResponse,
	QrLoginPollResponse,
	RegistrationInitResponse,
	RegistrationSubmitResponse,
	RecoveryInitResponse,
	RecoverySubmitResponse,
	VerificationInitResponse,
	VerificationSubmitResponse,
	SettingsInitResponse,
	SettingsSubmitResponse,
	WhoamiResponse,
	SessionListResponse,
	MfaStatusResponse,
	TotpSetupResponse,
	TotpVerifyResponse,
	PasskeyBeginResponse,
	PasskeyCredential,
	PasskeyLoginBeginResponse,
	RecoveryCodesResponse,
	SocialAccountsResponse,
	SocialLoginCompletion,
	SecurityActivityResponse,
	DataExport,
	Identity,
	TokenListResponse,
	TokenCreateResponse,
	NotificationPreferences,
	OAuthGrantsResponse,
	AttributesResponse
} from './types.js';

/**
 * Ferret Browser API client.
 *
 * Wraps all `/api/browser/*` endpoints. Session is managed via HttpOnly cookies
 * (automatically handled by the browser). CSRF tokens are included in flow
 * responses and must be submitted back with mutations.
 */
export class FerretClient {
	private readonly baseUrl: string;
	private readonly _fetch: typeof fetch;

	/**
	 * The single in-flight `navigator.credentials.get()` request, if any. The
	 * WebAuthn spec allows only one outstanding `get()` per page; a second one
	 * throws "A request is already pending". The background conditional-mediation
	 * autofill (`startConditionalPasskeyLogin`) stays pending for the life of the
	 * login page, so an explicit passkey request fired afterwards (e.g. the MFA
	 * second factor) would collide. We track the live request here and abort it
	 * before starting a new one — last-write-wins.
	 */
	private inFlightWebAuthn?: AbortController;

	/**
	 * Called once per response when the backend returns 401. Used by
	 * FerretProvider to flip the session store to "unauthenticated" globally
	 * so any expired-session 401 surfaces in the auth guard regardless of
	 * which page fired the original request.
	 */
	onUnauthorized?: () => void;

	constructor(config: FerretClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, '');
		this._fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
	}

	// ─── Internal helpers ──────────────────────────────────────────────────

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const headers: Record<string, string> = {};

		if (body !== undefined) {
			headers['Content-Type'] = 'application/json';
		}

		const res = await this._fetch(url, {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			credentials: 'include'
		});

		if (res.status === 204) {
			return undefined as T;
		}

		// Surface non-JSON responses (e.g. backend deserialization errors that
		// come back as text/plain) as readable FerretError instead of letting
		// res.json() throw an opaque SyntaxError.
		const contentType = res.headers.get('content-type') ?? '';
		if (!contentType.toLowerCase().includes('application/json')) {
			if (res.ok) return undefined as T;
			const text = await res.text().catch(() => '');
			throw new FerretError({
				code: 'invalid_response',
				i18n_key: 'error.internal',
				message: text || `HTTP ${res.status}`,
				status: res.status
			});
		}

		const json = await res.json();

		if (!res.ok) {
			const errResponse = json as FerretErrorResponse;
			// Only treat session/token-invalidation codes as global unauth — a
			// 401 from e.g. wrong-password on email change is domain-specific
			// and should surface as a normal flow error, not a logout.
			if (
				res.status === 401 &&
				/^(session|token)_/i.test(errResponse.error?.code ?? '')
			) {
				this.onUnauthorized?.();
			}
			throw new FerretError(errResponse.error);
		}

		return json as T;
	}

	private get<T>(path: string): Promise<T> {
		return this.request<T>('GET', path);
	}

	private post<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('POST', path, body);
	}

	private put<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('PUT', path, body);
	}

	private del<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('DELETE', path, body);
	}


	// ─── Login ─────────────────────────────────────────────────────────────

	/** Create a new login flow. Returns id, csrf_token, and UI schema. */
	createLoginFlow(): Promise<LoginInitResponse> {
		return this.post('/api/browser/self-service/login');
	}

	/** Submit login credentials (identifier + password + csrf_token). */
	submitLogin(
		flowId: string,
		data: { identifier: string; password: string; csrf_token: string }
	): Promise<LoginSubmitResponse> {
		return this.post(`/api/browser/self-service/login/${flowId}`, data);
	}

	/**
	 * Submit MFA verification during login (TOTP or recovery code).
	 *
	 * Note: there is no browser `trust_device` option — trusted devices are a
	 * native-only feature (the worker's browser MFA submit has no such field and
	 * `GET /mfa` always reports zero trusted devices on this path).
	 */
	submitLoginMfa(
		flowId: string,
		data:
			| { method: 'totp'; code: string; csrf_token: string }
			| { method: 'recovery_code'; code: string; csrf_token: string }
	): Promise<LoginMfaResponse> {
		return this.post(`/api/browser/self-service/login/${flowId}/mfa`, data);
	}

	/**
	 * Create a cross-device QR login request. Render `qr_svg`, keep
	 * `poll_token` private to this page, and call {@link pollQrLogin} every
	 * `poll_interval_ms` until it returns a terminal status. The QR is valid
	 * for ~3 minutes (`expires_at`); create a fresh one after that.
	 */
	createQrLoginFlow(): Promise<QrLoginCreateResponse> {
		return this.post('/api/browser/self-service/login/qr');
	}

	/**
	 * Poll a QR login request. On `authorized` the backend has already set the
	 * session cookie and the response carries the session. Throws `FerretError`
	 * with `flow_expired` once the request times out, or `flow_not_found` when
	 * it was already consumed / never existed (anti-enumeration: those are
	 * indistinguishable by design).
	 */
	pollQrLogin(pollToken: string): Promise<QrLoginPollResponse> {
		return this.post('/api/browser/self-service/login/qr/poll', { poll_token: pollToken });
	}

	/**
	 * Begin a scoped login-time passkey assertion. Pass `identifier` to do a
	 * first-factor passkey login for a known account, or call with just the
	 * flow id when passkey is the second factor on an in-progress flow.
	 * Returns a `challenge_token` to pass to {@link finishPasskeyLogin}.
	 */
	beginPasskeyLogin(flowId: string, identifier?: string): Promise<PasskeyLoginBeginResponse> {
		return this.post(
			`/api/browser/self-service/login/${flowId}/passkey/begin`,
			identifier ? { identifier } : {}
		);
	}

	/** Finish a scoped login-time passkey assertion. Establishes the session. */
	finishPasskeyLogin(
		flowId: string,
		challengeToken: string,
		credential: Record<string, unknown>
	): Promise<LoginSubmitResponse> {
		return this.post(`/api/browser/self-service/login/${flowId}/passkey/finish`, {
			challenge_token: challengeToken,
			credential
		});
	}

	/**
	 * Drive a passkey assertion as the SECOND factor on an in-progress login
	 * flow that returned `mfa_required` (the user already passed the password
	 * step). begin → `navigator.credentials.get` → finish; the session is
	 * established on success. Returns `null` if the user dismisses the prompt
	 * (so the UI can stay on the MFA screen). Backend errors still throw.
	 */
	async verifyPasskeyMfa(
		flowId: string,
		options: { signal?: AbortSignal } = {}
	): Promise<LoginSubmitResponse | null> {
		if (typeof window === 'undefined') return null;
		const begin = await this.beginPasskeyLogin(flowId);
		const assertion = await this.getAssertion(begin, undefined, options.signal);
		if (!assertion) return null;
		return this.finishPasskeyLogin(flowId, begin.challenge_token, assertion);
	}

	/** Begin a discoverable (resident-key) passkey login — no identifier needed. */
	beginDiscoverablePasskeyLogin(flowId: string): Promise<PasskeyLoginBeginResponse> {
		return this.post(`/api/browser/self-service/login/${flowId}/passkey/discover/begin`);
	}

	/** Finish a discoverable passkey login. Establishes the session. */
	finishDiscoverablePasskeyLogin(
		flowId: string,
		challengeToken: string,
		credential: Record<string, unknown>
	): Promise<LoginSubmitResponse> {
		return this.post(`/api/browser/self-service/login/${flowId}/passkey/discover/finish`, {
			challenge_token: challengeToken,
			credential
		});
	}

	/** Serialize a WebAuthn assertion (`navigator.credentials.get`) for the wire. */
	private serializeAssertion(credential: PublicKeyCredential): Record<string, unknown> {
		const response = credential.response as AuthenticatorAssertionResponse;
		return {
			id: credential.id,
			rawId: bytesToB64(credential.rawId),
			type: credential.type,
			response: {
				authenticatorData: bytesToB64(response.authenticatorData),
				clientDataJSON: bytesToB64(response.clientDataJSON),
				signature: bytesToB64(response.signature),
				userHandle: response.userHandle ? bytesToB64(response.userHandle) : null
			}
		};
	}

	/**
	 * Drive a discoverable passkey login through the discover/begin → get →
	 * discover/finish dance. `mediation: 'conditional'` powers autofill UI;
	 * `'optional'` (the default) shows the modal account picker. Returns `null`
	 * when the user dismisses the prompt or the abort signal fires; backend
	 * errors still throw (`FerretError`) so callers can surface them.
	 */
	/**
	 * Build the request options from a begin response, prompt the authenticator
	 * (`navigator.credentials.get`), and serialize the assertion for the wire.
	 * Shared by discoverable login and second-factor MFA. Returns `null` when the
	 * user dismisses the prompt or the abort signal fires; other errors throw.
	 */
	private async getAssertion(
		begin: PasskeyLoginBeginResponse,
		mediation: CredentialMediationRequirement | undefined,
		signal?: AbortSignal
	): Promise<Record<string, unknown> | null> {
		const opts = begin.options.publicKey;
		const publicKey: PublicKeyCredentialRequestOptions = {
			challenge: b64ToBytes(opts.challenge).buffer as ArrayBuffer,
			allowCredentials: (opts.allowCredentials ?? []).map((c) => ({
				type: c.type as 'public-key',
				id: b64ToBytes(c.id).buffer as ArrayBuffer,
				transports: c.transports as AuthenticatorTransport[] | undefined
			})),
			timeout: opts.timeout,
			userVerification: opts.userVerification as UserVerificationRequirement | undefined,
			rpId: opts.rpId
		};

		// Only one WebAuthn get() may be outstanding at a time. Abort whatever is
		// still pending (typically the background conditional autofill) so this
		// request — e.g. an explicit MFA passkey — doesn't hit "A request is
		// already pending". Chain the caller's own signal into ours.
		this.inFlightWebAuthn?.abort();
		const controller = new AbortController();
		this.inFlightWebAuthn = controller;
		const forwardAbort = () => controller.abort();
		if (signal) {
			if (signal.aborted) controller.abort();
			else signal.addEventListener('abort', forwardAbort, { once: true });
		}

		let credential: PublicKeyCredential | null;
		try {
			credential = (await navigator.credentials.get({
				publicKey,
				mediation,
				signal: controller.signal
			} as CredentialRequestOptions)) as PublicKeyCredential | null;
		} catch (err) {
			if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
				return null;
			}
			throw err;
		} finally {
			signal?.removeEventListener('abort', forwardAbort);
			if (this.inFlightWebAuthn === controller) this.inFlightWebAuthn = undefined;
		}
		if (!credential) return null;
		return this.serializeAssertion(credential);
	}

	private async runDiscoverablePasskeyLogin(
		mediation: 'optional' | 'conditional',
		signal?: AbortSignal
	): Promise<LoginSubmitResponse | null> {
		if (typeof window === 'undefined') return null;

		const flow = await this.createLoginFlow();
		const begin = await this.beginDiscoverablePasskeyLogin(flow.id);
		const assertion = await this.getAssertion(begin, mediation, signal);
		if (!assertion) return null;

		return this.finishDiscoverablePasskeyLogin(flow.id, begin.challenge_token, assertion);
	}

	/**
	 * Best-effort probe for whether a discoverable-passkey sign-in is worth
	 * offering on this device. Returns `true` when the browser exposes WebAuthn
	 * *and* either a platform authenticator (Touch ID / Windows Hello / Android)
	 * or conditional mediation is available — i.e. the "Sign in with a passkey"
	 * button has a realistic chance of working. Returns `false` on
	 * non-browser/SSR, unsupported browsers, or when both probes are
	 * false/throw. Note: this reports *capability*, not whether a credential is
	 * actually registered — that can't be known without prompting.
	 */
	async isPasskeyLoginAvailable(): Promise<boolean> {
		if (typeof window === 'undefined') return false;
		const PKC = (window as unknown as { PublicKeyCredential?: typeof PublicKeyCredential })
			.PublicKeyCredential;
		if (!PKC) return false;
		const probe = async (name: 'isUserVerifyingPlatformAuthenticatorAvailable' | 'isConditionalMediationAvailable') => {
			const fn = (PKC as unknown as Record<string, unknown>)[name];
			if (typeof fn !== 'function') return false;
			try {
				return (await (fn as () => Promise<boolean>).call(PKC)) === true;
			} catch {
				return false;
			}
		};
		const [platform, conditional] = await Promise.all([
			probe('isUserVerifyingPlatformAuthenticatorAvailable'),
			probe('isConditionalMediationAvailable')
		]);
		return platform || conditional;
	}

	/**
	 * Explicit "Sign in with a passkey" — shows the platform's modal account
	 * picker (discoverable credentials, no identifier required). Returns `null`
	 * if the user dismisses the prompt.
	 */
	signInWithPasskey(options: { signal?: AbortSignal } = {}): Promise<LoginSubmitResponse | null> {
		return this.runDiscoverablePasskeyLogin('optional', options.signal);
	}

	/**
	 * Conditional-mediation passkey login (autofill UI on the identifier field).
	 * Best-effort: returns `null` if the browser doesn't support conditional
	 * mediation, the user cancels, or the abort signal fires. For the autofill
	 * UI to appear, an input with `autocomplete="username webauthn"` must be
	 * present (the SDK `LoginFlow`/`FlowForm` set this on the identifier field).
	 *
	 * ```ts
	 * const abort = new AbortController();
	 * onMount(() => {
	 *   client.startConditionalPasskeyLogin({ signal: abort.signal })
	 *     .then((res) => res && goto('/'));
	 *   return () => abort.abort();
	 * });
	 * ```
	 */
	async startConditionalPasskeyLogin(
		options: { signal?: AbortSignal } = {}
	): Promise<LoginSubmitResponse | null> {
		if (typeof window === 'undefined') return null;
		const PKC = (window as unknown as { PublicKeyCredential?: typeof PublicKeyCredential })
			.PublicKeyCredential;
		if (!PKC || typeof PKC.isConditionalMediationAvailable !== 'function') return null;
		try {
			if (!(await PKC.isConditionalMediationAvailable())) return null;
		} catch {
			return null;
		}
		return this.runDiscoverablePasskeyLogin('conditional', options.signal);
	}

	// ─── Registration ──────────────────────────────────────────────────────

	/** Create a new registration flow. */
	createRegistrationFlow(): Promise<RegistrationInitResponse> {
		return this.post('/api/browser/self-service/registration');
	}

	/** Submit registration form. */
	submitRegistration(
		flowId: string,
		data: {
			email: string;
			username: string;
			password: string;
			csrf_token: string;
			given_name?: string;
			family_name?: string;
		}
	): Promise<RegistrationSubmitResponse> {
		return this.post(`/api/browser/self-service/registration/${flowId}`, data);
	}

	// ─── Logout ────────────────────────────────────────────────────────────

	/** Logout the current session. Clears the session cookie. */
	logout(csrfToken: string): Promise<void> {
		return this.post('/api/browser/self-service/logout', { csrf_token: csrfToken });
	}

	// ─── Session ───────────────────────────────────────────────────────────

	/** Get current session and identity (whoami). */
	whoami(): Promise<WhoamiResponse> {
		return this.get('/api/browser/sessions/whoami');
	}

	/** List all active sessions for the current user. */
	listSessions(): Promise<SessionListResponse> {
		return this.get('/api/browser/sessions');
	}

	/** Revoke a specific session by ID. */
	revokeSession(sessionId: string, csrfToken: string): Promise<void> {
		return this.del(`/api/browser/sessions/${sessionId}`, { csrf_token: csrfToken });
	}

	// ─── Settings ──────────────────────────────────────────────────────────

	/** Create a new settings flow (profile or password change). */
	createSettingsFlow(): Promise<SettingsInitResponse> {
		return this.post('/api/browser/self-service/settings');
	}

	/** Submit settings change (password or profile). */
	submitSettings(
		flowId: string,
		data:
			| { csrf_token: string; password: { current: string; new: string } }
			| { csrf_token: string; profile: Record<string, unknown> }
	): Promise<SettingsSubmitResponse> {
		return this.post(`/api/browser/self-service/settings/${flowId}`, data);
	}

	// ─── Recovery ──────────────────────────────────────────────────────────

	/** Initiate password recovery. Sends a code to the email. */
	createRecoveryFlow(email: string): Promise<RecoveryInitResponse> {
		return this.post('/api/browser/self-service/recovery', { email });
	}

	/** Submit recovery code or new password. */
	submitRecovery(
		flowId: string,
		data:
			| { code: string; csrf_token: string }
			| { password: string; csrf_token: string }
	): Promise<RecoverySubmitResponse> {
		return this.post(`/api/browser/self-service/recovery/${flowId}`, data);
	}

	// ─── Email Verification ────────────────────────────────────────────────

	/** Create an email verification flow. Requires active session. */
	createVerificationFlow(): Promise<VerificationInitResponse> {
		return this.post('/api/browser/self-service/verification');
	}

	/** Submit the verification code. */
	submitVerification(
		flowId: string,
		data: { code: string; csrf_token: string }
	): Promise<VerificationSubmitResponse> {
		return this.post(`/api/browser/self-service/verification/${flowId}`, data);
	}

	// ─── Email Change ──────────────────────────────────────────────────────

	/** Initiate email change. Sends verification code to the new email. */
	createEmailChange(data: {
		email: string;
		current_password: string;
		csrf_token: string;
	}): Promise<{ id: string }> {
		return this.post('/api/browser/self-service/settings/email', data);
	}

	/** Submit email change verification code. */
	submitEmailChange(
		flowId: string,
		data: { code: string; csrf_token: string }
	): Promise<{ identity: Identity }> {
		return this.post(`/api/browser/self-service/settings/email/${flowId}`, data);
	}

	// ─── MFA ───────────────────────────────────────────────────────────────

	/** Get current MFA status (methods, mfa_level). */
	getMfaStatus(): Promise<MfaStatusResponse> {
		return this.get('/api/browser/self-service/mfa');
	}

	/**
	 * Set the per-user MFA requirement (the "xfa" policy level):
	 * `1` = password only, `2` = password + one second factor, `3` = + two
	 * distinct factors. Session-gated on the browser path (no password needed).
	 * Throws if `level` exceeds what the account's enrolled factors can satisfy
	 * (`1 + enrolled factors`, capped at 3) — enroll a factor before raising it.
	 */
	setMfaLevel(level: number): Promise<void> {
		return this.put('/api/browser/self-service/mfa/level', { level });
	}

	/** Begin TOTP enrollment. Returns secret, QR code, and backup codes. */
	setupTotp(csrfToken?: string): Promise<TotpSetupResponse> {
		return this.post('/api/browser/self-service/mfa/totp/setup', csrfToken ? { csrf_token: csrfToken } : undefined);
	}

	/** Verify TOTP setup with a code from the authenticator app. */
	verifyTotpSetup(code: string, csrfToken: string): Promise<TotpVerifyResponse> {
		return this.post('/api/browser/self-service/mfa/totp/setup/verify', { code, csrf_token: csrfToken });
	}

	/** Disable TOTP. Requires current password, a TOTP/recovery code, and CSRF token. */
	disableTotp(data: {
		current_password: string;
		csrf_token: string;
		totp_code?: string;
		recovery_code?: string;
	}): Promise<void> {
		return this.del('/api/browser/self-service/mfa/totp', data);
	}

	/** Begin passkey (WebAuthn) registration. Returns a `challenge_token` that
	 * must be passed back to {@link completePasskeyRegistration}. */
	beginPasskeyRegistration(deviceName?: string): Promise<PasskeyBeginResponse> {
		return this.post(
			'/api/browser/self-service/mfa/passkey/register/begin',
			deviceName ? { device_name: deviceName } : {}
		);
	}

	/** Complete passkey registration with the credential from the browser and
	 * the `challenge_token` from {@link beginPasskeyRegistration}. */
	completePasskeyRegistration(
		challengeToken: string,
		credential: unknown,
		deviceName?: string
	): Promise<{ credential_id: string; device_name: string | null; created_at: string }> {
		return this.post('/api/browser/self-service/mfa/passkey/register/complete', {
			challenge_token: challengeToken,
			credential,
			...(deviceName ? { device_name: deviceName } : {})
		});
	}

	/** List registered passkeys. */
	listPasskeys(): Promise<{ credentials: PasskeyCredential[] }> {
		return this.get('/api/browser/self-service/mfa/passkey');
	}

	/** Delete a passkey. Requires the account password to re-authorize. */
	deletePasskey(credentialId: string, currentPassword: string): Promise<void> {
		return this.del(`/api/browser/self-service/mfa/passkey/${credentialId}`, {
			current_password: currentPassword
		});
	}

	/** Regenerate recovery codes. Requires current password and CSRF token. */
	regenerateRecoveryCodes(currentPassword: string, csrfToken: string): Promise<RecoveryCodesResponse> {
		return this.post('/api/browser/self-service/mfa/recovery-codes/regenerate', {
			current_password: currentPassword,
			csrf_token: csrfToken
		});
	}

	// ─── Social Login ──────────────────────────────────────────────────────

	/**
	 * URL that starts a social *login* (Mode B / full-page redirect).
	 *
	 * Backend completes the OAuth dance and 303s back to `returnTo` with a
	 * `ferret_status` query param (`ok`, `mfa_required`, or an error code).
	 * Use the returned string from a click handler:
	 *
	 * ```ts
	 * window.location.href = client.socialLoginUrl('google', `${origin}/login/oauth-done`);
	 * ```
	 */
	socialLoginUrl(provider: string, returnTo?: string): string {
		const path = `/api/browser/self-service/login/social/${provider}`;
		if (!returnTo) return `${this.baseUrl}${path}`;
		return `${this.baseUrl}${path}?return_to=${encodeURIComponent(returnTo)}`;
	}

	/**
	 * URL that starts *linking* a social account to the current session.
	 * Requires an authenticated session — anonymous callers should use
	 * `socialLoginUrl` instead.
	 */
	socialLinkUrl(provider: string, returnTo?: string): string {
		const path = `/api/browser/self-service/social/${provider}`;
		if (!returnTo) return `${this.baseUrl}${path}`;
		return `${this.baseUrl}${path}?return_to=${encodeURIComponent(returnTo)}`;
	}

	/** List linked social accounts. */
	listSocialAccounts(): Promise<SocialAccountsResponse> {
		return this.get('/api/browser/self-service/social');
	}

	/** Unlink a social account. Requires CSRF token. */
	unlinkSocialAccount(provider: string, csrfToken: string): Promise<void> {
		return this.del(`/api/browser/self-service/social/${provider}`, { csrf_token: csrfToken });
	}

	/**
	 * Inspect the `ferret_status` returned to the social-login `return_to`
	 * URL and finish the trip. On `ok`, calls whoami so the caller can hydrate
	 * its session store without a second round-trip.
	 *
	 * ```ts
	 * const result = await client.completeSocialLogin(new URLSearchParams(location.search));
	 * if (result.kind === 'ok') session.setAuthenticated(result.session.identity, ...);
	 * ```
	 */
	async completeSocialLogin(params: URLSearchParams | string): Promise<SocialLoginCompletion> {
		const sp = typeof params === 'string' ? new URLSearchParams(params) : params;
		const status = sp.get('ferret_status');
		if (status === 'ok') {
			const who = await this.whoami();
			return { kind: 'ok', session: who.session };
		}
		if (status === 'mfa_required') {
			return { kind: 'mfa_required' };
		}
		return { kind: 'error', status };
	}

	// ─── GDPR ──────────────────────────────────────────────────────────────

	/** Schedule account deletion. */
	deleteAccount(csrfToken: string): Promise<void> {
		return this.post('/api/browser/self-service/account/delete', { csrf_token: csrfToken });
	}

	/** Cancel a pending account deletion (within grace period). */
	cancelAccountDeletion(csrfToken: string): Promise<void> {
		return this.post('/api/browser/self-service/account/cancel-deletion', {
			csrf_token: csrfToken
		});
	}

	/** Request a data export (GDPR). */
	createDataExport(): Promise<DataExport> {
		return this.post('/api/browser/self-service/data-export');
	}

	/** Get data export status by ID. */
	getDataExport(exportId: string): Promise<DataExport> {
		return this.get(`/api/browser/self-service/data-export/${exportId}`);
	}

	/** Get the download URL for a ready data export. */
	getDataExportDownloadUrl(exportId: string): string {
		return `${this.baseUrl}/api/browser/self-service/data-export/${exportId}/download`;
	}

	// ─── Security Activity ─────────────────────────────────────────────────

	/** Get security activity log for the current user. */
	getSecurityActivity(params?: {
		type?: string;
		since?: string;
		until?: string;
		limit?: number;
		cursor?: string;
	}): Promise<SecurityActivityResponse> {
		const query = new URLSearchParams();
		if (params?.type) query.set('type', params.type);
		if (params?.since) query.set('since', params.since);
		if (params?.until) query.set('until', params.until);
		if (params?.limit) query.set('limit', String(params.limit));
		if (params?.cursor) query.set('cursor', params.cursor);
		const qs = query.toString();
		return this.get(`/api/browser/self-service/security-activity${qs ? `?${qs}` : ''}`);
	}

	// ─── Health ────────────────────────────────────────────────────────────

	/** Check server health. */
	health(): Promise<{ status: string; db: string; valkey: string }> {
		return this.get('/health');
	}

	// ─── Personal Access Tokens ────────────────────────────────────────────

	/** List the current user's personal access tokens (metadata only). */
	listTokens(): Promise<TokenListResponse> {
		return this.get('/api/browser/self-service/tokens');
	}

	/**
	 * Create a personal access token. The plain-text `token` field is returned
	 * exactly once in this response; subsequent reads never include it.
	 */
	createToken(
		name: string,
		scopes: string[],
		expiresInDays: number | null,
		csrfToken: string
	): Promise<TokenCreateResponse> {
		return this.post('/api/browser/self-service/tokens', {
			csrf_token: csrfToken,
			name,
			scopes,
			expires_in_days: expiresInDays
		});
	}

	/** Revoke a personal access token by id. */
	revokeToken(id: string, csrfToken: string): Promise<void> {
		return this.del(`/api/browser/self-service/tokens/${id}`, { csrf_token: csrfToken });
	}

	// ─── Notification Preferences ──────────────────────────────────────────

	/** Get the current user's email notification preferences. */
	getNotificationPreferences(): Promise<NotificationPreferences> {
		return this.get('/api/browser/self-service/notification-preferences');
	}

	/** Replace the user's notification preference values. */
	updateNotificationPreferences(
		values: Record<string, boolean>,
		csrfToken: string
	): Promise<void> {
		return this.put('/api/browser/self-service/notification-preferences', {
			csrf_token: csrfToken,
			values
		});
	}

	// ─── OAuth Grants (Connected Apps) ─────────────────────────────────────

	/** List third-party OAuth clients with active grants on this account. */
	listOAuthGrants(): Promise<OAuthGrantsResponse> {
		return this.get('/api/browser/self-service/oauth-grants');
	}

	/** Revoke a specific OAuth client's access. */
	revokeOAuthGrant(clientId: string, csrfToken: string): Promise<void> {
		return this.del(`/api/browser/self-service/oauth-grants/${clientId}`, {
			csrf_token: csrfToken
		});
	}

	// ─── Custom Attributes ─────────────────────────────────────────────────

	/**
	 * Get the caller's custom attributes (name → value map), filtered to the
	 * schemas marked user- or public-readable. Requires an authenticated session.
	 */
	getAttributes(): Promise<AttributesResponse> {
		return this.get('/api/browser/self-service/attributes');
	}

	/**
	 * Set one or more user-writable custom attributes. Values must satisfy each
	 * attribute's schema; writing an unknown or non-user-writable attribute is
	 * rejected. Returns the updated, readable-filtered map. No CSRF token — the
	 * browser path is gated on the session cookie alone.
	 */
	updateAttributes(attributes: Record<string, unknown>): Promise<AttributesResponse> {
		return this.put('/api/browser/self-service/attributes', { attributes });
	}

	// ─── Magic Link ────────────────────────────────────────────────────────

	/**
	 * Start a magic-link login flow. Always resolves successfully (the backend
	 * returns 202 regardless of whether the email exists, to avoid leaking
	 * account existence).
	 */
	async createMagicLinkFlow(email: string, returnTo?: string): Promise<void> {
		const body: Record<string, string> = { email };
		if (returnTo) body.return_to = returnTo;
		try {
			await this.post('/api/browser/self-service/login/magic', body);
		} catch {
			// Swallow: response status is a security signal; callers must
			// always render the neutral "if an account exists..." message.
		}
	}
}
