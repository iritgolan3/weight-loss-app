import { screenEl, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { auth } from '../auth.js';
import { store, money } from '../store.js';
import { tierById } from '../ui/card.js';
import { stagger } from '../hero.js';

export function profileScreen({ onBack, onChangePasscode, onSignOut }) {
  const email = auth.email || 'guest@dailywallet.app';
  const tier = tierById(store.card);

  const node = screenEl('sc-profile', `
    <div class="sc-profile__head">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
      <h1 class="title title--s" style="margin-top:6px">Profile</h1>
    </div>

    <div class="sc-profile__id">
      <span class="sc-profile__avatar">${email[0].toUpperCase()}</span>
      <span>
        <span class="sc-profile__email">${email}</span>
        <span class="sc-profile__since">${tier.name} card · ${money(store.balance, { cents: false })} available</span>
      </span>
    </div>

    <div data-rows>
      <button class="rowbtn" data-passcode>${icon('key', 20)} Change passcode
        <span class="rowbtn__chev">${icon('chevronR', 18)}</span></button>
      <button class="rowbtn" data-bio>${icon('finger', 20)} <span data-biolabel>Biometric unlock</span>
        <span class="rowbtn__chev">${icon('chevronR', 18)}</span></button>
      <button class="rowbtn rowbtn--danger" data-out>${icon('logout', 20)} Sign out</button>
    </div>
  `);

  const bioLabel = node.querySelector('[data-biolabel]');

  node.addEventListener('click', async event => {
    if (event.target.closest('[data-back]'))     { tap(); return onBack(); }
    if (event.target.closest('[data-passcode]')) { tap(); return onChangePasscode(); }
    if (event.target.closest('[data-out]'))      { tap(); return onSignOut(); }

    if (event.target.closest('[data-bio]')) {
      tap();
      if (auth.hasBiometric()) return toast('Biometric unlock is already on.');
      try {
        await auth.enrolBiometric();
        bioLabel.textContent = 'Biometric unlock · on';
        toast('Biometric unlock enabled');
      } catch {
        toast('This device turned down the request.');
      }
    }
  });

  return {
    el: node,
    async enter() {
      stagger(node.querySelector('[data-rows]'), { step: 60, start: 120 });
      const can = await auth.constructor.biometricAvailable();
      bioLabel.textContent = !can ? 'Biometric unlock · unavailable'
        : auth.hasBiometric() ? 'Biometric unlock · on' : 'Biometric unlock';
      node.querySelector('[data-bio]').disabled = !can;
    },
  };
}
