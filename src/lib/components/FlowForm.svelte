<script lang="ts">
	import { untrack } from 'svelte';
	import type { FlowField } from '../types.js';
	import { FerretError } from '../errors.js';
	import { getFerretT } from '../context.js';

	interface Props {
		fields: FlowField[];
		error?: FerretError | Error | null;
		loading?: boolean;
		submitLabel?: string;
		onsubmit: (data: Record<string, string>) => void;
	}

	let { fields, error = null, loading = false, submitLabel, onsubmit }: Props = $props();

	const t = getFerretT();

	let formData = $state<Record<string, string>>({});

	// Initialize form data when fields change (untrack formData to avoid infinite loop)
	$effect(() => {
		const current = untrack(() => formData);
		const initial: Record<string, string> = {};
		for (const field of fields) {
			if (field.value !== undefined) {
				initial[field.name] = field.value;
			} else if (field.name in current) {
				initial[field.name] = current[field.name];
			} else {
				initial[field.name] = '';
			}
		}
		formData = initial;
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		onsubmit({ ...formData });
	}

	function fieldError(fieldName: string): string | null {
		if (error instanceof FerretError && error.isValidation) {
			const fe = error.fieldError(fieldName);
			if (fe) return t(fe.i18n_key, fe.params ?? undefined);
		}
		return null;
	}

	function fieldLabel(field: FlowField): string {
		if (field.label) return field.label;
		return t(`flow.field.${field.name}`);
	}
</script>

<form onsubmit={handleSubmit} class="ferret-form">
	{#if error && !(error instanceof FerretError && error.isValidation)}
		<div class="ferret-form-error" role="alert">
			{error instanceof FerretError ? t(error.i18nKey) : error.message}
		</div>
	{/if}

	{#each fields as field (field.name)}
		{#if field.type !== 'hidden'}
			{@const err = fieldError(field.name)}
			<div class="ferret-field" class:ferret-field-error={!!err}>
				<label for="ferret-{field.name}" class="ferret-label">
					{fieldLabel(field)}
					{#if field.required}<span class="ferret-required" aria-hidden="true">*</span>{/if}
				</label>
				<input
					id="ferret-{field.name}"
					type={field.type}
					name={field.name}
					required={field.required}
					pattern={field.pattern}
					bind:value={formData[field.name]}
					disabled={loading}
					class="ferret-input"
					aria-invalid={!!err}
					aria-describedby={err ? `ferret-err-${field.name}` : undefined}
				/>
				{#if err}
					<div id="ferret-err-{field.name}" class="ferret-field-message" role="alert">
						{err}
					</div>
				{/if}
			</div>
		{:else}
			<input type="hidden" name={field.name} bind:value={formData[field.name]} />
		{/if}
	{/each}

	<button type="submit" class="ferret-submit" disabled={loading}>
		{#if loading}
			<span class="ferret-spinner" aria-hidden="true"></span>
		{/if}
		{submitLabel ?? t('action.submit')}
	</button>
</form>

<style>
	.ferret-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.ferret-form-error {
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		background: var(--ferret-error-bg, #fef2f2);
		color: var(--ferret-error-color, #dc2626);
		font-size: 0.875rem;
		border: 1px solid var(--ferret-error-border, #fecaca);
	}

	.ferret-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.ferret-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--ferret-label-color, #374151);
	}

	.ferret-required {
		color: var(--ferret-error-color, #dc2626);
		margin-left: 0.125rem;
	}

	.ferret-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--ferret-input-border, #d1d5db);
		border-radius: 0.375rem;
		font-size: 1rem;
		line-height: 1.5;
		transition: border-color 0.15s;
		outline: none;
	}

	.ferret-input:focus {
		border-color: var(--ferret-focus-color, #3b82f6);
		box-shadow: 0 0 0 2px var(--ferret-focus-ring, rgba(59, 130, 246, 0.3));
	}

	.ferret-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ferret-field-error .ferret-input {
		border-color: var(--ferret-error-color, #dc2626);
	}

	.ferret-field-message {
		font-size: 0.75rem;
		color: var(--ferret-error-color, #dc2626);
	}

	.ferret-submit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: var(--ferret-primary-bg, #3b82f6);
		color: var(--ferret-primary-color, #ffffff);
		border: none;
		border-radius: 0.375rem;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.ferret-submit:hover:not(:disabled) {
		background: var(--ferret-primary-hover, #2563eb);
	}

	.ferret-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ferret-spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: ferret-spin 0.6s linear infinite;
	}

	@keyframes ferret-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
