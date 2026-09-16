/* Add an existing card.

   This is a demonstration wallet, so the form is deliberately explicit about
   what it is: the number is validated in the browser, the brand and last four
   are kept, and the full number and security code are discarded the moment
   the form is submitted. Nothing is transmitted anywhere. A test number is
   one tap away so nobody needs to type a real one. */

import { screenEl, tap, toast } from '../dom.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { stagger } from '../hero.js';

const TEST_NUMBERS = ['4242 4242 4242 4242', '5555 5555 5555 4444', '3782 822463 10005'];

/** Issuer identification ranges, enough to name the common brands. */
export function brandOf(digits) {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'Discover';
  if (/^(30[0-5]|36|38)/.test(digits)) return 'Diners Club';
  if (/^35(2[89]|[3-8]\d)/.test(digits)) return 'JCB';
  return 'Card';
}

/** The Luhn checksum every card number satisfies. */
export function luhnValid(digits) {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Amex groups 4-6-5; everything else groups in fours. */
export function formatNumber(digits) {
  const amex = /^3[47]/.test(digits);
  const groups = amex ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const out = [];
  let i = 0;
  for (const n of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + n));
    i += n;
  }
  return out.join(' ');
}

/** `MMYY` -> `MM/YY`, and says whether it is a real month still in the future. */
export function checkExpiry(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length < 4) return { text: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d, ok: false };
  const mm = Number(d.slice(0, 2)), yy = Number(d.slice(2));
  const text = `${d.slice(0, 2)}/${d.slice(2)}`;
  if (mm < 1 || mm > 12) return { text, ok: false, why: 'That month does not exist.' };
  const now = new Date();
  const end = new Date(2000 + yy, mm, 0, 23, 59, 59);
  if (end < now) return { text, ok: false, why: 'That card has expired.' };
  return { text, ok: true };
}

export function addCardScreen({ onBack, onOrder, onAdded }) {
  const node = screenEl('sc-addcard', `
    <div class="sc-addcard__head">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
      <h1 class="title title--s" style="margin-top:0.375rem">Add a card</h1>
    </div>

    <div class="sc-addcard__body u-scroll" data-body>
      <section class="group">
        <div class="group__box">
          <button class="srow" data-order>
            <span class="srow__icon">${icon('card', 20)}</span>
            <span class="srow__body"><span class="srow__name">Order a DailyWallet card</span>
              <span class="srow__sub">Platinum, Silver or Gold metal.</span></span>
            <span class="srow__chev">${icon('chevronR', 18)}</span>
          </button>
        </div>
      </section>

      <h2 class="group__title" style="padding-left:0.25rem">Or add a card you already have</h2>

      <div class="sc-addcard__note">
        <span>${icon('lock', 16)}</span>
        <span><b>This is a demo wallet — please don't enter a real card.</b>
          Only the brand, last four digits and expiry are kept, on this device.
          The number and security code are discarded on submit and nothing is
          ever sent anywhere. Tap “Use a test number” below.</span>
      </div>

      <form novalidate>
        <div class="field">
          <label class="field__box">
            <span class="sr-only">Card number</span>
            <input name="number" inputmode="numeric" autocomplete="off"
                   placeholder="Card number" maxlength="23" spellcheck="false">
            <span class="field__brand" data-brand></span>
          </label>
        </div>

        <div class="fieldrow">
          <div class="field">
            <label class="field__box">
              <span class="sr-only">Expiry</span>
              <input name="expiry" inputmode="numeric" autocomplete="off"
                     placeholder="MM/YY" maxlength="5">
            </label>
          </div>
          <div class="field">
            <label class="field__box">
              <span class="sr-only">Security code</span>
              <input name="cvc" inputmode="numeric" autocomplete="off"
                     placeholder="CVC" maxlength="4">
            </label>
          </div>
        </div>

        <div class="field">
          <label class="field__box">
            <span class="sr-only">Card name</span>
            <input name="label" autocomplete="off" placeholder="Name this card (optional)" maxlength="22">
          </label>
          <p class="field__err" data-err hidden></p>
        </div>

        <button class="btn btn--block" type="submit" style="margin-top:0.5rem">Add card</button>
        <button class="btn btn--block btn--quiet" type="button" data-test
                style="margin-top:0.625rem">Use a test number</button>
      </form>
    </div>
  `);

  const form   = node.querySelector('form');
  const brand  = node.querySelector('[data-brand]');
  const err    = node.querySelector('[data-err]');
  const numBox = form.number.closest('.field__box');

  const digitsOf = () => form.number.value.replace(/\D/g, '');

  const clearError = () => {
    err.hidden = true;
    numBox.classList.remove('is-bad');
  };

  function showError(message, field = numBox) {
    err.textContent = message;
    err.hidden = false;
    field.classList.add('is-bad');
    tap(20);
  }

  form.number.addEventListener('input', () => {
    clearError();
    const d = digitsOf().slice(0, 19);
    form.number.value = formatNumber(d);
    brand.textContent = d.length >= 2 ? brandOf(d) : '';
    form.cvc.maxLength = /^3[47]/.test(d) ? 4 : 3;
  });

  form.expiry.addEventListener('input', () => {
    clearError();
    form.expiry.value = checkExpiry(form.expiry.value).text;
  });

  form.cvc.addEventListener('input', () => {
    clearError();
    form.cvc.value = form.cvc.value.replace(/\D/g, '');
  });

  node.querySelector('[data-test]').addEventListener('click', () => {
    tap();
    clearError();
    const pick = TEST_NUMBERS[Math.floor(Math.random() * TEST_NUMBERS.length)];
    form.number.value = pick;
    form.number.dispatchEvent(new Event('input'));
    form.expiry.value = '12/34';
    form.cvc.value = /^3[47]/.test(pick.replace(/\D/g, '')) ? '1234' : '123';
    form.label.focus();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearError();

    const digits = digitsOf();
    if (!digits)                 return showError('Enter the card number.');
    if (!luhnValid(digits))      return showError('That card number is not valid.');

    const exp = checkExpiry(form.expiry.value);
    if (!exp.ok) return showError(exp.why || 'Enter the expiry as MM/YY.',
                                  form.expiry.closest('.field__box'));

    const cvcLen = /^3[47]/.test(digits) ? 4 : 3;
    if (form.cvc.value.length !== cvcLen) {
      return showError(`The security code is ${cvcLen} digits on this card.`,
                       form.cvc.closest('.field__box'));
    }

    const brandName = brandOf(digits);
    const last4 = digits.slice(-4);

    if (store.cards.some(c => c.last4 === last4 && c.brand === brandName)) {
      return showError('That card is already in your wallet.');
    }

    // Everything beyond these three fields is dropped here and never stored.
    store.addCard({
      kind: 'linked',
      brand: brandName,
      last4,
      expiry: exp.text,
      label: form.label.value.trim() || brandName,
    });

    form.reset();
    brand.textContent = '';
    toast(`${brandName} •••• ${last4} added`);
    onAdded();
  });

  node.addEventListener('click', event => {
    if (event.target.closest('[data-back]'))  { tap(); onBack(); }
    if (event.target.closest('[data-order]')) { tap(); onOrder(); }
  });

  return {
    el: node,
    enter() { stagger(node.querySelector('[data-body]'), { step: 60, start: 100 }); },
  };
}
