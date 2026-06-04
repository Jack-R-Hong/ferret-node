# Components

All components are exported from `@ferret/sdk-svelte` and must be used inside a `<FerretProvider>`.

---

## FerretProvider

Root context provider. Initializes the client, session store, and translation function. Must wrap all other Ferret components.

```svelte
<FerretProvider config={{ baseUrl: 'https://auth.example.com' }} locale="zh-TW">
  <!-- child components here -->
</FerretProvider>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `FerretClientConfig` | **required** | `{ baseUrl: string, fetch?: typeof fetch }` |
| `locale` | `string` | `'en'` | Locale for translations (`'en'` or `'zh-TW'`) |
| `translations` | `Translations` | — | Override or extend translation keys |
| `autoCheck` | `boolean` | `true` | Auto-call `whoami()` on mount to check session |
| `children` | `Snippet` | **required** | Child content (Svelte 5 snippet) |

**What it does on mount:**
1. Creates a `FerretClient` instance
2. Creates a `SessionStore`
3. Creates a translation function via `createT(locale, translations)`
4. Sets all three into Svelte context
5. If `autoCheck` is true, calls `session.check()` (→ `whoami()`)

---

## FlowForm

Generic form renderer for Ferret's UI schema. Used internally by all flow components, but can also be used directly for custom flows.

```svelte
<FlowForm
  fields={flow.ui.fields}
  error={flowStore.error}
  loading={flowStore.isLoading}
  submitLabel="Log In"
  onsubmit={handleSubmit}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fields` | `FlowField[]` | **required** | Form fields from backend UI schema |
| `error` | `FerretError \| Error \| null` | `null` | Error to display |
| `loading` | `boolean` | `false` | Disables form and shows spinner |
| `submitLabel` | `string` | `t('action.submit')` | Submit button text |
| `onsubmit` | `(data: Record<string, string>) => void` | **required** | Called with form data on submit |

**Field types supported:** `text`, `password`, `email`, `hidden`, `select`

**Error display:**
- Validation errors (`FerretError.isValidation`) → shown inline per field
- Other errors → shown as a banner above the form

**Accessibility:** `aria-invalid`, `aria-describedby`, `role="alert"`, required asterisk

---

## LoginFlow

Complete login flow with MFA support (TOTP, recovery codes, passkey).

```svelte
<LoginFlow
  onsuccess={(identity) => goto('/dashboard')}
  onforgot={() => (view = 'recovery')}
  onregister={() => (view = 'register')}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `onsuccess` | `(identity: Identity) => void` | Called after successful login |
| `onforgot` | `() => void` | "Forgot password?" click handler |
| `onregister` | `() => void` | "Sign up" click handler |

**Flow:**
1. Renders email/password form (fields from backend UI schema)
2. On submit, if backend returns `mfa_required` → shows MFA tab UI (TOTP / Recovery Code)
3. If `mfa_setup_required` → renders MFA setup fields from backend UI
4. On MFA success → fires `onsuccess` with identity

---

## RegistrationFlow

Sign-up flow. Returns an authenticated session immediately on success.

```svelte
<RegistrationFlow
  onsuccess={(identity) => goto('/dashboard')}
  onlogin={() => (view = 'login')}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `onsuccess` | `(identity: Identity) => void` | Called after successful registration |
| `onlogin` | `() => void` | "Already have an account?" click handler |

**Fields submitted:** `email`, `username`, `password`, `given_name` (optional), `family_name` (optional)

---

## RecoveryFlow

Three-step password reset flow.

```svelte
<RecoveryFlow
  onsuccess={(identity) => goto('/dashboard')}
  onlogin={() => (view = 'login')}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `onsuccess` | `(identity: Identity) => void` | Called after password reset |
| `onlogin` | `() => void` | "Back" click handler (shown on step 1) |

**Steps:**
1. **Email** — User enters email → backend sends verification code
2. **Code** — User enters verification code → backend validates
3. **Password** — User enters new password → password reset completes

---

## VerificationFlow

Email verification flow. Requires an active session.

```svelte
<VerificationFlow onsuccess={(identity) => console.log('Verified!')} />
```

| Prop | Type | Description |
|------|------|-------------|
| `onsuccess` | `(identity: Identity) => void` | Called after successful verification |

**Flow:**
1. Shows "Send Code" button
2. After sending → shows code input form
3. Includes "Resend Code" link

---

## SettingsFlow

Password change and profile editing. Requires an active session.

```svelte
<!-- Password change -->
<SettingsFlow section="password" onsuccess={handleSuccess} />

<!-- Profile editing -->
<SettingsFlow section="profile" onsuccess={handleSuccess} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `section` | `'password' \| 'profile'` | `'password'` | Which settings section to show |
| `onsuccess` | `(identity: Identity) => void` | — | Called after successful save |

**Password section:** Renders `current_password` and `new_password` fields.  
**Profile section:** Renders fields from backend UI schema (excluding hidden and csrf_token fields).

---

## MfaSetup

TOTP (Authenticator App) enrollment component. Requires an active session.

```svelte
<MfaSetup onsuccess={() => console.log('MFA enabled!')} />
```

| Prop | Type | Description |
|------|------|-------------|
| `onsuccess` | `() => void` | Called after TOTP is successfully verified |

**Steps:**
1. **Status** — Shows current MFA methods (TOTP, WebAuthn, Recovery Codes) with ON/OFF badges
2. **Setup** — Shows QR code (sanitized SVG), manual secret, and backup codes
3. **Verify** — User enters authenticator code to confirm setup
4. **Done** — Success message

**Security:** QR code SVG is sanitized (script tags and event handlers stripped).

---

## SessionList

Lists all active sessions with the ability to revoke them. Requires an active session.

```svelte
<SessionList onrevoke={(id) => console.log('Revoked:', id)} />
```

| Prop | Type | Description |
|------|------|-------------|
| `onrevoke` | `(sessionId: string) => void` | Called after a session is revoked |

**Displays per session:**
- Device name (or user agent, or "Unknown")
- IP address
- Authentication timestamp
- "Log Out" button to revoke

**CSRF:** Automatically fetches a CSRF token via `createSettingsFlow()` on mount.
