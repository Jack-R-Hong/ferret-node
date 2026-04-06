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

	setFerretContext(client, session, t);

	if (autoCheck) {
		session.check();
	}
</script>

{@render children()}
