<script lang="ts">
	import { getFerretClient, getFerretT } from '../context.js';
	import type { DataExport } from '../types.js';
	import { FerretError } from '../errors.js';

	interface Props {
		onsuccess?: (exp: DataExport) => void;
	}

	let { onsuccess }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();

	let exports = $state<DataExport[]>([]);
	let requesting = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	async function request() {
		error = null;
		success = null;
		requesting = true;
		try {
			const exp = await client.createDataExport();
			exports = [exp, ...exports];
			success = t('gdpr.data_export.requested');
			onsuccess?.(exp);
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			requesting = false;
		}
	}

	async function refresh(exportId: string) {
		error = null;
		try {
			const exp = await client.getDataExport(exportId);
			exports = exports.map((e) => (e.export_id === exportId ? exp : e));
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		}
	}

	function formatDate(d: string): string {
		return new Date(d).toLocaleString();
	}

	function statusLabel(status: DataExport['status']): string {
		const map: Record<string, string> = {
			pending: t('gdpr.data_export.status_pending'),
			ready: t('gdpr.data_export.status_ready'),
			expired: t('gdpr.data_export.status_expired')
		};
		return map[status] ?? status;
	}

	function statusClass(status: DataExport['status']): string {
		if (status === 'ready') return 'ferret-status-ready';
		if (status === 'expired') return 'ferret-status-expired';
		return 'ferret-status-pending';
	}
</script>

<section class="ferret-data-export">
	{#if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{/if}
	{#if success}
		<div class="ferret-alert ferret-alert-success">{success}</div>
	{/if}

	<p class="ferret-muted">{t('gdpr.data_export.description')}</p>

	<button class="ferret-btn ferret-btn-primary" onclick={request} disabled={requesting}>
		{t('gdpr.data_export.request')}
	</button>

	{#if exports.length > 0}
		<div class="ferret-list">
			{#each exports as exp}
				<div class="ferret-item">
					<div class="ferret-item-info">
						<div class="ferret-item-header">
							<span class="ferret-status {statusClass(exp.status)}">
								{statusLabel(exp.status)}
							</span>
							<span class="ferret-export-id">{exp.export_id.slice(0, 8)}…</span>
						</div>
						<span class="ferret-meta">
							{t('gdpr.data_export.created', { date: formatDate(exp.created_at) })}
						</span>
						{#if exp.expires_at}
							<span class="ferret-meta">
								{t('gdpr.data_export.expires', { date: formatDate(exp.expires_at) })}
							</span>
						{/if}
					</div>
					<div class="ferret-item-actions">
						{#if exp.status === 'pending'}
							<button class="ferret-btn ferret-btn-sm" onclick={() => refresh(exp.export_id)}>
								↻
							</button>
						{:else if exp.status === 'ready'}
							<a
								class="ferret-btn ferret-btn-primary ferret-btn-sm"
								href={client.getDataExportDownloadUrl(exp.export_id)}
								download
							>
								{t('gdpr.data_export.download')}
							</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<p class="ferret-muted-tight">{t('gdpr.data_export.no_exports')}</p>
	{/if}
</section>

<style>
	.ferret-data-export {
		max-width: 32rem;
	}

	.ferret-muted {
		font-size: 0.875rem;
		color: var(--ferret-muted-color, #6b7280);
		margin-bottom: 1rem;
	}

	.ferret-muted-tight {
		color: var(--ferret-muted-color, #6b7280);
		font-size: 0.875rem;
		margin-top: 1rem;
	}

	.ferret-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		background: transparent;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ferret-btn-primary {
		background: var(--ferret-primary-bg, #3b82f6);
		color: var(--ferret-primary-color, #fff);
		border-color: transparent;
	}

	.ferret-btn-primary:hover:not(:disabled) {
		background: var(--ferret-primary-hover, #2563eb);
	}

	.ferret-btn-sm {
		padding: 0.25rem 0.625rem;
		font-size: 0.8125rem;
	}

	a.ferret-btn {
		text-decoration: none;
		display: inline-block;
	}

	.ferret-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.ferret-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--ferret-card-bg, #fff);
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.5rem;
	}

	.ferret-item-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.ferret-item-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ferret-status {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}

	.ferret-status-pending {
		background: #fef3c7;
		color: #92400e;
	}

	.ferret-status-ready {
		background: var(--ferret-success-bg, #dcfce7);
		color: var(--ferret-success-color, #16a34a);
	}

	.ferret-status-expired {
		background: var(--ferret-muted-bg, #f3f4f6);
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-export-id {
		font-size: 0.75rem;
		font-family: monospace;
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-meta {
		font-size: 0.75rem;
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-item-actions {
		display: flex;
		gap: 0.375rem;
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
</style>
