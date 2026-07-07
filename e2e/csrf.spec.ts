import { expect, test } from '@playwright/test';
import { SESSION } from './mock';

/**
 * Positive control for the CSRF double-submit implementation in FerretClient.
 *
 * The backend sets a non-HttpOnly `ferret_csrf` cookie next to the session
 * cookie; the client must echo its value in the `X-CSRF-Token` header on every
 * mutating request, and must NOT add it to safe (GET) requests. We drive the
 * TOTP example (a GET whoami + GET mfa on load, a POST settings on load, and a
 * POST totp/setup on click) and inspect the headers the client actually sent.
 */
test('X-CSRF-Token header mirrors the ferret_csrf cookie on mutations only', async ({
	page,
	context
}) => {
	const CSRF = 'tok-abc-123';
	await context.addCookies([
		{ name: 'ferret_csrf', value: CSRF, domain: 'localhost', path: '/' }
	]);

	const seen: Record<string, { csrf?: string; cookie?: string }> = {};
	const record = (key: string, req: import('@playwright/test').Request) => {
		const h = req.headers();
		seen[key] = { csrf: h['x-csrf-token'], cookie: h['cookie'] };
	};
	const json = (route: import('@playwright/test').Route, body: unknown) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

	await page.route('**/api/browser/sessions/whoami', (route) => {
		record('whoami', route.request()); // GET
		return json(route, { session: SESSION, csrf_token: 'csrf-from-whoami' });
	});
	await page.route('**/api/browser/self-service/mfa', (route) => {
		record('mfa', route.request()); // GET
		return json(route, { enabled: false, methods: [], mfa_level: 1 });
	});
	await page.route('**/api/browser/self-service/settings', (route) => {
		record('settings', route.request()); // POST
		return json(route, {
			id: 'flow_settings_1',
			csrf_token: 'csrf-settings',
			expires_at: '2999-01-01T00:00:00Z',
			ui: { method: 'POST', action: '', fields: [] }
		});
	});
	await page.route('**/api/browser/self-service/mfa/totp/setup', (route) => {
		record('totpSetup', route.request()); // POST
		return json(route, {
			secret: 'JBSWY3DPEHPK3PXP',
			uri: 'otpauth://totp/Ferret:alice?secret=JBSWY3DPEHPK3PXP',
			qr_svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
			backup_codes: [],
			ui: { method: 'POST', action: '', fields: [] }
		});
	});

	await page.goto('/examples/totp');
	await page.locator('.ferret-btn-primary').click();
	await expect(page.locator('.ferret-qr')).toBeVisible();

	// Safe methods must not carry the CSRF header...
	expect(seen.whoami.csrf).toBeUndefined();
	expect(seen.mfa.csrf).toBeUndefined();

	// ...mutations must carry it, and it must equal the cookie value (double-submit).
	expect(seen.settings.csrf).toBe(CSRF);
	expect(seen.totpSetup.csrf).toBe(CSRF);

	// credentials: 'include' — the cookie actually rides along on the request.
	expect(seen.totpSetup.cookie).toContain(`ferret_csrf=${CSRF}`);
});
