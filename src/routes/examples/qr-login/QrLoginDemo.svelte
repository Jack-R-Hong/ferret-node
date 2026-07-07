<script lang="ts">
	import { createQrLoginStore, getFerretClient, getFerretSession } from '$lib/index.js';

	// ⚠️ ANTI-PATTERN — kept as a regression demo of what NOT to do.
	// Inlining the raw server `qrSvg` with `{@html}` is a DOM-XSS sink. The SDK
	// now exposes `qr.qrImageSrc` for safe rendering (see the qr-login-safe
	// example); the e2e suite proves this page executes a poisoned qr_svg and
	// the safe one does not.
	const qr = createQrLoginStore(getFerretClient(), getFerretSession());
</script>

<div class="qr-demo">
	<button onclick={() => qr.start()} data-testid="qr-start">Show QR code</button>

	<p data-testid="qr-state">state: {qr.state}</p>

	{#if qr.qrSvg}
		<!-- ⚠️ Unsafe on purpose — do NOT copy this. Use qr.qrImageSrc + <img>. -->
		<div class="qr" data-testid="qr-canvas">{@html qr.qrSvg}</div>
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
