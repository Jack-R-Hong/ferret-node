<script lang="ts">
	import { getFerretClient, getFerretT } from '../context.js';
	import type { TotpSetupResponse, MfaStatusResponse } from '../types.js';
	import { FerretError } from '../errors.js';

	interface Props {
		onsuccess?: () => void;
	}

	let { onsuccess }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();

	let loading = $state(false);
	let error = $state<FerretError | Error | null>(null);
	let step = $state<'status' | 'setup' | 'verify' | 'done'>('status');
	let mfaStatus = $state<MfaStatusResponse | null>(null);
	let totpSetup = $state<TotpSetupResponse | null>(null);
	let verifyCode = $state('');
	let backupCodes = $state<string[]>([]);

	async function loadStatus() {
		loading = true;
		error = null;
		try {
			mfaStatus = await client.getMfaStatus();
		} catch (err) {
			error = err instanceof Error ? err : new Error(String(err));
		} finally {
			loading = false;
		}
	}

	async function startTotpSetup() {
		loading = true;
		error = null;
		try {
			totpSetup = await client.setupTotp();
			backupCodes = totpSetup.backup_codes;
			step = 'setup';
		} catch (err) {
			error = err instanceof Error ? err : new Error(String(err));
		} finally {
			loading = false;
		}
	}

	async function verifyTotp() {
		loading = true;
		error = null;
		try {
			await client.verifyTotpSetup(verifyCode);
			step = 'done';
			onsuccess?.();
		} catch (err) {
			error = err instanceof Error ? err : new Error(String(err));
		} finally {
			loading = false;
		}
	}

	// Load status on mount
	loadStatus();
</script>

<div class="ferret-mfa-setup">
	{#if loading && step === 'status'}
		<div class="ferret-loading">...</div>
	{:else if step === 'status' && mfaStatus}
		<div class="ferret-mfa-status">
			<h3 class="ferret-heading">{t('flow.method.totp')}</h3>
			{#each mfaStatus.methods as method}
				<div class="ferret-mfa-method">
					<span>{t(`flow.method.${method.type}`)}</span>
					<span class="ferret-badge" class:enabled={method.enabled}>
						{method.enabled ? 'ON' : 'OFF'}
					</span>
				</div>
			{/each}

			{#if !mfaStatus.methods.some((m) => m.type === 'totp' && m.enabled)}
				<button class="ferret-submit" onclick={startTotpSetup} disabled={loading}>
					{t('flow.method.totp')} Setup
				</button>
			{/if}
		</div>
	{:else if step === 'setup' && totpSetup}
		<div class="ferret-totp-setup">
			<p class="ferret-status-message">Scan the QR code with your authenticator app:</p>
			<div class="ferret-qr">{@html totpSetup.qr_svg}</div>
			<p class="ferret-secret-label">Or enter this secret manually:</p>
			<code class="ferret-secret">{totpSetup.secret}</code>

			{#if backupCodes.length > 0}
				<div class="ferret-backup-codes">
					<p class="ferret-status-message">Save these recovery codes in a safe place:</p>
					<div class="ferret-codes-grid">
						{#each backupCodes as code}
							<code class="ferret-code">{code}</code>
						{/each}
					</div>
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); verifyTotp(); }} class="ferret-verify-form">
				{#if error}
					<div class="ferret-form-error" role="alert">
						{error instanceof FerretError ? t(error.i18nKey) : error.message}
					</div>
				{/if}
				<label for="ferret-totp-verify" class="ferret-label">{t('flow.field.totp_code')}</label>
				<input
					id="ferret-totp-verify"
					type="text"
					bind:value={verifyCode}
					class="ferret-input"
					placeholder="123456"
					autocomplete="one-time-code"
					inputmode="numeric"
					required
				/>
				<button type="submit" class="ferret-submit" disabled={loading}>
					{t('action.verify')}
				</button>
			</form>
		</div>
	{:else if step === 'done'}
		<p class="ferret-status-message">{t('flow.status.success')}</p>
	{/if}

	{#if error && step === 'status'}
		<div class="ferret-form-error" role="alert">
			{error instanceof FerretError ? t(error.i18nKey) : error.message}
		</div>
	{/if}
</div>

<style>
	.ferret-mfa-setup {
		max-width: var(--ferret-form-width, 24rem);
		margin: 0 auto;
	}

	.ferret-loading {
		text-align: center;
		color: var(--ferret-muted-color, #6b7280);
		padding: 2rem 0;
	}

	.ferret-heading {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-mfa-method {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--ferret-input-border, #d1d5db);
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

	.ferret-totp-setup {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.ferret-qr {
		max-width: 200px;
	}

	.ferret-qr :global(svg) {
		width: 100%;
		height: auto;
	}

	.ferret-secret-label {
		font-size: 0.875rem;
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-secret {
		font-size: 0.875rem;
		padding: 0.5rem 1rem;
		background: var(--ferret-muted-bg, #f3f4f6);
		border-radius: 0.375rem;
		word-break: break-all;
	}

	.ferret-backup-codes {
		width: 100%;
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

	.ferret-verify-form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.ferret-status-message {
		text-align: center;
		color: var(--ferret-label-color, #374151);
		font-size: 0.875rem;
	}

	.ferret-form-error {
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		background: var(--ferret-error-bg, #fef2f2);
		color: var(--ferret-error-color, #dc2626);
		font-size: 0.875rem;
		border: 1px solid var(--ferret-error-border, #fecaca);
	}

	.ferret-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.375rem;
		font-size: 1rem;
		text-align: center;
		letter-spacing: 0.25em;
	}

	.ferret-input:focus {
		outline: none;
		border-color: var(--ferret-focus-color, #3b82f6);
		box-shadow: 0 0 0 2px var(--ferret-focus-ring, rgba(59, 130, 246, 0.3));
	}

	.ferret-submit {
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
</style>
