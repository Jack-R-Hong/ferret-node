import { describe, it, expect } from 'vitest';
import { svgToDataUri } from './svg.js';

describe('svgToDataUri', () => {
	it('wraps SVG markup in an image/svg+xml data URI', () => {
		expect(svgToDataUri('<svg/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E');
	});

	it('percent-encodes so an injected handler cannot break out of the URI', () => {
		const poisoned = '<svg></svg><img src=x onerror=alert(1)>';
		const uri = svgToDataUri(poisoned);
		// The angle brackets / spaces that would let markup execute are encoded,
		// and there is no raw "<img" or "onerror=" left in the src string.
		expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
		expect(uri).not.toMatch(/<img/i);
		expect(uri).toContain('%3Cimg');
	});

	it('neutralises a <script> payload (encoded, not raw markup)', () => {
		const uri = svgToDataUri('<svg><script>alert(1)</' + 'script></svg>');
		expect(uri).not.toContain('<script');
		expect(uri).toContain('%3Cscript');
	});

	it('is lossless — the wrapped SVG decodes back to the original QR markup', () => {
		// The doc promises the real QR still displays; the transform only wraps,
		// it does not alter the bytes.
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
		const payload = svgToDataUri(svg).slice('data:image/svg+xml;charset=utf-8,'.length);
		expect(decodeURIComponent(payload)).toBe(svg);
	});
});
