import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the SDK's end-to-end / security suite.
 *
 * The specs in `e2e/` drive the example routes under `src/routes/examples`.
 * Every Ferret backend call is mocked per-test with `page.route(...)`, so no
 * running Ferret server is required — the dev server only needs to serve the
 * SDK components and example pages.
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'npm run dev -- --port 5173 --strictPort',
		url: 'http://localhost:5173/examples',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
