<script lang="ts">
	import { FerretProvider, LoginFlow } from '$lib/index.js';
	import type { Identity } from '$lib/index.js';

	let status = $state<string>('');

	function handleSuccess(identity: Identity) {
		// A real app would navigate; here we expose the result for the example /
		// the e2e test to observe.
		status = `Signed in as ${identity.email}`;
	}
</script>

<main>
	<h1>Login</h1>
	<FerretProvider config={{ baseUrl: 'http://localhost:8080' }} locale="en">
		<LoginFlow onsuccess={handleSuccess} />
	</FerretProvider>

	{#if status}
		<p data-testid="login-status" class="status">{status}</p>
	{/if}
</main>

<style>
	main {
		max-width: 28rem;
		margin: 4rem auto;
		padding: 0 1.5rem;
		font-family: system-ui, -apple-system, sans-serif;
	}
	.status {
		margin-top: 1.5rem;
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		background: #ecfdf5;
		color: #047857;
	}
</style>
