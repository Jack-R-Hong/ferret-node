<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretT } from '../context.js';
	import type { MfaMethod } from '../types.js';
	import { FerretError } from '../errors.js';

	interface Props {
		onsuccess?: () => void;
	}

	let { onsuccess }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();

	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let csrfToken = $state('');
	let recoveryMethod = $state<MfaMethod | null>(null);

	let showForm = $state(false);
	let password = $state('');
	let submitting = $state(false);
	let newCodes = $state<string[]>([]);

	onMount(() => {
		void load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			const [status, flow] = await Promise.all([
				client.getMfaStatus(),
				client.createSettingsFlow()
			]);
			recoveryMethod = status.methods.find((m) => m.type === 'recovery_codes') ?? null;
			csrfToken = flow.csrf_token ?? '';
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}

	function clearMessages() {
		error = null;
		success = null;
	}

	async function regenerate() {
		clearMessages();
		submitting = true;
		try {
			const res = await client.regenerateRecoveryCodes(password, csrfToken);
			newCodes = res.codes;
			success = t('mfa.recovery_codes.regenerated');
			password = '';
			showForm = false;
			await load();
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			submitting = false;
		}
	}
</script>

<section class="ferret-recovery-codes">
	<h3 class="ferret-heading">{t('flow.method.recovery_code')}</h3>

	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	{#if loading}
		<p class="ferret-muted">…</p>
	{:else if !recoveryMethod}
		<p class="ferret-muted">{t('mfa.recovery_codes.no_codes') || ''}</p>
	{:else}
		{#if recoveryMethod.remaining !== undefined}
			<p class="ferret-muted">
				{t('mfa.recovery_codes.remaining', { remaining: String(recoveryMethod.remaining) })}
			</p>
		{/if}

		{#if newCodes.length > 0}
			<div class="ferret-codes-box">
				<p class="ferret-muted">{t('mfa.recovery_codes.save')}</p>
				<div class="ferret-codes-grid">
					{#each newCodes as code}
						<code class="ferret-code">{code}</code>
					{/each}
				</div>
			</div>
		{/if}

		{#if !showForm}
			<button
				class="ferret-btn ferret-btn-secondary"
				onclick={() => {
					clearMessages();
					showForm = true;
				}}
			>
				{t('mfa.recovery_codes.regenerate')}
			</button>
		{:else}
			<div class="ferret-card">
				<p class="ferret-muted">{t('mfa.recovery_codes.regenerate_confirm')}</p>
				<form
					class="ferret-form"
					onsubmit={(e) => {
						e.preventDefault();
						void regenerate();
					}}
				>
					<label class="ferret-label" for="ferret-regen-pw">
						{t('flow.field.current_password')}
					</label>
					<input
						id="ferret-regen-pw"
						class="ferret-input"
						type="password"
						bind:value={password}
						required
					/>
					<div class="ferret-form-actions">
						<button type="submit" class="ferret-btn ferret-btn-primary" disabled={submitting}>
							{t('mfa.recovery_codes.regenerate')}
						</button>
						<button
							type="button"
							class="ferret-btn ferret-btn-secondary"
							onclick={() => (showForm = false)}
						>
							{t('action.cancel')}
						</button>
					</div>
				</form>
			</div>
		{/if}
	{/if}
</section>

<style>
	.ferret-recovery-codes {
		max-width: 32rem;
	}

	.ferret-heading {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: var(--ferret-text-color, #111827);
	}

	.ferret-muted {
		color: var(--ferret-muted-color, #6b7280);
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
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

	.ferret-btn {
		padding: 0.5rem 1rem;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.ferret-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ferret-btn-primary {
		background: var(--ferret-primary-bg, #3b82f6);
		color: var(--ferret-primary-color, #fff);
	}

	.ferret-btn-primary:hover:not(:disabled) {
		background: var(--ferret-primary-hover, #2563eb);
	}

	.ferret-btn-secondary {
		background: transparent;
		border-color: var(--ferret-input-border, #d1d5db);
		color: var(--ferret-label-color, #374151);
	}

	.ferret-btn-secondary:hover:not(:disabled) {
		background: var(--ferret-muted-bg, #f3f4f6);
	}

	.ferret-form {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-top: 0.5rem;
	}

	.ferret-form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
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

	.ferret-card {
		background: var(--ferret-muted-bg, #f3f4f6);
		border-radius: 0.5rem;
		padding: 1rem;
		margin-top: 0.75rem;
	}

	.ferret-codes-box {
		width: 100%;
		margin: 0.5rem 0;
	}

	.ferret-codes-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.ferret-code {
		font-size: 0.875rem;
		padding: 0.25rem 0.5rem;
		background: var(--ferret-muted-bg, #f3f4f6);
		border-radius: 0.25rem;
		text-align: center;
	}
</style>
