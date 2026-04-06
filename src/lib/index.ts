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
	TrustedDevice,
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
	// GDPR
	DataExport,
	// Security Activity
	SecurityEvent,
	SecurityActivityResponse,
	// Error
	FieldError,
	FerretErrorBody,
	FerretErrorResponse
} from './types.js';

// ─── Stores ──────────────────────────────────────────────────────────────────
export { createSessionStore } from './stores/session.svelte.js';
export { createFlowStore } from './stores/flow.svelte.js';
export type { SessionState, SessionStore } from './stores/session.svelte.js';
export type { FlowState, FlowStore } from './stores/flow.svelte.js';

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

// ─── Components ──────────────────────────────────────────────────────────────
export { default as FerretProvider } from './components/FerretProvider.svelte';
export { default as FlowForm } from './components/FlowForm.svelte';
export { default as LoginFlow } from './components/LoginFlow.svelte';
export { default as RegistrationFlow } from './components/RegistrationFlow.svelte';
export { default as RecoveryFlow } from './components/RecoveryFlow.svelte';
export { default as VerificationFlow } from './components/VerificationFlow.svelte';
export { default as SettingsFlow } from './components/SettingsFlow.svelte';
export { default as MfaSetup } from './components/MfaSetup.svelte';
export { default as SessionList } from './components/SessionList.svelte';
