/**
 * Browser ↔ server encoding helpers for WebAuthn.
 *
 * The backend exchanges WebAuthn binary fields as base64 strings; the
 * browser's `navigator.credentials.*` APIs use `ArrayBuffer` / `Uint8Array`.
 * These helpers bridge the two so callers don't need to reinvent them.
 */

export function b64ToBytes(b64: string): Uint8Array {
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function bytesToB64(bytes: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
