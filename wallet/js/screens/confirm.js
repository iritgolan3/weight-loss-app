import { screenEl, tap } from '../dom.js';
import { icon } from '../icons.js';
import { cardMarkup } from '../ui/card.js';
import { money } from '../store.js';
import { stagger } from '../hero.js';

/** Order review. The card arrives as the hero, then the summary staggers in. */
export function confirmScreen({ tier, onBack, onPaid }) {
  const fee = money(tier.price);

  const node = screenEl('sc-confirm', `
    <div class="sc-confirm__nav">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
    </div>

    <div class="sc-confirm__head">
      <h1 class="title">Confirm order</h1>
      <p class="subtitle">Review your new card before you pay.</p>
    </div>

    <div class="sc-confirm__card">${cardMarkup(tier.id, { hero: true })}</div>

    <div class="sc-confirm__box">
      <div class="box" data-box>
        <div class="box__row"><span class="box__k">Card</span>
          <span class="box__v">${tier.subtitle}</span></div>
        <div class="box__row"><span class="box__k">Annual fee</span>
          <span class="box__v">${fee}</span></div>
        <div class="box__row"><span class="box__k">Delivery</span>
          <span class="box__v">Free · 5–7 days</span></div>
        <div class="box__row box__row--total"><span class="box__k">Total today</span>
          <span class="box__v">${fee}</span></div>
      </div>
    </div>

    <div class="sc-confirm__foot">
      <button class="btn btn--block btn--morph" data-pay>
        <span class="btn__label">Order · ${fee}</span>
        <span class="btn__dots"><i></i><i></i><i></i></span>
      </button>
      <p class="sc-confirm__secure" data-secure>
        ${icon('lock', 13)} Secure payment · Cancel anytime
      </p>
    </div>
  `);

  const payBtn = node.querySelector('[data-pay]');
  const secure = node.querySelector('[data-secure]');
  let timer;

  node.addEventListener('click', event => {
    if (event.target.closest('[data-back]')) { tap(); return onBack(); }
    if (!event.target.closest('[data-pay]')) return;

    tap(12);
    payBtn.classList.add('is-busy');
    secure.textContent = 'Confirming your payment…';
    timer = setTimeout(() => onPaid(tier), 1700);
  });

  return {
    el: node,
    enter() {
      // Card first, then the summary rows, then the button — the same
      // cadence as the reference.
      stagger(node.querySelector('[data-box]'), { step: 60, start: 220 });
      const foot = node.querySelector('.sc-confirm__foot');
      foot.style.animationDelay = '480ms';
      foot.classList.add('fade-in');
      node.querySelector('.sc-confirm__head').classList.add('fade-in');
    },
    destroy() { clearTimeout(timer); },
  };
}
