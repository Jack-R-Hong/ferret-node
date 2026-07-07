<script lang="ts">
	import { FerretProvider } from '$lib/index.js';
	import QrLoginDemo from './QrLoginDemo.svelte';
</script>

<main>
	<h1>QR login — documented pattern</h1>
	<p class="muted">
		Cross-device login. The desktop shows a QR code (returned by the backend as
		<code>qr_svg</code>) and polls until a signed-in phone approves it. This page
		renders the SVG the way the <code>createQrLoginStore</code> docstring shows:
		<code>{'{@html qr.qrSvg}'}</code>.
	</p>

	<FerretProvider config={{ baseUrl: 'http://localhost:8080' }} locale="en">
		<QrLoginDemo />
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
