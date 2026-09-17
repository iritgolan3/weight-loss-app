import { screenEl, el, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { store, money, Declined } from '../store.js';
import { auth } from '../auth.js';
import { cardMarkup } from '../ui/card.js';
import { amountSheet, txnSheet } from '../ui/sheet.js';
import { attachTilt } from '../ui/tilt.js';

const NAV = [
  { id: 'home',    glyph: 'home',    label: 'Home'     },
  { id: 'convert', glyph: 'convert', label: 'Convert'  },
  { id: 'card',    glyph: 'card',    label: 'Cards'    },
  { id: 'profile', glyph: 'person',  label: 'Profile'  },
];

function txnRow(t) {
  const credit = t.amount > 0;
  const glyph = t.type === 'card' ? 'card' : (t.type === 'topup' ? 'plus' : t.type);
  return `
    <li class="txn${t.pending ? ' txn--pending' : ''}" data-txn="${t.id}">
      <span class="txn__icon">${icon(glyph, 19)}</span>
      <span class="txn__body">
        <span class="txn__title">${t.title}</span>
        <span class="txn__time">${t.pending ? 'Pending' : t.time}</span>
      </span>
      <span class="txn__amt${credit ? ' txn__amt--in' : ''}">${credit ? '+' : ''}${money(t.amount)}</span>
    </li>`;
}

/** Runs a payment, reporting refusals and honouring the alert settings. */
async function pay(run, announce) {
  try {
    run();
  } catch (err) {
    if (err instanceof Declined) return toast(err.message);
    throw err;
  }
  const alerts = store.settings.alerts;
  if (alerts.payments) toast(announce);
  if (alerts.lowBalance && store.balance < alerts.lowBalanceAt) {
    setTimeout(() => toast(`Balance is below ${money(alerts.lowBalanceAt, { cents: false })}`), 2400);
  }
}

export function homeScreen({ onPickCard, onProfile }) {
  const node = screenEl('sc-home', `
    <div class="sc-home__top">
      <div class="sc-home__bar sc-home__fade">
        <h1 class="sc-home__hello">Hello ${auth.displayName}</h1>
        <button class="iconbtn" data-search aria-label="Search transactions">${icon('search', 21)}</button>
        <button class="iconbtn" data-add aria-label="Top up">${icon('plus', 21)}</button>
      </div>
      <div class="sc-home__fade sc-home__money">
        <p class="sc-home__label">Available balance</p>
        <button class="sc-home__balance" data-balance aria-label="Available balance"></button>
      </div>
      <div class="sc-home__card" data-cardslot></div>
    </div>

    <div class="sc-home__sheet">
      <div class="sc-home__sheethead">
        <h2 class="sc-home__sheettitle">Recent transactions</h2>
        <button class="sc-home__seeall" data-seeall>See all</button>
      </div>
      <div class="field" data-searchbox hidden style="padding:0 var(--gutter) 10px;margin:0">
        <label class="field__box" style="height:46px">
          <span class="sr-only">Search transactions</span>
          ${icon('search', 18)}
          <input type="search" placeholder="Search transactions" data-q>
        </label>
      </div>
      <ul class="sc-home__list u-scroll" data-list></ul>
    </div>

    <nav class="navpill" aria-label="Main">
      <span class="navpill__thumb" data-thumb></span>
      ${NAV.map((n, i) => `
        <button class="navpill__item${i === 0 ? ' is-active' : ''}" data-nav="${n.id}"
                aria-label="${n.label}">${icon(n.glyph, 22)}</button>`).join('')}
    </nav>
  `, { dark: true });

  const listEl    = node.querySelector('[data-list]');
  const balanceEl = node.querySelector('[data-balance]');
  const slot      = node.querySelector('[data-cardslot]');
  const thumb     = node.querySelector('[data-thumb]');
  const searchBox = node.querySelector('[data-searchbox]');
  const queryEl   = node.querySelector('[data-q]');
  let query = '';
  let active = 0;
  let shown = null;        // the balance currently painted, for the count-up
  let firstList = true;
  let revealed = false;    // tap-to-reveal, when the balance is set to hide

  slot.innerHTML = cardMarkup(store.card, { hero: true });
  let detachTilt = attachTilt(slot.querySelector('.card-fit'));

  function renderList() {
    const q = query.trim().toLowerCase();
    const rows = store.txns.filter(t => !q || t.title.toLowerCase().includes(q));
    listEl.innerHTML = rows.length
      ? rows.map(txnRow).join('')
      : `<li style="padding:2.125rem var(--gutter);text-align:center;color:var(--muted);font-size:0.875rem">
           Nothing matches “${query.trim()}”.</li>`;

    // Only the first paint cascades; later ones would fight the search field.
    if (firstList && rows.length) {
      firstList = false;
      listEl.classList.add('is-entering');
      [...listEl.children].forEach((row, i) => {
        row.style.animationDelay = `${380 + i * 55}ms`;
      });
      setTimeout(() => listEl.classList.remove('is-entering'), 380 + rows.length * 55 + 500);
    }
  }

  /** Counts the balance to its new value rather than snapping. */
  function paintBalance(value) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (shown === null || reduced || shown === value) {
      shown = value;
      balanceEl.textContent = money(value);
      return;
    }

    const from = shown, delta = value - from, t0 = performance.now();
    shown = value;
    const ease = t => 1 - Math.pow(1 - t, 3);

    const frame = now => {
      const t = Math.min(1, (now - t0) / 620);
      balanceEl.textContent = money(from + delta * ease(t));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function render() {
    paintBalance(store.balance);
    balanceEl.classList.toggle('is-hidden', store.settings.hideBalance && !revealed);
    const fit = slot.querySelector('.card-fit');
    if (fit && !fit.querySelector(`.card--${store.card}`)) {
      slot.innerHTML = cardMarkup(store.card, { hero: true });
  let detachTilt = attachTilt(slot.querySelector('.card-fit'));
    }
    renderList();
  }

  function placeThumb() {
    const pill = node.querySelector('.navpill');
    const w = pill.clientWidth / NAV.length;
    thumb.style.transform = `translateX(${active * w + (w - 48) / 2}px)`;
  }

  function setNav(index) {
    active = index;
    node.querySelectorAll('[data-nav]').forEach((b, i) => b.classList.toggle('is-active', i === index));
    placeThumb();
  }

  const cardSlot = node.querySelector('.sc-home__card');
  const unpress = () => cardSlot.classList.remove('is-pressed');

  /* The entrance animations use `both` fill, which pins opacity at 1 and
     would block the hero exit cross-fade. Always settle them before leaving. */
  let enterTimer;
  const settleEntrance = () => {
    clearTimeout(enterTimer);
    node.classList.remove('is-entering');
    listEl.classList.remove('is-entering');
  };
  cardSlot.addEventListener('pointerdown', () => cardSlot.classList.add('is-pressed'));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(e =>
    cardSlot.addEventListener(e, unpress));

  node.addEventListener('click', async event => {
    const row = event.target.closest('[data-txn]');
    if (row) {
      tap();
      const t = store.txns.find(x => x.id === row.dataset.txn);
      if (t) txnSheet(t);
      return;
    }

    if (event.target.closest('[data-balance]')) {
      if (!store.settings.hideBalance) return;
      tap();
      revealed = !revealed;
      return render();
    }

    if (event.target.closest('[data-cardslot]')) {
      // Clear the press first: the hero flight measures this element's box.
      unpress();
      settleEntrance();
      tap();
      return onPickCard();
    }

    if (event.target.closest('[data-add]')) {
      tap();
      const amount = await amountSheet({ title: 'Top up', note: 'Added straight to your balance.', cta: 'Add money' });
      if (amount) await pay(() => store.topUp(amount), `${money(amount, { cents: false })} added`);
      return;
    }

    if (event.target.closest('[data-search]') || event.target.closest('[data-seeall]')) {
      tap();
      searchBox.hidden = !searchBox.hidden;
      if (!searchBox.hidden) queryEl.focus();
      else { query = ''; queryEl.value = ''; renderList(); }
      return;
    }

    const nav = event.target.closest('[data-nav]');
    if (!nav) return;
    tap();
    const id = nav.dataset.nav;
    const index = NAV.findIndex(n => n.id === id);

    if (id === 'card')    { settleEntrance(); return onPickCard(); }
    if (id === 'profile') return onProfile();

    setNav(index);

    if (id === 'convert') {
      const amount = await amountSheet({
        title: 'Convert', note: 'Moved between your currency balances.',
        cta: 'Convert', max: store.balance,
      });
      if (amount) await pay(() => store.convert(amount), `${money(amount, { cents: false })} converted`);
      setNav(0);
    }
  });

  queryEl.addEventListener('input', () => { query = queryEl.value; renderList(); });

  const onChange = () => render();
  store.addEventListener('change', onChange);
  const onResize = () => placeThumb();
  window.addEventListener('resize', onResize);

  render();

  return {
    el: node,
    enter() {
      requestAnimationFrame(placeThumb);
      // Cascade in on first mount only — coming back from the card picker
      // should land where the hero flight leaves off, not replay this.
      node.classList.add('is-entering');
      enterTimer = setTimeout(() => node.classList.remove('is-entering'), 1100);
    },
    onResume() { setNav(0); render(); },
    destroy()  {
      detachTilt();
      clearTimeout(enterTimer);
      store.removeEventListener('change', onChange);
      window.removeEventListener('resize', onResize);
    },
  };
}
