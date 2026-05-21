<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretT } from '../context.js';
	import type { PasskeyCredential } from '../types.js';
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
	let passkeys = $state<PasskeyCredential[]>([]);

	let registerLoading = $state(false);
	let deletingId = $state<string | null>(null);
	let deletePassword = $state('');
	let deleteLoading = $state(false);

	onMount(() => {
		void load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			const [res, flow] = await Promise.all([
				client.listPasskeys().catch(() => ({ credentials: [] })),
				client.createSettingsFlow()
			]);
			passkeys = res.credentials;
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

	function formatDate(d: string): string {
		return new Date(d).toLocaleDateString();
	}

	function b64ToBytes(b64: string): Uint8Array {
		return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	}

	function bytesToB64(bytes: ArrayBuffer): string {
		return btoa(String.fromCharCode(...new Uint8Array(bytes)));
	}

	async function register() {
		clearMessages();
		registerLoading = true;
		try {
			const options = await client.beginPasskeyRegistration();
			const publicKey: PublicKeyCredentialCreationOptions = {
				challenge: b64ToBytes(options.challenge) as BufferSource,
				rp: options.rp,
				user: {
					id: b64ToBytes(options.user.id) as BufferSource,
					name: options.user.name,
					displayName: options.user.displayName
				},
				pubKeyCredParams: options.pubKeyCredParams as PublicKeyCredentialParameters[],
				authenticatorSelection:
					options.authenticatorSelection as AuthenticatorSelectionCriteria,
				timeout: options.timeout,
				excludeCredentials: options.excludeCredentials.map((c) => ({
					type: c.type as 'public-key',
					id: b64ToBytes(c.id) as BufferSource
				}))
			};
			const credential = (await navigator.credentials.create({ publicKey })) as
				| PublicKeyCredential
				| null;

			if (!credential) throw new Error('Passkey registration cancelled');

			const response = credential.response as AuthenticatorAttestationResponse;
			await client.completePasskeyRegistration({
				id: credential.id,
				rawId: bytesToB64(credential.rawId),
				type: credential.type,
				response: {
					attestationObject: bytesToB64(response.attestationObject),
					clientDataJSON: bytesToB64(response.clientDataJSON)
				}
			});

			success = t('mfa.passkey.registered');
			await load();
			onsuccess?.();
		} catch (err) {
			if (err instanceof DOMException && err.name === 'NotAllowedError') return;
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			registerLoading = false;
		}
	}

	async function deletePasskey() {
		if (!deletingId) return;
		clearMessages();
		deleteLoading = true;
		try {
			await client.deletePasskey(deletingId, deletePassword, csrfToken);
			success = t('mfa.passkey.deleted');
			deletingId = null;
			deletePassword = '';
			await load();
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			deleteLoading = false;
		}
	}
</script>

<section class="ferret-passkey-manager">
	<h3 class="ferret-heading">{t('mfa.passkey.title')}</h3>

	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	{#if loading}
		<p class="ferret-muted">…</p>
	{:else}
		{#if passkeys.length === 0}
			<p class="ferret-muted">{t('mfa.passkey.no_passkeys')}</p>
		{:else}
			<div class="ferret-list">
				{#each passkeys as pk}
					<div class="ferret-list-item">
						<div class="ferret-list-info">
							<span class="ferret-list-name">{pk.device_name}</span>
							<span class="ferret-list-meta">
								{pk.last_used_at
									? t('mfa.passkey.last_used', { date: formatDate(pk.last_used_at) })
									: t('mfa.passkey.never_used')}
								{#if pk.backed_up}
									· {t('mfa.passkey.backed_up')}
								{/if}
							</span>
						</div>
						{#if deletingId === pk.id}
							<form
								class="ferret-inline-form"
								onsubmit={(e) => {
									e.preventDefault();
									void deletePasskey();
								}}
							>
								<input
									class="ferret-input ferret-input-sm"
									type="password"
									bind:value={deletePassword}
									placeholder={t('flow.field.current_password')}
									required
								/>
								<button
									type="submit"
									class="ferret-btn ferret-btn-danger ferret-btn-sm"
									disabled={deleteLoading}
								>
									{t('action.verify')}
								</button>
								<button
									type="button"
									class="ferret-btn ferret-btn-secondary ferret-btn-sm"
									onclick={() => (deletingId = null)}
								>
									{t('action.cancel')}
								</button>
							</form>
						{:else}
							<button
								class="ferret-btn ferret-btn-danger ferret-btn-sm"
								onclick={() => {
									clearMessages();
									deletingId = pk.id;
								}}
							>
								{t('mfa.passkey.delete')}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<button
			class="ferret-btn ferret-btn-primary"
			onclick={register}
			disabled={registerLoading}
		>
			{t('mfa.passkey.register')}
		</button>
	{/if}
</section>

<style>
	.ferret-passkey-manager {
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

	.ferret-btn-sm {
		padding: 0.25rem 0.625rem;
		font-size: 0.8125rem;
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

	.ferret-input-sm {
		padding: 0.25rem 0.5rem;
		font-size: 0.8125rem;
		width: 12rem;
	}

	.ferret-inline-form {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}

	.ferret-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.ferret-list-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--ferret-card-bg, #fff);
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.5rem;
		gap: 0.75rem;
	}

	.ferret-list-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.ferret-list-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--ferret-text-color, #111827);
	}

	.ferret-list-meta {
		font-size: 0.75rem;
		color: var(--ferret-muted-color, #6b7280);
	}
</style>
