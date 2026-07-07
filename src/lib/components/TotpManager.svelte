<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretT } from '../context.js';
	import type { MfaStatusResponse, TotpSetupResponse } from '../types.js';
	import { FerretError } from '../errors.js';
	import { svgToDataUri } from '../svg.js';

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
	let mfaStatus = $state<MfaStatusResponse | null>(null);

	let step = $state<'idle' | 'setup' | 'done'>('idle');
	let totpSetup = $state<TotpSetupResponse | null>(null);
	let verifyCode = $state('');
	let setupLoading = $state(false);

	let showDisable = $state(false);
	let disablePassword = $state('');
	let disableTotpCode = $state('');
	let disableRecoveryCode = $state('');
	let disableLoading = $state(false);

	let totpEnabled = $derived(
		mfaStatus?.methods.some((m) => m.type === 'totp' && m.enabled) ?? false
	);

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
			mfaStatus = status;
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

	async function startSetup() {
		clearMessages();
		setupLoading = true;
		try {
			totpSetup = await client.setupTotp(csrfToken);
			step = 'setup';
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			setupLoading = false;
		}
	}

	async function verify() {
		clearMessages();
		setupLoading = true;
		try {
			await client.verifyTotpSetup(verifyCode, csrfToken);
			step = 'done';
			success = t('flow.status.success');
			verifyCode = '';
			await load();
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			setupLoading = false;
		}
	}

	async function disable() {
		clearMessages();
		disableLoading = true;
		try {
			await client.disableTotp({
				current_password: disablePassword,
				csrf_token: csrfToken,
				totp_code: disableTotpCode || undefined,
				recovery_code: disableRecoveryCode || undefined
			});
			success = t('mfa.totp.disabled_success');
			showDisable = false;
			disablePassword = '';
			disableTotpCode = '';
			disableRecoveryCode = '';
			await load();
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			disableLoading = false;
		}
	}
</script>

<section class="ferret-totp-manager">
	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	{#if loading}
		<p class="ferret-muted">…</p>
	{:else if mfaStatus}
		{#each mfaStatus.methods as method}
			<div class="ferret-method-row">
				<span>{t(`flow.method.${method.type}`)}</span>
				<span class="ferret-badge" class:enabled={method.enabled}>
					{method.enabled ? 'ON' : 'OFF'}
				</span>
			</div>
		{/each}

		{#if !totpEnabled && step === 'idle'}
			<button
				class="ferret-btn ferret-btn-primary"
				onclick={startSetup}
				disabled={setupLoading}
			>
				{t('mfa.totp.setup')}
			</button>
		{:else if step === 'setup' && totpSetup}
			<div class="ferret-totp-setup">
				<p class="ferret-muted">{t('mfa.totp.scan_qr')}</p>
				<!-- Render the backend QR as an image, never inline `{@html}`. SVG
				     loaded via an <img> data-URI can't execute embedded script or
				     `on*` handlers, so a poisoned `qr_svg` is inert here. -->
				<img class="ferret-qr" alt={t('mfa.totp.scan_qr')} src={svgToDataUri(totpSetup.qr_svg)} />
				<p class="ferret-muted">{t('mfa.totp.manual_entry')}</p>
				<code class="ferret-secret">{totpSetup.secret}</code>

				{#if totpSetup.backup_codes.length > 0}
					<div class="ferret-codes-box">
						<p class="ferret-muted">{t('mfa.recovery_codes.save')}</p>
						<div class="ferret-codes-grid">
							{#each totpSetup.backup_codes as code}
								<code class="ferret-code">{code}</code>
							{/each}
						</div>
					</div>
				{/if}

				<form
					class="ferret-form"
					onsubmit={(e) => {
						e.preventDefault();
						void verify();
					}}
				>
					<label class="ferret-label" for="ferret-totp-verify">
						{t('flow.field.totp_code')}
					</label>
					<input
						id="ferret-totp-verify"
						class="ferret-input"
						type="text"
						bind:value={verifyCode}
						placeholder="123456"
						autocomplete="one-time-code"
						inputmode="numeric"
						required
					/>
					<button type="submit" class="ferret-btn ferret-btn-primary" disabled={setupLoading}>
						{t('action.verify')}
					</button>
				</form>
			</div>
		{/if}

		{#if totpEnabled}
			{#if !showDisable}
				<button
					class="ferret-btn ferret-btn-danger"
					onclick={() => {
						clearMessages();
						showDisable = true;
					}}
				>
					{t('mfa.totp.disable')}
				</button>
			{:else}
				<div class="ferret-card">
					<p class="ferret-muted">{t('mfa.totp.disable_confirm')}</p>
					<form
						class="ferret-form"
						onsubmit={(e) => {
							e.preventDefault();
							void disable();
						}}
					>
						<label class="ferret-label" for="ferret-disable-pw">
							{t('flow.field.current_password')}
						</label>
						<input
							id="ferret-disable-pw"
							class="ferret-input"
							type="password"
							bind:value={disablePassword}
							required
						/>
						<label class="ferret-label" for="ferret-disable-totp">
							{t('flow.field.totp_code')}
						</label>
						<input
							id="ferret-disable-totp"
							class="ferret-input"
							type="text"
							bind:value={disableTotpCode}
							placeholder="123456"
							inputmode="numeric"
						/>
						<label class="ferret-label" for="ferret-disable-recovery">
							{t('flow.field.recovery_code')}
						</label>
						<input
							id="ferret-disable-recovery"
							class="ferret-input"
							type="text"
							bind:value={disableRecoveryCode}
						/>
						<div class="ferret-form-actions">
							<button
								type="submit"
								class="ferret-btn ferret-btn-danger"
								disabled={disableLoading}
							>
								{t('mfa.totp.disable')}
							</button>
							<button
								type="button"
								class="ferret-btn ferret-btn-secondary"
								onclick={() => (showDisable = false)}
							>
								{t('action.cancel')}
							</button>
						</div>
					</form>
				</div>
			{/if}
		{/if}
	{/if}
</section>

<style>
	.ferret-totp-manager {
		max-width: 32rem;
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

	.ferret-method-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--ferret-input-border, #d1d5db);
		font-size: 0.875rem;
	}

	.ferret-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		background: var(--ferret-muted-bg, #f3f4f6);
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-badge.enabled {
		background: var(--ferret-success-bg, #dcfce7);
		color: var(--ferret-success-color, #16a34a);
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

	.ferret-btn-danger {
		background: var(--ferret-error-color, #dc2626);
		color: #fff;
	}

	.ferret-btn-danger:hover:not(:disabled) {
		background: #b91c1c;
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

	.ferret-totp-setup {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin: 1rem 0;
	}

	.ferret-qr {
		display: block;
		width: 100%;
		max-width: 200px;
		height: auto;
	}

	.ferret-secret {
		font-size: 0.875rem;
		padding: 0.5rem 1rem;
		background: var(--ferret-muted-bg, #f3f4f6);
		border-radius: 0.375rem;
		word-break: break-all;
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
