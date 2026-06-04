# Stores

The SDK provides two Svelte 5 rune-based stores for managing authentication and flow state.

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
