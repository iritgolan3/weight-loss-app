import { screenEl, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { auth, biometricLabel, biometricGlyph } from '../auth.js';
import { store, money, CURRENCIES } from '../store.js';
import { group, navRow, toggleRow, infoRow, optionSheet, confirmSheet, textSheet } from '../ui/controls.js';
import { stagger } from '../hero.js';

const APP_VERSION = '1.0.0';

const AUTO_LOCK = [
  { value: 0,  label: 'Immediately' },
  { value: 1,  label: 'After 1 minute' },
  { value: 5,  label: 'After 5 minutes' },
  { value: 15, label: 'After 15 minutes' },
];

const LOW_BALANCE = [100, 250, 500, 1000, 2500];

const autoLockLabel = m => (AUTO_LOCK.find(o => o.value === m) || AUTO_LOCK[1]).label;

/**
 * The settings a payment app cannot sensibly run without. Checked live so
 * the screen can say what is still outstanding rather than leaving the user
 * to work it out.
 */
export function outstanding({ canBio }) {
  const s = store.settings;
  const out = [];
  if (!auth.hasPasscode) out.push({ key: 'passcode', text: 'Set a passcode' });
  if (canBio && !auth.hasBiometric) {
    out.push({ key: 'bio', text: `Turn on ${biometricLabel()}` });
  }
  if (!s.alerts.payments) out.push({ key: 'alerts', text: 'Turn on payment alerts' });
  if (!store.cards.length) out.push({ key: 'cards', text: 'Add a card' });
  else if (store.cards.every(c => c.frozen)) out.push({ key: 'cards', text: 'Every card is frozen' });
  return out;
}

export function settingsScreen({ onBack, onChangePasscode, onCards, onSync, onStopSync, onLock, onErased }) {
  let canBio = false;

  const node = screenEl('sc-settings', `
    <div class="sc-settings__head">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
      <h1 class="title title--s" style="margin-top:0.375rem">Settings</h1>
    </div>
    <div class="sc-settings__body u-scroll" data-body></div>
  `);

  const body = node.querySelector('[data-body]');

  function setupBanner() {
    const items = outstanding({ canBio });
    if (!items.length) {
      return `<div class="setup setup--done">
          <span class="setup__icon">${icon('check', 18)}</span>
          <span>Everything a payment app needs is switched on.</span>
        </div>`;
    }
    return `<div class="setup">
        <p class="setup__title">${items.length} thing${items.length > 1 ? 's' : ''} still to set up</p>
        <ul class="setup__list">
          ${items.map(i => `<li><button data-fix="${i.key}">${i.text}
            <span>${icon('chevronR', 15)}</span></button></li>`).join('')}
        </ul>
      </div>`;
  }

  function render() {
    const s = store.settings;
    const def = store.defaultCard;
    const frozen = store.cards.filter(c => c.frozen).length;

    body.innerHTML = `
      ${setupBanner()}

      ${group('Cards & payments', [
        navRow('cards', 'Cards', {
          glyph: 'card',
          sub: `${store.cards.length} card${store.cards.length > 1 ? 's' : ''}`
             + (frozen ? ` · ${frozen} frozen` : ''),
          value: def ? `•••• ${def.last4}` : 'None',
        }),
        navRow('currency', 'Currency', {
          glyph: 'convert',
          value: `${CURRENCIES[s.currency].symbol} ${s.currency}`,
        }),
      ].join(''), 'Spending limits and payment controls live on each card.')}

      ${group('Security', [
        navRow('passcode', 'Change passcode', { glyph: 'key' }),
        navRow('bio', canBio ? `${cap(biometricLabel())}` : 'Biometric unlock', {
          glyph: biometricGlyph(),
          value: !canBio ? 'Unavailable' : auth.hasBiometric ? 'On' : 'Off',
          disabled: !canBio,
        }),
        navRow('autolock', 'Auto-lock', { glyph: 'lock', value: autoLockLabel(s.autoLockMinutes) }),
        toggleRow('hideBalance', 'Hide balance', s.hideBalance,
          { glyph: 'person', sub: 'Blurs it on the home screen until you tap.' }),
        navRow('lock', 'Lock now', { glyph: 'logout' }),
      ].join(''), 'A passcode and a biometric check are what a payment app uses to confirm it is really you.')}

      ${group('Notifications', [
        toggleRow('alerts.payments', 'Payment alerts', s.alerts.payments,
          { glyph: 'bell', sub: 'Tells you the moment money moves.' }),
        toggleRow('alerts.lowBalance', 'Low balance alert', s.alerts.lowBalance, { glyph: 'bell' }),
        navRow('lowAt', 'Warn me below', { glyph: 'plus', value: money(s.alerts.lowBalanceAt, { cents: false }) }),
        toggleRow('alerts.news', 'Product news', s.alerts.news,
          { glyph: 'bell', sub: 'Off unless you ask for it.' }),
      ].join(''))}

      ${group('Accessibility', [
        toggleRow('reducedMotion', 'Reduce motion', s.reducedMotion,
          { glyph: 'home', sub: 'Turns off the card flights and cascades.' }),
      ].join(''))}

      ${group('Privacy & data', [
        navRow('export', 'Export my data', { glyph: 'back', sub: 'Everything this app holds about you.' }),
        navRow('erase', 'Erase everything on this device', {
          glyph: 'logout', danger: true, sub: 'Wallet, cards, passcode. Cannot be undone.',
        }),
      ].join(''), 'Nothing is collected, tracked or sent anywhere. Your wallet stays on this device unless you turn on syncing.')}

      ${auth.canSync ? group('Account', (auth.isSynced
        ? navRow('stopsync', 'Stop syncing', { glyph: 'logout', value: auth.email })
        : navRow('sync', 'Sync across devices', { glyph: 'person' })))
        : ''}

      ${group('About', [
        infoRow('Version', APP_VERSION),
        navRow('about', 'What this app is', { glyph: 'search' }),
      ].join(''))}
    `;
  }

  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  /* --- Row actions ----------------------------------------------------- */

  const ACTIONS = {
    cards:    () => onCards(),
    passcode: () => onChangePasscode(),
    lock:     () => onLock(),
    sync:     () => onSync(),

    stopsync: () => { onStopSync(); toast('Syncing turned off'); },

    async bio() {
      if (auth.hasBiometric) {
        auth.forgetBiometric();
        render();
        return toast(`${cap(biometricLabel())} turned off`);
      }
      try {
        // Straight off the tap: WebAuthn needs live user activation.
        await auth.enrolBiometric();
        render();
        toast(`${cap(biometricLabel())} turned on`);
      } catch (err) { toast(err.message); }
    },

    async autolock() {
      const picked = await optionSheet({
        title: 'Auto-lock',
        options: AUTO_LOCK.map(o => ({ ...o, value: String(o.value) })),
        selected: String(store.settings.autoLockMinutes),
      });
      if (picked === null) return;
      store.setSetting('autoLockMinutes', Number(picked));
      render();
    },

    async currency() {
      const picked = await optionSheet({
        title: 'Currency',
        options: Object.entries(CURRENCIES).map(([code, c]) => ({
          value: code, label: `${c.symbol}  ${code}`, sub: c.name,
        })),
        selected: store.settings.currency,
      });
      if (!picked) return;
      store.setSetting('currency', picked);
      render();
      toast(`Showing amounts in ${picked}`);
    },

    async lowAt() {
      const picked = await optionSheet({
        title: 'Warn me below',
        options: LOW_BALANCE.map(v => ({ value: String(v), label: money(v, { cents: false }) })),
        selected: String(store.settings.alerts.lowBalanceAt),
      });
      if (!picked) return;
      store.setSetting('alerts.lowBalanceAt', Number(picked));
      render();
    },

    export: () => textSheet({
      title: 'Your data',
      body: 'Everything this app holds, on this device.',
      text: store.exportJSON(),
    }),

    async erase() {
      const yes = await confirmSheet({
        title: 'Erase everything?',
        body: 'Your wallet, cards and passcode are deleted from this device. This cannot be undone.',
        confirm: 'Erase everything',
        danger: true,
      });
      if (!yes) return;
      store.erase();
      auth.eraseProfile();
      onErased();
    },

    about: () => textSheet({
      title: 'About DailyWallet',
      body: 'Worth knowing before you rely on it.',
      text:
`DailyWallet is a demonstration app.

The money is simulated. Balances, transfers, top-ups, conversions and
card fees are real application state that persists and adds up, but no
payment network is involved and no real money can move.

Nothing leaves this device. There is no analytics, no tracking and no
server, unless you switch on syncing yourself.

Cards you add are stored as the brand, the last four digits and the
expiry only. Full card numbers are never kept.

It is not a licensed payment service, and it is not covered by any
deposit protection scheme.

Version ${APP_VERSION}`,
    }),
  };

  /* --- Wiring ---------------------------------------------------------- */

  node.addEventListener('click', async event => {
    if (event.target.closest('[data-back]')) { tap(); return onBack(); }

    const fix = event.target.closest('[data-fix]');
    if (fix) {
      tap();
      const map = { passcode: 'passcode', bio: 'bio', alerts: null, cards: 'cards' };
      if (fix.dataset.fix === 'alerts') {
        store.setSetting('alerts.payments', true);
        render();
        return toast('Payment alerts turned on');
      }
      return ACTIONS[map[fix.dataset.fix]]?.();
    }

    const toggle = event.target.closest('[data-toggle]');
    if (toggle) {
      tap();
      const key = toggle.dataset.toggle;
      const now = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(now));
      store.setSetting(key, now);
      if (key === 'reducedMotion') applyReducedMotion(now);
      // Re-render so the setup banner keeps up, but let the switch animate.
      setTimeout(render, 260);
      return;
    }

    const row = event.target.closest('[data-row]');
    if (row) { tap(); return ACTIONS[row.dataset.row]?.(); }
  });

  const onChange = () => render();
  store.addEventListener('change', onChange);

  render();

  return {
    el: node,
    async enter() {
      canBio = await auth.constructor.biometricAvailable();
      render();
      stagger(body, { step: 55, start: 100 });
    },
    onResume() { render(); },
    destroy() { store.removeEventListener('change', onChange); },
  };
}

/** Motion preference is app-wide, so it lives on the device shell. */
export function applyReducedMotion(on) {
  document.getElementById('device')?.toggleAttribute('data-reduced-motion', on);
}
