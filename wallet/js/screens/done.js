import { screenEl, tap } from '../dom.js';
import { money } from '../store.js';
import { terminalSVG, playTerminal } from '../ui/terminal.js';
import { stagger } from '../hero.js';

/** Order confirmation, fronted by the animated terminal illustration. */
export function doneScreen({ tier, onDone }) {
  const node = screenEl('sc-done', `
    <div class="sc-done__art">${terminalSVG()}</div>

    <div class="sc-done__head" data-head>
      <h1 class="title">Order placed</h1>
      <p class="sc-done__sub">
        Your ${tier.name} card is on its way.<br>
        We'll let you know the moment it ships.
      </p>
    </div>

    <div class="sc-done__box">
      <div class="box" data-box>
        <div class="box__row"><span class="box__k">Paid</span>
          <span class="box__v">${money(tier.price)}</span></div>
        <div class="box__row"><span class="box__k">Arrives</span>
          <span class="box__v">5–7 business days</span></div>
      </div>
    </div>

    <div class="sc-done__foot">
      <button class="btn btn--block" data-done>Done</button>
    </div>
  `);

  node.querySelector('[data-done]').addEventListener('click', () => { tap(); onDone(); });

  return {
    el: node,
    enter() {
      playTerminal(node);
      const head = node.querySelector('[data-head]');
      head.style.animationDelay = '820ms';
      head.classList.add('fade-in');
      stagger(node.querySelector('[data-box]'), { step: 70, start: 980 });
      const foot = node.querySelector('.sc-done__foot');
      foot.style.animationDelay = '1180ms';
      foot.classList.add('fade-in');
    },
  };
}
