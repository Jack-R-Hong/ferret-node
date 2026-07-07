import { expect, test, type Page } from '@playwright/test';
import {
	XSS_QUOTED_HANDLER,
	XSS_UNQUOTED_HANDLER,
	mockQrLogin,
	mockWhoami,
	primeXssSensor,
	xssCount
} from './mock';

/**
 * The createQrLoginStore docstring tells integrators to render the backend
 * `qr_svg` with `{@html qr.qrSvg}` — no sanitizer at all. The vulnerable example
 * follows that pattern; the hardened example renders the SVG as an <img>
 * data-URI instead.
 */
test.describe('QR login qr_svg render', () => {
	test.beforeEach(async ({ page }) => {
		await primeXssSensor(page);
		await mockWhoami(page, false);
	});

	// The "Show QR code" button is static SSR markup, so it exists before Svelte
	// hydrates its click handler. Retry the click until the store actually starts
	// (state leaves `idle`) so the test doesn't race hydration.
	async function startQr(page: Page) {
		await expect(async () => {
			await page.getByTestId('qr-start').click();
			await expect(page.getByTestId('qr-state')).not.toContainText('idle', { timeout: 500 });
		}).toPass({ timeout: 6000 });
	}

	test('FINDING: documented {@html} pattern runs a poisoned qr_svg', async ({ page }) => {
		// Even the QUOTED handler runs here — the QR store applies no sanitizer,
		// so this render path is strictly weaker than TotpManager's.
		await mockQrLogin(page, XSS_QUOTED_HANDLER);

		await page.goto('/examples/qr-login');
		await startQr(page);
		await expect(page.getByTestId('qr-canvas')).toBeVisible();

		await expect.poll(() => xssCount(page)).toBe(1);
	});

	test('REMEDIATION: <img> data-URI render neutralises the same payload', async ({ page }) => {
		// The worst payload (bypasses even sanitizeSvg) still cannot execute when
		// the SVG is loaded as an image instead of inlined.
		await mockQrLogin(page, XSS_UNQUOTED_HANDLER);

		await page.goto('/examples/qr-login-safe');
		await startQr(page);

		const img = page.getByTestId('qr-canvas');
		await expect(img).toBeVisible();
		await expect(img).toHaveAttribute('src', /^data:image\/svg\+xml/);

		await page.waitForTimeout(300);
		expect(await xssCount(page)).toBe(0);
	});
});
