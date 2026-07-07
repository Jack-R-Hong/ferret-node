import { expect, test } from '@playwright/test';
import { mockLoginFlow, mockWhoami } from './mock';

/**
 * Functional happy-path for the login example: proves the <LoginFlow> component
 * renders the backend-driven form, submits credentials, and reports success.
 * (Baseline that the flow works, so the security specs are testing real UI.)
 */
test('login flow submits credentials and reports success', async ({ page }) => {
	await mockWhoami(page, false);
	await mockLoginFlow(page);

	await page.goto('/examples/login');

	await page.locator('#ferret-identifier').fill('alice@example.com');
	await page.locator('#ferret-password').fill('correct horse battery staple');
	await page.locator('.ferret-form button[type=submit]').click();

	await expect(page.getByTestId('login-status')).toHaveText(/Signed in as alice@example.com/);
});
