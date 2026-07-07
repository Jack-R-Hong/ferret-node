<script lang="ts">
	import { FerretProvider, TotpManager } from '$lib/index.js';
</script>

<main>
	<h1>TOTP setup</h1>
	<p class="muted">
		Enroll an authenticator app. The backend returns a QR code as SVG markup
		(<code>qr_svg</code>) which <code>&lt;TotpManager&gt;</code> renders inline.
	</p>

	<FerretProvider config={{ baseUrl: 'http://localhost:8080' }} locale="en">
		<TotpManager />
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
