import { describe, it, expect } from 'vitest';
import * as sdk from './index.js';

/**
 * Pins the public API surface. The barrel (`index.ts`) is the package's only
 * export path — a symbol not re-exported here is invisible to consumers even if
 * it exists in `src/lib`. These are the security-relevant primitives the docs
 * (docs/security.md, docs/stores.md, docs/client.md) tell users to import, so
 * guard them against accidental removal.
 */
describe('public API surface', () => {
	it('exports the safe-SVG helper and the QR-login store', () => {
		expect(typeof sdk.svgToDataUri).toBe('function');
		expect(typeof sdk.createQrLoginStore).toBe('function');
	});

	it('svgToDataUri produces an image/svg+xml data URI', () => {
		expect(sdk.svgToDataUri('<svg/>')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
	});

	it('still exports the client entry point', () => {
		expect(typeof sdk.FerretClient).toBe('function');
	});
});
