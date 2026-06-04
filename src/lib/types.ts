// ─── Identity ────────────────────────────────────────────────────────────────

export interface Identity {
	id: string;
	email: string;
	username: string;
	given_name?: string;
	family_name?: string;
	email_verified: boolean;
	status: 'active' | 'suspended' | 'pending_deletion';
	created_at: string;
	updated_at: string;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface Session {
	id: string;
	identity: Identity;
	authenticated_at: string;
	expires_at: string;
	device_name?: string;
	ip_address?: string;
	user_agent?: string;
}

export interface WhoamiResponse {
	session: {
		id: string;
		identity: Identity;
		authenticated_at: string;
		expires_at: string;
	};
}

export interface SessionListResponse {
	sessions: Session[];
}

// ─── Flow ────────────────────────────────────────────────────────────────────

export type FlowStatus =
	| 'input_required'
	| 'mfa_required'
	| 'mfa_setup_required'
	| 'code_sent'
	| 'password_required'
	| 'success';

export interface FlowField {
	name: string;
	type: 'text' | 'password' | 'email' | 'hidden' | 'select';
	required: boolean;
	label?: string;
	pattern?: string;
	value?: string;
	options?: Array<{ value: string; label: string }>;
}

export interface FlowUI {
	method: string;
	action: string;
	fields: FlowField[];
}

export interface Flow {
	/** Flow identifier — backend returns this as `id` */
	id: string;
	csrf_token?: string;
	expires_at: string;
	status?: FlowStatus;
	ui: FlowUI;
}

// ─── Login ───────────────────────────────────────────────────────────────────

export interface LoginInitResponse extends Flow {}

export interface LoginSubmitResponse {
	session: {
		id: string;
		identity: Identity;
		authenticated_at: string;
		expires_at: string;
	};
	/** Set by client when backend signals MFA is needed */
	status?: FlowStatus;
	ui?: FlowUI;
	/**
	 * Second-factor methods this account can actually present, sent by the
	 * backend alongside `status: 'mfa_required'` so the login UI offers only
	 * enrolled options (e.g. `['totp', 'passkey']`, or with `'recovery_code'`
	 * when unused recovery codes remain). Absent on backends that don't supply
	 * it — callers should fall back to offering all methods.
	 */
	methods?: Array<'totp' | 'passkey' | 'recovery_code'>;
}

export interface LoginMfaResponse {
	identity: Identity;
	session_token?: string;
	expires_at?: string;
	remaining_codes?: number;
}

// ─── Registration ────────────────────────────────────────────────────────────

export interface RegistrationInitResponse extends Flow {}

export interface RegistrationSubmitResponse {
	session: {
		id: string;
		identity: Identity;
		authenticated_at: string;
		expires_at: string;
	};
}

// ─── Recovery ────────────────────────────────────────────────────────────────

export interface RecoveryInitResponse extends Flow {
	status: FlowStatus;
}

export interface RecoverySubmitResponse {
	status: FlowStatus;
	ui?: FlowUI;
	identity?: Identity;
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Response from creating a verification flow.
 *
 * NOTE: The backend `POST /api/browser/self-service/verification` endpoint does
 * NOT return a full `Flow` object (no `ui`, no `csrf_token`) — just a flow id,
 * the email the code was sent to, and a user-facing message. The SDK used to
 * model this as `Flow` but the runtime shape is minimal; keep the interface
 * aligned with reality so components don't read undefined fields.
 */
export interface VerificationInitResponse {
	flow_id: string;
	email: string;
	message?: string;
}

export interface VerificationSubmitResponse {
	status: string;
	user_id: string;
	/** Populated only when the caller resolves the identity client-side. */
	identity?: Identity;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface SettingsInitResponse extends Flow {}

export interface SettingsSubmitResponse {
	identity: Identity;
}

// ─── MFA ─────────────────────────────────────────────────────────────────────

export interface MfaMethod {
	type: 'totp' | 'webauthn' | 'recovery_codes';
	enabled: boolean;
	enrolled_at?: string;
	credentials_count?: number;
	remaining?: number;
}

export interface TrustedDevice {
	device_id: string;
	device_name: string;
	expires_at: string;
}

export interface MfaStatusResponse {
	enabled: boolean;
	methods: MfaMethod[];
	trusted_devices: TrustedDevice[];
}

export interface TotpSetupResponse {
	secret: string;
	uri: string;
	qr_svg: string;
	backup_codes: string[];
	ui: FlowUI;
}

export interface TotpVerifyResponse {
	enabled: boolean;
}

export interface PasskeyCredential {
	id: string;
	device_name: string;
	created_at: string;
	last_used_at?: string;
	backed_up: boolean;
}

/**
 * Response from the worker's `mfa/passkey/register/begin`: an opaque
 * `challenge_token` that must be echoed back to `register/complete`, plus
 * `options.publicKey` (webauthn-rs `CreationChallengeResponse`) ready to hand
 * to `navigator.credentials.create({ publicKey: options.publicKey })`.
 */
export interface PasskeyBeginResponse {
	challenge_token: string;
	options: {
		publicKey: {
			challenge: string;
			rp: { id: string; name: string };
			user: { id: string; name: string; displayName: string };
			pubKeyCredParams: Array<{ type: string; alg: number }>;
			authenticatorSelection?: {
				residentKey?: string;
				requireResidentKey?: boolean;
				userVerification?: string;
				authenticatorAttachment?: string;
			};
			timeout?: number;
			attestation?: string;
			excludeCredentials?: Array<{ type: string; id: string; transports?: string[] }>;
			extensions?: Record<string, unknown>;
		};
	};
}

/**
 * Response from the worker's login `passkey/begin` and `passkey/discover/begin`:
 * an opaque `challenge_token` to echo back to finish, plus a webauthn-rs
 * `RequestChallengeResponse` under `options.publicKey` for
 * `navigator.credentials.get({ publicKey: options.publicKey })`. The discover
 * variant adds a top-level `mediation: 'conditional'` hint.
 */
export interface PasskeyLoginBeginResponse {
	challenge_token: string;
	options: {
		publicKey: {
			challenge: string;
			allowCredentials?: Array<{ type: string; id: string; transports?: string[] }>;
			timeout?: number;
			userVerification?: string;
			rpId?: string;
			extensions?: Record<string, unknown>;
		};
		mediation?: string;
	};
}

export interface RecoveryCodesResponse {
	codes: string[];
}

// ─── Social Login ────────────────────────────────────────────────────────────

export interface SocialAccount {
	provider: string;
	provider_user_id: string;
	email: string;
	linked_at: string;
}

export interface SocialAccountsResponse {
	accounts: SocialAccount[];
}

/**
 * Result of the social-login return trip. The backend redirects back to the
 * app with `?ferret_status=...`; this captures the three meaningful branches:
 * authenticated, MFA still required, or anything else (error / missing).
 */
export type SocialLoginCompletion =
	| { kind: 'ok'; session: WhoamiResponse['session'] }
	| { kind: 'mfa_required' }
	| { kind: 'error'; status: string | null };

// ─── GDPR ────────────────────────────────────────────────────────────────────

export interface DataExport {
	export_id: string;
	status: 'pending' | 'ready' | 'expired';
	created_at: string;
	expires_at?: string;
}

// ─── Security Activity ──────────────────────────────────────────────────────

export interface SecurityEvent {
	type: string;
	ip_address?: string;
	user_agent?: string;
	created_at: string;
	details?: Record<string, unknown>;
}

export interface SecurityActivityResponse {
	events: SecurityEvent[];
	cursor?: string;
}

// ─── Personal Access Tokens ─────────────────────────────────────────────────

export interface PersonalAccessToken {
	id: string;
	name: string;
	scopes: string[];
	last_used_at?: string | null;
	created_at: string;
	expires_at?: string | null;
}

export interface TokenListResponse {
	tokens: PersonalAccessToken[];
}

export interface TokenCreateResponse extends PersonalAccessToken {
	/** Plain-text token. Returned ONCE on creation; never readable again. */
	token: string;
}

// ─── Notification Preferences ───────────────────────────────────────────────

export interface NotificationPreferenceItem {
	key: string;
	label: string;
	description?: string;
}

export interface NotificationPreferenceCategory {
	key: string;
	label: string;
	items: NotificationPreferenceItem[];
}

export interface NotificationPreferences {
	categories: NotificationPreferenceCategory[];
	values: Record<string, boolean>;
}

// ─── OAuth Grants (Connected Apps) ──────────────────────────────────────────

export interface OAuthGrant {
	client_id: string;
	client_name: string;
	client_logo_url?: string | null;
	scopes: string[];
	granted_at: string;
	last_used_at?: string | null;
}

export interface OAuthGrantsResponse {
	grants: OAuthGrant[];
}

// ─── Error ───────────────────────────────────────────────────────────────────

export interface FieldError {
	field: string;
	code: string;
	message: string;
	i18n_key: string;
	params?: Record<string, unknown>;
}

export interface FerretErrorBody {
	code: string;
	message: string;
	// Optional on the wire: older worker deploys send only `{code, message}`.
	// `FerretError` derives a fallback key from `code` when these are absent.
	i18n_key?: string;
	status?: number;
	details?: FieldError[];
	retry_after?: number;
}

export interface FerretErrorResponse {
	error: FerretErrorBody;
}

// ─── Client Config ───────────────────────────────────────────────────────────

export interface FerretClientConfig {
	baseUrl: string;
	/** Custom fetch function (defaults to window.fetch) */
	fetch?: typeof fetch;
}
