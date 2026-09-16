import { el, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { money, store } from '../store.js';

/**
 * Bottom sheet with a numeric amount pad. Resolves to the entered amount,
 * or null if dismissed.
 */
export function amountSheet({ title, note = '', cta, max = Infinity }) {
  const host = document.getElementById('device');
  let digits = '';

  const scrim = el('<div class="scrim"></div>');
  const sheet = el(`
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sheet__grip"></div>
      <h2 class="title title--s" style="text-align:center;font-size:20px">${title}</h2>
      <p class="amount amount--dim" data-amt>$0</p>
      <p class="amount__note" data-note>${note}</p>
      <div class="keypad" style="margin-bottom:18px">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        <button data-k="00">00</button>
        <button data-k="0">0</button>
        <button class="is-bare" data-del aria-label="Delete">${icon('back', 24)}</button>
      </div>
      <button class="btn btn--block" data-go disabled>${cta}</button>
    </div>`);

  host.append(scrim, sheet);
  requestAnimationFrame(() => { scrim.classList.add('is-open'); sheet.classList.add('is-open'); });

  const amtEl  = sheet.querySelector('[data-amt]');
  const noteEl = sheet.querySelector('[data-note]');
  const goBtn  = sheet.querySelector('[data-go]');

  const value = () => Number(digits || 0);

  function render() {
    const v = value();
    amtEl.textContent = v ? money(v, { cents: false }) : '$0';
    amtEl.classList.toggle('amount--dim', !v);
    const over = v > max;
    noteEl.textContent = over ? 'That is more than your available balance.' : note;
    noteEl.style.color = over ? 'var(--danger)' : '';
    goBtn.disabled = !v || over;
  }

  return new Promise(resolve => {
    function close(result) {
      scrim.classList.remove('is-open');
      sheet.classList.remove('is-open');
      window.removeEventListener('keydown', onKey);
      setTimeout(() => { scrim.remove(); sheet.remove(); }, 440);
      resolve(result);
    }

    sheet.addEventListener('click', event => {
      const k = event.target.closest('[data-k]');
      if (k) {
        if ((digits + k.dataset.k).replace(/^0+/, '').length <= 7) digits += k.dataset.k;
        digits = digits.replace(/^0+(?=\d)/, '');
        tap(); return render();
      }
      if (event.target.closest('[data-del]')) { digits = digits.slice(0, -1); tap(5); return render(); }
      if (event.target.closest('[data-go]') && !goBtn.disabled) { tap(); close(value()); }
    });

    scrim.addEventListener('click', () => close(null));

    const onKey = event => {
      if (/^\d$/.test(event.key)) { digits = (digits + event.key).replace(/^0+(?=\d)/, ''); render(); }
      else if (event.key === 'Backspace') { digits = digits.slice(0, -1); render(); }
      else if (event.key === 'Escape')    { close(null); }
      else if (event.key === 'Enter' && !goBtn.disabled) { close(value()); }
    };
    window.addEventListener('keydown', onKey);

    render();
  });
}


/** What a single line on the statement actually was. */
export function txnSheet(txn) {
  const host = document.getElementById('device');
  const credit = txn.amount > 0;
  const card = store.defaultCard;
  const when = new Date(txn.at || Date.now());

  const KIND = {
    card: 'Card payment', transfer: 'Transfer', topup: 'Money in', convert: 'Currency exchange',
  };

  const scrim = el('<div class="scrim"></div>');
  const sheet = el(`
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${txn.title}">
      <div class="sheet__grip"></div>
      <p class="txnsheet__amount${credit ? ' txnsheet__amount--in' : ''}">
        ${credit ? '+' : '−'}${money(txn.amount)}
      </p>
      <p class="txnsheet__who">${txn.title}</p>
      <p class="txnsheet__when">
        ${when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        at ${when.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
      </p>

      <div class="group__box" style="margin-top:1.25rem">
        <div class="srow"><span class="srow__body"><span class="srow__name">Type</span></span>
          <span class="srow__val">${KIND[txn.type] || 'Payment'}</span></div>
        <div class="srow"><span class="srow__body"><span class="srow__name">Status</span></span>
          <span class="srow__val" style="color:var(--green-deep)">Completed</span></div>
        ${card ? `<div class="srow"><span class="srow__body"><span class="srow__name">Card</span></span>
          <span class="srow__val">${card.label || card.brand} •••• ${card.last4}</span></div>` : ''}
        <div class="srow"><span class="srow__body"><span class="srow__name">Reference</span></span>
          <span class="srow__val">${String(txn.id).toUpperCase().slice(-10)}</span></div>
      </div>

      <button class="btn btn--block btn--quiet" data-dispute style="margin-top:1.25rem">
        Something wrong with this?
      </button>
    </div>`);

  host.append(scrim, sheet);
  requestAnimationFrame(() => { scrim.classList.add('is-open'); sheet.classList.add('is-open'); });

  const close = () => {
    scrim.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { scrim.remove(); sheet.remove(); }, 440);
  };

  sheet.addEventListener('click', event => {
    if (!event.target.closest('[data-dispute]')) return;
    tap();
    // Disputes need a card issuer behind them. Say so rather than pretend.
    toast('Raising a dispute needs a real issuer — this wallet has none.');
  });
  scrim.addEventListener('click', close);
}
