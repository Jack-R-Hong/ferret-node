<script lang="ts">
	import { onMount } from 'svelte';
	import type { Identity } from '../types.js';
	import { createFlowStore } from '../stores/flow.svelte.js';
	import { getFerretClient, getFerretSession, getFerretT } from '../context.js';
	import FlowForm from './FlowForm.svelte';

	interface Props {
		onsuccess?: (identity: Identity) => void;
		onlogin?: () => void;
	}

	let { onsuccess, onlogin }: Props = $props();

	const client = getFerretClient();
	const session = getFerretSession();
	const t = getFerretT();
	const flow = createFlowStore();

	let step = $state<'email' | 'code' | 'password'>('email');

	async function handleEmailSubmit(data: Record<string, string>) {
		flow.setLoading();
		try {
			const res = await client.createRecoveryFlow(data.email);
			flow.setReady(res);
			step = 'code';
		} catch (err) {
			flow.setError(err);
		}
	}

	async function handleCodeSubmit(data: Record<string, string>) {
		const currentFlow = flow.flow;
		if (!currentFlow) return;

		flow.setSubmitting(currentFlow);
		try {
			const res = await client.submitRecovery(currentFlow.id, {
				code: data.code,
				csrf_token: currentFlow.csrf_token ?? ''
			});
			if (res.status === 'password_required') {
				flow.setReady({ ...currentFlow, status: 'password_required', ui: res.ui! });
				step = 'password';
			} else {
				flow.setSuccess(res);
			}
		} catch (err) {
			flow.setError(err, currentFlow);
		}
	}

	async function handlePasswordSubmit(data: Record<string, string>) {
		const currentFlow = flow.flow;
		if (!currentFlow) return;

		flow.setSubmitting(currentFlow);
		try {
			const res = await client.submitRecovery(currentFlow.id, {
				password: data.password,
				csrf_token: currentFlow.csrf_token ?? ''
			});
			flow.setSuccess(res);
			if (res.identity) {
				session.setAuthenticated(res.identity, new Date().toISOString(), '');
				onsuccess?.(res.identity);
			}
		} catch (err) {
			flow.setError(err, currentFlow);
		}
	}
</script>

<div class="ferret-recovery">
	{#if step === 'email'}
		<p class="ferret-status-message">{t('action.recover')}</p>
		<FlowForm
			fields={[{ name: 'email', type: 'email', required: true, label: t('flow.field.email') }]}
			error={flow.error}
			loading={flow.isLoading}
			submitLabel={t('action.submit')}
			onsubmit={handleEmailSubmit}
		/>
	{:else if step === 'code'}
		<p class="ferret-status-message">{t('flow.status.code_sent')}</p>
		<FlowForm
			fields={[{ name: 'code', type: 'text', required: true, label: t('flow.field.code') }]}
			error={flow.error}
			loading={flow.isLoading}
			submitLabel={t('action.verify')}
			onsubmit={handleCodeSubmit}
		/>
	{:else if step === 'password'}
		<p class="ferret-status-message">{t('flow.status.password_required')}</p>
		<FlowForm
			fields={[{ name: 'password', type: 'password', required: true, label: t('flow.field.new_password') }]}
			error={flow.error}
			loading={flow.isLoading}
			submitLabel={t('action.save')}
			onsubmit={handlePasswordSubmit}
		/>
	{:else if flow.phase === 'success'}
		<p class="ferret-status-message">{t('flow.status.success')}</p>
	{/if}

	{#if onlogin && step === 'email'}
		<div class="ferret-recovery-links">
			<button class="ferret-link" onclick={onlogin}>
				{t('action.back')}
			</button>
		</div>
	{/if}
</div>

<style>
	.ferret-recovery {
		max-width: var(--ferret-form-width, 24rem);
		margin: 0 auto;
	}

	.ferret-status-message {
		text-align: center;
		margin-bottom: 1rem;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-recovery-links {
		text-align: center;
		margin-top: 1rem;
	}

	.ferret-link {
		background: none;
		border: none;
		color: var(--ferret-primary-bg, #3b82f6);
		cursor: pointer;
		font-size: 0.875rem;
		text-decoration: none;
		padding: 0;
	}

	.ferret-link:hover {
		text-decoration: underline;
	}
</style>
