/* Inline SVG icon set. Every glyph is drawn on a 24x24 grid with a 1.7px
   stroke so weights stay consistent wherever they are used. */

const P = (d, extra = '') =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7"
         stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

const GLYPHS = {
  search:    P('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z') + P('M16.2 16.2 20 20'),
  plus:      P('M12 5v14M5 12h14'),
  // Transfer — an arrow leaving, up and to the right.
  transfer:  P('M8.5 15.5 15.5 8.5') + P('M9.8 8.5h5.7v5.7'),
  // Conversion — two arrows swapping directions.
  convert:   P('M5 9.5h12M14 6.5l3 3') + P('M19 14.5H7M10 17.5l-3-3'),
  topup:     P('M12 5v14M5 12h14'),
  home:      P('M4.5 10.6 12 4.8l7.5 5.8V19a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z'),
  card:      P('M3.5 7.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z') +
             P('M3.5 10.5h17'),
  person:    P('M12 11.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z') +
             P('M4.9 20c.5-3.6 3.5-5.7 7.1-5.7s6.6 2.1 7.1 5.7'),
  chevronL:  P('M14.5 5.5 8 12l6.5 6.5'),
  chevronR:  P('M9.5 5.5 16 12l-6.5 6.5'),
  lock:      P('M6.8 10.6V8.4a5.2 5.2 0 0 1 10.4 0v2.2') +
             P('M5.6 10.6h12.8a1 1 0 0 1 1 1v7.2a1 1 0 0 1-1 1H5.6a1 1 0 0 1-1-1v-7.2a1 1 0 0 1 1-1z'),
  // Fingerprint: concentric ridges with tails, which still reads at 18px.
  finger:    P('M4.3 10.9a7.7 7.7 0 0 1 15.4 0') +
             P('M7 11.3a5 5 0 0 1 10 0v2.2a13.4 13.4 0 0 1-.8 4.6') +
             P('M9.7 11.5a2.3 2.3 0 0 1 4.6 0v4.3a11 11 0 0 1-.6 3.4') +
             P('M12 11.7v5.5') +
             P('M7 15.5a11.4 11.4 0 0 0 .7 4') +
             P('M19.6 13.3a15 15 0 0 1-.5 3.6'),
  back:      P('M4 7.5h11a4.5 4.5 0 0 1 0 9H9') + P('M11.5 13.5 8 17l3.5 3.5'),
  // Face-scan mark: corner brackets around a simple face.
  faceid:    P('M4.4 8.6V6.3a1.9 1.9 0 0 1 1.9-1.9h2.3') +
             P('M15.4 4.4h2.3a1.9 1.9 0 0 1 1.9 1.9v2.3') +
             P('M19.6 15.4v2.3a1.9 1.9 0 0 1-1.9 1.9h-2.3') +
             P('M8.6 19.6H6.3a1.9 1.9 0 0 1-1.9-1.9v-2.3') +
             P('M9.1 9.9v1.7M14.9 9.9v1.7') +
             P('M12 9.9v3.3h-1.1') +
             P('M9.2 15.4a3.9 3.9 0 0 0 5.6 0'),
  check:     P('M5 12.5 10 17.5 19 7'),
  logout:    P('M14.5 7.5V5.6a1.5 1.5 0 0 0-1.5-1.5H5.9A1.5 1.5 0 0 0 4.4 5.6v12.8a1.5 1.5 0 0 0 1.5 1.5H13a1.5 1.5 0 0 0 1.5-1.5v-1.9') +
             P('M9.8 12h10M16.7 9 19.8 12l-3.1 3'),
  key:       P('M15.2 4.5a4.6 4.6 0 1 0-3.6 7.5c.4 0 .8 0 1.2-.1l1.3 1.3h1.8v1.8h1.8v1.8H19l.9.9v2.3h-2.6l-5-5') ,
  bell:      P('M12 4.2a5.6 5.6 0 0 0-5.6 5.6c0 4.4-1.9 5.8-1.9 5.8h15s-1.9-1.4-1.9-5.8A5.6 5.6 0 0 0 12 4.2z') +
             P('M13.6 19a1.9 1.9 0 0 1-3.2 0'),
};

/** Returns an inline SVG string for `name`, sized to `size` px. */
export function icon(name, size = 22) {
  const g = GLYPHS[name];
  if (!g) return '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"
               aria-hidden="true" focusable="false">${g}</svg>`;
}

/** The contactless-payment arcs printed on every card face. */
export function contactless() {
  const cx = 1, cy = 30, span = 62 * Math.PI / 180;
  const arc = r => {
    const x1 = (cx + r * Math.cos(-span)).toFixed(2);
    const y1 = (cy + r * Math.sin(-span)).toFixed(2);
    const x2 = (cx + r * Math.cos(span)).toFixed(2);
    const y2 = (cy + r * Math.sin(span)).toFixed(2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  return `<svg class="card__wave" viewBox="0 0 30 60" aria-hidden="true">
    ${[8, 15.2, 22.4, 29.6].map((r, i) =>
      `<path d="${arc(r)}" fill="none" stroke="#2A2519" stroke-width="3.0"
             stroke-linecap="round" opacity="${(0.95 - i * 0.05).toFixed(2)}"/>`).join('')}
  </svg>`;
}
