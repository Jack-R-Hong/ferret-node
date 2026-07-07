<script lang="ts">
	// Index of the SDK usage examples. Each page below wraps the relevant
	// component/store in a <FerretProvider> pointed at a Ferret backend. Under
	// `npm run dev` they talk to http://localhost:8080; the Playwright suite in
	// /e2e drives these same routes with a mocked backend so no server is needed.
	const examples = [
		{ href: '/examples/login', title: 'Login', desc: 'Password login via <LoginFlow>.' },
		{ href: '/examples/totp', title: 'TOTP setup', desc: 'Authenticator enrollment with QR code via <TotpManager>.' },
		{ href: '/examples/qr-login', title: 'QR login (⚠️ anti-pattern)', desc: 'Cross-device QR login inlining qrSvg with {@html} — kept as a regression demo of the DOM-XSS sink. Do not copy.' },
		{ href: '/examples/qr-login-safe', title: 'QR login (recommended)', desc: 'Same flow rendered via the store’s qrImageSrc / an <img> data-URI, so embedded script can never run.' }
	];
</script>

<main>
	<h1>Ferret SDK — Examples</h1>
	<p class="muted">
		Runnable usage examples for <code>@ferret/sdk-svelte</code>. The Playwright
		suite exercises these routes against a mocked backend and probes each flow
		for client-side security issues.
	</p>
	<ul>
		{#each examples as ex (ex.href)}
			<li>
				<a href={ex.href}>{ex.title}</a>
				<span class="muted">{ex.desc}</span>
			</li>
		{/each}
	</ul>
</main>

<style>
	main {
		max-width: 42rem;
		margin: 4rem auto;
		padding: 0 1.5rem;
		font-family: system-ui, -apple-system, sans-serif;
	}
	h1 {
		margin-bottom: 0.5rem;
	}
	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 2rem;
	}
	li {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	a {
		font-weight: 600;
		color: #3b82f6;
	}
	.muted {
		color: #6b7280;
		font-size: 0.9rem;
	}
</style>
