import { screenEl, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { auth, biometricLabel, biometricGlyph } from '../auth.js';
import { store, money } from '../store.js';
import { tierById } from '../ui/card.js';
import { stagger } from '../hero.js';

export function profileScreen({ onBack, onChangePasscode, onSync, onStopSync, onLock }) {
  const tier = tierById(store.card);
  const synced = auth.isSynced;
  const title = synced ? auth.email : 'This device';

  const node = screenEl('sc-profile', `
    <div class="sc-profile__head">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
      <h1 class="title title--s" style="margin-top:6px">Profile</h1>
    </div>

    <div class="sc-profile__id">
      <span class="sc-profile__avatar">${(synced ? auth.email[0] : 'D').toUpperCase()}</span>
      <span>
        <span class="sc-profile__email">${title}</span>
        <span class="sc-profile__since">${tier.name} card · ${money(store.balance, { cents: false })} available</span>
      </span>
    </div>

    <div data-rows>
      <button class="rowbtn" data-passcode>${icon('key', 20)} Change passcode
        <span class="rowbtn__chev">${icon('chevronR', 18)}</span></button>

      <button class="rowbtn" data-bio>${icon(biometricGlyph(), 20)}
        <span data-biolabel>Biometric unlock</span>
        <span class="rowbtn__chev">${icon('chevronR', 18)}</span></button>

      ${auth.canSync ? (synced
        ? `<button class="rowbtn" data-stopsync>${icon('logout', 20)} Stop syncing
             <span class="rowbtn__chev">${icon('chevronR', 18)}</span></button>`
        : `<button class="rowbtn" data-sync>${icon('bell', 20)} Sync across devices
             <span class="rowbtn__chev">${icon('chevronR', 18)}</span></button>`) : ''}

      <button class="rowbtn" data-lock>${icon('lock', 20)} Lock now
        <span class="rowbtn__chev">${icon('chevronR', 18)}</span></button>
    </div>

    <p class="sc-auth__hint" style="margin-top:18px">
      ${icon('lock', 14)} Your wallet stays on this device
    </p>
  `);

  const bioLabel = node.querySelector('[data-biolabel]');

  node.addEventListener('click', async event => {
    if (event.target.closest('[data-back]'))     { tap(); return onBack(); }
    if (event.target.closest('[data-passcode]')) { tap(); return onChangePasscode(); }
    if (event.target.closest('[data-sync]'))     { tap(); return onSync(); }
    if (event.target.closest('[data-lock]'))     { tap(); return onLock(); }

    if (event.target.closest('[data-stopsync]')) {
      tap();
      onStopSync();
      return toast('Syncing turned off');
    }

    if (event.target.closest('[data-bio]')) {
      tap();

      // Already on: offer to forget it rather than dead-ending.
      if (auth.hasBiometric) {
        auth.forgetBiometric();
        setBioLabel();
        return toast(`${cap(biometricLabel())} turned off`);
      }

      try {
        // Runs straight off this tap, with no await in front of it, because
        // WebAuthn needs live user activation.
        await auth.enrolBiometric();
        setBioLabel();
        toast(`${cap(biometricLabel())} turned on`);
      } catch (err) {
        toast(err.message);
      }
    }
  });

  let canBio = false;
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  function setBioLabel() {
    const what = cap(biometricLabel());
    bioLabel.textContent = !canBio ? `${what} · unavailable`
      : auth.hasBiometric ? `${what} · on` : `Turn on ${biometricLabel()}`;
    node.querySelector('[data-bio]').disabled = !canBio;
  }

  return {
    el: node,
    async enter() {
      stagger(node.querySelector('[data-rows]'), { step: 60, start: 120 });
      canBio = await auth.constructor.biometricAvailable();
      setBioLabel();
    },
  };
}
