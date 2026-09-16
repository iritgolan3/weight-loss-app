/* Shared settings controls: grouped rows, switches and the sheets that back
   the rows which need a choice, a number or a confirmation. */

import { el, tap } from '../dom.js';
import { icon } from '../icons.js';

/** A group of rows under a small caps heading. */
export const group = (title, rows, note = '') => `
  <section class="group">
    ${title ? `<h2 class="group__title">${title}</h2>` : ''}
    <div class="group__box">${rows}</div>
    ${note ? `<p class="group__note">${note}</p>` : ''}
  </section>`;

/** A row that opens something. `value` shows the current choice on the right. */
export const navRow = (key, name, { glyph, sub = '', value = '', danger = false, disabled = false } = {}) => `
  <button class="srow${danger ? ' srow--danger' : ''}" data-row="${key}" ${disabled ? 'disabled' : ''}>
    ${glyph ? `<span class="srow__icon">${icon(glyph, 20)}</span>` : ''}
    <span class="srow__body">
      <span class="srow__name">${name}</span>
      ${sub ? `<span class="srow__sub">${sub}</span>` : ''}
    </span>
    ${value ? `<span class="srow__val" data-val="${key}">${value}</span>` : ''}
    <span class="srow__chev">${icon('chevronR', 18)}</span>
  </button>`;

/** A row whose whole job is a switch. */
export const toggleRow = (key, name, on, { glyph, sub = '', disabled = false } = {}) => `
  <div class="srow">
    ${glyph ? `<span class="srow__icon">${icon(glyph, 20)}</span>` : ''}
    <span class="srow__body">
      <span class="srow__name">${name}</span>
      ${sub ? `<span class="srow__sub">${sub}</span>` : ''}
    </span>
    <button class="switch" role="switch" data-toggle="${key}"
            aria-checked="${on ? 'true' : 'false'}" aria-label="${name}"
            ${disabled ? 'disabled' : ''}></button>
  </div>`;

/** A read-only row, for facts rather than controls. */
export const infoRow = (name, value, { glyph, sub = '' } = {}) => `
  <div class="srow">
    ${glyph ? `<span class="srow__icon">${icon(glyph, 20)}</span>` : ''}
    <span class="srow__body">
      <span class="srow__name">${name}</span>
      ${sub ? `<span class="srow__sub">${sub}</span>` : ''}
    </span>
    <span class="srow__val">${value}</span>
  </div>`;

/* --- Sheets ------------------------------------------------------------- */

function openSheet(inner, { label }) {
  const host = document.getElementById('device');
  const scrim = el('<div class="scrim"></div>');
  const sheet = el(`<div class="sheet" role="dialog" aria-modal="true" aria-label="${label}">
      <div class="sheet__grip"></div>${inner}</div>`);
  host.append(scrim, sheet);
  requestAnimationFrame(() => { scrim.classList.add('is-open'); sheet.classList.add('is-open'); });

  const close = () => {
    scrim.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { scrim.remove(); sheet.remove(); }, 440);
  };
  return { scrim, sheet, close };
}

/** Pick one of a list. Resolves to the chosen value, or null. */
export function optionSheet({ title, options, selected }) {
  const rows = options.map(o => `
    <button class="srow" data-pick="${o.value}">
      <span class="srow__body">
        <span class="srow__name">${o.label}</span>
        ${o.sub ? `<span class="srow__sub">${o.sub}</span>` : ''}
      </span>
      ${String(o.value) === String(selected)
        ? `<span class="srow__icon" style="color:var(--green)">${icon('check', 20)}</span>` : ''}
    </button>`).join('');

  const { scrim, sheet, close } = openSheet(`
    <h2 class="title title--s" style="text-align:center;font-size:1.25rem;margin-bottom:1rem">${title}</h2>
    <div class="group__box u-scroll" style="max-height:26rem">${rows}</div>
  `, { label: title });

  return new Promise(resolve => {
    const done = v => { close(); resolve(v); };
    sheet.addEventListener('click', e => {
      const pick = e.target.closest('[data-pick]');
      if (pick) { tap(); done(pick.dataset.pick); }
    });
    scrim.addEventListener('click', () => done(null));
  });
}

/** Yes/no, with the destructive option styled as such. */
export function confirmSheet({ title, body, confirm, danger = false }) {
  const { scrim, sheet, close } = openSheet(`
    <h2 class="title title--s" style="text-align:center;font-size:1.25rem">${title}</h2>
    <p class="subtitle" style="text-align:center;margin:0.5rem 0 1.5rem">${body}</p>
    <button class="btn btn--block" data-yes
            style="${danger ? 'background:var(--danger)' : ''}">${confirm}</button>
    <button class="btn btn--block btn--quiet" data-no style="margin-top:0.625rem">Cancel</button>
  `, { label: title });

  return new Promise(resolve => {
    const done = v => { close(); resolve(v); };
    sheet.addEventListener('click', e => {
      if (e.target.closest('[data-yes]')) { tap(12); done(true); }
      if (e.target.closest('[data-no]'))  { tap(); done(false); }
    });
    scrim.addEventListener('click', () => done(false));
  });
}

/** Read-only text with a copy button — the export path, since the artifact
    sandbox makes script-driven downloads inert. */
export function textSheet({ title, body, text }) {
  const { scrim, sheet, close } = openSheet(`
    <h2 class="title title--s" style="text-align:center;font-size:1.25rem">${title}</h2>
    <p class="subtitle" style="text-align:center;margin:0.5rem 0 1rem">${body}</p>
    <pre class="codebox u-scroll" data-text>${text.replace(/[<&]/g, c => ({ '<': '&lt;', '&': '&amp;' }[c]))}</pre>
    <button class="btn btn--block" data-copy style="margin-top:1rem">Copy to clipboard</button>
  `, { label: title });

  return new Promise(resolve => {
    sheet.addEventListener('click', async e => {
      if (!e.target.closest('[data-copy]')) return;
      tap();
      const btn = e.target.closest('[data-copy]');
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
      } catch {
        btn.textContent = 'Select the text above to copy';
      }
    });
    scrim.addEventListener('click', () => { close(); resolve(); });
  });
}
