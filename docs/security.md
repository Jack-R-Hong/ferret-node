# Security

How the SDK protects the browser side of the auth flows, and the rules you must
follow when you render SDK data yourself.

The runnable examples in `src/routes/examples/` and the Playwright suite in
`e2e/` exercise everything below; run the security tests with `npm run test:e2e`.

---

## Rendering server SVG safely

The backend returns QR codes as **SVG markup** — `qr_svg` on the TOTP setup
response and on the cross-device QR-login response. Treat that markup as
untrusted: inlining it with Svelte's `{@html}` turns any embedded `<script>` or
`on*` handler into a DOM-XSS sink that runs in your origin.

**Rule: never `{@html}` server SVG. Load it through an `<img>` instead.** SVG
loaded as an image runs in a restricted mode — scripts and event handlers never
execute, and external fetches are blocked — so a poisoned document is inert.

The SDK ships a helper and a ready-made field so you don't have to think about
it:

```ts
import { svgToDataUri } from '@ferret/sdk-svelte';

// Wrap any SVG string in a data: URI for an <img src>.
const src = svgToDataUri(qr_svg);
```

```svelte
<!-- QR login: the store exposes qrImageSrc (already a data: URI) -->
<img alt="Scan to sign in" src={qr.qrImageSrc} />
```

The built-in `TotpManager` component already renders its QR this way, so if you
use the components you get the safe behaviour for free. You only need the helper
when you render `qr_svg` / `qr.qrSvg` yourself.

| Do | Don't |
|----|-------|
| `<img src={svgToDataUri(qr_svg)}>` | `{@html qr_svg}` |
| `<img src={qr.qrImageSrc}>` | `{@html qr.qrSvg}` |

> If you genuinely need inline SVG (e.g. to style it with `currentColor`), run it
> through a vetted sanitizer such as DOMPurify with an SVG profile — not a
> hand-rolled regex, which is easy to bypass.

---

## CSRF

Ferret authenticates browser requests with an HttpOnly session cookie and
protects mutations with a double-submit CSRF token. `FerretClient` handles this
for you:

- The backend sets a **non-HttpOnly** `ferret_csrf` cookie (prod:
  `__Host-ferret_csrf`) next to the session cookie.
- On every mutating request (`POST`/`PUT`/`DELETE`) the client reads that cookie
  and echoes it as the `X-CSRF-Token` header. Safe methods (`GET`) never carry
  it.
- All requests use `credentials: 'include'`, so the cookies ride along.

**Same-origin** integrations need no extra work. **Cross-origin** `baseUrl`
integrations can't read the API host's cookie from JS, so seed the token
yourself after a login/recovery completion or a `whoami`:

```ts
client.setCsrfToken(res.csrf_token); // from a completion response …
await client.whoami();               // … or let whoami cache it for you
```

The self-service flow families (login / registration / recovery / settings)
carry their own per-flow `csrf_token` in the request body, which the flow
components thread through automatically.

---

## Session probing and SSR

`FerretProvider` runs a `whoami` check to hydrate the session, but defers it to
`onMount` — it never fetches during server-side rendering, where it couldn't
send the session cookie anyway. If you build a custom provider, do the same:
keep network calls out of component setup and inside `onMount`/`load`.

---

## Account enumeration

Endpoints that take an email address are designed not to leak whether an account
exists. `createMagicLinkFlow()` always resolves — the backend returns `202`
regardless — so always render the neutral "if an account exists, we've sent a
link" message. The client only rethrows genuine transport/programming errors
(offline, CORS, a bug), never the backend's status, so you can't accidentally
branch your UI on account existence. QR-login poll errors collapse
expired/consumed/unknown into a single state for the same reason.
