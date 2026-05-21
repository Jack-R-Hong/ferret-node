<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretSession, getFerretT } from '../context.js';
	import { FerretError } from '../errors.js';

	interface Props {
		onsuccess?: () => void;
	}

	let { onsuccess }: Props = $props();

	const client = getFerretClient();
	const session = getFerretSession();
	const t = getFerretT();

	let step = $state<'form' | 'verify' | 'done'>('form');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let csrfToken = $state('');

	let newEmail = $state('');
	let currentPassword = $state('');

	let flowId = $state('');
	let code = $state('');

	let currentEmail = $derived(
		session.state.status === 'authenticated' ? session.state.identity.email : ''
	);

	onMount(async () => {
		try {
			const flow = await client.createSettingsFlow();
			csrfToken = flow.csrf_token ?? '';
		} catch {
			// non-fatal — submit will surface the error
		}
	});

	async function initiate() {
		error = null;
		loading = true;
		try {
			const res = await client.createEmailChange({
				email: newEmail,
				current_password: currentPassword,
				csrf_token: csrfToken
			});
			flowId = res.id;
			step = 'verify';
			success = t('email.change.code_sent');
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}

	async function verify() {
		error = null;
		loading = true;
		try {
			await client.submitEmailChange(flowId, {
				code,
				csrf_token: csrfToken
			});
			step = 'done';
			success = t('email.change.success');
			session.check();
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}
</script>

<section class="ferret-email-change">
	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	{#if step === 'form'}
		<p class="ferret-muted">{t('email.change.description')}</p>

		{#if currentEmail}
			<p class="ferret-current">
				{t('flow.field.email')}: <strong>{currentEmail}</strong>
			</p>
		{/if}

		<form
			class="ferret-form"
			onsubmit={(e) => {
				e.preventDefault();
				void initiate();
			}}
		>
			<label class="ferret-label" for="ferret-new-email">
				{t('email.change.new_email')}
			</label>
			<input
				id="ferret-new-email"
				class="ferret-input"
				type="email"
				bind:value={newEmail}
				required
			/>

			<label class="ferret-label" for="ferret-ec-password">
				{t('flow.field.current_password')}
			</label>
			<input
				id="ferret-ec-password"
				class="ferret-input"
				type="password"
				bind:value={currentPassword}
				required
			/>

			<button type="submit" class="ferret-btn" disabled={loading || !csrfToken}>
				{t('action.submit')}
			</button>
		</form>
	{:else if step === 'verify'}
		<p class="ferret-muted">{t('email.change.code_sent')}</p>

		<form
			class="ferret-form"
			onsubmit={(e) => {
				e.preventDefault();
				void verify();
			}}
		>
			<label class="ferret-label" for="ferret-ec-code">{t('flow.field.code')}</label>
			<input
				id="ferret-ec-code"
				class="ferret-input"
				type="text"
				bind:value={code}
				autocomplete="one-time-code"
				inputmode="numeric"
				required
			/>

			<button type="submit" class="ferret-btn" disabled={loading}>
				{t('email.change.verify')}
			</button>
		</form>
	{:else if step === 'done'}
		<p class="ferret-success-text">{t('email.change.success')}</p>
	{/if}
</section>

<style>
	.ferret-email-change {
		max-width: 24rem;
	}

	.ferret-muted {
		font-size: 0.875rem;
		color: var(--ferret-muted-color, #6b7280);
		margin-bottom: 1rem;
	}

	.ferret-current {
		font-size: 0.875rem;
		color: var(--ferret-label-color, #374151);
		margin-bottom: 1rem;
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
		border-color: var(--ferret-focus-color, #3b82f6);
		box-shadow: 0 0 0 2px var(--ferret-focus-ring, rgba(59, 130, 246, 0.3));
	}

	.ferret-btn {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--ferret-primary-bg, #3b82f6);
		color: var(--ferret-primary-color, #fff);
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.ferret-btn:hover:not(:disabled) {
		background: var(--ferret-primary-hover, #2563eb);
	}

	.ferret-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.ferret-success-text {
		color: var(--ferret-success-color, #16a34a);
		font-weight: 500;
	}
</style>
