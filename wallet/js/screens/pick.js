import { screenEl, tap } from '../dom.js';
import { icon } from '../icons.js';
import { TIERS, cardMarkup } from '../ui/card.js';
import { money } from '../store.js';
import { attachTilt } from '../ui/tilt.js';

/**
 * Card picker. A snapping carousel of turned cards; the focused card is the
 * hero that flies in from Home and on to Confirm, so exactly one cell at a
 * time carries the hero marker.
 */
export function pickScreen({ start = 'platinum', onBack, onChoose }) {
  let index = Math.max(0, TIERS.findIndex(t => t.id === start));

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
        ${TIERS.map(t => `
          <div class="carousel__cell" data-tier="${t.id}">
            <div class="carousel__inner">${cardMarkup(t.id, { turned: true })}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="dots sc-pick__dots" data-dots>
      ${TIERS.map(() => '<i></i>').join('')}
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
    const t = TIERS[index];
    nameEl.textContent = t.name;
    priceEl.innerHTML = `<b>${money(t.price, { cents: false })}</b> <span>/ year</span>`;
    ctaEl.textContent = `Choose ${t.name}`;
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
    if (event.target.closest('[data-choose]')) { tap(); return onChoose(TIERS[index]); }
    const cell = event.target.closest('.carousel__cell');
    if (cell) {
      const i = cells.indexOf(cell);
      if (i !== index) { tap(); scrollTo(i, 'smooth'); }
    }
  });

  const detachers = [...node.querySelectorAll('.card-fit')].map(attachTilt);

  const onResize = () => scrollTo(index);
  window.addEventListener('resize', onResize);

  renderHead();

  return {
    el: node,
    get tier() { return TIERS[index]; },
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
