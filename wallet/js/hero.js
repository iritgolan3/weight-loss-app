/* Shared-element ("hero") flight.

   The card face exists in more than one screen. Rather than cross-fading two
   copies, we measure the outgoing and incoming positions, fly a single clone
   between them, and interpolate the quarter turn along the way — so the card
   reads as one physical object being turned, which is the move the design
   is built around. */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

/** Geometry of a `.card-fit` box, ignoring any rotation applied to its face. */
function measure(fit, origin) {
  const r = fit.getBoundingClientRect();
  return {
    cx: r.left + r.width / 2 - origin.left,
    cy: r.top + r.height / 2 - origin.top,
    w: r.width,
    h: r.height,
    rot: Number(fit.dataset.rot || 0),
  };
}

/**
 * Fly the card from `fromFit` to `toFit` inside `layer`.
 * Both originals stay hidden for the duration so only the clone is visible.
 */
export function flyHero(layer, fromFit, toFit, { duration = 620 } = {}) {
  if (!fromFit || !toFit) return Promise.resolve();

  const origin = layer.getBoundingClientRect();
  const a = measure(fromFit, origin);
  const b = measure(toFit, origin);

  if (REDUCED.matches || !a.w || !b.w) return Promise.resolve();

  const face = toFit.querySelector('.card');
  if (!face) return Promise.resolve();

  const clone = face.cloneNode(true);
  clone.classList.remove('card--turned');
  Object.assign(clone.style, {
    position: 'absolute',
    left: `${b.cx - b.w / 2}px`,
    top: `${b.cy - b.h / 2}px`,
    width: `${b.w}px`,
    height: `${b.h}px`,
    margin: '0',
    transformOrigin: '50% 50%',
    willChange: 'transform',
  });
  layer.appendChild(clone);

  fromFit.style.visibility = 'hidden';
  toFit.style.visibility = 'hidden';

  const from = `translate(${a.cx - b.cx}px, ${a.cy - b.cy}px) `
             + `rotate(${a.rot}deg) scale(${a.w / b.w})`;
  const to   = `translate(0px, 0px) rotate(${b.rot}deg) scale(1)`;

  const anim = clone.animate(
    [{ transform: from }, { transform: to }],
    { duration, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'both' },
  );

  return anim.finished
    .catch(() => {})
    .then(() => {
      clone.remove();
      fromFit.style.visibility = '';
      toFit.style.visibility = '';
    });
}

/** Applies `rise` to each child with an even cadence. */
export function stagger(container, { step = 60, start = 0 } = {}) {
  if (!container) return;
  container.classList.add('stagger');
  [...container.children].forEach((child, i) => {
    child.style.animationDelay = `${start + i * step}ms`;
  });
}
