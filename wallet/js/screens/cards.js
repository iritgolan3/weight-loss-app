import { screenEl, tap } from '../dom.js';
import { icon } from '../icons.js';
import { store, money } from '../store.js';
import { stagger } from '../hero.js';

const faceClass = c => (c.kind === 'linked' ? 'linked' : c.tier);

const cardRow = (c, isDefault) => `
  <button class="cardrow" data-card="${c.id}">
    <span class="cardrow__face cardrow__face--${faceClass(c)}"></span>
    <span class="cardrow__body">
      <span class="cardrow__name">${c.label || c.brand} •••• ${c.last4}</span>
      <span class="cardrow__sub">
        ${c.kind === 'linked' ? `${c.brand} · added card` : `DailyWallet ${c.tier}`} ·
        expires ${c.expiry}
      </span>
    </span>
    ${isDefault ? '<span class="pill pill--default">Default</span>' : ''}
    ${c.frozen ? '<span class="pill pill--frozen">Frozen</span>' : ''}
    <span class="srow__chev">${icon('chevronR', 18)}</span>
  </button>`;

export function cardsScreen({ onBack, onCard, onAdd }) {
  const node = screenEl('sc-cards', `
    <div class="sc-cards__head">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
      <h1 class="title title--s" style="margin-top:0.375rem">Cards</h1>
    </div>
    <div class="sc-cards__body u-scroll" data-body></div>
  `);

  const body = node.querySelector('[data-body]');

  function render() {
    const def = store.defaultCard;
    body.innerHTML = `
      <section class="group">
        <div class="group__box">
          ${store.cards.map(c => cardRow(c, c.id === def?.id)).join('')}
        </div>
        <p class="group__note">
          Payments come out of your default card. Freezing it stops every
          payment until you turn it back on.
        </p>
      </section>

      <section class="group">
        <div class="group__box">
          <button class="srow" data-add>
            <span class="srow__icon">${icon('plus', 20)}</span>
            <span class="srow__body"><span class="srow__name">Add a card</span>
              <span class="srow__sub">Order a DailyWallet card, or add one you already have.</span></span>
            <span class="srow__chev">${icon('chevronR', 18)}</span>
          </button>
        </div>
      </section>

      <section class="group">
        <div class="group__box">
          <div class="srow">
            <span class="srow__body"><span class="srow__name">Available balance</span></span>
            <span class="srow__val">${money(store.balance, { cents: false })}</span>
          </div>
        </div>
      </section>`;
  }

  node.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) { tap(); return onBack(); }
    if (event.target.closest('[data-add]'))  { tap(); return onAdd(); }
    const row = event.target.closest('[data-card]');
    if (row) { tap(); return onCard(row.dataset.card); }
  });

  const onChange = () => render();
  store.addEventListener('change', onChange);
  render();

  return {
    el: node,
    enter()    { stagger(body, { step: 70, start: 100 }); },
    onResume() { render(); },
    destroy()  { store.removeEventListener('change', onChange); },
  };
}
