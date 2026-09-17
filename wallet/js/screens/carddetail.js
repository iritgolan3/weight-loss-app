import { screenEl, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { store, money, Declined, CONTROL_NAMES, termsFor } from '../store.js';
import { cardFace } from '../ui/card.js';
import { attachTilt } from '../ui/tilt.js';
import { group, navRow, toggleRow, optionSheet, confirmSheet } from '../ui/controls.js';
import { stagger } from '../hero.js';

const PER_TXN = [250, 500, 1000, 2500, 5000];
const DAILY   = [1000, 2500, 5000, 10000, 25000];

export function cardDetailScreen({ cardId, onBack }) {
  const node = screenEl('sc-card', `
    <div class="sc-card__head">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
      <h1 class="title title--s" style="margin-top:0.375rem" data-title></h1>
    </div>
    <div class="sc-card__body u-scroll" data-body></div>
  `);

  const body = node.querySelector('[data-body]');
  const title = node.querySelector('[data-title]');

  const card = () => store.cardById(cardId);

  function render() {
    const c = card();
    if (!c) return onBack();
    const isDefault = store.defaultCard?.id === c.id;
    title.textContent = c.label || `${c.brand} card`;

    body.innerHTML = `
      <div class="sc-card__hero">${cardFace(c, { hero: true })}</div>

      ${group('', [
        `<div class="srow">
          <span class="srow__body"><span class="srow__name">${c.brand}</span>
            <span class="srow__sub">${c.kind === 'linked' ? 'Added card' : `DailyWallet ${c.tier}`}</span></span>
          <span class="srow__val">•••• ${c.last4}</span>
        </div>`,
        `<div class="srow">
          <span class="srow__body"><span class="srow__name">Expires</span></span>
          <span class="srow__val">${c.expiry}</span>
        </div>`,
      ].join(''))}

      ${group('This card', [
        toggleRow('frozen', 'Freeze card', c.frozen,
          { glyph: 'lock', sub: 'Nothing goes out until you switch it back.' }),
        isDefault
          ? `<div class="srow"><span class="srow__icon">${icon('check', 20)}</span>
               <span class="srow__body"><span class="srow__name">Default card</span>
                 <span class="srow__sub">Everything goes out of this card.</span></span></div>`
          : navRow('makeDefault', 'Make this the default', { glyph: 'card' }),
      ].join(''))}

      ${(() => {
        const t = termsFor(c);
        if (!t) return group('Terms', [
          `<div class="srow"><span class="srow__body"><span class="srow__name">Added card</span>
             <span class="srow__sub">Rewards and fees are set by whoever issued it,
               not by DailyWallet.</span></span></div>`,
        ].join(''));
        return group(`${t.name} terms`, [
          `<div class="srow"><span class="srow__body"><span class="srow__name">Cashback</span></span>
             <span class="srow__val">${t.cashback}% on card spend</span></div>`,
          `<div class="srow"><span class="srow__body"><span class="srow__name">Foreign exchange</span></span>
             <span class="srow__val">${t.fx === 0 ? 'No fee' : `${t.fx}%`}</span></div>`,
          `<div class="srow"><span class="srow__body"><span class="srow__name">Free cash withdrawals</span></span>
             <span class="srow__val">${t.freeAtm < 0 ? 'Unlimited' : `${t.freeAtm} a month`}</span></div>`,
          `<div class="srow"><span class="srow__body"><span class="srow__name">Annual fee</span></span>
             <span class="srow__val">${money(t.price, { cents: false })}</span></div>`,
        ].join(''), 'These come with the metal. Ordering a different one changes them.');
      })()}

      ${group('Spending limits', [
        navRow('perTxn', 'Per payment', { glyph: 'plus', value: money(c.limits.perTxn, { cents: false }) }),
        navRow('daily', 'Per day', { glyph: 'plus', value: money(c.limits.daily, { cents: false }) }),
      ].join(''), 'Anything over is turned down before it leaves.')}

      ${group('Payment controls', Object.entries(CONTROL_NAMES).map(([key, name]) =>
        toggleRow(`controls.${key}`, name, c.controls[key], { glyph: 'convert' })).join(''),
        'Switch off what you never use. Transfers count as online.')}

      ${group('Privacy', [
        `<div class="srow">
          <span class="srow__icon">${icon('lock', 20)}</span>
          <span class="srow__body"><span class="srow__name">Full card number</span>
            <span class="srow__sub">Never kept. Only the brand, last four and
              expiry, encrypted on this phone.</span></span>
        </div>`,
      ].join(''))}

      ${group('', navRow('remove', 'Remove this card', { glyph: 'logout', danger: true }))}
    `;
  }

  const ACTIONS = {
    makeDefault() {
      store.setDefaultCard(cardId);
      toast('Default card updated');
    },

    async perTxn() {
      const picked = await optionSheet({
        title: 'Per-payment limit',
        options: PER_TXN.map(v => ({ value: String(v), label: money(v, { cents: false }) })),
        selected: String(card().limits.perTxn),
      });
      if (picked) store.updateCard(cardId, { limits: { perTxn: Number(picked) } });
    },

    async daily() {
      const picked = await optionSheet({
        title: 'Daily limit',
        options: DAILY.map(v => ({ value: String(v), label: money(v, { cents: false }) })),
        selected: String(card().limits.daily),
      });
      if (picked) store.updateCard(cardId, { limits: { daily: Number(picked) } });
    },

    async remove() {
      const c = card();
      const yes = await confirmSheet({
        title: 'Remove this card?',
        body: `${c.label || c.brand} •••• ${c.last4} comes out of your wallet.`,
        confirm: 'Remove card',
        danger: true,
      });
      if (!yes) return;
      try {
        store.removeCard(cardId);
        toast('Card removed');
        onBack();
      } catch (e) {
        toast(e instanceof Declined ? e.message : 'That card could not be removed.');
      }
    },
  };

  node.addEventListener('click', async event => {
    if (event.target.closest('[data-back]')) { tap(); return onBack(); }

    const toggle = event.target.closest('[data-toggle]');
    if (toggle) {
      tap();
      const key = toggle.dataset.toggle;
      const now = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(now));

      if (key === 'frozen') {
        store.updateCard(cardId, { frozen: now });
        toast(now ? 'Card frozen — payments are blocked' : 'Card unfrozen');
      } else {
        store.updateCard(cardId, { controls: { [key.split('.')[1]]: now } });
      }
      return;
    }

    const row = event.target.closest('[data-row]');
    if (row) { tap(); return ACTIONS[row.dataset.row]?.(); }
  });

  let detachTilt = () => {};
  const onChange = () => {
    detachTilt();
    render();
    detachTilt = attachTilt(body.querySelector('.card-fit'));
  };
  store.addEventListener('change', onChange);
  render();

  return {
    el: node,
    enter() {
      stagger(body, { step: 55, start: 140 });
      detachTilt = attachTilt(body.querySelector('.card-fit'));
    },
    destroy() {
      detachTilt();
      store.removeEventListener('change', onChange);
    },
  };
}
