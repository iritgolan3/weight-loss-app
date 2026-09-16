import { screenEl, tap, toast } from '../dom.js';
import { auth, biometricLabel, biometricGlyph } from '../auth.js';
import { icon } from '../icons.js';

const LEN = 6;

/**
 * One screen serving three jobs:
 *   mode 'unlock' — verify an existing passcode to lift the lock
 *   mode 'set'    — choose a new passcode, then confirm it
 */
export function passcodeScreen({ mode = 'unlock', onDone }) {
  let stage = mode === 'set' ? 'choose' : 'unlock';
  let first = '';
  let buf = '';
  let bioReady = false;

  const node = screenEl('sc-pass', `
    <div class="sc-pass__head">
      <h1 class="title title--s" data-t></h1>
      <p class="subtitle" data-s></p>
    </div>

    <div class="pcode__dots" role="status" aria-live="polite">
      ${Array.from({ length: LEN }, () => '<i></i>').join('')}
    </div>

    <button class="pcode__bio" data-bio-cta hidden>
      ${icon(biometricGlyph(), 18)} <span data-bio-label></span>
    </button>

    <div class="sc-pass__pad">
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        <button class="is-bare" data-bio hidden
                aria-label="Unlock with ${biometricLabel()}">${icon(biometricGlyph(), 26)}</button>
        <button data-k="0">0</button>
        <button class="is-bare" data-del aria-label="Delete">${icon('back', 24)}</button>
      </div>
    </div>
  `);

  const title = node.querySelector('[data-t]');
  const sub   = node.querySelector('[data-s]');
  const dots  = node.querySelector('.pcode__dots');
  const bio   = node.querySelector('[data-bio]');
  const bioCta = node.querySelector('[data-bio-cta]');

  const COPY = {
    unlock:  ['Enter your passcode', 'Six digits to unlock your wallet.'],
    choose:  ['Choose a passcode',   'Six digits. You will use it each time you open the app.'],
    confirm: ['Confirm your passcode', 'Enter the same six digits once more.'],
  };

  function render() {
    [title.textContent, sub.textContent] = COPY[stage];
    [...dots.children].forEach((d, i) => d.classList.toggle('is-on', i < buf.length));
    const offer = stage === 'unlock' && bioReady;
    bio.hidden = !offer;
    bioCta.hidden = !offer;
    if (offer) {
      bioCta.querySelector('[data-bio-label]').textContent =
        `Unlock with ${biometricLabel()}`;
    }
  }

  function reject(message) {
    dots.classList.add('is-bad');
    tap(30);
    if (message) toast(message);
    setTimeout(() => {
      dots.classList.remove('is-bad');
      buf = '';
      render();
    }, 520);
  }

  async function submit() {
    if (stage === 'unlock') {
      if (await auth.verifyPasscode(buf)) { tap(); return onDone(); }
      return reject('That passcode did not match.');
    }

    if (stage === 'choose') {
      first = buf;
      buf = '';
      stage = 'confirm';
      return render();
    }

    // stage === 'confirm'
    if (buf !== first) {
      stage = 'choose';
      first = '';
      return reject('Those did not match. Start again.');
    }

    await auth.setPasscode(buf);

    // Biometric setup needs its own tap, so point at Profile instead of
    // firing a prompt that the platform would reject here.
    toast(bioReady && !auth.hasBiometric
      ? `Passcode set — turn on ${biometricLabel()} in Profile`
      : 'Passcode set');
    onDone();
  }

  function push(digit) {
    if (buf.length >= LEN) return;
    buf += digit;
    tap();
    render();
    if (buf.length === LEN) setTimeout(submit, 160);
  }

  node.addEventListener('click', event => {
    const k = event.target.closest('[data-k]');
    if (k) return push(k.dataset.k);

    if (event.target.closest('[data-del]')) {
      buf = buf.slice(0, -1);
      tap(5);
      return render();
    }

    if (event.target.closest('[data-bio]') || event.target.closest('[data-bio-cta]')) {
      tap();
      // Runs straight off this tap: WebAuthn needs live user activation.
      auth.unlockWithBiometric()
        .then(() => onDone())
        .catch(err => toast(err.message));
    }
  });

  const onKey = event => {
    if (/^\d$/.test(event.key))      push(event.key);
    else if (event.key === 'Backspace') { buf = buf.slice(0, -1); render(); }
  };
  window.addEventListener('keydown', onKey);

  render();

  return {
    el: node,
    async enter() {
      bioReady = stage === 'unlock'
        ? (await auth.constructor.biometricAvailable()) && auth.hasBiometric
        : await auth.constructor.biometricAvailable();
      render();
    },
    destroy() { window.removeEventListener('keydown', onKey); },
  };
}
