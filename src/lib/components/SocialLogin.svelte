<script lang="ts">
	import { onMount } from 'svelte';
	import type { Identity } from '../types.js';
	import { getFerretClient, getFerretSession, getFerretT } from '../context.js';
	import { createSocialLoginStore } from '../stores/social.svelte.js';

	interface Props {
		/**
		 * URL the provider redirects back to once the OAuth/OIDC dance is done.
		 * Must be on an origin the backend allowlists. The page that mounts this
		 * component inspects `ferret_status` on load to finish the trip, so the
		 * `returnTo` should point at a route that renders `<SocialLogin>`.
		 */
		returnTo: string;
		/** Providers to render a button for. Defaults to Google only. */
		providers?: string[];
		/** Called once the social login completes and the session is hydrated. */
		onsuccess?: (identity: Identity) => void;
		/** Called when the backend signals a second factor is still required. */
		onmfa?: () => void;
		/** Called when the return trip reports an error status. */
		onerror?: (status: string | null) => void;
	}

	let { returnTo, providers = ['google'], onsuccess, onmfa, onerror }: Props = $props();

	const t = getFerretT();
	const session = getFerretSession();
	const social = createSocialLoginStore(getFerretClient(), session);

	const PROVIDER_LABELS: Record<string, string> = {
		google: 'Google',
		github: 'GitHub',
		apple: 'Apple',
		microsoft: 'Microsoft',
		facebook: 'Facebook',
		twitter: 'Twitter / X',
		discord: 'Discord'
	};

	function providerLabel(provider: string): string {
		return PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
	}

	onMount(async () => {
		// The provider redirect lands back on `returnTo` with a `ferret_status`
		// query param; the store no-ops ('none') on a normal visit.
		const kind = await social.complete();
		if (kind === 'ok') {
			if (session.identity) onsuccess?.(session.identity);
		} else if (kind === 'mfa_required') {
			onmfa?.();
		} else if (kind === 'error') {
			onerror?.(social.errorStatus);
		}
	});
</script>

<div class="ferret-social-login">
	{#if social.state === 'loading'}
		<p class="ferret-muted">{t('social.loading')}</p>
	{:else if social.state === 'mfa_required'}
		<div class="ferret-alert ferret-alert-warn" role="alert">{t('social.mfa_required')}</div>
	{:else if social.state === 'error'}
		<div class="ferret-alert ferret-alert-error" role="alert">{t('social.error')}</div>
	{/if}

	<div class="ferret-social-buttons">
		{#each providers as provider (provider)}
			<button
				type="button"
				class="ferret-btn-social"
				disabled={social.isLoading}
				onclick={() => social.start(provider, returnTo)}
			>
				{t('social.continue_with', { provider: providerLabel(provider) })}
			</button>
		{/each}
	</div>
</div>

<style>
	.ferret-social-login {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.ferret-social-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ferret-btn-social {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--ferret-card-bg, #fff);
		color: var(--ferret-text-color, #111827);
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: var(--ferret-radius, 0.5rem);
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.ferret-btn-social:hover:not(:disabled) {
		background: var(--ferret-hover-bg, #f9fafb);
		border-color: var(--ferret-label-color, #374151);
	}

	.ferret-btn-social:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ferret-muted {
		color: var(--ferret-muted-color, #6b7280);
		font-size: 0.875rem;
		text-align: center;
		padding: 0.5rem 0;
		margin: 0;
	}

	.ferret-alert {
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.ferret-alert-error {
		background: var(--ferret-error-bg, #fef2f2);
		color: var(--ferret-error-color, #dc2626);
		border: 1px solid var(--ferret-error-border, #fecaca);
	}

	.ferret-alert-warn {
		background: var(--ferret-warn-bg, #fffbeb);
		color: var(--ferret-warn-color, #b45309);
		border: 1px solid var(--ferret-warn-border, #fde68a);
	}
</style>
