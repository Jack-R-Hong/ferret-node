import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createQrLoginStore } from './qr-login.svelte.js';
import { FerretError } from '../errors.js';
import type { FerretClient } from '../client.js';
import type { SessionStore } from './session.svelte.js';

const identity = { id: 'u1', email: 'a@b.c' };

const created = {
	id: 'qr1',
	scan_token: 'scan',
	qr_svg: '<svg/>',
	poll_token: 'poll-tok',
	expires_at: '2030-01-01T00:00:00Z',
	poll_interval_ms: 1000
};

const authorizedSession = {
	status: 'authorized' as const,
	session: { id: 's', identity, authenticated_at: 't0', expires_at: 't1' }
};

function makeSession() {
	return { setAuthenticated: vi.fn() };
}

function stubClient(over: Partial<Record<'createQrLoginFlow' | 'pollQrLogin', unknown>>): FerretClient {
	return {
		createQrLoginFlow: vi.fn(async () => created),
		pollQrLogin: vi.fn(async () => ({ status: 'pending' })),
		...over
	} as unknown as FerretClient;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createQrLoginStore', () => {
	it('start() loads, shows the QR, then begins polling on the interval', async () => {
		const client = stubClient({});
		const qr = createQrLoginStore(client, makeSession() as unknown as SessionStore);
		const p = qr.start();
		expect(qr.state).toBe('loading');
		await p;
		expect(qr.state).toBe('ready');
		expect(qr.qrSvg).toBe('<svg/>');
		// Safe render primitive: the SVG as an <img>-ready data URI (null before start()).
		expect(qr.qrImageSrc).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E');
		expect(qr.expiresAt).toBe('2030-01-01T00:00:00Z');
		expect(client.pollQrLogin).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1000);
		expect(client.pollQrLogin).toHaveBeenCalledWith('poll-tok');
	});

	it('hydrates the session and goes authorized', async () => {
		const session = makeSession();
		const client = stubClient({ pollQrLogin: vi.fn(async () => authorizedSession) });
		const qr = createQrLoginStore(client, session as unknown as SessionStore);
		await qr.start();
		await vi.advanceTimersByTimeAsync(1000);
		expect(qr.state).toBe('authorized');
		expect(session.setAuthenticated).toHaveBeenCalledWith(identity, 't0', 't1');
	});

	it('marks scanned, then keeps polling to a terminal status', async () => {
		let n = 0;
		const client = stubClient({
			pollQrLogin: vi.fn(async () => (++n === 1 ? { status: 'scanned' } : authorizedSession))
		});
		const qr = createQrLoginStore(client, makeSession() as unknown as SessionStore);
		await qr.start();
		await vi.advanceTimersByTimeAsync(1000);
		expect(qr.state).toBe('scanned');
		await vi.advanceTimersByTimeAsync(1000);
		expect(qr.state).toBe('authorized');
	});

	it('denied is terminal — no further polling', async () => {
		const client = stubClient({ pollQrLogin: vi.fn(async () => ({ status: 'denied' })) });
		const qr = createQrLoginStore(client, makeSession() as unknown as SessionStore);
		await qr.start();
		await vi.advanceTimersByTimeAsync(1000);
		expect(qr.state).toBe('denied');
		await vi.advanceTimersByTimeAsync(5000);
		expect(client.pollQrLogin).toHaveBeenCalledTimes(1);
	});

	it('maps flow_not_found / flow_expired to expired (offer a refresh)', async () => {
		const client = stubClient({
			pollQrLogin: vi.fn(async () => {
				throw new FerretError({ code: 'flow_not_found', message: 'x', status: 404 });
			})
		});
		const qr = createQrLoginStore(client, makeSession() as unknown as SessionStore);
		await qr.start();
		await vi.advanceTimersByTimeAsync(1000);
		expect(qr.state).toBe('expired');
	});

	it('maps other poll errors to error', async () => {
		const client = stubClient({
			pollQrLogin: vi.fn(async () => {
				throw new FerretError({ code: 'rate_limited', message: 'x', status: 429 });
			})
		});
		const qr = createQrLoginStore(client, makeSession() as unknown as SessionStore);
		await qr.start();
		await vi.advanceTimersByTimeAsync(1000);
		expect(qr.state).toBe('error');
	});

	it('a failure while creating the QR sets error', async () => {
		const client = stubClient({
			createQrLoginFlow: vi.fn(async () => {
				throw new Error('down');
			})
		});
		const qr = createQrLoginStore(client, makeSession() as unknown as SessionStore);
		await qr.start();
		expect(qr.state).toBe('error');
	});

	it('stop() cancels polling and resets to idle', async () => {
		const client = stubClient({});
		const qr = createQrLoginStore(client, makeSession() as unknown as SessionStore);
		await qr.start();
		qr.stop();
		expect(qr.state).toBe('idle');
		expect(qr.qrSvg).toBeNull();
		expect(qr.qrImageSrc).toBeNull();
		await vi.advanceTimersByTimeAsync(5000);
		expect(client.pollQrLogin).not.toHaveBeenCalled();
	});

	it('a poll that resolves after stop() does not clobber idle (generation guard)', async () => {
		let resolvePoll: (v: unknown) => void = () => {};
		const client = stubClient({
			pollQrLogin: vi.fn(
				() =>
					new Promise((res) => {
						resolvePoll = res;
					})
			)
		});
		const session = makeSession();
		const qr = createQrLoginStore(client, session as unknown as SessionStore);
		await qr.start();
		await vi.advanceTimersByTimeAsync(1000); // fire the poll; it now hangs on the promise
		expect(client.pollQrLogin).toHaveBeenCalledTimes(1);
		qr.stop();
		resolvePoll(authorizedSession);
		await Promise.resolve();
		await Promise.resolve();
		expect(qr.state).toBe('idle');
		expect(session.setAuthenticated).not.toHaveBeenCalled();
	});
});
