/* Semi-3D card.

   The face sits on a perspective plane and leans towards the pointer or
   finger, with a specular highlight tracking the same point. It is a small
   tilt on purpose: enough to read as a physical object catching the light,
   not enough to fight the flat design around it.

   The tilt is written to custom properties rather than the transform itself,
   so the quarter turn in the card picker and the hero flight keep control of
   their own transforms. */

const MAX = 7;   // degrees

const reduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.getElementById('device')?.hasAttribute('data-reduced-motion');

/**
 * @param {HTMLElement} fit  a `.card-fit`
 * @returns {() => void} detach
 */
export function attachTilt(fit) {
  const face = fit?.querySelector('.card');
  if (!face) return () => {};

  let raf = 0;

  const reset = () => {
    cancelAnimationFrame(raf);
    face.classList.remove('is-tilting');
    face.style.setProperty('--rx', '0deg');
    face.style.setProperty('--ry', '0deg');
    face.style.setProperty('--gloss', '50% 0%');
  };

  const move = event => {
    if (reduced()) return;
    const r = face.getBoundingClientRect();
    if (!r.width) return;

    // -0.5 .. 0.5 across the face, whichever way it is turned.
    const px = (event.clientX - r.left) / r.width - 0.5;
    const py = (event.clientY - r.top) / r.height - 0.5;

    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      face.classList.add('is-tilting');
      face.style.setProperty('--rx', `${(-py * MAX * 2).toFixed(2)}deg`);
      face.style.setProperty('--ry', `${(px * MAX * 2).toFixed(2)}deg`);
      face.style.setProperty('--gloss', `${(px * 100 + 50).toFixed(1)}% ${(py * 100 + 50).toFixed(1)}%`);
    });
  };

  fit.addEventListener('pointermove', move);
  fit.addEventListener('pointerdown', move);
  fit.addEventListener('pointerleave', reset);
  fit.addEventListener('pointercancel', reset);
  fit.addEventListener('pointerup', reset);
  reset();

  return () => {
    cancelAnimationFrame(raf);
    fit.removeEventListener('pointermove', move);
    fit.removeEventListener('pointerdown', move);
    fit.removeEventListener('pointerleave', reset);
    fit.removeEventListener('pointercancel', reset);
    fit.removeEventListener('pointerup', reset);
  };
}
