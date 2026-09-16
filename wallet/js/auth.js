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

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

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

/* --- Biometrics ---------------------------------------------------------
   WebAuthn asks the platform for *its* authenticator; the device decides
   whether that means a face scan or a fingerprint, and there is no web API
   to pick one. So the app names both and lets the OS choose the sensor it
   has. On Android, BiometricPrompt lets the user switch between enrolled
   modalities itself. */

function platformKind() {
  const ua = navigator.userAgent || '';
  const appleTouch = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || appleTouch) return 'ios';
  if (/Macintosh|Mac OS X/.test(ua))            return 'mac';
  if (/Android/.test(ua))                        return 'android';
  if (/Windows/.test(ua))                        return 'windows';
  return 'other';
}

/**
 * What to call the sensor on this platform, naming both modalities where the
 * platform has both. Phrased to read correctly after "Unlock with", "Turn on"
 * and "This device does not offer".
 */
export function biometricLabel() {
  switch (platformKind()) {
    case 'ios':     return 'Face ID or Touch ID';
    case 'mac':     return 'Touch ID';
    case 'android': return 'fingerprint or face unlock';
    case 'windows': return 'Windows Hello';
    default:        return 'fingerprint or face';
  }
}

/** Which glyph best represents the likely sensor. */
export function biometricGlyph() {
  return platformKind() === 'ios' ? 'faceid' : 'finger';
}

/** Turns a WebAuthn DOMException into something worth showing a person. */
function biometricError(err, action) {
  const name = err?.name || '';
  const what = biometricLabel();

  if (name === 'NotAllowedError') {
    return action === 'enrol'
      ? `Setup was dismissed. Tap again and confirm with ${what}.`
      : `Not recognised, or the prompt was dismissed. Try again, or use your passcode.`;
  }
  if (name === 'InvalidStateError') return 'This device is already set up for biometric unlock.';
  if (name === 'SecurityError')     return 'Biometric unlock needs the app to be served over HTTPS.';
  if (name === 'NotSupportedError') return `This device does not offer ${what}.`;
  if (name === 'AbortError')        return 'The prompt closed before it finished.';
  return `${what.charAt(0).toUpperCase() + what.slice(1)} is unavailable right now.`;
}

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

     Both calls below MUST run inside a fresh user gesture. Safari on iOS
     rejects WebAuthn without user activation, and activation does not
     survive a setTimeout or a slow await — which is why neither of these is
     ever fired automatically on screen entry.

     `authenticatorAttachment: 'platform'` asks for the device's own sensor,
     which is Face ID, Touch ID, Windows Hello or an Android fingerprint or
     face, whichever that device has. `userVerification: 'required'` makes
     the biometric check mandatory rather than mere presence. */

  static async biometricAvailable() {
    try {
      return !!window.PublicKeyCredential &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch { return false; }
  }

  get hasBiometric() { return Boolean(this.#profile?.webauthn); }

  /** Call only from a tap handler. Throws a readable Error on failure. */
  async enrolBiometric() {
    if (!(await Auth.biometricAvailable())) {
      throw new Error(`This device does not offer ${biometricLabel()}.`);
    }

    const label = this.email || 'DailyWallet';
    const existing = this.#profile?.webauthn;

    let cred;
    try {
      cred = await navigator.credentials.create({
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
          // Stops the platform from silently making a second credential.
          excludeCredentials: existing
            ? [{ type: 'public-key', id: unb64(existing.id), transports: ['internal'] }]
            : [],
          timeout: 60_000,
          attestation: 'none',
        },
      });
    } catch (err) {
      throw new Error(biometricError(err, 'enrol'));
    }

    if (!cred) throw new Error('Biometric setup did not complete.');
    this.#profile.webauthn = { id: b64(cred.rawId) };
    this.#save();
    return true;
  }

  /** Call only from a tap handler. Throws a readable Error on failure. */
  async unlockWithBiometric() {
    const w = this.#profile?.webauthn;
    if (!w) throw new Error('Biometric unlock is not set up on this device yet.');

    let got;
    try {
      got = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          // 'internal' keeps the prompt on this device's own sensor rather
          // than offering a phone-as-security-key hand-off.
          allowCredentials: [{ type: 'public-key', id: unb64(w.id), transports: ['internal'] }],
          userVerification: 'required',
          timeout: 60_000,
        },
      });
    } catch (err) {
      throw new Error(biometricError(err, 'unlock'));
    }

    if (!got) throw new Error('Biometric unlock did not complete.');
    this.#locked = false;
    this.dispatchEvent(new CustomEvent('change'));
    return true;
  }

  /** Right-to-erasure: drop the device profile, passcode and credential. */
  eraseProfile() {
    try { localStorage.removeItem(PROFILE); } catch { /* private mode */ }
    try { sessionStorage.removeItem(SESSION); } catch { /* private mode */ }
    this.#profile = null;
    this.#session = null;
    this.#locked = true;
    this.dispatchEvent(new CustomEvent('change'));
  }

  /** Forget the enrolled credential; the passcode still works. */
  forgetBiometric() {
    if (!this.#profile) return;
    this.#profile.webauthn = null;
    this.#save();
  }
}

export const auth = new Auth();
