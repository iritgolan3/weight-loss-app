/* The card stack.

   Cards overlap like a wallet: you see the top strip of each and the whole
   of the last. Tap one to open it — the face flies through to the detail
   screen as the same element. Press and drag to reorder; the order is the
   order the wallet keeps.

   The magnifier opens manage mode: a search field, a remove control on each
   card, and a row to add another. */

import { screenEl, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { store, money, Declined } from '../store.js';
import { cardFace } from '../ui/card.js';
import { attachTilt } from '../ui/tilt.js';
import { confirmSheet } from '../ui/controls.js';

const STEP = 84;          // px of each card left showing beneath the next
const LIFT = 1.04;        // scale while dragging

export function cardsScreen({ onBack, onCard, onAdd }) {
  let manage = false;
  let query = '';
  let detachers = [];

  const node = screenEl('sc-cards', `
    <div class="sc-cards__head">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
      <div class="sc-cards__titlerow">
        <h1 class="title title--s">Cards</h1>
        <button class="iconbtn iconbtn--soft" data-manage
                aria-label="Search, add or remove cards">${icon('search', 21)}</button>
      </div>
    </div>

    <div class="sc-cards__search" data-search hidden>
      <label class="field__box">
        <span class="sr-only">Search cards</span>
        ${icon('search', 18)}
        <input type="search" placeholder="Search your cards" data-q>
      </label>
    </div>

    <div class="sc-cards__body u-scroll" data-body></div>
  `);

  const body     = node.querySelector('[data-body]');
  const searchEl = node.querySelector('[data-search]');
  const queryEl  = node.querySelector('[data-q]');

  const visible = () => {
    const q = query.trim().toLowerCase();
    if (!q) return store.cards;
    return store.cards.filter(c =>
      `${c.label} ${c.brand} ${c.last4} ${c.tier}`.toLowerCase().includes(q));
  };

  function render() {
    detachers.forEach(d => d());
    detachers = [];

    const cards = visible();
    const def = store.defaultCard;

    body.innerHTML = `
      ${manage ? `
        <button class="srow srow--add" data-add>
          <span class="srow__icon">${icon('plus', 20)}</span>
          <span class="srow__body"><span class="srow__name">Add a card</span></span>
          <span class="srow__chev">${icon('chevronR', 18)}</span>
        </button>` : ''}

      <div class="stack" data-stack style="height:${cards.length ? (cards.length - 1) * STEP + 216 : 0}px">
        ${cards.map((c, i) => `
          <div class="stack__item" data-item="${c.id}" style="transform:translateY(${i * STEP}px)">
            ${cardFace(c)}
            <div class="stack__tags">
              <span class="stack__name${c.kind === 'linked' ? ' stack__name--light' : ''}">
                ${c.label || c.brand} <b>•••• ${c.last4}</b>
              </span>
              ${c.id === def?.id ? '<span class="pill pill--default">Default</span>' : ''}
              ${c.frozen ? '<span class="pill pill--frozen">Frozen</span>' : ''}
            </div>
            ${manage ? `<button class="stack__remove" data-remove="${c.id}"
                          aria-label="Remove ${c.label || c.brand}">${icon('logout', 17)}</button>` : ''}
          </div>`).join('')}
      </div>

      ${cards.length ? '' : `<p class="sc-cards__empty">No card matches “${query.trim()}”.</p>`}

      <p class="sc-cards__hint">
        ${manage ? 'Search, add or remove. Tap the glass again when you are done.'
                 : 'Tap a card to open it. Press and drag to reorder.'}
      </p>

      ${manage ? '' : `
        <div class="group" style="margin-top:1.25rem">
          <div class="group__box">
            <div class="srow">
              <span class="srow__body"><span class="srow__name">Available</span></span>
              <span class="srow__val">${money(store.balance)}</span>
            </div>
          </div>
        </div>`}
    `;

    // The face leans towards the finger on every card in the stack.
    body.querySelectorAll('.card-fit').forEach(fit => detachers.push(attachTilt(fit)));
  }

  /* --- Drag to reorder -------------------------------------------------- */

  let drag = null;

  function onPointerDown(event) {
    if (manage) return;                                   // manage mode is for editing
    const item = event.target.closest('[data-item]');
    if (!item || event.target.closest('[data-remove]')) return;

    const stack = body.querySelector('[data-stack]');
    const items = [...stack.querySelectorAll('[data-item]')];

    drag = {
      item, stack, items,
      id: item.dataset.item,
      from: items.indexOf(item),
      index: items.indexOf(item),
      startY: event.clientY,
      moved: false,
      pointerId: event.pointerId,
    };
    item.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dy = event.clientY - drag.startY;

    // A few pixels of slop so a tap is never mistaken for a drag.
    if (!drag.moved && Math.abs(dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.item.classList.add('is-dragging');
      drag.stack.classList.add('is-reordering');
    }
    event.preventDefault();

    drag.item.style.transform =
      `translateY(${drag.from * STEP + dy}px) scale(${LIFT})`;

    // Where would it land if released here?
    const target = Math.max(0, Math.min(drag.items.length - 1,
      Math.round((drag.from * STEP + dy) / STEP)));
    if (target !== drag.index) {
      drag.index = target;
      layoutGaps();
    }
  }

  /** Slide the other cards out of the way of the held one. */
  function layoutGaps() {
    let slot = 0;
    drag.items.forEach(el => {
      if (el === drag.item) return;
      if (slot === drag.index) slot++;
      el.style.transform = `translateY(${slot * STEP}px)`;
      slot++;
    });
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { item, items, index, moved, id } = drag;
    const stack = drag.stack;
    drag = null;

    item.classList.remove('is-dragging');
    stack.classList.remove('is-reordering');

    if (!moved) { item.style.transform = ''; tap(); return onCard(id); }

    const order = items.filter(el => el !== item).map(el => el.dataset.item);
    order.splice(index, 0, id);
    tap(12);
    store.reorderCards(order);           // re-render follows from the change event
  }

  body.addEventListener('pointerdown', onPointerDown);
  body.addEventListener('pointermove', onPointerMove);
  body.addEventListener('pointerup', onPointerUp);
  body.addEventListener('pointercancel', onPointerUp);

  /* --- Everything else -------------------------------------------------- */

  node.addEventListener('click', async event => {
    if (event.target.closest('[data-back]')) { tap(); return onBack(); }
    if (event.target.closest('[data-add]'))  { tap(); return onAdd(); }

    if (event.target.closest('[data-manage]')) {
      tap();
      manage = !manage;
      searchEl.hidden = !manage;
      node.querySelector('[data-manage]').classList.toggle('is-on', manage);
      if (!manage) { query = ''; queryEl.value = ''; }
      render();
      if (manage) queryEl.focus();
      return;
    }

    const remove = event.target.closest('[data-remove]');
    if (remove) {
      tap();
      const card = store.cardById(remove.dataset.remove);
      const yes = await confirmSheet({
        title: 'Remove this card?',
        body: `${card.label || card.brand} •••• ${card.last4} comes out of your wallet.`,
        confirm: 'Remove card',
        danger: true,
      });
      if (!yes) return;
      try { store.removeCard(card.id); toast('Card removed'); }
      catch (e) { toast(e instanceof Declined ? e.message : 'Could not remove that card.'); }
    }
  });

  queryEl.addEventListener('input', () => { query = queryEl.value; render(); });

  const onChange = () => render();
  store.addEventListener('change', onChange);
  render();

  return {
    el: node,
    /** The tapped card is the hero, so only it carries the marker. */
    markHero(id) {
      body.querySelectorAll('.card-fit').forEach(f => f.removeAttribute('data-hero'));
      const fit = body.querySelector(`[data-item="${id}"] .card-fit`);
      fit?.setAttribute('data-hero', 'card');
    },
    onResume() { render(); },
    destroy() {
      detachers.forEach(d => d());
      store.removeEventListener('change', onChange);
    },
  };
}
