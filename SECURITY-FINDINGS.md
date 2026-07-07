# Security review — @ferret/sdk-svelte flows

Scope: client-side security of the SDK's auth flows, exercised through runnable
example pages and a Playwright suite that drives them against a mocked Ferret
backend. Each finding below has a passing test that demonstrates it in a real
Chromium browser.

- Examples: `src/routes/examples/*`
- Tests: `e2e/*.spec.ts` (run with `npm run test:e2e`)
- Result: **2 findings** (both DOM XSS via server-supplied SVG), plus one
  positive control confirming CSRF is implemented correctly.

> **Status: RESOLVED.** Both findings are fixed in the SDK source — see
> [Resolution](#resolution--fixes-applied) at the end. The e2e suite was flipped
> into regression guards that fail if the sinks ever come back. The sections
> below describe the original vulnerabilities.

```
✓ TOTP: renders qr_svg as an <img> data-URI, not inline markup     (fix)
✓ TOTP: poisoned qr_svg (unquoted handler) does not execute        (regression)
✓ TOTP: poisoned qr_svg (quoted handler) does not execute          (regression)
✓ QR:   raw {@html qrSvg} anti-pattern still runs a poisoned svg    (why the fix matters)
✓ QR:   qrImageSrc / <img> data-URI render neutralises the payload  (fix)
✓ CSRF: X-CSRF-Token mirrors ferret_csrf cookie on mutations only  (positive control)
✓ Login: flow submits credentials and reports success             (functional baseline)
```

---

## Finding 1 — `sanitizeSvg` is a bypassable blocklist (TotpManager)

**Severity: Medium** (High if the QR SVG can carry any attacker-influenced
input on the backend). **Type: DOM-based XSS.**

`TotpManager.svelte` renders the backend's TOTP QR code inline:

```svelte
<!-- src/lib/components/TotpManager.svelte:155 -->
<div class="ferret-qr">{@html sanitizeSvg(totpSetup.qr_svg)}</div>
```

with this sanitizer:

```ts
// src/lib/components/TotpManager.svelte:63
function sanitizeSvg(svg: string): string {
	return svg
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');   // ← only QUOTED handlers
}
```

The event-handler regex only matches handlers whose value is wrapped in quotes.
An **unquoted** handler slips through untouched:

```
<svg ...></svg><img src=x onerror=window.__ferretXss=...>
```

`{@html}` sets `innerHTML`, the bogus `src` 404s, `onerror` fires, script runs in
the app origin. The test log shows the real request (`[404] GET /examples/x`),
proving execution rather than simulation.

Because the regex is a blocklist, other well-known vectors also survive
(non-exhaustive): `xlink:href="javascript:…"`, `<foreignObject>` HTML, SVG
`<animate>`/`<set>`, and handlers separated by newlines. The control test
confirms the *quoted* case the regex was written for **is** blocked — so this is
a partial mitigation with a specific, demonstrated hole, not a no-op.

**Tests:** `e2e/totp-svg-xss.spec.ts` (FINDING + CONTROL).

---

## Finding 2 — QR-login store documents raw `{@html}` with no sanitizer

**Severity: Medium** (same conditional-High caveat). **Type: DOM-based XSS.**

The `createQrLoginStore` docstring hands integrators the backend SVG and tells
them to inject it directly:

```ts
// src/lib/stores/qr-login.svelte.ts:37
 *   {@html qr.qrSvg}
```

There is **no** sanitizer on this path at all — strictly weaker than Finding 1.
The test proves that even the *quoted* payload (the one `sanitizeSvg` would have
stripped) executes here. Any integrator who copies the documented pattern (the
`qr-login` example does) ships an XSS sink.

**Test:** `e2e/qr-svg-xss.spec.ts` → "documented {@html} pattern runs a poisoned
qr_svg".

---

## Trust boundary — why this matters

`qr_svg` is produced by the Ferret backend, so exploitation requires the SVG to
be attacker-influenced. That is not a purely theoretical bar:

1. **The code already distrusts it.** `sanitizeSvg` exists precisely because the
   SVG is treated as not-fully-trusted — but the filter is incomplete.
2. **Reflected input.** If any user-controlled value (account label, device
   name, issuer/identifier baked into the QR/otpauth payload) reaches the SVG
   server-side, it becomes the injection vector.
3. **Transport / compromise.** A misconfigured non-TLS `baseUrl`, a compromised
   or malicious backend, or a proxy can substitute the response.

An authentication SDK should not have a script-execution sink gated on "the
backend never emits or reflects a hostile byte." This is a defense-in-depth gap
with a concrete exploit path.

---

## Remediation (demonstrated)

Render server SVG as an **image**, not as inline markup. SVG loaded via
`<img src="data:image/svg+xml,…">` runs in restricted image mode: `<script>` and
`on*` handlers never execute and external fetches are blocked.

```svelte
<!-- src/routes/examples/qr-login-safe/QrLoginDemoSafe.svelte -->
<img alt="Scan to sign in"
     src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.qrSvg)}`} />
```

The remediation test feeds the *worst* payload (the one that bypasses
`sanitizeSvg`) to this variant and confirms it does **not** execute
(`e2e/qr-svg-xss.spec.ts` → "REMEDIATION"). Svelte's own autofixer flags the
inline `{@html}` demo and passes the `<img>` variant.

Suggested changes to the SDK:

1. Render `qr_svg` (TOTP and QR-login) via the `<img>` data-URI pattern above, or
   through a real sanitizer (e.g. DOMPurify with an SVG profile) — not a
   hand-rolled regex.
2. Fix the `createQrLoginStore` docstring so it never shows raw `{@html}`.
3. If inline SVG is truly required, replace `sanitizeSvg` with a vetted
   sanitizer and add a `Content-Security-Policy` (e.g. `script-src` without
   `unsafe-inline`) as a backstop.

---

## Positive control — CSRF is implemented correctly

`e2e/csrf.spec.ts` confirms the double-submit design in `FerretClient.request`:

- `X-CSRF-Token` is **absent** on safe requests (`whoami`, `mfa` — both GET).
- It is **present** on mutations (settings `POST`, TOTP setup `POST`) and its
  value equals the `ferret_csrf` cookie (cookie read at request time).
- `credentials: 'include'` is honoured — the cookie rides along on the request.

No CSRF issue found on the client side. (Server-side `return_to`/social redirect
validation and account-enumeration responses are the backend's responsibility
and out of scope for this client review.)

## Other observations (not exploitable here, worth noting)

- Path parameters (`provider`, `sessionId`, `credentialId`) are interpolated into
  request paths without `encodeURIComponent`. Values come from the backend's own
  listings today, so low risk — encode them for defense in depth.
- `FerretProvider` triggers `whoami` eagerly during SSR; the dev server logs
  "Avoid calling `fetch` eagerly during server-side rendering". Correctness/SSR
  smell, not a security issue.

---

## How to run

```bash
npm run test:e2e          # headless Chromium, boots `vite dev` automatically
npm run test:e2e:ui       # interactive UI mode
npm run dev               # browse the examples at /examples (needs a real backend)
```

The e2e suite needs no Ferret server — every backend call is mocked in
`e2e/mock.ts`, including the poisoned SVG responses used to probe the sinks.

---

## Resolution — fixes applied

Both sinks were removed by rendering server SVG as an image instead of inlining
it. Changes:

| File | Change |
|------|--------|
| `src/lib/svg.ts` *(new)* | `svgToDataUri(svg)` — wraps SVG in a `data:image/svg+xml` URI for `<img src>`. Exported from `index.ts`. |
| `src/lib/components/TotpManager.svelte` | Deleted the `sanitizeSvg` regex; the QR now renders as `<img class="ferret-qr" src={svgToDataUri(totpSetup.qr_svg)} alt=…>`. No more `{@html}`. |
| `src/lib/stores/qr-login.svelte.ts` | Added a `qrImageSrc` getter (the SVG as an `<img>`-ready data URI); docstring now shows `<img src={qr.qrImageSrc}>` and warns against `{@html}`. `qrSvg` kept for headless callers, documented as a sink. |
| `src/lib/index.ts` | Exports `svgToDataUri`. |

Why `<img>` data-URI over a sanitizer: SVG loaded as an image runs with scripting
disabled by the browser, so it's safe by construction — no allow/blocklist to get
wrong. A vetted sanitizer (DOMPurify) would also work if inline SVG is ever
required.

Tests: `svgToDataUri` and the new `qrImageSrc` getter have unit coverage
(`src/lib/svg.test.ts`, `src/lib/stores/qr-login.test.ts`); the e2e specs above
assert the poisoned payloads no longer execute. The `qr-login` example is kept as
a clearly-labelled anti-pattern so the "raw `{@html}` is unsafe" regression stays
meaningful. Full suite after the fix: **91 unit tests + 7 e2e tests green**,
`svelte-check` 0 errors.
