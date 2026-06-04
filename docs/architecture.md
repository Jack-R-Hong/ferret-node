# Architecture

## Layered Design

```
┌──────────────────────────────────────────────────┐
│  Application                                      │
│  Your Svelte 5 app                                │
├──────────────────────────────────────────────────┤
│  Components                                       │
│  FerretProvider, LoginFlow, RegistrationFlow, ... │
├──────────────────────────────────────────────────┤
│  Stores                                           │
│  SessionStore (auth state), FlowStore (form FSM)  │
├──────────────────────────────────────────────────┤
│  Context                                          │
│  getFerretClient(), getFerretSession(), getFerretT()│
├──────────────────────────────────────────────────┤
│  Client                                           │
│  FerretClient — HTTP wrapper for /api/browser/*   │
├──────────────────────────────────────────────────┤
│  Ferret IDP Backend                               │
│  Rust server + MySQL + Valkey                     │
└──────────────────────────────────────────────────┘
```

## Authentication Model

- **Session cookies**: The backend sets HttpOnly cookies. The SDK sends `credentials: 'include'` on every request so the browser handles cookies automatically.
- **CSRF tokens**: Each flow response includes a `csrf_token`. This token must be submitted with every mutation (POST/DELETE). Components handle this automatically.
- **No client-side tokens**: There are no JWTs or bearer tokens stored in JS. Session state is fully server-managed.

## Flow State Machine

All flow components (Login, Registration, Recovery, etc.) follow the same pattern using `FlowStore`:

```
idle → loading → ready → submitting → success
                   ↑         │
                   └── error ←┘
```

1. **Mount**: Component calls `flow.setLoading()`, then initializes the flow via the client.
2. **Ready**: Backend returns flow data (id, csrf_token, UI schema). Component renders the form.
3. **Submit**: User submits → `flow.setSubmitting()` → client sends data to backend.
4. **Success**: Backend returns result → `flow.setSuccess()` → callback fired.
5. **Error**: Backend returns error → `flow.setError()` → error displayed, form re-enabled.

Multi-step flows (Recovery, Login+MFA) track an additional `step` state variable to switch between form screens.

## Context System

`FerretProvider` sets three Svelte contexts using Symbol keys:

| Context | Getter | Type |
|---------|--------|------|
| Client | `getFerretClient()` | `FerretClient` |
| Session | `getFerretSession()` | `SessionStore` |
| Translation | `getFerretT()` | `TFunction` |

All child components call these getters to access shared state.

## Source Layout

```
src/lib/
├── client.ts           # FerretClient — HTTP methods for all /api/browser/* endpoints
├── types.ts            # All TypeScript interfaces (Identity, Session, Flow, etc.)
├── errors.ts           # FerretError class with validation/rate-limit helpers
├── context.ts          # Svelte context setters/getters (Symbol-keyed)
├── index.ts            # Public API — re-exports everything
├── stores/
│   ├── session.svelte.ts  # SessionStore — tracks auth state via Svelte 5 $state
│   └── flow.svelte.ts     # FlowStore — tracks flow lifecycle via Svelte 5 $state
├── i18n/
│   ├── index.ts           # createT(), registerLocale()
│   ├── en.ts              # English translations (155+ keys)
│   └── zh-TW.ts           # Traditional Chinese translations
└── components/
    ├── FerretProvider.svelte    # Context root
    ├── FlowForm.svelte          # Generic form renderer
    ├── LoginFlow.svelte         # Login + MFA
    ├── RegistrationFlow.svelte  # Sign up
    ├── RecoveryFlow.svelte      # Password reset (3-step)
    ├── VerificationFlow.svelte  # Email verification
    ├── SettingsFlow.svelte      # Password/profile change
    ├── MfaSetup.svelte          # TOTP enrollment + QR
    └── SessionList.svelte       # Active sessions + revoke
```

## Svelte 5 Patterns

The SDK uses Svelte 5 runes throughout:

- **`$state`** — All reactive state in stores and components
- **`$effect`** — Form data initialization in FlowForm, session check in FerretProvider
- **`$props()`** — Typed component props via interface
- **`Snippet`** — FerretProvider's `children` prop
- **No legacy stores** — No `writable()` or `$:` reactive declarations
