import type { FerretErrorBody, FieldError } from './types.js';

export class FerretError extends Error {
	readonly code: string;
	readonly status: number;
	readonly i18nKey: string;
	readonly details: FieldError[] | undefined;
	readonly retryAfter: number | undefined;

	constructor(body: FerretErrorBody) {
		super(body.message);
		this.name = 'FerretError';
		this.code = body.code;
		this.status = body.status ?? 0;
		// Older worker deploys omit `i18n_key` (and send `message` === `code`).
		// Without a key the UI renders a blank error box, since components show
		// error text via `t(error.i18nKey)`. Derive `error.<code>` so every error
		// resolves to a dictionary entry (or at least a legible key) — see the
		// `error.*` block in i18n/en.ts.
		this.i18nKey = body.i18n_key || (body.code ? `error.${body.code}` : 'error.internal');
		this.details = body.details ?? undefined;
		this.retryAfter = body.retry_after ?? undefined;
	}

	/** Check if this is a validation error with field-level details */
	get isValidation(): boolean {
		return this.code === 'validation_failed' && !!this.details?.length;
	}

	/** Check if this is a rate limit error */
	get isRateLimited(): boolean {
		return this.code === 'rate_limited';
	}

	/** Check if reauthentication is required (session age > 15min) */
	get isReauthRequired(): boolean {
		return this.code === 'reauthentication_required';
	}

	/** Get error message for a specific field */
	fieldError(fieldName: string): FieldError | undefined {
		return this.details?.find((d) => d.field === fieldName);
	}
}
