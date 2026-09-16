/* Encryption for everything the wallet keeps on the device.

   The wallet blob is sealed with AES-GCM under a key derived from the
   passcode. The key is held in memory for the life of the page and is never
   written anywhere, so a closed app leaves nothing readable behind — not in
   localStorage, not in a profile backup.

   Biometric unlock gets its own path through the WebAuthn PRF extension,
   which lets an authenticator hand back a stable secret after a successful
   scan. Where PRF is supported the data key is wrapped under that secret, so
   a face or fingerprint can open a cold start. Where it is not, biometrics
   still gate the UI but the passcode is what decrypts — which the lock
   screen says rather than failing mysteriously. */

const ITER = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

export const randomBytes = (n = 32) => crypto.getRandomValues(new Uint8Array(n));

/** PBKDF2 over the passcode, giving the AES key the wallet is sealed with. */
export async function keyFromPasscode(passcode, saltB64) {
  const base = await crypto.subtle.importKey(
    'raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: ITER },
    base,
    { name: 'AES-GCM', length: 256 },
    true,                      // extractable: needed to wrap it for biometrics
    ['encrypt', 'decrypt'],
  );
}

/** Raw 32 bytes (from the PRF extension) as an AES key. */
export const keyFromBytes = (bytes, usages = ['encrypt', 'decrypt']) =>
  crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM', length: 256 }, false, usages);

export async function seal(key, text) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { v: 2, iv: toB64(iv), data: toB64(ct) };
}

export async function open(key, blob) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.data));
  return dec.decode(plain);
}

/** Seal the data key itself, so a biometric secret can release it later. */
export async function wrapKey(wrappingKey, keyToWrap) {
  const raw = await crypto.subtle.exportKey('raw', keyToWrap);
  return seal(wrappingKey, toB64(raw));
}

export async function unwrapKey(wrappingKey, blob) {
  const rawB64 = await open(wrappingKey, blob);
  return keyFromBytes(fromB64(rawB64));
}
