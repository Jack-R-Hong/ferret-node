# Stores

The SDK provides Svelte 5 rune-based stores for managing authentication and flow
state. `SessionStore` and `FlowStore` are the two core stores; `QrLoginStore`
(below) and `SocialLoginStore` drive specific cross-device / social flows.

---

## SessionStore

Tracks the current authentication state. Created by `FerretProvider` and accessible via `getFerretSession()`.

### Creation

```ts
import { createSessionStore } from '@ferret/sdk-svelte';

const session = createSessionStore(client);
```

### State

The `state` property is a discriminated union:

```ts
type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; identity: Identity; authenticatedAt: string; expiresAt: string }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: FerretError | Error };
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `SessionState` | Current state object |
| `isAuthenticated` | `boolean` | `true` if status is `'authenticated'` |
| `identity` | `Identity \| null` | Current identity, or `null` if not authenticated |

### Methods

| Method | Description |
|--------|-------------|
| `check()` | Calls `whoami()` to refresh session state. Sets `loading` → `authenticated` or `unauthenticated` or `error`. |
| `setAuthenticated(identity, authenticatedAt, expiresAt)` | Manually set authenticated state (called by flow components after login/register). |
| `setUnauthenticated()` | Manually set unauthenticated state (called after logout). |

### Usage

```svelte
<script lang="ts">
  import { getFerretSession } from '@ferret/sdk-svelte';
  const session = getFerretSession();
</script>

{#if session.state.status === 'loading'}
  <Spinner />
{:else if session.isAuthenticated}
  <p>Hello, {session.identity?.username}</p>
  <p>Email: {session.identity?.email}</p>
{:else if session.state.status === 'error'}
  <p>Error: {session.state.error.message}</p>
{:else}
  <LoginFlow />
{/if}
```

---

## FlowStore

Manages the lifecycle of a single flow (login, registration, recovery, etc.). Each flow component creates its own instance.

### Creation

```ts
import { createFlowStore } from '@ferret/sdk-svelte';

const flow = createFlowStore();
```

### State

The `state` property is a discriminated union:

```ts
type FlowState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; flow: Flow }
  | { phase: 'submitting'; flow: Flow }
  | { phase: 'success'; data: unknown }
  | { phase: 'error'; error: FerretError | Error; flow?: Flow };
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `FlowState` | Current state object |
| `phase` | `string` | Current phase (`'idle'`, `'loading'`, `'ready'`, `'submitting'`, `'success'`, `'error'`) |
| `flow` | `Flow \| null` | Current flow data (available in `ready`, `submitting`, `error` phases) |
| `flowId` | `string \| null` | Current flow ID |
| `csrfToken` | `string \| null` | CSRF token from the current flow |
| `ui` | `FlowUI \| null` | UI schema (fields) from the current flow |
| `error` | `FerretError \| Error \| null` | Error (only in `error` phase) |
| `isLoading` | `boolean` | `true` if phase is `loading` or `submitting` |

### Methods

| Method | Description |
|--------|-------------|
| `setLoading()` | Transition to `loading` phase |
| `setReady(flow)` | Transition to `ready` with flow data |
| `setSubmitting(flow)` | Transition to `submitting` (preserves flow for error recovery) |
| `setSuccess(data)` | Transition to `success` with result data |
| `setError(error, flow?)` | Transition to `error` (optionally preserves flow for retry) |
| `reset()` | Back to `idle` |

### Usage in a Custom Flow

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createFlowStore, getFerretClient, getFerretT } from '@ferret/sdk-svelte';
  import FlowForm from '@ferret/sdk-svelte/FlowForm';

  const client = getFerretClient();
  const t = getFerretT();
  const flow = createFlowStore();

  onMount(async () => {
    flow.setLoading();
    try {
      const res = await client.createLoginFlow();
      flow.setReady(res);
    } catch (err) {
      flow.setError(err);
    }
  });

  async function handleSubmit(data: Record<string, string>) {
    const currentFlow = flow.flow;
    if (!currentFlow) return;

    flow.setSubmitting(currentFlow);
    try {
      const res = await client.submitLogin(currentFlow.id, {
        identifier: data.identifier,
        password: data.password,
        csrf_token: currentFlow.csrf_token ?? ''
      });
      flow.setSuccess(res);
    } catch (err) {
      flow.setError(err, currentFlow);
    }
  }
</script>

{#if flow.phase === 'loading'}
  <p>Loading...</p>
{:else if flow.ui}
  <FlowForm
    fields={flow.ui.fields}
    error={flow.error}
    loading={flow.isLoading}
    submitLabel={t('action.login')}
    onsubmit={handleSubmit}
  />
{:else if flow.phase === 'success'}
  <p>Done!</p>
{/if}
```

---

## QrLoginStore

Drives cross-device QR login on the **displaying** (desktop) side: create a QR
request, render it, and poll until a signed-in phone approves, denies, or the
code expires. Created with `createQrLoginStore(client, session)`.

### Creation

```ts
import { createQrLoginStore, getFerretClient, getFerretSession } from '@ferret/sdk-svelte';

const qr = createQrLoginStore(getFerretClient(), getFerretSession());
```

### State

```ts
type QrLoginState =
  | 'idle'        // nothing in flight (initial, or after stop())
  | 'loading'     // creating a fresh QR request
  | 'ready'       // QR on screen, waiting for a phone to scan it
  | 'scanned'     // a signed-in phone scanned it; waiting for approve/deny
  | 'authorized'  // approved — session cookie set, session store hydrated
  | 'denied'      // the phone explicitly denied the sign-in (terminal)
  | 'expired'     // the QR's ~3-minute TTL ran out (offer a refresh)
  | 'error';      // create/poll failed for any other reason
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `QrLoginState` | Current phase |
| `qrImageSrc` | `string \| null` | **Render this.** The QR as a `data:image/svg+xml` URI, ready for an `<img>` `src`. `null` until `start()`. |
| `qrSvg` | `string \| null` | Raw QR SVG markup. For headless callers only — do **not** inline it with `{@html}` (see below). |
| `expiresAt` | `string \| null` | ISO timestamp the current QR expires at |

### Methods

| Method | Description |
|--------|-------------|
| `start()` | Create a fresh QR request and begin polling. Safe to call again to replace an expired code. |
| `stop()` | Abandon the current request and return to `idle`. Call this when the QR UI unmounts. |

### Usage

```svelte
<script lang="ts">
  import { createQrLoginStore, getFerretClient, getFerretSession } from '@ferret/sdk-svelte';
  import { goto } from '$app/navigation';

  const qr = createQrLoginStore(getFerretClient(), getFerretSession());
  $effect(() => { if (qr.state === 'authorized') goto('/account'); });
</script>

<button onclick={() => qr.start()}>Sign in with a QR code</button>

{#if qr.qrImageSrc}
  <img alt="Scan to sign in" src={qr.qrImageSrc} />
{/if}
{#if qr.state === 'expired'}
  <button onclick={() => qr.start()}>Refresh code</button>
{/if}
```

> ⚠️ **Never `{@html qr.qrSvg}`.** The SVG comes from the server; inlining it is
> a DOM-XSS sink. Render `qrImageSrc` through an `<img>` (as above), which loads
> the SVG as an image where embedded script can't run. See
> [Security → Rendering server SVG safely](./security.md#rendering-server-svg-safely).
