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
		this.status = body.status;
		this.i18nKey = body.i18n_key;
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
