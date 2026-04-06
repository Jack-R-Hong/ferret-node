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
	identity: Identity;
	authenticated_at: string;
	expires_at: string;
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
	flow_id: string;
	csrf_token?: string;
	expires_at: string;
	status?: FlowStatus;
	ui: FlowUI;
}

// ─── Login ───────────────────────────────────────────────────────────────────

export interface LoginInitResponse extends Flow {}

export interface LoginSubmitResponse {
	status?: FlowStatus;
	identity: Identity;
	ui?: FlowUI;
}

export interface LoginMfaResponse {
	identity: Identity;
	session_token?: string;
	remaining_codes?: number;
}

// ─── Registration ────────────────────────────────────────────────────────────

export interface RegistrationInitResponse extends Flow {}

export interface RegistrationSubmitResponse {
	identity: Identity;
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

export interface VerificationInitResponse extends Flow {}

export interface VerificationSubmitResponse {
	identity: Identity;
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

export interface PasskeyBeginResponse {
	challenge: string;
	rp: { id: string; name: string };
	user: { id: string; name: string; displayName: string };
	pubKeyCredParams: Array<{ type: string; alg: number }>;
	authenticatorSelection: { residentKey: string; userVerification: string };
	timeout: number;
	excludeCredentials: Array<{ type: string; id: string }>;
}

export interface PasskeyLoginBeginResponse {
	challenge: string;
	allowCredentials: Array<{ type: string; id: string }>;
	timeout: number;
	userVerification: string;
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
	i18n_key: string;
	status: number;
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
