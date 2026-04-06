import { FerretError } from './errors.js';
import type {
	FerretClientConfig,
	FerretErrorResponse,
	LoginInitResponse,
	LoginSubmitResponse,
	LoginMfaResponse,
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
	SecurityActivityResponse,
	DataExport,
	Identity
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

		const json = await res.json();

		if (!res.ok) {
			const errResponse = json as FerretErrorResponse;
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

	private del<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('DELETE', path, body);
	}


	// ─── Login ─────────────────────────────────────────────────────────────

	/** Create a new login flow. Returns flow_id, csrf_token, and UI schema. */
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

	/** Submit MFA verification during login (TOTP or recovery code). */
	submitLoginMfa(
		flowId: string,
		data:
			| { method: 'totp'; code: string; trust_device?: boolean; csrf_token: string }
			| { method: 'recovery_code'; code: string; csrf_token: string }
	): Promise<LoginMfaResponse> {
		return this.post(`/api/browser/self-service/login/${flowId}`, data);
	}

	/** Begin passkey authentication during MFA-required login. */
	beginPasskeyLogin(flowId: string): Promise<PasskeyLoginBeginResponse> {
		return this.post(`/api/browser/self-service/login/${flowId}/passkey/begin`);
	}

	/** Complete passkey authentication during MFA-required login. */
	completePasskeyLogin(
		flowId: string,
		credential: PublicKeyCredential
	): Promise<LoginMfaResponse> {
		return this.post(
			`/api/browser/self-service/login/${flowId}/passkey/complete`,
			credential
		);
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
	}): Promise<{ flow_id: string }> {
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

	/** Get current MFA status (methods, trusted devices). */
	getMfaStatus(): Promise<MfaStatusResponse> {
		return this.get('/api/browser/self-service/mfa');
	}

	/** Begin TOTP enrollment. Returns secret, QR code, and backup codes. */
	setupTotp(): Promise<TotpSetupResponse> {
		return this.post('/api/browser/self-service/mfa/totp/setup');
	}

	/** Verify TOTP setup with a code from the authenticator app. */
	verifyTotpSetup(code: string): Promise<TotpVerifyResponse> {
		return this.post('/api/browser/self-service/mfa/totp/setup/verify', { code });
	}

	/** Disable TOTP. Requires current password and a TOTP/recovery code. */
	disableTotp(data: {
		current_password: string;
		totp_code?: string;
		recovery_code?: string;
	}): Promise<void> {
		return this.del('/api/browser/self-service/mfa/totp', data);
	}

	/** Begin passkey (WebAuthn) registration. */
	beginPasskeyRegistration(): Promise<PasskeyBeginResponse> {
		return this.post('/api/browser/self-service/mfa/passkey/register/begin');
	}

	/** Complete passkey registration with the credential from the browser. */
	completePasskeyRegistration(credential: unknown): Promise<{ credential_id: string; device_name: string }> {
		return this.post('/api/browser/self-service/mfa/passkey/register/complete', credential);
	}

	/** List registered passkeys. */
	listPasskeys(): Promise<{ credentials: PasskeyCredential[] }> {
		return this.get('/api/browser/self-service/mfa/passkey');
	}

	/** Delete a passkey. Requires current password. */
	deletePasskey(credentialId: string, currentPassword: string): Promise<void> {
		return this.del(`/api/browser/self-service/mfa/passkey/${credentialId}`, {
			current_password: currentPassword
		});
	}

	/** Regenerate recovery codes. Requires current password. */
	regenerateRecoveryCodes(currentPassword: string): Promise<RecoveryCodesResponse> {
		return this.post('/api/browser/self-service/mfa/recovery-codes/regenerate', {
			current_password: currentPassword
		});
	}

	/** Remove a trusted device. */
	removeTrustedDevice(deviceId: string): Promise<void> {
		return this.del(`/api/browser/self-service/mfa/trusted-devices/${deviceId}`);
	}

	// ─── Social Login ──────────────────────────────────────────────────────

	/**
	 * Redirect to social login provider.
	 * This navigates the browser — call it from a click handler.
	 */
	socialLoginUrl(provider: string): string {
		return `${this.baseUrl}/api/browser/self-service/social/${provider}`;
	}

	/** List linked social accounts. */
	listSocialAccounts(): Promise<SocialAccountsResponse> {
		return this.get('/api/browser/self-service/social');
	}

	/** Unlink a social account. */
	unlinkSocialAccount(provider: string): Promise<void> {
		return this.del(`/api/browser/self-service/social/${provider}`);
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

	/** Download a data export by ID. */
	getDataExport(exportId: string): Promise<DataExport> {
		return this.get(`/api/browser/self-service/data-export/${exportId}`);
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
}
