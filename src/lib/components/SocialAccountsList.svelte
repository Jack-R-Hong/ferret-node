<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretT } from '../context.js';
	import type { SocialAccount } from '../types.js';
	import { FerretError } from '../errors.js';

	interface Props {
		onsuccess?: () => void;
	}

	let { onsuccess }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();

	let accounts = $state<SocialAccount[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let csrfToken = $state('');
	let unlinkingProvider = $state<string | null>(null);

	const PROVIDER_LABELS: Record<string, string> = {
		google: 'Google',
		github: 'GitHub',
		apple: 'Apple',
		microsoft: 'Microsoft',
		facebook: 'Facebook',
		twitter: 'Twitter / X',
		discord: 'Discord'
	};

	onMount(() => {
		void load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			const [res, flow] = await Promise.all([
				client.listSocialAccounts(),
				client.createSettingsFlow()
			]);
			accounts = res.accounts;
			csrfToken = flow.csrf_token ?? '';
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}

	async function unlink(provider: string) {
		error = null;
		success = null;
		unlinkingProvider = provider;
		try {
			await client.unlinkSocialAccount(provider, csrfToken);
			success = t('social.unlinked');
			accounts = accounts.filter((a) => a.provider !== provider);
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			unlinkingProvider = null;
		}
	}

	function formatDate(d: string): string {
		return new Date(d).toLocaleDateString();
	}

	function providerLabel(provider: string): string {
		return PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
	}
</script>

<section class="ferret-social-accounts">
	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	{#if loading}
		<p class="ferret-muted">…</p>
	{:else if accounts.length === 0}
		<p class="ferret-muted">{t('social.no_accounts')}</p>
	{:else}
		<div class="ferret-list">
			{#each accounts as account}
				<div class="ferret-list-item">
					<div class="ferret-list-info">
						<span class="ferret-provider">{providerLabel(account.provider)}</span>
						<span class="ferret-email">{account.email}</span>
						<span class="ferret-meta">
							{t('social.linked_at', { date: formatDate(account.linked_at) })}
						</span>
					</div>
					<button
						class="ferret-btn-unlink"
						disabled={unlinkingProvider === account.provider}
						onclick={() => unlink(account.provider)}
					>
						{t('social.unlink')}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.ferret-social-accounts {
		max-width: 32rem;
	}

	.ferret-muted {
		color: var(--ferret-muted-color, #6b7280);
		font-size: 0.875rem;
		padding: 1rem 0;
	}

	.ferret-alert {
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.ferret-alert-error {
		background: var(--ferret-error-bg, #fef2f2);
		color: var(--ferret-error-color, #dc2626);
		border: 1px solid var(--ferret-error-border, #fecaca);
	}

	.ferret-alert-success {
		background: var(--ferret-success-bg, #dcfce7);
		color: var(--ferret-success-color, #16a34a);
		border: 1px solid #bbf7d0;
	}

	.ferret-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ferret-list-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--ferret-card-bg, #fff);
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.5rem;
	}

	.ferret-list-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.ferret-provider {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--ferret-text-color, #111827);
	}

	.ferret-email {
		font-size: 0.8125rem;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-meta {
		font-size: 0.75rem;
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-btn-unlink {
		padding: 0.375rem 0.75rem;
		background: transparent;
		border: 1px solid var(--ferret-error-color, #dc2626);
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		color: var(--ferret-error-color, #dc2626);
		cursor: pointer;
		transition: background 0.15s;
	}

	.ferret-btn-unlink:hover:not(:disabled) {
		background: var(--ferret-error-bg, #fef2f2);
	}

	.ferret-btn-unlink:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
