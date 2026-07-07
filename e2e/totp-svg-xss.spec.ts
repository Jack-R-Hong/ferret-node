import { expect, test, type Page } from '@playwright/test';
import {
	XSS_QUOTED_HANDLER,
	XSS_UNQUOTED_HANDLER,
	mockTotpSetup,
	mockWhoami,
	primeXssSensor,
	xssCount
} from './mock';

/**
 * Regression guard for the TOTP QR fix. `TotpManager` used to inline
 * `{@html sanitizeSvg(qr_svg)}` with a bypassable regex; it now renders the SVG
 * through an <img> data-URI, where embedded script/handlers can't run. These
 * tests feed poisoned SVGs and assert nothing executes.
 */
test.describe('TOTP qr_svg rendering is XSS-safe', () => {
	test.beforeEach(async ({ page }) => {
		await primeXssSensor(page);
		await mockWhoami(page, true);
	});

	async function openSetup(page: Page) {
		await page.goto('/examples/totp');
		await page.locator('.ferret-btn-primary').click();
		await expect(page.locator('img.ferret-qr')).toBeVisible();
	}

	test('renders qr_svg as an <img> data-URI, not inline markup', async ({ page }) => {
		await mockTotpSetup(page, XSS_UNQUOTED_HANDLER);
		await openSetup(page);
		await expect(page.locator('img.ferret-qr')).toHaveAttribute('src', /^data:image\/svg\+xml/);
	});

	// The two payloads that would have run under the old sanitizer (unquoted
	// handler = bypass; quoted handler = the case the regex caught). Neither may
	// execute now.
	for (const [name, payload] of [
		['unquoted handler', XSS_UNQUOTED_HANDLER],
		['quoted handler', XSS_QUOTED_HANDLER]
	] as const) {
		test(`poisoned qr_svg (${name}) does not execute`, async ({ page }) => {
			await mockTotpSetup(page, payload);
			await openSetup(page);
			await page.waitForTimeout(300);
			expect(await xssCount(page)).toBe(0);
		});
	}
});
