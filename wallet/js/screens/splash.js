import { el } from '../dom.js';

export function splashScreen({ onDone }) {
  const node = el(`
    <section class="screen sc-splash">
      <div>
        <div class="sc-splash__mark">DailyWallet</div>
        <div class="sc-splash__dot"></div>
      </div>
    </section>`);

  let timer;
  return {
    el: node,
    enter() { timer = setTimeout(onDone, 1250); },
    destroy() { clearTimeout(timer); },
  };
}
