import { screenEl, el, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { store, money } from '../store.js';
import { auth } from '../auth.js';
import { cardMarkup } from '../ui/card.js';
import { amountSheet } from '../ui/sheet.js';

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
    <li class="txn">
      <span class="txn__icon">${icon(glyph, 19)}</span>
      <span class="txn__body">
        <span class="txn__title">${t.title}</span>
        <span class="txn__time">${t.time}</span>
      </span>
      <span class="txn__amt${credit ? ' txn__amt--in' : ''}">${credit ? '+' : ''}${money(t.amount)}</span>
    </li>`;
}

export function homeScreen({ onPickCard, onProfile }) {
  const node = screenEl('sc-home', `
    <div class="sc-home__top">
      <div class="sc-home__bar sc-home__fade">
        <h1 class="sc-home__hello">Hello ${auth.displayName}</h1>
        <button class="iconbtn" data-search aria-label="Search transactions">${icon('search', 21)}</button>
        <button class="iconbtn" data-add aria-label="Top up">${icon('plus', 21)}</button>
      </div>
      <div class="sc-home__fade">
        <p class="sc-home__label">Available balance</p>
        <p class="sc-home__balance" data-balance></p>
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

  slot.innerHTML = cardMarkup(store.card, { hero: true });

  function renderList() {
    const q = query.trim().toLowerCase();
    const rows = store.txns.filter(t => !q || t.title.toLowerCase().includes(q));
    listEl.innerHTML = rows.length
      ? rows.map(txnRow).join('')
      : `<li style="padding:34px var(--gutter);text-align:center;color:var(--muted);font-size:14px">
           Nothing matches “${query.trim()}”.</li>`;
  }

  function render() {
    balanceEl.textContent = money(store.balance, { cents: false });
    const fit = slot.querySelector('.card-fit');
    if (fit && !fit.querySelector(`.card--${store.card}`)) {
      slot.innerHTML = cardMarkup(store.card, { hero: true });
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

  node.addEventListener('click', async event => {
    if (event.target.closest('[data-cardslot]')) { tap(); return onPickCard(); }

    if (event.target.closest('[data-add]')) {
      tap();
      const amount = await amountSheet({ title: 'Top up', note: 'Added straight to your balance.', cta: 'Add money' });
      if (amount) { store.topUp(amount); toast(`${money(amount, { cents: false })} added`); }
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

    if (id === 'card')    return onPickCard();
    if (id === 'profile') return onProfile();

    setNav(index);

    if (id === 'convert') {
      const amount = await amountSheet({
        title: 'Convert', note: 'Moved between your currency balances.',
        cta: 'Convert', max: store.balance,
      });
      if (amount) { store.convert(amount); toast(`${money(amount, { cents: false })} converted`); }
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
    enter()    { requestAnimationFrame(placeThumb); },
    onResume() { setNav(0); render(); },
    destroy()  {
      store.removeEventListener('change', onChange);
      window.removeEventListener('resize', onResize);
    },
  };
}
