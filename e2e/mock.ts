import type { Page, Route } from '@playwright/test';

/**
 * Backend-mock helpers for the e2e suite.
 *
 * The example pages talk to a Ferret backend at http://localhost:8080. None is
 * running in CI, so each test intercepts the specific `/api/browser/*` calls its
 * flow makes and returns canned JSON. This also lets a security test feed a
 * *poisoned* server response (e.g. a malicious `qr_svg`) and observe what the
 * SDK does with it in a real browser.
 */

const json = (route: Route, body: unknown, status = 200) =>
	route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});

export const IDENTITY = {
	id: 'usr_1',
	email: 'alice@example.com',
	username: 'alice',
	email_verified: true,
	status: 'active' as const,
	created_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:00:00Z'
};

export const SESSION = {
	id: 'sess_1',
	identity: IDENTITY,
	authenticated_at: '2024-01-01T00:00:00Z',
	expires_at: '2999-01-01T00:00:00Z'
};

// ─── XSS payloads ──────────────────────────────────────────────────────────
//
// Each payload, if it executes, increments `window.__ferretXss`. The <img src=x>
// 404s (not an image) so `onerror` fires when the handler survives into the DOM.

/**
 * Unquoted `on*` handler — the payload that bypassed TotpManager's old
 * `sanitizeSvg` (its handler regex only matched quoted values). Used to prove
 * the fixed render paths keep it inert.
 */
export const XSS_UNQUOTED_HANDLER =
	`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>` +
	`<img src=x onerror=window.__ferretXss=(window.__ferretXss||0)+1>`;

/**
 * Quoted `on*` handler — the naive payload. It still executes if the raw SVG is
 * inlined with `{@html}` (see the qr-login anti-pattern example), so it's the
 * one used to demonstrate why inlining is unsafe.
 */
export const XSS_QUOTED_HANDLER =
	`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>` +
	`<img src="x" onerror="window.__ferretXss=(window.__ferretXss||0)+1">`;

/** Seed the XSS counter to 0 before the page scripts run. */
export async function primeXssSensor(page: Page) {
	await page.addInitScript(() => {
		(window as unknown as { __ferretXss: number }).__ferretXss = 0;
	});
}

export function xssCount(page: Page): Promise<number> {
	return page.evaluate(
		() => (window as unknown as { __ferretXss?: number }).__ferretXss ?? 0
	);
}

// ─── Endpoint mocks ─────────────────────────────────────────────────────────

/** FerretProvider autoCheck → whoami. */
export async function mockWhoami(page: Page, authenticated = true) {
	await page.route('**/api/browser/sessions/whoami', (route) => {
		if (!authenticated) {
			return json(
				route,
				{ error: { code: 'session_not_found', i18n_key: 'error.session', status: 401 } },
				401
			);
		}
		return json(route, { session: SESSION, csrf_token: 'csrf-from-whoami' });
	});
}

/** TOTP manager load path + setup, with a caller-supplied qr_svg. */
export async function mockTotpSetup(page: Page, qrSvg: string) {
	await page.route('**/api/browser/self-service/mfa', (route) =>
		json(route, { enabled: false, methods: [], mfa_level: 1 })
	);
	await page.route('**/api/browser/self-service/settings', (route) =>
		json(route, {
			id: 'flow_settings_1',
			csrf_token: 'csrf-settings',
			expires_at: '2999-01-01T00:00:00Z',
			ui: { method: 'POST', action: '', fields: [] }
		})
	);
	await page.route('**/api/browser/self-service/mfa/totp/setup', (route) =>
		json(route, {
			secret: 'JBSWY3DPEHPK3PXP',
			uri: 'otpauth://totp/Ferret:alice?secret=JBSWY3DPEHPK3PXP',
			qr_svg: qrSvg,
			backup_codes: ['aaaa-bbbb', 'cccc-dddd'],
			ui: { method: 'POST', action: '', fields: [] }
		})
	);
}

/** QR cross-device login: create (with caller-supplied qr_svg) + a pending poll. */
export async function mockQrLogin(page: Page, qrSvg: string) {
	await page.route('**/api/browser/self-service/login/qr', (route) =>
		json(route, {
			id: 'qr_1',
			scan_token: 'scan-abc',
			qr_svg: qrSvg,
			poll_token: 'poll-abc',
			expires_at: '2999-01-01T00:00:00Z',
			poll_interval_ms: 100000
		})
	);
	await page.route('**/api/browser/self-service/login/qr/poll', (route) =>
		json(route, { status: 'pending' })
	);
}

/** Login flow: init returns identifier+password fields; submit succeeds. */
export async function mockLoginFlow(page: Page) {
	await page.route('**/api/browser/self-service/login', (route) =>
		json(route, {
			id: 'flow_login_1',
			csrf_token: 'csrf-login',
			expires_at: '2999-01-01T00:00:00Z',
			status: 'input_required',
			ui: {
				method: 'POST',
				action: '',
				fields: [
					{ name: 'identifier', type: 'text', required: true },
					{ name: 'password', type: 'password', required: true }
				]
			}
		})
	);
	await page.route('**/api/browser/self-service/login/*', (route) =>
		json(route, { session: SESSION })
	);
}
