import { statusIcons } from './icons.js';

/** Build a detached element from an HTML string. */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** The faux iOS status bar. Times match the device clock. */
export function statusbar({ light = false } = {}) {
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, '0');
  return `<div class="statusbar${light ? ' statusbar--light' : ''}">
            <span>${h}:${m}</span>
            <span class="statusbar__icons">${statusIcons()}</span>
          </div>`;
}

/** Wrap screen content in the standard shell. */
export function screenEl(cls, body, { dark = false, flush = false } = {}) {
  return el(`
    <section class="screen ${cls}${dark ? ' screen--dark' : ''}${flush ? ' screen--flush' : ''}">
      ${statusbar({ light: dark })}
      <div class="screen__body">${body}</div>
    </section>`);
}

let toastTimer;
/** Transient confirmation message. */
export function toast(message) {
  const host = document.getElementById('device');
  let node = host.querySelector('.toast');
  if (!node) {
    node = el('<div class="toast" role="status" aria-live="polite"></div>');
    host.appendChild(node);
  }
  node.textContent = message;
  requestAnimationFrame(() => node.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-on'), 2200);
}

/** Light haptic tap where the platform supports it. */
export const tap = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* no-op */ } };
