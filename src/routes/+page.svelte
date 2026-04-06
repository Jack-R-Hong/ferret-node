<script lang="ts">
	import {
		FerretProvider,
		LoginFlow,
		RegistrationFlow,
		RecoveryFlow
	} from '$lib/index.js';
	import type { Identity } from '$lib/index.js';

	let view = $state<'login' | 'register' | 'recovery'>('login');

	function handleSuccess(identity: Identity) {
		console.log('Authenticated:', identity);
	}
</script>

<main>
	<h1>Ferret SDK Demo</h1>

	<FerretProvider config={{ baseUrl: 'http://localhost:8080' }} locale="en">
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
</main>

<style>
	main {
		max-width: 28rem;
		margin: 4rem auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	h1 {
		text-align: center;
		margin-bottom: 2rem;
	}
</style>
