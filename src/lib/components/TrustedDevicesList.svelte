<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretT } from '../context.js';
	import type { TrustedDevice } from '../types.js';
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
	let devices = $state<TrustedDevice[]>([]);
	let removingId = $state<string | null>(null);

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
			devices = status.trusted_devices ?? [];
			csrfToken = flow.csrf_token ?? '';
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}

	function formatDate(d: string): string {
		return new Date(d).toLocaleDateString();
	}

	async function remove(deviceId: string) {
		error = null;
		success = null;
		removingId = deviceId;
		try {
			await client.removeTrustedDevice(deviceId, csrfToken);
			success = t('mfa.trusted_devices.removed');
			devices = devices.filter((d) => d.device_id !== deviceId);
			onsuccess?.();
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			removingId = null;
		}
	}
</script>

<section class="ferret-trusted-devices">
	<h3 class="ferret-heading">{t('mfa.trusted_devices.title')}</h3>

	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	{#if loading}
		<p class="ferret-muted">…</p>
	{:else if devices.length === 0}
		<p class="ferret-muted">{t('mfa.trusted_devices.no_devices')}</p>
	{:else}
		<div class="ferret-list">
			{#each devices as device}
				<div class="ferret-list-item">
					<div class="ferret-list-info">
						<span class="ferret-list-name">{device.device_name}</span>
						<span class="ferret-list-meta">
							{t('mfa.trusted_devices.expires', { date: formatDate(device.expires_at) })}
						</span>
					</div>
					<button
						class="ferret-btn ferret-btn-danger ferret-btn-sm"
						disabled={removingId === device.device_id}
						onclick={() => remove(device.device_id)}
					>
						{t('mfa.trusted_devices.remove')}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.ferret-trusted-devices {
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

	.ferret-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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
