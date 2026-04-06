import { en } from './en.js';
import { zhTW } from './zh-TW.js';

export type Translations = Record<string, string>;

const locales: Record<string, Translations> = {
	en,
	'zh-TW': zhTW
};

/**
 * Create a translation function for the given locale.
 *
 * Supports `{{param}}` interpolation matching Ferret's i18n_key + params pattern.
 *
 * @example
 * ```ts
 * const t = createT('zh-TW');
 * t('error.field.password_too_short', { min: 10 });
 * // → "密碼至少 10 個字元"
 * ```
 */
export function createT(locale: string, overrides?: Translations) {
	const dict = { ...locales[locale], ...locales.en, ...overrides };

	return function t(key: string, params?: Record<string, unknown>): string {
		let msg = dict[key] ?? key;
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				msg = msg.replaceAll(`{{${k}}}`, String(v));
			}
		}
		return msg;
	};
}

/** Register a custom locale or extend an existing one. */
export function registerLocale(locale: string, translations: Translations) {
	locales[locale] = { ...locales[locale], ...translations };
}

export { en, zhTW };
