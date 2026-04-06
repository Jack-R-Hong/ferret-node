<script lang="ts">
	import type { Identity } from '../types.js';
	import { createFlowStore } from '../stores/flow.svelte.js';
	import { getFerretClient, getFerretT } from '../context.js';
	import FlowForm from './FlowForm.svelte';

	interface Props {
		onsuccess?: (identity: Identity) => void;
	}

	let { onsuccess }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();
	const flow = createFlowStore();

	let sent = $state(false);

	async function sendCode() {
		flow.setLoading();
		try {
			const res = await client.createVerificationFlow();
			flow.setReady(res);
			sent = true;
		} catch (err) {
			flow.setError(err);
		}
	}

	async function handleSubmit(data: Record<string, string>) {
		const currentFlow = flow.flow;
		if (!currentFlow) return;

		flow.setSubmitting(currentFlow);
		try {
			const res = await client.submitVerification(currentFlow.flow_id, {
				code: data.code,
				csrf_token: currentFlow.csrf_token ?? ''
			});
			flow.setSuccess(res);
			onsuccess?.(res.identity);
		} catch (err) {
			flow.setError(err, currentFlow);
		}
	}
</script>

<div class="ferret-verification">
	{#if !sent}
		<p class="ferret-status-message">{t('flow.field.email')}</p>
		<button class="ferret-submit" disabled={flow.isLoading} onclick={sendCode}>
			{t('action.verify')}
		</button>
	{:else if flow.ui}
		<p class="ferret-status-message">{t('flow.status.code_sent')}</p>
		<FlowForm
			fields={[{ name: 'code', type: 'text', required: true, label: t('flow.field.code') }]}
			error={flow.error}
			loading={flow.isLoading}
			submitLabel={t('action.verify')}
			onsubmit={handleSubmit}
		/>
		<button class="ferret-link" onclick={sendCode} disabled={flow.isLoading}>
			{t('action.resend_code')}
		</button>
	{:else if flow.phase === 'success'}
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
