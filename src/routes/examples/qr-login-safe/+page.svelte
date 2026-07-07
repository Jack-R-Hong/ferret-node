<script lang="ts">
	import { FerretProvider } from '$lib/index.js';
	import QrLoginDemoSafe from './QrLoginDemoSafe.svelte';
</script>

<main>
	<h1>QR login — hardened</h1>
	<p class="muted">
		Same cross-device flow, but the QR SVG is rendered through an
		<code>&lt;img&gt;</code> data-URI instead of inline <code>{'{@html}'}</code>.
		Script and event handlers embedded in a poisoned <code>qr_svg</code> cannot
		execute here.
	</p>

	<FerretProvider config={{ baseUrl: 'http://localhost:8080' }} locale="en">
		<QrLoginDemoSafe />
	</FerretProvider>
</main>

<style>
	main {
		max-width: 28rem;
		margin: 4rem auto;
		padding: 0 1.5rem;
		font-family: system-ui, -apple-system, sans-serif;
	}
	.muted {
		color: #6b7280;
		font-size: 0.9rem;
	}
</style>
