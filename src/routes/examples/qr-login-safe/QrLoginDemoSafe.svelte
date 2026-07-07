<script lang="ts">
	import { createQrLoginStore, getFerretClient, getFerretSession } from '$lib/index.js';

	const qr = createQrLoginStore(getFerretClient(), getFerretSession());

	// Hardened render: use the store's `qrImageSrc`, which wraps the server SVG
	// in a data: URI so it loads through the <img> below. SVG loaded as an image
	// runs in a restricted mode — <script> and on* handlers never execute — so a
	// poisoned qr_svg cannot run script in this origin. No inline {@html}.
</script>

<div class="qr-demo">
	<button onclick={() => qr.start()} data-testid="qr-start">Show QR code</button>

	<p data-testid="qr-state">state: {qr.state}</p>

	{#if qr.qrImageSrc}
		<img class="qr" data-testid="qr-canvas" alt="Scan to sign in" src={qr.qrImageSrc} />
	{/if}
</div>

<style>
	.qr-demo {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
	}
	.qr {
		width: 200px;
		height: 200px;
		border: 1px solid #e5e7eb;
	}
	button {
		padding: 0.5rem 1rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: #3b82f6;
		color: white;
		cursor: pointer;
	}
</style>
