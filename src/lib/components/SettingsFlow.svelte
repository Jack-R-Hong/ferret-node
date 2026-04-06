<script lang="ts">
	import { onMount } from 'svelte';
	import type { Identity } from '../types.js';
	import { createFlowStore } from '../stores/flow.svelte.js';
	import { getFerretClient, getFerretSession, getFerretT } from '../context.js';
	import FlowForm from './FlowForm.svelte';

	interface Props {
		/** Which section to show: 'password' or 'profile' */
		section?: 'password' | 'profile';
		onsuccess?: (identity: Identity) => void;
	}

	let { section = 'password', onsuccess }: Props = $props();

	const client = getFerretClient();
	const session = getFerretSession();
	const t = getFerretT();
	const flow = createFlowStore();

	onMount(() => {
		initFlow();
	});

	async function initFlow() {
		flow.setLoading();
		try {
			const res = await client.createSettingsFlow();
			flow.setReady(res);
		} catch (err) {
			flow.setError(err);
		}
	}

	async function handlePasswordSubmit(data: Record<string, string>) {
		const currentFlow = flow.flow;
		if (!currentFlow) return;

		flow.setSubmitting(currentFlow);
		try {
			const res = await client.submitSettings(currentFlow.id, {
				csrf_token: currentFlow.csrf_token ?? '',
				password: { current: data.current, new: data.new }
			});
			flow.setSuccess(res);
			session.setAuthenticated(res.identity, new Date().toISOString(), '');
			onsuccess?.(res.identity);
		} catch (err) {
			flow.setError(err, currentFlow);
		}
	}

	async function handleProfileSubmit(data: Record<string, string>) {
		const currentFlow = flow.flow;
		if (!currentFlow) return;

		flow.setSubmitting(currentFlow);
		try {
			const res = await client.submitSettings(currentFlow.id, {
				csrf_token: currentFlow.csrf_token ?? '',
				profile: data
			});
			flow.setSuccess(res);
			session.setAuthenticated(res.identity, new Date().toISOString(), '');
			onsuccess?.(res.identity);
		} catch (err) {
			flow.setError(err, currentFlow);
		}
	}
</script>

<div class="ferret-settings">
	{#if flow.phase === 'loading'}
		<div class="ferret-loading">...</div>
	{:else if section === 'password'}
		<FlowForm
			fields={[
				{ name: 'current', type: 'password', required: true, label: t('flow.field.current_password') },
				{ name: 'new', type: 'password', required: true, label: t('flow.field.new_password') }
			]}
			error={flow.error}
			loading={flow.isLoading}
			submitLabel={t('action.save')}
			onsubmit={handlePasswordSubmit}
		/>
	{:else if flow.ui}
		<FlowForm
			fields={flow.ui.fields.filter((f) => f.type !== 'hidden' && f.name !== 'csrf_token')}
			error={flow.error}
			loading={flow.isLoading}
			submitLabel={t('action.save')}
			onsubmit={handleProfileSubmit}
		/>
	{:else if flow.phase === 'success'}
		<p class="ferret-status-message">{t('flow.status.success')}</p>
	{/if}
</div>

<style>
	.ferret-settings {
		max-width: var(--ferret-form-width, 24rem);
		margin: 0 auto;
	}

	.ferret-loading {
		text-align: center;
		color: var(--ferret-muted-color, #6b7280);
		padding: 2rem 0;
	}

	.ferret-status-message {
		text-align: center;
		color: var(--ferret-label-color, #374151);
	}
</style>
