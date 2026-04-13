<script lang="ts">
	import type { Identity } from '../types.js';
	import { FerretError } from '../errors.js';
	import { getFerretClient, getFerretT } from '../context.js';
	import FlowForm from './FlowForm.svelte';

	interface Props {
		onsuccess?: (identity?: Identity) => void;
	}

	let { onsuccess }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();

	// Local state — the verification endpoint returns a minimal
	// `{flow_id, email, message}` payload (NOT a full Flow with `ui`), so we
	// don't use the generic flow store here.
	let phase = $state<'initial' | 'code_sent' | 'success'>('initial');
	let flowId = $state<string | null>(null);
	let loading = $state(false);
	let submitError = $state<FerretError | Error | null>(null);

	async function sendCode() {
		loading = true;
		submitError = null;
		try {
			const res = await client.createVerificationFlow();
			flowId = res.flow_id;
			phase = 'code_sent';
		} catch (err) {
			submitError =
				err instanceof FerretError || err instanceof Error ? err : new Error(String(err));
		} finally {
			loading = false;
		}
	}

	async function handleSubmit(data: Record<string, string>) {
		if (!flowId) return;
		loading = true;
		submitError = null;
		try {
			const res = await client.submitVerification(flowId, {
				code: data.code,
				csrf_token: ''
			});
			phase = 'success';
			onsuccess?.(res.identity);
		} catch (err) {
			submitError =
				err instanceof FerretError || err instanceof Error ? err : new Error(String(err));
		} finally {
			loading = false;
		}
	}
</script>

<div class="ferret-verification">
	{#if phase === 'initial'}
		<p class="ferret-status-message">{t('action.verify')}</p>
		{#if submitError}
			<div class="ferret-form-error" role="alert">
				{submitError instanceof FerretError ? t(submitError.i18nKey) : submitError.message}
			</div>
		{/if}
		<button class="ferret-submit" disabled={loading} onclick={sendCode}>
			{t('action.submit')}
		</button>
	{:else if phase === 'code_sent'}
		<p class="ferret-status-message">{t('flow.status.code_sent')}</p>
		<FlowForm
			fields={[{ name: 'code', type: 'text', required: true, label: t('flow.field.code') }]}
			error={submitError}
			loading={loading}
			submitLabel={t('action.verify')}
			onsubmit={handleSubmit}
		/>
		<button class="ferret-link" onclick={sendCode} disabled={loading}>
			{t('action.resend_code')}
		</button>
	{:else if phase === 'success'}
		<p class="ferret-status-message">{t('flow.status.success')}</p>
	{/if}
</div>

<style>
	.ferret-verification {
		max-width: var(--ferret-form-width, 24rem);
		margin: 0 auto;
		text-align: center;
	}

	.ferret-status-message {
		margin-bottom: 1rem;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-form-error {
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		background: var(--ferret-error-bg, #fef2f2);
		color: var(--ferret-error-color, #dc2626);
		font-size: 0.875rem;
		border: 1px solid var(--ferret-error-border, #fecaca);
		margin-bottom: 1rem;
	}

	.ferret-submit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.625rem 1.25rem;
		background: var(--ferret-primary-bg, #3b82f6);
		color: var(--ferret-primary-color, #ffffff);
		border: none;
		border-radius: 0.375rem;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
	}

	.ferret-submit:hover:not(:disabled) {
		background: var(--ferret-primary-hover, #2563eb);
	}

	.ferret-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ferret-link {
		display: inline-block;
		margin-top: 0.75rem;
		background: none;
		border: none;
		color: var(--ferret-primary-bg, #3b82f6);
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0;
	}

	.ferret-link:hover {
		text-decoration: underline;
	}
</style>
