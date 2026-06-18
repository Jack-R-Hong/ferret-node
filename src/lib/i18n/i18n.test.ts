import { describe, it, expect } from 'vitest';
import { createT, registerLocale, en, zhTW } from './index.js';

describe('createT', () => {
	it('resolves a known key to a string', () => {
		const t = createT('en');
		const [firstKey, firstVal] = Object.entries(en)[0];
		expect(t(firstKey)).toBe(firstVal);
	});

	it('interpolates {{param}} placeholders', () => {
		registerLocale('test-interp', { greet: 'Hi {{name}}, you have {{n}} new messages' });
		const t = createT('test-interp');
		expect(t('greet', { name: 'Sam', n: 3 })).toBe('Hi Sam, you have 3 new messages');
	});

	it('replaces every occurrence of a placeholder', () => {
		registerLocale('test-dup', { k: '{{x}} and {{x}}' });
		expect(createT('test-dup')('k', { x: 'z' })).toBe('z and z');
	});

	it('returns the key itself when it is missing everywhere', () => {
		expect(createT('en')('totally.unknown.key')).toBe('totally.unknown.key');
	});

	it('falls back to English for keys missing in the target locale', () => {
		registerLocale('test-partial', { 'only.key': 'X' });
		const t = createT('test-partial');
		const [enKey, enVal] = Object.entries(en)[0];
		expect(t('only.key')).toBe('X');
		expect(t(enKey)).toBe(enVal); // fell back to en
	});

	it('lets explicit overrides win over both locale and English', () => {
		const [enKey] = Object.entries(en)[0];
		const t = createT('en', { [enKey]: 'CUSTOM VALUE' });
		expect(t(enKey)).toBe('CUSTOM VALUE');
	});
});

describe('registerLocale', () => {
	it('registers a new locale usable by createT', () => {
		registerLocale('ja', { 'action.login': 'ログイン' });
		expect(createT('ja')('action.login')).toBe('ログイン');
	});

	it('merges into an existing locale without dropping prior keys', () => {
		registerLocale('ja', { 'action.logout': 'ログアウト' });
		const t = createT('ja');
		expect(t('action.login')).toBe('ログイン');
		expect(t('action.logout')).toBe('ログアウト');
	});
});

describe('shipped dictionaries', () => {
	it('zh-TW covers every key present in en (no silent English fallback)', () => {
		const missingInZh = Object.keys(en).filter((k) => !(k in zhTW));
		expect(missingInZh).toEqual([]);
	});
});
