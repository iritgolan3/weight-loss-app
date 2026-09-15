/* Accounts, passcode and biometric unlock.

   Passwords and passcodes are never stored. We keep a random per-credential
   salt plus a PBKDF2-SHA256 derivation of it, and compare derivations. That
   is the same shape a server would use, so switching the storage adapter to
   a real backend later does not change the security model here.

   WebCrypto's subtle API needs a secure context: https, or localhost during
   development. */

import { remote } from './backend.js';

const ACCOUNTS = 'dw:accounts';
const SESSION  = 'dw:session';
const ITER     = 210_000;

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

function randomSalt(bytes = 16) {
  return b64(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function derive(secret, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const key  = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return b64(bits);
}

/** Constant-time-ish comparison so a wrong guess costs the same as a right one. */
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const readAll  = () => { try { return JSON.parse(localStorage.getItem(ACCOUNTS)) || {}; } catch { return {}; } };
const writeAll = m  => { try { localStorage.setItem(ACCOUNTS, JSON.stringify(m)); } catch { /* private mode */ } };

export const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim());

/** Ensure a local record exists so the device passcode has somewhere to live. */
function ensureRecord(email) {
  const all = readAll();
  if (!all[email]) { all[email] = { createdAt: Date.now(), remote: true }; writeAll(all); }
  return all[email];
}

class Auth extends EventTarget {
  #user = null;      // { email } once signed in
  #locked = true;    // passcode gate
  #session = null;   // Supabase tokens, when the cloud backend is configured

  /** Restore a previous session; the passcode gate always re-arms on load. */
  boot() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
      if (s?.email && readAll()[s.email]) {
        this.#user = { email: s.email };
        if (s.token) this.#session = s;
      }
    } catch { /* ignore */ }
    this.#locked = !!this.#user;
    return this;
  }

  /** Tokens for the cloud backend, or null when running on-device only. */
  get session() { return this.#session; }
  get isRemote() { return remote.enabled; }

  get user()      { return this.#user; }
  get email()     { return this.#user?.email || null; }
  get isLocked()  { return this.#locked; }
  get hasAccounts() { return Object.keys(readAll()).length > 0; }

  hasPasscode(email = this.email) {
    const a = readAll()[email];
    return !!a?.passcode;
  }

  async signUp(email, password) {
    email = (email || '').trim().toLowerCase();
    if (!isValidEmail(email))    throw new Error('Enter a valid email address.');
    if ((password || '').length < 8) throw new Error('Use at least 8 characters.');

    if (remote.enabled) {
      this.#session = await remote.signUp(email, password);
      ensureRecord(email);
      this.#start(email);
      return this.#user;
    }

    const all = readAll();
    if (all[email]) throw new Error('That email already has an account.');

    const salt = randomSalt();
    all[email] = { salt, hash: await derive(password, salt), createdAt: Date.now() };
    writeAll(all);
    this.#start(email);
    return this.#user;
  }

  async signIn(email, password) {
    email = (email || '').trim().toLowerCase();

    if (remote.enabled) {
      this.#session = await remote.signIn(email, password);
      ensureRecord(email);
      this.#start(email);
      return this.#user;
    }

    const a = readAll()[email];
    // Derive even when the account is missing so timing does not leak existence.
    const probe = await derive(password || '', a?.salt || randomSalt());
    if (!a || !same(probe, a.hash)) throw new Error('Email or password is incorrect.');
    this.#start(email);
    return this.#user;
  }

  #start(email) {
    this.#user = { email };
    this.#locked = false;
    try {
      sessionStorage.setItem(SESSION, JSON.stringify({ email, ...(this.#session || {}) }));
    } catch { /* ignore */ }
    this.dispatchEvent(new CustomEvent('change'));
  }

  signOut() {
    if (remote.enabled && this.#session?.token) remote.signOut(this.#session.token);
    this.#user = null;
    this.#session = null;
    this.#locked = true;
    try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
    this.dispatchEvent(new CustomEvent('change'));
  }

  lock()   { this.#locked = true;  this.dispatchEvent(new CustomEvent('change')); }

  async setPasscode(code) {
    const all = readAll();
    const a = all[this.email];
    if (!a) throw new Error('No account is signed in.');
    const salt = randomSalt();
    a.passcode = { salt, hash: await derive(code, salt) };
    writeAll(all);
  }

  async verifyPasscode(code) {
    const a = readAll()[this.email];
    if (!a?.passcode) return false;
    const ok = same(await derive(code, a.passcode.salt), a.passcode.hash);
    if (ok) { this.#locked = false; this.dispatchEvent(new CustomEvent('change')); }
    return ok;
  }

  /* --- Biometric unlock ------------------------------------------------
     WebAuthn with a platform authenticator gives us Face ID / Touch ID /
     Windows Hello / Android biometrics. The credential never leaves the
     device and we only use it as proof of presence for the local gate. */

  static async biometricAvailable() {
    try {
      return !!window.PublicKeyCredential &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch { return false; }
  }

  hasBiometric(email = this.email) { return !!readAll()[email]?.webauthn; }

  async enrolBiometric() {
    const all = readAll();
    const a = all[this.email];
    if (!a) throw new Error('No account is signed in.');

    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'DailyWallet' },
        user: {
          id: enc.encode(this.email),
          name: this.email,
          displayName: this.email,
        },
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
    a.webauthn = { id: b64(cred.rawId) };
    writeAll(all);
    return true;
  }

  async unlockWithBiometric() {
    const a = readAll()[this.email];
    if (!a?.webauthn) return false;
    const id = Uint8Array.from(atob(a.webauthn.id), c => c.charCodeAt(0));
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
