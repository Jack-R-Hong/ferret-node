<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretSession, getFerretT } from '../context.js';
	import { FerretError } from '../errors.js';

	interface Props {
		/** Word the user must type to confirm. Default: "DELETE". */
		confirmWord?: string;
		onsuccess?: () => void;
		oncancelled?: () => void;
	}

	let { confirmWord = 'DELETE', onsuccess, oncancelled }: Props = $props();

	const client = getFerretClient();
	const session = getFerretSession();
	const t = getFerretT();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let csrfToken = $state('');
	let confirmText = $state('');
	let isPendingDeletion = $state(false);

	onMount(async () => {
		try {
			const flow = await client.createSettingsFlow();
			csrfToken = flow.csrf_token ?? '';
		} catch {
			// non-fatal — surfaced on submit
		}
		if (
			session.state.status === 'authenticated' &&
			session.state.identity.status === 'pending_deletion'
		) {
			isPendingDeletion = true;
		}
	});

	async function deleteAccount() {
		if (confirmText !== confirmWord) return;
		error = null;
		loading = true;
		try {
			await client.deleteAccount(csrfToken);
			success = t('gdpr.delete_account.scheduled');
			isPendingDeletion = true;
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}

	async function cancel() {
		error = null;
		loading = true;
		try {
			await client.cancelAccountDeletion(csrfToken);
			success = t('gdpr.delete_account.cancelled');
			isPendingDeletion = false;
			session.check();
			oncancelled?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}
</script>

<section class="ferret-delete-account">
	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	{#if isPendingDeletion}
		<div class="ferret-pending">
			<p class="ferret-warning-text">{t('gdpr.delete_account.pending')}</p>
			<button
				class="ferret-btn ferret-btn-secondary"
				onclick={cancel}
				disabled={loading}
			>
				{t('gdpr.delete_account.cancel')}
			</button>
		</div>
	{:else}
		<div class="ferret-warning-box">
			<p class="ferret-warning-text">{t('gdpr.delete_account.warning')}</p>
		</div>

		<form
			class="ferret-form"
			onsubmit={(e) => {
				e.preventDefault();
				void deleteAccount();
			}}
		>
			<label class="ferret-label" for="ferret-da-confirm">
				{t('gdpr.delete_account.confirm')}
			</label>
			<input
				id="ferret-da-confirm"
				class="ferret-input"
				type="text"
				bind:value={confirmText}
				placeholder={t('gdpr.delete_account.confirm_placeholder')}
				required
			/>
			<button
				type="submit"
				class="ferret-btn ferret-btn-danger"
				disabled={loading || confirmText !== confirmWord}
			>
				{t('gdpr.delete_account.submit')}
			</button>
		</form>
	{/if}
</section>

<style>
	.ferret-delete-account {
		max-width: 28rem;
	}

	.ferret-warning-box {
		background: var(--ferret-error-bg, #fef2f2);
		border: 1px solid var(--ferret-error-border, #fecaca);
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.ferret-warning-text {
		font-size: 0.875rem;
		color: var(--ferret-error-color, #dc2626);
		line-height: 1.5;
	}

	.ferret-pending {
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 0.5rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.ferret-pending .ferret-warning-text {
		color: #92400e;
	}

	.ferret-form {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.ferret-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.375rem;
		font-size: 0.875rem;
		background: var(--ferret-input-bg, #fff);
	}

	.ferret-input:focus {
		outline: none;
		border-color: var(--ferret-error-color, #dc2626);
		box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
	}

	.ferret-btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.ferret-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ferret-btn-danger {
		background: var(--ferret-error-color, #dc2626);
		color: #fff;
	}

	.ferret-btn-danger:hover:not(:disabled) {
		background: #b91c1c;
	}

	.ferret-btn-secondary {
		background: transparent;
		border: 1px solid var(--ferret-input-border, #d1d5db);
		color: var(--ferret-label-color, #374151);
	}

	.ferret-btn-secondary:hover:not(:disabled) {
		background: var(--ferret-muted-bg, #f3f4f6);
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
</style>
