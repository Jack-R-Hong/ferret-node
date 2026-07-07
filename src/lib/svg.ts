/**
 * Wrap SVG markup in a `data:` URI for use as an `<img>` `src`.
 *
 * Prefer this over inlining server-supplied SVG with Svelte's `{@html}`. SVG
 * loaded through an `<img>` runs in a restricted image context: embedded
 * `<script>` and `on*` handlers never execute and external fetches are blocked,
 * so a poisoned document cannot run script in your origin. Inlining the same
 * markup would. Use it for any SVG that originates outside your own source —
 * e.g. the `qr_svg` Ferret returns for TOTP enrolment and cross-device QR login.
 *
 * ```svelte
 * <img alt="Scan to sign in" src={svgToDataUri(qr.qrSvg)} />
 * ```
 */
export function svgToDataUri(svg: string): string {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
