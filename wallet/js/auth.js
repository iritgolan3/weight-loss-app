/* Device profile, passcode and biometric unlock.

   The passcode is the credential. A profile is created on first run and the
   app is usable immediately — no email, no sign-up. An email is only ever
   introduced when the optional cloud backend is configured and the user asks
   to sync across devices.

   Secrets are never stored. Each one gets a random salt plus a PBKDF2-SHA256
   derivation, and we compare derivations rather than secrets.

   WebCrypto's subtle API needs a secure context: https, or localhost during
   development. */

import { remote } from './backend.js';

const PROFILE = 'dw:profile';
const SESSION = 'dw:session';
const ITER    = 210_000;

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

const randomSalt = (bytes = 16) => b64(crypto.getRandomValues(new Uint8Array(bytes)));

async function derive(secret, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const key  = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return b64(bits);
}

/** Constant-time comparison so a near-miss costs the same as a wild guess. */
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const read  = () => { try { return JSON.parse(localStorage.getItem(PROFILE)); } catch { return null; } };
const write = p  => { try { localStorage.setItem(PROFILE, JSON.stringify(p)); } catch { /* private mode */ } };

export const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim());

class Auth extends EventTarget {
  #profile = null;   // { id, createdAt, email, passcode, webauthn }
  #locked = true;
  #session = null;   // cloud tokens, only when syncing

  /** Load or create the device profile. The lock re-arms on every load. */
  boot() {
    this.#profile = read() || {
      id: `p_${b64(crypto.getRandomValues(new Uint8Array(9))).replace(/\W/g, '')}`,
      createdAt: Date.now(),
      email: null,
      passcode: null,
      webauthn: null,
    };
    write(this.#profile);

    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
      if (s?.token && s.email === this.#profile.email) this.#session = s;
    } catch { /* ignore */ }

    this.#locked = this.hasPasscode;
    return this;
  }

  /** Stable id used to namespace this device's wallet. */
  get profileId()   { return this.#profile?.id || 'local'; }
  get email()       { return this.#profile?.email || null; }
  get isSynced()    { return Boolean(this.#profile?.email); }
  get hasPasscode() { return Boolean(this.#profile?.passcode); }
  get isLocked()    { return this.#locked; }
  get session()     { return this.#session; }
  get canSync()     { return remote.enabled; }

  /** What the home screen greets the user with. */
  get displayName() {
    const email = this.email;
    if (!email) return 'DailyWallet';
    const stem = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    return stem.charAt(0).toUpperCase() + stem.slice(1);
  }

  #save() { write(this.#profile); this.dispatchEvent(new CustomEvent('change')); }

  /* --- Passcode -------------------------------------------------------- */

  async setPasscode(code) {
    const salt = randomSalt();
    this.#profile.passcode = { salt, hash: await derive(code, salt) };
    this.#locked = false;
    this.#save();
  }

  async verifyPasscode(code) {
    const p = this.#profile?.passcode;
    if (!p) return false;
    const ok = same(await derive(code, p.salt), p.hash);
    if (ok) { this.#locked = false; this.dispatchEvent(new CustomEvent('change')); }
    return ok;
  }

  lock() { this.#locked = true; this.dispatchEvent(new CustomEvent('change')); }

  /* --- Optional cloud sync --------------------------------------------- */

  /** Attach an email so this wallet follows the user to other devices. */
  async signUp(email, password) {
    email = (email || '').trim().toLowerCase();
    if (!isValidEmail(email))        throw new Error('Enter a valid email address.');
    if ((password || '').length < 8) throw new Error('Use at least 8 characters.');
    if (!remote.enabled)             throw new Error('Syncing is not set up for this app yet.');

    this.#session = await remote.signUp(email, password);
    this.#profile.email = email;
    this.#persistSession();
    this.#save();
  }

  async signIn(email, password) {
    email = (email || '').trim().toLowerCase();
    if (!remote.enabled) throw new Error('Syncing is not set up for this app yet.');

    this.#session = await remote.signIn(email, password);
    this.#profile.email = email;
    this.#persistSession();
    this.#save();
  }

  #persistSession() {
    try { sessionStorage.setItem(SESSION, JSON.stringify(this.#session)); } catch { /* ignore */ }
  }

  /** Detach the email. The device profile, passcode and wallet all stay. */
  stopSync() {
    if (this.#session?.token) remote.signOut(this.#session.token);
    this.#session = null;
    this.#profile.email = null;
    try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
    this.#save();
  }

  /* --- Biometric unlock -------------------------------------------------
     WebAuthn with a platform authenticator gives us Face ID / Touch ID /
     Windows Hello / Android biometrics. The credential never leaves the
     device and we use it only as proof of presence for the local gate. */

  static async biometricAvailable() {
    try {
      return !!window.PublicKeyCredential &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch { return false; }
  }

  get hasBiometric() { return Boolean(this.#profile?.webauthn); }

  async enrolBiometric() {
    const label = this.email || 'This device';
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'DailyWallet' },
        user: { id: enc.encode(this.profileId), name: label, displayName: label },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    });
    if (!cred) throw new Error('Biometric setup was cancelled.');
    this.#profile.webauthn = { id: b64(cred.rawId) };
    this.#save();
    return true;
  }

  async unlockWithBiometric() {
    const w = this.#profile?.webauthn;
    if (!w) return false;
    const id = Uint8Array.from(atob(w.id), c => c.charCodeAt(0));
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    if (!got) return false;
    this.#locked = false;
    this.dispatchEvent(new CustomEvent('change'));
    return true;
  }
}

export const auth = new Auth();
