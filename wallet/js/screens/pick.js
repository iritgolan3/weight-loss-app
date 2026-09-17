import { screenEl, tap } from '../dom.js';
import { icon } from '../icons.js';
import { TIERS, cardMarkup, cardFace, rankOf } from '../ui/card.js';
import { store, money } from '../store.js';
import { attachTilt } from '../ui/tilt.js';

/**
 * The card carousel, in one of two jobs.
 *
 *   mode 'select'  the cards already in the wallet — swipe to the one you
 *                  want to pay with and it becomes your default. Nothing is
 *                  bought here. This is where tapping your card on Home goes.
 *   mode 'order'   the three orderable metals, with their annual fee, leading
 *                  to Confirm order. Reached from Cards -> Add a card.
 *
 * Same carousel, same layout, same turned card; only the subtitle and the
 * button differ, because choosing and buying are different acts.
 */
export function pickScreen({ mode = 'order', start, onBack, onChoose }) {
  const ordering = mode === 'order';

  // In select mode the items are the user's own cards, not products.
  const items = ordering ? TIERS : store.cards;
  if (!items.length) return { el: screenEl('sc-pick', ''), enter: onBack };

  const startIndex = ordering
    ? TIERS.findIndex(t => t.id === start)
    : store.cards.findIndex(c => c.id === (start || store.defaultCard?.id));
  let index = Math.max(0, startIndex);

  const node = screenEl('sc-pick', `
    <div class="sc-pick__nav">
      <button class="iconbtn iconbtn--bare" data-back aria-label="Back">${icon('chevronL', 24)}</button>
    </div>

    <div class="sc-pick__head">
      <h1 class="sc-pick__name" data-name></h1>
      <p class="sc-pick__price" data-price></p>
    </div>

    <div class="carousel" data-carousel>
      <div class="carousel__track">
        ${items.map(item => `
          <div class="carousel__cell" data-item="${ordering ? item.id : item.id}">
            <div class="carousel__inner">${ordering
              ? cardMarkup(item.id, { turned: true })
              : cardFace(item, { turned: true, muted: item.id !== store.defaultCardId })}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="dots sc-pick__dots" data-dots>
      ${items.map(() => '<i></i>').join('')}
    </div>

    <div class="sc-pick__foot">
      <button class="btn btn--block" data-choose><span data-cta></span></button>
    </div>
  `);

  const carousel = node.querySelector('[data-carousel]');
  const cells    = [...node.querySelectorAll('.carousel__cell')];
  const inners   = cells.map(c => c.querySelector('.carousel__inner'));
  const head     = node.querySelector('.sc-pick__head');
  const nameEl   = node.querySelector('[data-name]');
  const priceEl  = node.querySelector('[data-price]');
  const ctaEl    = node.querySelector('[data-cta]');
  const dots     = [...node.querySelectorAll('[data-dots] i')];

  /** Only the focused card is the hero, so the flight has a single target. */
  function markHero() {
    cells.forEach((cell, i) => {
      const fit = cell.querySelector('.card-fit');
      if (i === index) fit.setAttribute('data-hero', 'card');
      else             fit.removeAttribute('data-hero');
    });
  }

  function renderHead() {
    const item = items[index];

    if (ordering) {
      nameEl.textContent = item.name;
      priceEl.innerHTML = `<b>${money(item.price, { cents: false })}</b> <span>/ year</span>`;
      ctaEl.textContent = `Choose ${item.name}`;
    } else {
      // Choosing, not buying: no price, and the button says what it does.
      const isDefault = store.defaultCard?.id === item.id;
      nameEl.textContent = item.label || item.brand;
      priceEl.innerHTML = item.frozen
        ? '<span>Frozen · unfreeze it in Cards</span>'
        : `<b>•••• ${item.last4}</b> <span>· expires ${item.expiry}</span>`;
      ctaEl.textContent = isDefault ? 'Already your card' : 'Use this card';
      node.querySelector('[data-choose]').disabled = isDefault || item.frozen;
    }

    dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    markHero();
  }

  /**
   * Neighbours shrink, sink and dim in proportion to their distance from
   * centre, so the stack reads with depth rather than as a flat filmstrip.
   */
  function paint() {
    const centre = carousel.scrollLeft + carousel.clientWidth / 2;
    let best = 0, bestD = Infinity;

    cells.forEach((cell, i) => {
      const cc = cell.offsetLeft + cell.offsetWidth / 2;
      const raw = Math.abs(centre - cc) / cell.offsetWidth;
      const d = Math.min(1, raw);
      const sink = (d * cell.offsetHeight * 0.035).toFixed(2);
      inners[i].style.transform =
        `translateY(${sink}px) scale(${(1 - 0.17 * d).toFixed(4)})`;
      inners[i].style.opacity = (1 - 0.5 * d).toFixed(3);
      if (raw < bestD) { bestD = raw; best = i; }
    });

    if (best !== index) {
      index = best;
      // Brief cross-fade so the label swap does not snap.
      head.classList.add('is-swapping');
      clearTimeout(paint._t);
      paint._t = setTimeout(() => { renderHead(); head.classList.remove('is-swapping'); }, 120);
    }
  }

  let ticking = false;
  carousel.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { paint(); ticking = false; });
  }, { passive: true });

  function scrollTo(i, behavior = 'auto') {
    const cell = cells[i];
    carousel.scrollTo({
      left: cell.offsetLeft + cell.offsetWidth / 2 - carousel.clientWidth / 2,
      behavior,
    });
  }

  node.addEventListener('click', event => {
    if (event.target.closest('[data-back]'))   { tap(); return onBack(); }
    if (event.target.closest('[data-choose]')) {
      tap();
      if (ordering) return onChoose(items[index]);
      return switchTo(index);
    }
    const cell = event.target.closest('.carousel__cell');
    if (cell) {
      const i = cells.indexOf(cell);
      if (i !== index) { tap(); scrollTo(i, 'smooth'); }
    }
  });

  /**
   * Move to another card, showing the change rather than just recording it.
   * The card being taken up brightens and lifts; the one being left behind
   * desaturates and settles back, so a step up the ladder reads as one.
   */
  async function switchTo(to) {
    const next = items[to];
    const prevId = store.defaultCardId;
    const prev = items.findIndex(c => c.id === prevId);
    if (next.id === prevId) return;

    const step = rankOf(next) - rankOf(items[prev]);
    const chooseBtn = node.querySelector('[data-choose]');
    chooseBtn.disabled = true;

    if (prev >= 0) {
      inners[prev].classList.add('is-demoted');
      inners[prev].querySelector('.card')?.classList.add('card--muted');
    }
    inners[to].classList.add('is-promoted');
    inners[to].querySelector('.card')?.classList.remove('card--muted');

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise(r => setTimeout(r, reduced ? 0 : 720));

    onChoose(next, step);
  }

  const detachers = [...node.querySelectorAll('.card-fit')].map(attachTilt);

  const onResize = () => scrollTo(index);
  window.addEventListener('resize', onResize);

  renderHead();

  return {
    el: node,
    get tier() { return items[index]; },
    enter() {
      // Force layout so the hero measurement below reads the settled position.
      void carousel.offsetWidth;
      scrollTo(index);
      paint();
      renderHead();
    },
    destroy() {
      detachers.forEach(d => d());
      window.removeEventListener('resize', onResize);
    },
  };
}
