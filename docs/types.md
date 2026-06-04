# TypeScript Types

All types are exported from `@ferret/sdk-svelte`.

```ts
import type { Identity, Session, Flow, ... } from '@ferret/sdk-svelte';
```

---

## Identity

```ts
interface Identity {
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
```

## Session

```ts
interface Session {
  id: string;
  identity: Identity;
  authenticated_at: string;
  expires_at: string;
  device_name?: string;
  ip_address?: string;
  user_agent?: string;
}
```

## Flow

```ts
type FlowStatus =
  | 'input_required'
  | 'mfa_required'
  | 'mfa_setup_required'
  | 'code_sent'
  | 'password_required'
  | 'success';

interface FlowField {
  name: string;
  type: 'text' | 'password' | 'email' | 'hidden' | 'select';
  required: boolean;
  label?: string;
  pattern?: string;
  value?: string;
  options?: Array<{ value: string; label: string }>;
}

interface FlowUI {
  method: string;
  action: string;
  fields: FlowField[];
}

interface Flow {
  id: string;
  csrf_token?: string;
  expires_at: string;
  status?: FlowStatus;
  ui: FlowUI;
}
```

---

## API Response Types

### Login

```ts
interface LoginInitResponse extends Flow {}

interface LoginSubmitResponse {
  session: {
    id: string;
    identity: Identity;
    authenticated_at: string;
    expires_at: string;
  };
  status?: FlowStatus;    // 'mfa_required' | 'mfa_setup_required' if MFA needed
  ui?: FlowUI;
}

interface LoginMfaResponse {
  identity: Identity;
  session_token?: string;
  expires_at?: string;
  remaining_codes?: number;  // when using recovery_code method
}
```

### Registration

```ts
interface RegistrationInitResponse extends Flow {}

interface RegistrationSubmitResponse {
  session: {
    id: string;
    identity: Identity;
    authenticated_at: string;
    expires_at: string;
  };
}
```

### Recovery

```ts
interface RecoveryInitResponse extends Flow {
  status: FlowStatus;
}

interface RecoverySubmitResponse {
  status: FlowStatus;
  ui?: FlowUI;
  identity?: Identity;
}
```

### Verification

```ts
interface VerificationInitResponse extends Flow {}

interface VerificationSubmitResponse {
  identity: Identity;
}
```

### Settings

```ts
interface SettingsInitResponse extends Flow {}

interface SettingsSubmitResponse {
  identity: Identity;
}
```

### Session

```ts
interface WhoamiResponse {
  session: {
    id: string;
    identity: Identity;
    authenticated_at: string;
    expires_at: string;
  };
}

interface SessionListResponse {
  sessions: Session[];
}
```

---

## MFA Types

```ts
interface MfaMethod {
  type: 'totp' | 'webauthn' | 'recovery_codes';
  enabled: boolean;
  enrolled_at?: string;
  credentials_count?: number;
  remaining?: number;
}

interface TrustedDevice {
  device_id: string;
  device_name: string;
  expires_at: string;
}

interface MfaStatusResponse {
  enabled: boolean;
  methods: MfaMethod[];
  trusted_devices: TrustedDevice[];
}

interface TotpSetupResponse {
  secret: string;
  uri: string;
  qr_svg: string;
  backup_codes: string[];
  ui: FlowUI;
}

interface TotpVerifyResponse {
  enabled: boolean;
}

interface PasskeyCredential {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at?: string;
  backed_up: boolean;
}

interface PasskeyBeginResponse {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: string; alg: number }>;
  authenticatorSelection: { residentKey: string; userVerification: string };
  timeout: number;
  excludeCredentials: Array<{ type: string; id: string }>;
}

interface PasskeyLoginBeginResponse {
  challenge: string;
  allowCredentials: Array<{ type: string; id: string }>;
  timeout: number;
  userVerification: string;
}

interface RecoveryCodesResponse {
  codes: string[];
}
```

---

## Social Types

```ts
interface SocialAccount {
  provider: string;
  provider_user_id: string;
  email: string;
  linked_at: string;
}

interface SocialAccountsResponse {
  accounts: SocialAccount[];
}
```

## GDPR Types

```ts
interface DataExport {
  export_id: string;
  status: 'pending' | 'ready' | 'expired';
  created_at: string;
  expires_at?: string;
}
```

## Security Activity Types

```ts
interface SecurityEvent {
  type: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  details?: Record<string, unknown>;
}

interface SecurityActivityResponse {
  events: SecurityEvent[];
  cursor?: string;
}
```

---

## Error Types

```ts
interface FieldError {
  field: string;
  code: string;
  message: string;
  i18n_key: string;
  params?: Record<string, unknown>;
}

interface FerretErrorBody {
  code: string;
  message: string;
  i18n_key: string;
  status: number;
  details?: FieldError[];
  retry_after?: number;
}

interface FerretErrorResponse {
  error: FerretErrorBody;
}
```

## Client Config

```ts
interface FerretClientConfig {
  baseUrl: string;
  fetch?: typeof fetch;
}
```

---

## Store Types

```ts
type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; identity: Identity; authenticatedAt: string; expiresAt: string }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: FerretError | Error };

type SessionStore = ReturnType<typeof createSessionStore>;

type FlowState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; flow: Flow }
  | { phase: 'submitting'; flow: Flow }
  | { phase: 'success'; data: unknown }
  | { phase: 'error'; error: FerretError | Error; flow?: Flow };

type FlowStore = ReturnType<typeof createFlowStore>;
```

## Context Types

```ts
type TFunction = (key: string, params?: Record<string, unknown>) => string;

type Translations = Record<string, string>;
```
