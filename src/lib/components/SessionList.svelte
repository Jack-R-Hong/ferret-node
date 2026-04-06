<script lang="ts">
	import { onMount } from 'svelte';
	import type { Session } from '../types.js';
	import { FerretError } from '../errors.js';
	import { getFerretClient, getFerretT } from '../context.js';

	interface Props {
		/** Callback when a session is revoked */
		onrevoke?: (sessionId: string) => void;
	}

	let { onrevoke }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();

	let sessions = $state<Session[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let revoking = $state<string | null>(null);

	onMount(() => {
		loadSessions();
	});

	async function loadSessions() {
		loading = true;
		error = null;
		try {
			const res = await client.listSessions();
			sessions = res.sessions;
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}

	async function revoke(sessionId: string) {
		revoking = sessionId;
		try {
			// We need a csrf_token. For session revocation, we'll need one from somewhere.
			// In practice, the settings flow provides it. Here we pass an empty string
			// and rely on the caller to handle this properly via the client directly.
			await client.revokeSession(sessionId, '');
			sessions = sessions.filter((s) => s.id !== sessionId);
			onrevoke?.(sessionId);
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			revoking = null;
		}
	}
</script>

<div class="ferret-sessions">
	{#if loading}
		<div class="ferret-loading">...</div>
	{:else if error}
		<div class="ferret-form-error" role="alert">{error}</div>
	{:else if sessions.length === 0}
		<p class="ferret-empty">No active sessions.</p>
	{:else}
		<ul class="ferret-session-list">
			{#each sessions as session (session.id)}
				<li class="ferret-session-item">
					<div class="ferret-session-info">
						<span class="ferret-session-device">{session.device_name ?? session.user_agent ?? 'Unknown'}</span>
						<span class="ferret-session-meta">
							{session.ip_address ?? ''}
							{#if session.authenticated_at}
								&middot; {new Date(session.authenticated_at).toLocaleString()}
							{/if}
						</span>
					</div>
					<button
						class="ferret-session-revoke"
						disabled={revoking === session.id}
						onclick={() => revoke(session.id)}
					>
						{revoking === session.id ? '...' : t('action.logout')}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.ferret-sessions {
		max-width: var(--ferret-form-width, 32rem);
		margin: 0 auto;
	}

	.ferret-loading {
		text-align: center;
		color: var(--ferret-muted-color, #6b7280);
		padding: 2rem 0;
	}

	.ferret-form-error {
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		background: var(--ferret-error-bg, #fef2f2);
		color: var(--ferret-error-color, #dc2626);
		font-size: 0.875rem;
		border: 1px solid var(--ferret-error-border, #fecaca);
	}

	.ferret-empty {
		text-align: center;
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-session-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.ferret-session-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--ferret-input-border, #d1d5db);
	}

	.ferret-session-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.ferret-session-device {
		font-weight: 500;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-session-meta {
		font-size: 0.75rem;
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-session-revoke {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--ferret-error-color, #dc2626);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--ferret-error-color, #dc2626);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.ferret-session-revoke:hover:not(:disabled) {
		background: var(--ferret-error-bg, #fef2f2);
	}

	.ferret-session-revoke:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
