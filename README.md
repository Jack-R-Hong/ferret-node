# @ferret/sdk-svelte

Svelte 5 frontend SDK for [Ferret Identity Provider](https://github.com/Jack-R-Hong/ferret-node).

## Install

```bash
npm install @ferret/sdk-svelte
```

## Quick Start

```svelte
<script lang="ts">
  import { FerretProvider, LoginFlow } from '@ferret/sdk-svelte';

  function handleSuccess(identity) {
    console.log('Logged in:', identity);
  }
</script>

<FerretProvider config={{ baseUrl: 'http://localhost:8080' }} locale="zh-TW">
  <LoginFlow onsuccess={handleSuccess} />
</FerretProvider>
```

## Architecture

```
@ferret/sdk-svelte
├── FerretClient        # Headless HTTP client (usable without Svelte)
├── Stores              # Svelte 5 rune-based reactive stores
│   ├── SessionStore    # Session state (authenticated/unauthenticated)
│   └── FlowStore       # Flow state machine (idle → loading → ready → submitting → success)
├── Components          # Pre-built Svelte components
│   ├── FerretProvider  # Context provider (client + session + i18n)
│   ├── FlowForm        # Generic form renderer from Ferret UI schema
│   ├── LoginFlow       # Login with MFA support
│   ├── RegistrationFlow
│   ├── RecoveryFlow    # Password reset (email → code → new password)
│   ├── VerificationFlow# Email verification
│   ├── SettingsFlow    # Password/profile change
│   ├── MfaSetup        # TOTP enrollment with QR code
│   └── SessionList     # Active sessions with revoke
└── i18n                # en + zh-TW translations
```

## Headless Usage

Use `FerretClient` directly without Svelte components:

```ts
import { FerretClient } from '@ferret/sdk-svelte';

const client = new FerretClient({ baseUrl: 'http://localhost:8080' });

// Create login flow
const flow = await client.createLoginFlow();

// Submit credentials
const result = await client.submitLogin(flow.flow_id, {
  identifier: 'user@example.com',
  password: 'secret',
  csrf_token: flow.csrf_token
});
```

## Components

### FerretProvider

Root context provider. Wrap your app (or auth pages) with this.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `FerretClientConfig` | required | `{ baseUrl: string }` |
| `locale` | `string` | `'en'` | `'en'` or `'zh-TW'` |
| `translations` | `Translations` | — | Override/extend translations |
| `autoCheck` | `boolean` | `true` | Auto-call `whoami` on mount |

### LoginFlow

| Prop | Type | Description |
|------|------|-------------|
| `onsuccess` | `(identity) => void` | Called after successful login |
| `onforgot` | `() => void` | "Forgot password?" click handler |
| `onregister` | `() => void` | "Sign up" click handler |

### RegistrationFlow

| Prop | Type | Description |
|------|------|-------------|
| `onsuccess` | `(identity) => void` | Called after successful registration |
| `onlogin` | `() => void` | "Already have an account?" click handler |

### RecoveryFlow

Three-step flow: email → verification code → new password.

| Prop | Type | Description |
|------|------|-------------|
| `onsuccess` | `(identity) => void` | Called after password reset |
| `onlogin` | `() => void` | "Back" click handler |

### VerificationFlow / SettingsFlow / MfaSetup / SessionList

See source for prop details.

## i18n

```ts
import { createT, registerLocale } from '@ferret/sdk-svelte';

// Use built-in locale
const t = createT('zh-TW');
t('error.field.password_too_short', { min: 10 });
// → "密碼至少 10 個字元"

// Register custom locale
registerLocale('ja', { 'action.login': 'ログイン', ... });
```

## Styling

All components use CSS custom properties for theming:

```css
:root {
  --ferret-primary-bg: #3b82f6;
  --ferret-primary-hover: #2563eb;
  --ferret-primary-color: #ffffff;
  --ferret-error-bg: #fef2f2;
  --ferret-error-color: #dc2626;
  --ferret-error-border: #fecaca;
  --ferret-label-color: #374151;
  --ferret-muted-color: #6b7280;
  --ferret-input-border: #d1d5db;
  --ferret-focus-color: #3b82f6;
  --ferret-focus-ring: rgba(59, 130, 246, 0.3);
  --ferret-form-width: 24rem;
}
```

## Security

The pre-built components are safe by default; if you render SDK data yourself,
two rules matter:

- **Never `{@html}` server SVG.** The `qr_svg` fields (TOTP setup, QR login) are
  server markup — inlining them is a DOM-XSS sink. Render them through an
  `<img>` using `svgToDataUri(qr_svg)` or the QR store's `qrImageSrc`.
- **CSRF is automatic.** `FerretClient` echoes the `ferret_csrf` cookie as
  `X-CSRF-Token` on mutations and sends credentials on every request; cross-origin
  integrations seed the token via `setCsrfToken()` / `whoami()`.

See [docs/security.md](./docs/security.md) for the full guide. The security
behaviour is covered by a Playwright suite (`npm run test:e2e`) and runnable
examples under `src/routes/examples/`.

## API Coverage

| Ferret API | Client Method | Component |
|------------|--------------|-----------|
| Login | `createLoginFlow`, `submitLogin`, `submitLoginMfa` | `LoginFlow` |
| Registration | `createRegistrationFlow`, `submitRegistration` | `RegistrationFlow` |
| Recovery | `createRecoveryFlow`, `submitRecovery` | `RecoveryFlow` |
| Verification | `createVerificationFlow`, `submitVerification` | `VerificationFlow` |
| Settings | `createSettingsFlow`, `submitSettings` | `SettingsFlow` |
| Session | `whoami`, `listSessions`, `revokeSession` | `SessionList` |
| MFA (TOTP) | `setupTotp`, `verifyTotpSetup`, `disableTotp` | `MfaSetup` |
| MFA (Passkey) | `beginPasskeyRegistration`, `completePasskeyRegistration`, `beginPasskeyLogin`, `completePasskeyLogin`, `startConditionalPasskeyLogin` | `PasskeyManager` |
| MFA (Recovery) | `regenerateRecoveryCodes` | `MfaSetup` |
| Social Login | `socialLoginUrl`, `socialLinkUrl`, `completeSocialLogin`, `listSocialAccounts`, `unlinkSocialAccount` | `SocialAccountsList` |
| Email Change | `createEmailChange`, `submitEmailChange` | — |
| GDPR | `deleteAccount`, `cancelAccountDeletion`, `createDataExport` | — |
| Activity | `getSecurityActivity` | — |
| Logout | `logout` | — |
| Health | `health` | — |
