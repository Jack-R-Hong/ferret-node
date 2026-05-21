<script lang="ts">
	import { onMount } from 'svelte';
	import { getFerretClient, getFerretT } from '../context.js';
	import type { SecurityEvent } from '../types.js';
	import { FerretError } from '../errors.js';

	interface Props {
		limit?: number;
	}

	let { limit = 50 }: Props = $props();

	const client = getFerretClient();
	const t = getFerretT();

	let events = $state<SecurityEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const EVENT_LABELS: Record<string, string> = {
		login_success: 'Login',
		login_failed: 'Failed login',
		logout: 'Logout',
		password_changed: 'Password changed',
		profile_updated: 'Profile updated',
		mfa_enabled: 'MFA enabled',
		mfa_disabled: 'MFA disabled',
		session_revoked: 'Session revoked',
		recovery_initiated: 'Recovery initiated',
		email_verified: 'Email verified'
	};

	onMount(() => {
		void load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await client.getSecurityActivity({ limit });
			events = res.events;
		} catch (err) {
			error = err instanceof FerretError ? t(err.i18nKey) : String(err);
		} finally {
			loading = false;
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleString();
	}

	function eventLabel(type: string): string {
		return EVENT_LABELS[type] ?? type;
	}
</script>

<section class="ferret-security-log">
	{#if loading}
		<p class="ferret-muted">…</p>
	{:else if error}
		<div class="ferret-alert ferret-alert-error" role="alert">{error}</div>
	{:else if events.length === 0}
		<p class="ferret-muted">No security events found.</p>
	{:else}
		<div class="ferret-timeline">
			{#each events as event}
				<div class="ferret-event">
					<div class="ferret-event-dot"></div>
					<div class="ferret-event-content">
						<div class="ferret-event-header">
							<span class="ferret-event-type">{eventLabel(event.type)}</span>
							<time class="ferret-event-time">{formatDate(event.created_at)}</time>
						</div>
						<div class="ferret-event-meta">
							{#if event.ip_address}
								<span>IP: {event.ip_address}</span>
							{/if}
							{#if event.user_agent}
								<span class="ferret-event-ua">{event.user_agent}</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.ferret-security-log {
		max-width: 40rem;
	}

	.ferret-muted {
		color: var(--ferret-muted-color, #6b7280);
		padding: 2rem 0;
	}

	.ferret-alert {
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		background: var(--ferret-error-bg, #fef2f2);
		color: var(--ferret-error-color, #dc2626);
		font-size: 0.875rem;
		border: 1px solid var(--ferret-error-border, #fecaca);
	}

	.ferret-timeline {
		position: relative;
		padding-left: 1.5rem;
	}

	.ferret-timeline::before {
		content: '';
		position: absolute;
		left: 0.4375rem;
		top: 0.5rem;
		bottom: 0.5rem;
		width: 2px;
		background: var(--ferret-input-border, #d1d5db);
	}

	.ferret-event {
		position: relative;
		padding-bottom: 1.25rem;
	}

	.ferret-event:last-child {
		padding-bottom: 0;
	}

	.ferret-event-dot {
		position: absolute;
		left: -1.5rem;
		top: 0.375rem;
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: var(--ferret-primary-bg, #3b82f6);
		border: 2px solid var(--ferret-card-bg, #fff);
	}

	.ferret-event-content {
		background: var(--ferret-card-bg, #fff);
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
	}

	.ferret-event-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.25rem;
	}

	.ferret-event-type {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--ferret-text-color, #111827);
	}

	.ferret-event-time {
		font-size: 0.75rem;
		color: var(--ferret-muted-color, #6b7280);
		white-space: nowrap;
	}

	.ferret-event-meta {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		font-size: 0.75rem;
		color: var(--ferret-muted-color, #6b7280);
	}

	.ferret-event-ua {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 30rem;
	}
</style>
