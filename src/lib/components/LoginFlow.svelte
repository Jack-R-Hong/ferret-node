<script lang="ts">
	import { onMount } from 'svelte';
	import type { Identity } from '../types.js';
	import { FerretError } from '../errors.js';
	import { createFlowStore } from '../stores/flow.svelte.js';
	import { getFerretClient, getFerretSession, getFerretT } from '../context.js';
	import FlowForm from './FlowForm.svelte';

	interface Props {
		/** Called on successful login */
		onsuccess?: (identity: Identity) => void;
		/** Called when user clicks "Forgot password?" */
		onforgot?: () => void;
		/** Called when user clicks "Sign up" */
		onregister?: () => void;
	}

	let { onsuccess, onforgot, onregister }: Props = $props();

	const client = getFerretClient();
	const session = getFerretSession();
	const t = getFerretT();
	const flow = createFlowStore();

	let mfaMethod = $state<'totp' | 'recovery_code' | 'passkey'>('totp');
	let passkeyMfaLoading = $state(false);

	onMount(() => {
		initFlow();
	});

	async function initFlow() {
		flow.setLoading();
		try {
			const res = await client.createLoginFlow();
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
			data.csrf_token = currentFlow.csrf_token ?? '';
			const res = await client.submitLogin(currentFlow.id, {
				identifier: data.identifier,
				password: data.password,
				csrf_token: data.csrf_token
			});
			// API returns status in response body for MFA transitions (not as error)
			if (res.status === 'mfa_required' || res.status === 'mfa_setup_required') {
				flow.setReady({ ...currentFlow, status: res.status, ui: res.ui ?? currentFlow.ui });
			} else {
				flow.setSuccess(res);
				session.setAuthenticated(res.session.identity, res.session.authenticated_at, res.session.expires_at);
				onsuccess?.(res.session.identity);
			}
		} catch (err) {
			flow.setError(err, currentFlow);
		}
	}

	async function handleMfaSubmit(data: Record<string, string>) {
		const currentFlow = flow.flow;
		if (!currentFlow) return;

		flow.setSubmitting(currentFlow);
		try {
			const res = await client.submitLoginMfa(currentFlow.id, {
				method: mfaMethod === 'passkey' ? 'totp' : mfaMethod,
				code: data.code,
				csrf_token: currentFlow.csrf_token ?? ''
			});
			flow.setSuccess(res);
			session.setAuthenticated(res.identity, new Date().toISOString(), res.expires_at ?? '');
			onsuccess?.(res.identity);
		} catch (err) {
			flow.setError(err, currentFlow);
		}
	}

	// Passkey as the second factor: begin → navigator.credentials.get → finish,
	// driven by the SDK client. `null` means the user dismissed the platform
	// prompt — stay on the MFA screen rather than erroring.
	async function handlePasskeyMfa() {
		const currentFlow = flow.flow;
		if (!currentFlow || passkeyMfaLoading) return;

		passkeyMfaLoading = true;
		flow.setSubmitting(currentFlow);
		try {
			const res = await client.verifyPasskeyMfa(currentFlow.id);
			if (!res) {
				flow.setReady(currentFlow);
				return;
			}
			flow.setSuccess(res);
			session.setAuthenticated(
				res.session.identity,
				res.session.authenticated_at,
				res.session.expires_at
			);
			onsuccess?.(res.session.identity);
		} catch (err) {
			flow.setError(err, currentFlow);
		} finally {
			passkeyMfaLoading = false;
		}
	}
</script>

<div class="ferret-login">
	{#if flow.phase === 'loading'}
		<div class="ferret-loading" aria-live="polite">{t('flow.status.input_required')}</div>
	{:else if flow.flow?.status === 'mfa_required'}
		<div class="ferret-mfa">
			<p class="ferret-status-message">{t('flow.status.mfa_required')}</p>

			<div class="ferret-mfa-tabs">
				<button
					class="ferret-mfa-tab"
					class:active={mfaMethod === 'totp'}
					onclick={() => (mfaMethod = 'totp')}
				>
					{t('flow.method.totp')}
				</button>
				<button
					class="ferret-mfa-tab"
					class:active={mfaMethod === 'passkey'}
					onclick={() => (mfaMethod = 'passkey')}
				>
					{t('flow.method.webauthn')}
				</button>
				<button
					class="ferret-mfa-tab"
					class:active={mfaMethod === 'recovery_code'}
					onclick={() => (mfaMethod = 'recovery_code')}
				>
					{t('flow.method.recovery_code')}
				</button>
			</div>

			{#if mfaMethod === 'passkey'}
				<p class="ferret-status-message">{t('mfa.passkey.verify_prompt')}</p>
				{#if flow.error}
					<div class="ferret-form-error" role="alert">
						{flow.error instanceof FerretError ? t(flow.error.i18nKey) : flow.error.message}
					</div>
				{/if}
				<button
					class="ferret-passkey-verify"
					onclick={handlePasskeyMfa}
					disabled={passkeyMfaLoading}
				>
					{t('mfa.passkey.verify')}
				</button>
			{:else}
				<FlowForm
					fields={[
						{
							name: 'code',
							type: 'text',
							required: true,
							label: mfaMethod === 'totp'
								? t('flow.field.totp_code')
								: t('flow.field.recovery_code')
						}
					]}
					error={flow.error}
					loading={flow.isLoading}
					submitLabel={t('action.verify')}
					onsubmit={handleMfaSubmit}
				/>
			{/if}
		</div>
	{:else if flow.flow?.status === 'mfa_setup_required'}
		<div class="ferret-mfa">
			<p class="ferret-status-message">{t('flow.status.mfa_setup_required')}</p>
			{#if flow.ui}
				<FlowForm
					fields={flow.ui.fields}
					error={flow.error}
					loading={flow.isLoading}
					submitLabel={t('action.verify')}
					onsubmit={handleMfaSubmit}
				/>
			{/if}
		</div>
	{:else if flow.ui}
		<FlowForm
			fields={flow.ui.fields}
			error={flow.error}
			loading={flow.isLoading}
			submitLabel={t('action.login')}
			onsubmit={handleSubmit}
		/>

		<div class="ferret-login-links">
			{#if onforgot}
				<button class="ferret-link" onclick={onforgot}>
					{t('action.forgot_password')}
				</button>
			{/if}
			{#if onregister}
				<span class="ferret-link-text">
					{t('action.no_account')}
					<button class="ferret-link" onclick={onregister}>
						{t('action.register')}
					</button>
				</span>
			{/if}
		</div>
	{:else if flow.phase === 'success'}
		<p class="ferret-status-message">{t('flow.status.success')}</p>
	{/if}
</div>

<style>
	.ferret-login {
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
		margin-bottom: 1rem;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-mfa-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.ferret-mfa-tab {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.375rem;
		background: transparent;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--ferret-label-color, #374151);
		transition: all 0.15s;
	}

	.ferret-mfa-tab.active {
		background: var(--ferret-primary-bg, #3b82f6);
		color: var(--ferret-primary-color, #ffffff);
		border-color: var(--ferret-primary-bg, #3b82f6);
	}

	.ferret-passkey-verify {
		width: 100%;
		padding: 0.625rem 1rem;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		background: var(--ferret-primary-bg, #3b82f6);
		color: var(--ferret-primary-color, #ffffff);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.ferret-passkey-verify:hover:not(:disabled) {
		background: var(--ferret-primary-hover, #2563eb);
	}

	.ferret-passkey-verify:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ferret-form-error {
		padding: 0.625rem 0.875rem;
		margin-bottom: 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		background: var(--ferret-error-bg, #fef2f2);
		color: var(--ferret-error-color, #dc2626);
		border: 1px solid var(--ferret-error-border, #fecaca);
	}

	.ferret-login-links {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
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
