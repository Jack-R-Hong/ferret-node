import { describe, it, expect } from 'vitest';
import { FerretError } from './errors.js';

describe('FerretError', () => {
	it('maps the wire body onto typed fields', () => {
		const err = new FerretError({
			code: 'validation_failed',
			message: 'bad input',
			i18n_key: 'error.validation_failed',
			status: 400,
			details: [
				{
					field: 'password',
					code: 'too_short',
					message: 'short',
					i18n_key: 'error.field.password_too_short',
					params: { min: 10 }
				}
			],
			retry_after: 12
		});
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('FerretError');
		expect(err.code).toBe('validation_failed');
		expect(err.message).toBe('bad input');
		expect(err.status).toBe(400);
		expect(err.i18nKey).toBe('error.validation_failed');
		expect(err.details).toHaveLength(1);
		expect(err.retryAfter).toBe(12);
	});

	it('defaults status to 0 and leaves details/retryAfter undefined when absent', () => {
		const err = new FerretError({ code: 'x', message: 'y' });
		expect(err.status).toBe(0);
		expect(err.details).toBeUndefined();
		expect(err.retryAfter).toBeUndefined();
	});

	describe('i18nKey fallback', () => {
		it('uses i18n_key when present', () => {
			const err = new FerretError({ code: 'c', message: 'm', i18n_key: 'error.specific' });
			expect(err.i18nKey).toBe('error.specific');
		});

		it('derives error.<code> when i18n_key is missing (older worker deploys)', () => {
			const err = new FerretError({ code: 'rate_limited', message: 'rate_limited' });
			expect(err.i18nKey).toBe('error.rate_limited');
		});

		it('falls back to error.internal when both i18n_key and code are missing', () => {
			// @ts-expect-error deliberately malformed body (missing code)
			const err = new FerretError({ message: 'boom' });
			expect(err.i18nKey).toBe('error.internal');
		});
	});

	describe('boolean helpers', () => {
		it('isValidation is true only for validation_failed *with* details', () => {
			const withDetails = new FerretError({
				code: 'validation_failed',
				message: 'm',
				details: [{ field: 'a', code: 'b', message: 'c', i18n_key: 'd' }]
			});
			const noDetails = new FerretError({ code: 'validation_failed', message: 'm' });
			const otherCode = new FerretError({
				code: 'other',
				message: 'm',
				details: [{ field: 'a', code: 'b', message: 'c', i18n_key: 'd' }]
			});
			expect(withDetails.isValidation).toBe(true);
			expect(noDetails.isValidation).toBe(false);
			expect(otherCode.isValidation).toBe(false);
		});

		it('isRateLimited / isReauthRequired reflect the code', () => {
			expect(new FerretError({ code: 'rate_limited', message: 'm' }).isRateLimited).toBe(true);
			expect(new FerretError({ code: 'x', message: 'm' }).isRateLimited).toBe(false);
			expect(
				new FerretError({ code: 'reauthentication_required', message: 'm' }).isReauthRequired
			).toBe(true);
			expect(new FerretError({ code: 'x', message: 'm' }).isReauthRequired).toBe(false);
		});
	});

	describe('fieldError', () => {
		const err = new FerretError({
			code: 'validation_failed',
			message: 'm',
			details: [
				{ field: 'email', code: 'invalid', message: 'bad', i18n_key: 'error.field.email_invalid' }
			]
		});

		it('returns the matching field detail', () => {
			expect(err.fieldError('email')?.code).toBe('invalid');
		});

		it('returns undefined for a non-matching field', () => {
			expect(err.fieldError('password')).toBeUndefined();
		});

		it('returns undefined when there are no details', () => {
			expect(new FerretError({ code: 'x', message: 'm' }).fieldError('email')).toBeUndefined();
		});
	});
});
