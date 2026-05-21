<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { FerretClientConfig } from '../types.js';
	import { FerretClient } from '../client.js';
	import { createSessionStore } from '../stores/session.svelte.js';
	import { createT } from '../i18n/index.js';
	import { setFerretContext } from '../context.js';
	import type { Translations } from '../i18n/index.js';

	interface Props {
		config: FerretClientConfig;
		locale?: string;
		translations?: Translations;
		/** Auto-check session on mount */
		autoCheck?: boolean;
		children: Snippet;
	}

	let { config, locale = 'en', translations, autoCheck = true, children }: Props = $props();

	const client = new FerretClient(config);
	const session = createSessionStore(client);
	const t = createT(locale, translations);

	// Wire the global 401 interceptor so any expired-session response from
	// any page-initiated request flips the session store to unauthenticated.
	// The page-level $effect then handles the redirect.
	client.onUnauthorized = () => {
		if (session.state.status !== 'unauthenticated') {
			session.setUnauthenticated();
		}
	};

	setFerretContext(client, session, t);

	if (autoCheck) {
		session.check();
	}
</script>

{@render children()}
