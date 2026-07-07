import type { FerretClient } from '../client.js';
import { FerretError } from '../errors.js';
import { svgToDataUri } from '../svg.js';
import type { SessionStore } from './session.svelte.js';

/**
 * UI phase for a cross-device QR login attempt.
 *
 * - `idle`        nothing in flight (initial, or after `stop()`)
 * - `loading`     creating a fresh QR request
 * - `ready`       QR on screen, waiting for a phone to scan it
 * - `scanned`     a signed-in phone scanned it; waiting for approve/deny
 * - `authorized`  approved — the session cookie is set and the session store
 *                 hydrated; the caller should navigate away
 * - `denied`      the phone explicitly denied the sign-in (terminal)
 * - `expired`     the QR's ~3-minute TTL ran out (offer a refresh)
 * - `error`       create/poll failed for any other reason
 */
export type QrLoginState =
	| 'idle'
	| 'loading'
	| 'ready'
	| 'scanned'
	| 'authorized'
	| 'denied'
	| 'expired'
	| 'error';

/**
 * Headless cross-device QR login logic for the *displaying* (desktop) side:
 * create a QR request, render `qrSvg`, and poll on the backend's suggested
 * interval until the phone approves, denies, or the code expires. Mirrors
 * `createSocialLoginStore`: holds reactive `$state`, takes its deps explicitly.
 *
 *   const qr = createQrLoginStore(getFerretClient(), getFerretSession());
 *   $effect(() => { if (qr.state === 'authorized') goto('/account'); });
 *   <button onclick={() => qr.start()}>…</button>
 *   <img alt="Scan to sign in" src={qr.qrImageSrc} />
 *
 * Render the QR through `qrImageSrc` (an `<img>` data-URI), NOT by inlining
 * `qrSvg` with `{@html}`: the SVG comes from the server, and inlining it would
 * make any embedded script/handler a DOM-XSS sink. `qrImageSrc` loads the same
 * markup as an image, where script can't run.
 *
 * Call `stop()` when the QR UI unmounts or the user backs out, so the poll
 * loop doesn't keep hitting the backend from a page that no longer shows it.
 */
export function createQrLoginStore(client: FerretClient, session: SessionStore) {
	let state = $state<QrLoginState>('idle');
	let qrSvg = $state<string | null>(null);
	let expiresAt = $state<string | null>(null);

	// Poll-loop bookkeeping (non-reactive). `generation` invalidates the loop
	// belonging to a superseded start(): any await that resumes after a newer
	// start()/stop() sees a stale generation and exits without touching state.
	let generation = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function clearTimer() {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	/** Create a fresh QR request and begin polling. Safe to call again to
	 *  replace an expired code. */
	async function start(): Promise<void> {
		const gen = ++generation;
		clearTimer();
		state = 'loading';
		qrSvg = null;
		expiresAt = null;

		try {
			const created = await client.createQrLoginFlow();
			if (gen !== generation) return;
			qrSvg = created.qr_svg;
			expiresAt = created.expires_at;
			state = 'ready';
			schedulePoll(gen, created.poll_token, created.poll_interval_ms);
		} catch {
			if (gen !== generation) return;
			state = 'error';
		}
	}

	function schedulePoll(gen: number, pollToken: string, intervalMs: number) {
		timer = setTimeout(() => void poll(gen, pollToken, intervalMs), intervalMs);
	}

	async function poll(gen: number, pollToken: string, intervalMs: number) {
		if (gen !== generation) return;
		try {
			const res = await client.pollQrLogin(pollToken);
			if (gen !== generation) return;
			if (res.status === 'authorized') {
				session.setAuthenticated(
					res.session.identity,
					res.session.authenticated_at,
					res.session.expires_at
				);
				state = 'authorized';
				return;
			}
			if (res.status === 'denied') {
				state = 'denied';
				return;
			}
			// pending / scanned: keep waiting.
			state = res.status === 'scanned' ? 'scanned' : state;
			schedulePoll(gen, pollToken, intervalMs);
		} catch (err) {
			if (gen !== generation) return;
			// The backend deliberately collapses expired / consumed / unknown into
			// one `flow_not_found` wire code (anti-enumeration) — from this side
			// they all mean "this QR is dead", so offer a refresh rather than a
			// scary failure. `flow_expired` kept for backends that distinguish it.
			if (
				err instanceof FerretError &&
				(err.code === 'flow_expired' || err.code === 'flow_not_found')
			) {
				state = 'expired';
			} else {
				state = 'error';
			}
		}
	}

	/** Abandon the current QR request (if any) and return to `idle`. */
	function stop() {
		generation++;
		clearTimer();
		state = 'idle';
		qrSvg = null;
		expiresAt = null;
	}

	return {
		get state() {
			return state;
		},
		/**
		 * Raw QR SVG markup from the backend. Prefer {@link qrImageSrc} for
		 * rendering — inlining this with `{@html}` is a DOM-XSS sink. Exposed for
		 * headless callers that pipe it somewhere already safe.
		 */
		get qrSvg() {
			return qrSvg;
		},
		/**
		 * The QR as a `data:image/svg+xml` URI, ready for an `<img>` `src`. `null`
		 * until {@link start} has fetched a code. Safe to render directly: SVG
		 * loaded as an image can't execute embedded script.
		 */
		get qrImageSrc() {
			return qrSvg === null ? null : svgToDataUri(qrSvg);
		},
		get expiresAt() {
			return expiresAt;
		},
		start,
		stop
	};
}

export type QrLoginStore = ReturnType<typeof createQrLoginStore>;
