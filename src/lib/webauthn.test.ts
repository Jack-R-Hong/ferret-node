import { describe, it, expect } from 'vitest';
import { b64ToBytes, bytesToB64 } from './webauthn.js';

describe('webauthn base64url helpers', () => {
	it('round-trips arbitrary bytes through base64url', () => {
		const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 250, 255]);
		const b64 = bytesToB64(bytes.buffer);
		const back = b64ToBytes(b64);
		expect(Array.from(back)).toEqual(Array.from(bytes));
	});

	it('emits the URL-safe alphabet with no padding', () => {
		// 0xFF 0xFF 0xFF → six set bits per sextet → "////" in std base64 → "____"
		expect(bytesToB64(new Uint8Array([0xff, 0xff, 0xff]).buffer)).toBe('____');
		const b64 = bytesToB64(new Uint8Array([1, 2, 3, 4, 5]).buffer);
		expect(b64).not.toMatch(/[+/=]/);
	});

	it('handles empty input both ways', () => {
		expect(bytesToB64(new Uint8Array([]).buffer)).toBe('');
		expect(Array.from(b64ToBytes(''))).toEqual([]);
	});

	it('decodes input that is missing padding', () => {
		// base64url("A"=0x41) is "QQ" (std would pad to "QQ==")
		expect(Array.from(b64ToBytes('QQ'))).toEqual([0x41]);
	});

	it('tolerates standard base64 (+ and /) as well as base64url (- and _)', () => {
		expect(Array.from(b64ToBytes('a-b_'))).toEqual(Array.from(b64ToBytes('a+b/')));
	});
});
