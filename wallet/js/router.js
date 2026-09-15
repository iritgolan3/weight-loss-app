/* A small screen stack.

   Screens are factories returning `{ el, enter?, onResume?, destroy? }`.
   The router owns mounting, the transition between two screens, and the
   back stack. Transitions use Web Animations so they run off the main
   thread.

   Modes:
     push    grows the stack, iOS-style slide     (back() returns)
     hero    grows the stack, shared-element card (back() returns)
     fade    clears the stack, cross-fade
     none    clears the stack, no animation
*/

import { flyHero } from './hero.js';

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const GROWS = new Set(['push', 'hero']);

const play = (el, frames, duration, opts = {}) =>
  el.animate(frames, { duration, easing: EASE, fill: 'both', ...opts })
    .finished.catch(() => {});

export class Router {
  #host; #layer; #factories = new Map(); #stack = []; #busy = false;

  constructor(host, layer) {
    this.#host = host;
    this.#layer = layer;
  }

  register(name, factory) { this.#factories.set(name, factory); return this; }

  get current() { return this.#stack[this.#stack.length - 1] || null; }
  get depth()   { return this.#stack.length; }
  get busy()    { return this.#busy; }

  async go(name, params = {}, { mode = 'push' } = {}) {
    if (this.#busy) return null;
    const factory = this.#factories.get(name);
    if (!factory) throw new Error(`No screen registered as "${name}"`);

    this.#busy = true;
    try {
      const prev = this.current;
      const next = Object.assign(factory(params) || {}, { name, params });

      this.#host.appendChild(next.el);
      await next.enter?.();

      if (prev && mode !== 'none') await this.#transition(prev, next, mode);

      if (GROWS.has(mode)) {
        if (prev) {
          // Stay mounted but inert so back() can restore instantly.
          prev.el.style.visibility = 'hidden';
          prev.el.setAttribute('aria-hidden', 'true');
        }
        this.#stack.push(next);
      } else {
        // Clearing modes tear down every screen still mounted.
        this.#stack.forEach(s => this.#destroy(s));
        this.#stack = [next];
      }
      return next;
    } finally {
      this.#busy = false;
    }
  }

  /** Pop to the screen underneath, reversing the entry animation. */
  async back({ hero = false } = {}) {
    if (this.#busy || this.#stack.length < 2) return;
    this.#busy = true;
    try {
      const top = this.#stack.pop();
      const prev = this.current;

      prev.el.style.visibility = '';
      prev.el.removeAttribute('aria-hidden');
      prev.onResume?.();

      if (hero) {
        await this.#heroBetween(top, prev, true);
      } else {
        await Promise.all([
          play(top.el,  [{ transform: 'translateX(0)' },    { transform: 'translateX(100%)' }], 380),
          play(prev.el, [{ transform: 'translateX(-24%)' }, { transform: 'translateX(0)' }],    380),
        ]);
        prev.el.style.transform = '';
      }

      this.#destroy(top);
    } finally {
      this.#busy = false;
    }
  }

  #destroy(screen) {
    try { screen.destroy?.(); } catch { /* keep teardown non-fatal */ }
    screen.el.remove();
  }

  async #transition(prev, next, mode) {
    if (mode === 'hero') return this.#heroBetween(prev, next, false);

    if (mode === 'fade') {
      await Promise.all([
        play(next.el, [{ opacity: 0 }, { opacity: 1 }], 380, { easing: 'linear' }),
        play(prev.el, [{ opacity: 1 }, { opacity: 0 }], 260, { easing: 'linear' }),
      ]);
      next.el.style.opacity = '';
      return;
    }

    await Promise.all([
      play(next.el, [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],    420),
      play(prev.el, [{ transform: 'translateX(0)' },    { transform: 'translateX(-24%)' }], 420),
    ]);
    next.el.style.transform = '';
  }

  /** Cross-fade the backdrops while the card flies between the two screens. */
  async #heroBetween(prev, next, reverse) {
    const fromFit = prev.el.querySelector('[data-hero="card"]');
    const toFit   = next.el.querySelector('[data-hero="card"]');

    prev.el.classList.add('is-flying');
    next.el.style.opacity = '0';

    // Let the incoming screen lay out before measuring its card.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    await Promise.all([
      flyHero(this.#layer, fromFit, toFit, { duration: reverse ? 540 : 620 }),
      play(next.el, [{ opacity: 0 }, { opacity: 1 }], reverse ? 320 : 440, { easing: 'linear' }),
    ]);

    next.el.style.opacity = '';
    prev.el.classList.remove('is-flying');
  }
}
