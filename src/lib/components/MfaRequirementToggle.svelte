<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretT } from '../context.js';
	import type { MfaStatusResponse } from '../types.js';
	import { FerretError } from '../errors.js';

	interface Props {
		/** Called after the requirement level changes successfully. */
		onsuccess?: () => void;
	}

	let { onsuccess }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();

	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let mfaStatus = $state<MfaStatusResponse | null>(null);
	// Surfaced before we actually drop the requirement — see onToggle().
	let confirmingDisable = $state(false);

	// Level 1 = password only; >= 2 = a second factor is required on every login.
	const required = $derived((mfaStatus?.mfa_level ?? 1) >= 2);
	// You can only require a second factor if you have one enrolled.
	const hasFactor = $derived(
		mfaStatus?.methods.some(
			(m) => (m.type === 'totp' || m.type === 'passkey') && m.enabled
		) ?? false
	);

	onMount(() => void load());

	async function load() {
		loading = true;
		error = null;
		try {
			mfaStatus = await client.getMfaStatus();
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

	function onToggle() {
		clearMessages();
		if (saving) return;
		if (required) {
			// Turning the requirement OFF weakens the account — confirm first.
			confirmingDisable = true;
		} else {
			// Turning it ON is the safe direction; just do it (backend rejects if
			// no factor is enrolled, but we gate the control on `hasFactor` too).
			void setLevel(2);
		}
	}

	async function setLevel(level: number) {
		saving = true;
		clearMessages();
		try {
			await client.setMfaLevel(level);
			confirmingDisable = false;
			success =
				level >= 2
					? t('mfa.require.enabled_success')
					: t('mfa.require.disabled_success');
			await load();
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<section class="ferret-mfa-require">
	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	{#if loading}
		<p class="ferret-muted">…</p>
	{:else if mfaStatus}
		<div class="ferret-require-row">
			<div class="ferret-require-copy">
				<span class="ferret-require-title">{t('mfa.require.title')}</span>
				<span class="ferret-muted">{t('mfa.require.sub')}</span>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={required}
				aria-label={t('mfa.require.title')}
				class="ferret-switch"
				class:on={required}
				disabled={saving || (!required && !hasFactor)}
				onclick={onToggle}
			>
				<span class="ferret-switch-knob"></span>
			</button>
		</div>

		{#if !required && !hasFactor}
			<p class="ferret-muted ferret-require-hint">{t('mfa.require.need_factor')}</p>
		{/if}

		{#if confirmingDisable}
			<div class="ferret-card ferret-require-warning">
				<p class="ferret-warning-text" role="alert">{t('mfa.require.disable_warning')}</p>
				<div class="ferret-form-actions">
					<button
						type="button"
						class="ferret-btn ferret-btn-danger"
						disabled={saving}
						onclick={() => void setLevel(1)}
					>
						{t('mfa.require.disable_confirm')}
					</button>
					<button
						type="button"
						class="ferret-btn ferret-btn-secondary"
						disabled={saving}
						onclick={() => (confirmingDisable = false)}
					>
						{t('action.cancel')}
					</button>
				</div>
			</div>
		{/if}
	{/if}
</section>

<style>
	.ferret-mfa-require {
		max-width: 32rem;
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

	.ferret-muted {
		color: var(--ferret-muted-color, #6b7280);
		font-size: 0.875rem;
	}

	.ferret-require-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0;
	}
	.ferret-require-copy {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.ferret-require-title {
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--ferret-label-color, #374151);
	}
	.ferret-require-hint {
		margin-top: 0.25rem;
	}

	/* Toggle switch */
	.ferret-switch {
		position: relative;
		flex: 0 0 auto;
		width: 2.75rem;
		height: 1.5rem;
		border-radius: 9999px;
		border: none;
		padding: 0;
		cursor: pointer;
		background: var(--ferret-input-border, #d1d5db);
		transition: background 0.15s;
	}
	.ferret-switch.on {
		background: var(--ferret-success-color, #16a34a);
	}
	.ferret-switch:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.ferret-switch-knob {
		position: absolute;
		top: 0.1875rem;
		left: 0.1875rem;
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 9999px;
		background: #fff;
		transition: transform 0.15s;
	}
	.ferret-switch.on .ferret-switch-knob {
		transform: translateX(1.25rem);
	}

	.ferret-card {
		background: var(--ferret-muted-bg, #f3f4f6);
		border-radius: 0.5rem;
		padding: 1rem;
		margin-top: 0.75rem;
	}
	.ferret-require-warning {
		border: 1px solid var(--ferret-error-border, #fecaca);
		background: var(--ferret-error-bg, #fef2f2);
	}
	.ferret-warning-text {
		margin: 0 0 0.75rem;
		font-size: 0.875rem;
		color: var(--ferret-error-color, #dc2626);
	}

	.ferret-form-actions {
		display: flex;
		gap: 0.5rem;
	}
	.ferret-btn {
		padding: 0.5rem 1rem;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}
	.ferret-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.ferret-btn-secondary {
		background: transparent;
		border-color: var(--ferret-input-border, #d1d5db);
		color: var(--ferret-label-color, #374151);
	}
	.ferret-btn-secondary:hover:not(:disabled) {
		background: var(--ferret-muted-bg, #f3f4f6);
	}
	.ferret-btn-danger {
		background: var(--ferret-error-color, #dc2626);
		color: #fff;
	}
	.ferret-btn-danger:hover:not(:disabled) {
		background: #b91c1c;
	}
</style>
