# FerretClient API Reference

`FerretClient` is a headless HTTP client that wraps all Ferret IDP `/api/browser/*` endpoints. It can be used with or without Svelte components.

## Constructor

```ts
import { FerretClient } from '@ferret/sdk-svelte';

const client = new FerretClient({
  baseUrl: 'https://auth.example.com',
  fetch: customFetch  // optional, defaults to window.fetch
});
```

| Option | Type | Description |
|--------|------|-------------|
| `baseUrl` | `string` | Ferret IDP server URL (trailing slash is stripped) |
| `fetch` | `typeof fetch` | Custom fetch function (useful for SSR with SvelteKit) |

All requests use `credentials: 'include'` for automatic cookie handling.

---

## Login

### `createLoginFlow()`

Create a new login flow. Returns flow ID, CSRF token, and UI schema.

```ts
const flow = await client.createLoginFlow();
// flow.id, flow.csrf_token, flow.ui.fields
```

**Returns:** `LoginInitResponse` (extends `Flow`)

### `submitLogin(flowId, data)`

Submit login credentials.

```ts
const result = await client.submitLogin(flow.id, {
  identifier: 'user@example.com',
  password: 'secret',
  csrf_token: flow.csrf_token!
});
```

**Returns:** `LoginSubmitResponse`
- `result.session` — Session with identity (on direct success)
- `result.status` — `'mfa_required'` or `'mfa_setup_required'` if MFA is needed

### `submitLoginMfa(flowId, data)`

Submit MFA verification during login.

```ts
// TOTP
const result = await client.submitLoginMfa(flow.id, {
  method: 'totp',
  code: '123456',
  csrf_token: flow.csrf_token!
});

// Recovery code
const result = await client.submitLoginMfa(flow.id, {
  method: 'recovery_code',
  code: 'abc123-def456',
  csrf_token: flow.csrf_token!
});
```

**Returns:** `LoginMfaResponse`
- `result.identity` — Authenticated identity
- `result.remaining_codes` — Remaining recovery codes (when using recovery_code method)

### `beginPasskeyLogin(flowId)`

Begin passkey (WebAuthn) authentication during MFA-required login.

```ts
const options = await client.beginPasskeyLogin(flow.id);
// Pass options to navigator.credentials.get()
```

**Returns:** `PasskeyLoginBeginResponse`

### `completePasskeyLogin(flowId, credential)`

Complete passkey authentication with the browser credential.

```ts
const result = await client.completePasskeyLogin(flow.id, credential);
```

**Returns:** `LoginMfaResponse`

### `startConditionalPasskeyLogin(options?)`

Runs a conditional-mediation passkey login (autofill UI on the password
field). Wraps the full WebAuthn ceremony — feature detection, flow creation,
`navigator.credentials.get`, and completion — into a single best-effort call.

Returns `null` when the browser does not support conditional mediation, the
user cancels, or the abort signal fires. Backend errors still throw so
callers can surface them.

```ts
const abort = new AbortController();
const result = await client.startConditionalPasskeyLogin({ signal: abort.signal });
if (result?.identity) {
  // logged in — hydrate session and redirect
}
```

**Returns:** `Promise<LoginMfaResponse | null>`

---

## Registration

### `createRegistrationFlow()`

```ts
const flow = await client.createRegistrationFlow();
```

**Returns:** `RegistrationInitResponse` (extends `Flow`)

### `submitRegistration(flowId, data)`

```ts
const result = await client.submitRegistration(flow.id, {
  email: 'user@example.com',
  username: 'johndoe',
  password: 'strongpassword',
  csrf_token: flow.csrf_token!,
  given_name: 'John',     // optional
  family_name: 'Doe'      // optional
});
```

**Returns:** `RegistrationSubmitResponse`
- `result.session.identity` — The newly created identity

---

## Logout

### `logout(csrfToken)`

```ts
await client.logout(csrfToken);
```

Clears the session cookie.

---

## Session

### `whoami()`

Get the current session and identity.

```ts
const { session } = await client.whoami();
// session.identity, session.authenticated_at, session.expires_at
```

**Returns:** `WhoamiResponse`

### `listSessions()`

List all active sessions for the current user.

```ts
const { sessions } = await client.listSessions();
```

**Returns:** `SessionListResponse`

### `revokeSession(sessionId, csrfToken)`

Revoke a specific session.

```ts
await client.revokeSession('session-id', csrfToken);
```

---

## Settings

### `createSettingsFlow()`

Create a settings flow for password or profile changes. Also used to obtain a CSRF token for other mutations.

```ts
const flow = await client.createSettingsFlow();
```

**Returns:** `SettingsInitResponse` (extends `Flow`)

### `submitSettings(flowId, data)`

Submit a password or profile change.

```ts
// Password change
await client.submitSettings(flow.id, {
  csrf_token: flow.csrf_token!,
  password: { current: 'oldpass', new: 'newpass' }
});

// Profile update
await client.submitSettings(flow.id, {
  csrf_token: flow.csrf_token!,
  profile: { given_name: 'Jane', family_name: 'Doe' }
});
```

**Returns:** `SettingsSubmitResponse`

---

## Recovery (Password Reset)

### `createRecoveryFlow(email)`

Initiate password recovery. Sends a verification code to the email.

```ts
const flow = await client.createRecoveryFlow('user@example.com');
```

**Returns:** `RecoveryInitResponse`

### `submitRecovery(flowId, data)`

Submit a recovery code or new password.

```ts
// Step 1: Verify code
const res = await client.submitRecovery(flow.id, {
  code: '123456',
  csrf_token: flow.csrf_token!
});
// res.status === 'password_required' → proceed to step 2

// Step 2: Set new password
const res2 = await client.submitRecovery(flow.id, {
  password: 'newpassword',
  csrf_token: flow.csrf_token!
});
```

**Returns:** `RecoverySubmitResponse`

---

## Email Verification

### `createVerificationFlow()`

Create an email verification flow (sends code to current email). Requires active session.

```ts
const flow = await client.createVerificationFlow();
```

**Returns:** `VerificationInitResponse`

### `submitVerification(flowId, data)`

```ts
const { identity } = await client.submitVerification(flow.id, {
  code: '123456',
  csrf_token: flow.csrf_token!
});
```

**Returns:** `VerificationSubmitResponse`

---

## Email Change

### `createEmailChange(data)`

Initiate email change. Sends verification code to the new address.

```ts
const { id } = await client.createEmailChange({
  email: 'new@example.com',
  current_password: 'mypassword',
  csrf_token: csrfToken
});
```

### `submitEmailChange(flowId, data)`

```ts
const { identity } = await client.submitEmailChange(flowId, {
  code: '123456',
  csrf_token: csrfToken
});
```

---

## MFA — TOTP

### `getMfaStatus()`

Get current MFA status including enabled methods and the per-user MFA level.

```ts
const status = await client.getMfaStatus();
// status.enabled, status.methods[], status.mfa_level
```

**Returns:** `MfaStatusResponse`

### `setupTotp(csrfToken?)`

Begin TOTP enrollment. Returns secret, QR code SVG, and backup codes.

```ts
const setup = await client.setupTotp();
// setup.secret, setup.uri, setup.qr_svg, setup.backup_codes
```

**Returns:** `TotpSetupResponse`

### `verifyTotpSetup(code, csrfToken)`

Verify TOTP setup with a code from the authenticator app.

```ts
const { enabled } = await client.verifyTotpSetup('123456', csrfToken);
```

**Returns:** `TotpVerifyResponse`

### `disableTotp(data)`

Disable TOTP. Requires current password and a TOTP or recovery code.

```ts
await client.disableTotp({
  current_password: 'mypassword',
  csrf_token: csrfToken,
  totp_code: '123456'       // or recovery_code: 'abc-123'
});
```

---

## MFA — Passkeys (WebAuthn)

### `beginPasskeyRegistration()`

Begin passkey registration. Returns WebAuthn creation options.

```ts
const options = await client.beginPasskeyRegistration();
// Pass to navigator.credentials.create({ publicKey: options })
```

**Returns:** `PasskeyBeginResponse`

### `completePasskeyRegistration(credential)`

Complete registration with the credential from the browser.

```ts
const { credential_id, device_name } = await client.completePasskeyRegistration(credential);
```

### `listPasskeys()`

```ts
const { credentials } = await client.listPasskeys();
// credentials[].id, .device_name, .created_at, .last_used_at, .backed_up
```

### `deletePasskey(credentialId, currentPassword, csrfToken)`

```ts
await client.deletePasskey('cred-id', 'mypassword', csrfToken);
```

---

## MFA — Recovery Codes

### `regenerateRecoveryCodes(currentPassword, csrfToken)`

Generate new recovery codes. Invalidates all existing codes.

```ts
const { codes } = await client.regenerateRecoveryCodes('mypassword', csrfToken);
```

**Returns:** `RecoveryCodesResponse`

---

## Social Login

### `socialLoginUrl(provider, returnTo?)`

URL that starts a social *login* (Mode B / full-page redirect). The backend
finishes the OAuth dance and 303s back to `returnTo` with a `ferret_status`
query param. Call from a click handler:

```ts
const returnTo = `${location.origin}/login/oauth-done`;
window.location.href = client.socialLoginUrl('google', returnTo);
```

**Returns:** `string`

### `socialLinkUrl(provider, returnTo?)`

URL that *links* a new social account to the **current session**. Requires
the user to already be authenticated. Use `socialLoginUrl` for anonymous
sign-in instead.

```ts
window.location.href = client.socialLinkUrl('github', `${location.origin}/settings/social`);
```

**Returns:** `string`

### `completeSocialLogin(params)`

Inspect the `ferret_status` returned to the social-login `return_to` URL and
finish the trip. On `ok`, calls `whoami` so the caller can hydrate its
session store without a second round-trip.

```ts
const result = await client.completeSocialLogin(new URLSearchParams(location.search));
switch (result.kind) {
  case 'ok':
    session.setAuthenticated(
      result.session.identity,
      result.session.authenticated_at,
      result.session.expires_at
    );
    break;
  case 'mfa_required':
    // Social callback carries no flow id — restart from /login.
    break;
  case 'error':
    // result.status holds the raw ferret_status value (or null).
    break;
}
```

**Returns:** `Promise<SocialLoginCompletion>`

### `listSocialAccounts()`

```ts
const { accounts } = await client.listSocialAccounts();
// accounts[].provider, .email, .linked_at
```

**Returns:** `SocialAccountsResponse`

### `unlinkSocialAccount(provider, csrfToken)`

```ts
await client.unlinkSocialAccount('google', csrfToken);
```

---

## GDPR

### `deleteAccount(csrfToken)`

Schedule account deletion (with grace period).

```ts
await client.deleteAccount(csrfToken);
```

### `cancelAccountDeletion(csrfToken)`

Cancel a pending account deletion.

```ts
await client.cancelAccountDeletion(csrfToken);
```

### `createDataExport()`

Request a GDPR data export.

```ts
const export_ = await client.createDataExport();
// export_.export_id, .status ('pending' | 'ready' | 'expired')
```

**Returns:** `DataExport`

### `getDataExport(exportId)`

Check the status of a data export.

```ts
const export_ = await client.getDataExport('export-id');
```

**Returns:** `DataExport`

### `getDataExportDownloadUrl(exportId)`

Get the download URL for a ready data export.

```ts
const url = client.getDataExportDownloadUrl('export-id');
```

**Returns:** `string`

---

## Security Activity

### `getSecurityActivity(params?)`

Get security activity log for the current user.

```ts
const { events, cursor } = await client.getSecurityActivity({
  type: 'login',        // optional filter
  since: '2024-01-01',  // optional
  until: '2024-12-31',  // optional
  limit: 20,            // optional
  cursor: nextCursor    // optional (pagination)
});
```

**Returns:** `SecurityActivityResponse`

---

## Health

### `health()`

Check server health.

```ts
const { status, db, valkey } = await client.health();
```

---

## WebAuthn helpers (top-level exports)

Browser ↔ server encoding helpers used by the SDK's passkey methods. Exported
in case you need to assemble a raw `navigator.credentials.*` call yourself.

```ts
import { b64ToBytes, bytesToB64 } from '@ferret/sdk-svelte';

const bytes = b64ToBytes(options.challenge); // base64 → Uint8Array
const b64 = bytesToB64(credential.rawId);    // ArrayBuffer → base64
```
