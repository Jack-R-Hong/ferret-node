# Getting Started

## Installation

```bash
npm install @ferret/sdk-svelte
```

Peer dependency: Svelte 5 (`^5.0.0`).

## Quick Start

Wrap your auth pages with `FerretProvider`, then drop in the flow component you need:

```svelte
<script lang="ts">
  import { FerretProvider, LoginFlow } from '@ferret/sdk-svelte';
  import type { Identity } from '@ferret/sdk-svelte';

  function handleSuccess(identity: Identity) {
    console.log('Logged in:', identity);
    // Redirect to dashboard, update app state, etc.
  }
</script>

<FerretProvider config={{ baseUrl: 'https://auth.example.com' }} locale="en">
  <LoginFlow onsuccess={handleSuccess} />
</FerretProvider>
```

## Multi-Flow Example

A typical auth page switches between login, registration, and password recovery:

```svelte
<script lang="ts">
  import {
    FerretProvider,
    LoginFlow,
    RegistrationFlow,
    RecoveryFlow
  } from '@ferret/sdk-svelte';
  import type { Identity } from '@ferret/sdk-svelte';

  let view = $state<'login' | 'register' | 'recovery'>('login');

  function handleSuccess(identity: Identity) {
    console.log('Authenticated:', identity);
  }
</script>

<FerretProvider config={{ baseUrl: 'https://auth.example.com' }} locale="zh-TW">
  {#if view === 'login'}
    <LoginFlow
      onsuccess={handleSuccess}
      onforgot={() => (view = 'recovery')}
      onregister={() => (view = 'register')}
    />
  {:else if view === 'register'}
    <RegistrationFlow
      onsuccess={handleSuccess}
      onlogin={() => (view = 'login')}
    />
  {:else if view === 'recovery'}
    <RecoveryFlow
      onsuccess={handleSuccess}
      onlogin={() => (view = 'login')}
    />
  {/if}
</FerretProvider>
```

## Headless Usage

Use `FerretClient` directly without any Svelte components:

```ts
import { FerretClient } from '@ferret/sdk-svelte';

const client = new FerretClient({ baseUrl: 'https://auth.example.com' });

// Create a login flow
const flow = await client.createLoginFlow();

// Submit credentials
const result = await client.submitLogin(flow.id, {
  identifier: 'user@example.com',
  password: 'secret',
  csrf_token: flow.csrf_token!
});

// Check if MFA is required
if (result.status === 'mfa_required') {
  const mfaResult = await client.submitLoginMfa(flow.id, {
    method: 'totp',
    code: '123456',
    csrf_token: flow.csrf_token!
  });
  console.log('MFA completed:', mfaResult.identity);
} else {
  console.log('Logged in:', result.session.identity);
}
```

## Session Management

`FerretProvider` automatically checks the current session on mount (via `whoami`). Access session state from any child component:

```svelte
<script lang="ts">
  import { getFerretSession } from '@ferret/sdk-svelte';

  const session = getFerretSession();
</script>

{#if session.state.status === 'loading'}
  <p>Checking session...</p>
{:else if session.isAuthenticated}
  <p>Welcome, {session.identity?.username}!</p>
{:else}
  <p>Please log in.</p>
{/if}
```

## SvelteKit SSR

Pass SvelteKit's `fetch` to ensure cookies are forwarded during SSR:

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { FerretProvider, LoginFlow } from '@ferret/sdk-svelte';

  // In a +page.ts load function, pass `fetch` via page data
  let { data } = $props();
</script>

<FerretProvider
  config={{ baseUrl: 'https://auth.example.com', fetch: data.fetch }}
  locale="en"
>
  <LoginFlow />
</FerretProvider>
```

## Next Steps

- [Components](./components.md) — All pre-built components and their props
- [Client API](./client.md) — Full `FerretClient` method reference
- [Stores](./stores.md) — `SessionStore` and `FlowStore` state management
- [i18n](./i18n.md) — Internationalization and custom locales
- [Error Handling](./errors.md) — `FerretError` and field-level validation
- [Styling](./styling.md) — CSS custom properties for theming
