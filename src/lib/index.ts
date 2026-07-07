// ─── Client ──────────────────────────────────────────────────────────────────
export { FerretClient } from './client.js';

// ─── Errors ──────────────────────────────────────────────────────────────────
export { FerretError } from './errors.js';

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
	// Config
	FerretClientConfig,
	// Identity & Session
	Identity,
	Session,
	WhoamiResponse,
	SessionListResponse,
	// Flow
	FlowStatus,
	FlowField,
	FlowUI,
	Flow,
	// Login
	LoginInitResponse,
	LoginSubmitResponse,
	LoginMfaResponse,
	// QR login
	QrLoginCreateResponse,
	QrLoginPollResponse,
	QrLoginStatus,
	// Registration
	RegistrationInitResponse,
	RegistrationSubmitResponse,
	// Recovery
	RecoveryInitResponse,
	RecoverySubmitResponse,
	// Verification
	VerificationInitResponse,
	VerificationSubmitResponse,
	// Settings
	SettingsInitResponse,
	SettingsSubmitResponse,
	// MFA
	MfaMethod,
	MfaStatusResponse,
	TotpSetupResponse,
	TotpVerifyResponse,
	PasskeyCredential,
	PasskeyBeginResponse,
	PasskeyLoginBeginResponse,
	RecoveryCodesResponse,
	// Social
	SocialAccount,
	SocialAccountsResponse,
	SocialLoginCompletion,
	// GDPR
	DataExport,
	// Security Activity
	SecurityEvent,
	SecurityActivityResponse,
	// Personal Access Tokens
	PersonalAccessToken,
	TokenListResponse,
	TokenCreateResponse,
	// Notification Preferences
	NotificationPreferenceItem,
	NotificationPreferenceCategory,
	NotificationPreferences,
	// OAuth Grants
	OAuthGrant,
	OAuthGrantsResponse,
	// Error
	FieldError,
	FerretErrorBody,
	FerretErrorResponse
} from './types.js';

// ─── Stores ──────────────────────────────────────────────────────────────────
export { createSessionStore } from './stores/session.svelte.js';
export { createFlowStore } from './stores/flow.svelte.js';
export { createSocialLoginStore } from './stores/social.svelte.js';
export { createQrLoginStore } from './stores/qr-login.svelte.js';
export type { SessionState, SessionStore } from './stores/session.svelte.js';
export type { FlowState, FlowStore } from './stores/flow.svelte.js';
export type { SocialLoginState, SocialLoginStore, SocialReturnKind } from './stores/social.svelte.js';
export type { QrLoginState, QrLoginStore } from './stores/qr-login.svelte.js';

// ─── Context ─────────────────────────────────────────────────────────────────
export {
	setFerretContext,
	getFerretClient,
	getFerretSession,
	getFerretT
} from './context.js';
export type { TFunction } from './context.js';

// ─── i18n ────────────────────────────────────────────────────────────────────
export { createT, registerLocale, en, zhTW } from './i18n/index.js';
export type { Translations } from './i18n/index.js';

// ─── WebAuthn helpers ────────────────────────────────────────────────────────
export { b64ToBytes, bytesToB64 } from './webauthn.js';

// ─── SVG helpers ─────────────────────────────────────────────────────────────
export { svgToDataUri } from './svg.js';

// ─── Components ──────────────────────────────────────────────────────────────
export { default as FerretProvider } from './components/FerretProvider.svelte';
export { default as FlowForm } from './components/FlowForm.svelte';
export { default as LoginFlow } from './components/LoginFlow.svelte';
export { default as RegistrationFlow } from './components/RegistrationFlow.svelte';
export { default as RecoveryFlow } from './components/RecoveryFlow.svelte';
export { default as VerificationFlow } from './components/VerificationFlow.svelte';
export { default as SettingsFlow } from './components/SettingsFlow.svelte';
export { default as SessionList } from './components/SessionList.svelte';
export { default as TotpManager } from './components/TotpManager.svelte';
export { default as MfaRequirementToggle } from './components/MfaRequirementToggle.svelte';
export { default as PasskeyManager } from './components/PasskeyManager.svelte';
export { default as RecoveryCodeRegen } from './components/RecoveryCodeRegen.svelte';
export { default as EmailChangeFlow } from './components/EmailChangeFlow.svelte';
export { default as SocialAccountsList } from './components/SocialAccountsList.svelte';
export { default as SocialLogin } from './components/SocialLogin.svelte';
export { default as SecurityActivityLog } from './components/SecurityActivityLog.svelte';
export { default as DataExportRequest } from './components/DataExportRequest.svelte';
export { default as DeleteAccountConfirm } from './components/DeleteAccountConfirm.svelte';
