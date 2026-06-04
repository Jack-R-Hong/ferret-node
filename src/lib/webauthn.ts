/**
 * Browser ↔ server encoding helpers for WebAuthn.
 *
 * The backend exchanges WebAuthn binary fields as base64url (the encoding
 * the WebAuthn spec uses) while the browser's `navigator.credentials.*`
 * APIs use `ArrayBuffer` / `Uint8Array`. These helpers bridge the two.
 * Decoding also tolerates standard base64 input.
 */

export function b64ToBytes(b64: string): Uint8Array {
	const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
	const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
	return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function bytesToB64(bytes: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}
