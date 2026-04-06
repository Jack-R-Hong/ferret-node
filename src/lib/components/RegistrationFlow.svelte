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

	onMount(() => {
		initFlow();
	});

	async function initFlow() {
		flow.setLoading();
		try {
			const res = await client.createRegistrationFlow();
			flow.setReady(res);
		} catch (err) {
			flow.setError(err);
		}
	}

	async function handleSubmit(data: Record<string, string>) {
		const currentFlow = flow.flow;
		if (!currentFlow) return;

		flow.setSubmitting(currentFlow);
		try {
			const res = await client.submitRegistration(currentFlow.flow_id, {
				email: data.email,
				username: data.username,
				password: data.password,
				csrf_token: currentFlow.csrf_token ?? '',
				given_name: data.given_name || undefined,
				family_name: data.family_name || undefined
			});
			flow.setSuccess(res);
			session.setAuthenticated(res.identity, new Date().toISOString(), '');
			onsuccess?.(res.identity);
		} catch (err) {
			flow.setError(err, currentFlow);
		}
	}
</script>

<div class="ferret-registration">
	{#if flow.phase === 'loading'}
		<div class="ferret-loading">{t('flow.status.input_required')}</div>
	{:else if flow.ui}
		<FlowForm
			fields={flow.ui.fields}
			error={flow.error}
			loading={flow.isLoading}
			submitLabel={t('action.register')}
			onsubmit={handleSubmit}
		/>

		{#if onlogin}
			<div class="ferret-registration-links">
				<span class="ferret-link-text">
					{t('action.have_account')}
					<button class="ferret-link" onclick={onlogin}>
						{t('action.login')}
					</button>
				</span>
			</div>
		{/if}
	{:else if flow.phase === 'success'}
		<p class="ferret-status-message">{t('flow.status.success')}</p>
	{/if}
</div>

<style>
	.ferret-registration {
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

	.ferret-registration-links {
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

	.ferret-link-text {
		font-size: 0.875rem;
		color: var(--ferret-muted-color, #6b7280);
	}
</style>
