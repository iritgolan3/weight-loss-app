/* The card-terminal illustration on the order-placed screen.

   Drawn as SVG so the card can slide into the slot and the receipt out of
   the printer. Everything is authored in a flat "plan" space, then one
   projection (rotate, then squash vertically) tilts it into view; depth
   comes from re-drawing the silhouette a few pixels lower in dark grey.
   No raster assets. */

const W = 230;    // plan length: keypad end -> printer end
const H = 158;    // plan width
const R = 24;     // body corner radius
const DEPTH = 21; // screen-space extrusion

const CX = 150, CY = 182;

/** Plan space -> screen space. Rotate first, then flatten. */
const PROJ = `translate(${CX},${CY}) scale(1,0.66) rotate(-24) translate(${-W / 2},${-H / 2})`;
const PROJ_DEEP = `translate(${CX},${CY + DEPTH}) scale(1,0.66) rotate(-24) translate(${-W / 2},${-H / 2})`;

const rr = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

function keypad() {
  const out = [];
  const kw = 22, kh = 26, gapX = 27, gapY = 34;
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 3; row++) {
      const x = 18 + col * gapX;
      const y = 22 + row * gapY;
      const green = col === 3 && row === 2;
      const grey  = col === 0;
      out.push(rr(x, y, kw, kh, 9,
        green ? '#2BC96B' : grey ? '#C4C2BE' : '#EDEBE7',
        'stroke="#DEDCD8" stroke-width="1"'));
    }
  }
  return out.join('');
}

export function terminalSVG() {
  return `
  <svg class="term" viewBox="0 0 330 322" role="img"
       aria-label="A card terminal printing a receipt with a confirmation tick">

    <defs>
      <linearGradient id="termGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#D8C89C"/>
        <stop offset="0.5" stop-color="#C0AA79"/>
        <stop offset="1" stop-color="#9A8863"/>
      </linearGradient>
      <linearGradient id="termPaper" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/>
        <stop offset="1" stop-color="#EFEDEA"/>
      </linearGradient>
    </defs>

    <ellipse class="term__shadow" cx="${CX}" cy="${CY + 80}" rx="116" ry="20"
             fill="rgba(0,0,0,0.12)"/>

    <!-- Receipt leaves the printer at the far end and curls back over. -->
    <g class="term__receipt"><g>
      <path d="M 214 104 C 226 62 258 30 286 34
               L 302 74 C 278 72 252 104 242 146 Z"
            fill="url(#termPaper)" stroke="#D6D4D0" stroke-width="1.5" stroke-linejoin="round"/>
      ${[0, 1, 2, 3].map(i =>
        `<rect x="${238 + i * 6}" y="${58 + i * 13}" width="${42 - i * 6}" height="4.4" rx="2.2"
               fill="#D2D0CC" transform="rotate(-38 ${238 + i * 6} ${58 + i * 13})"/>`).join('')}
    </g></g>

    <g class="term__body">
      <!-- Extruded silhouette: the device's sides and underside. -->
      <g transform="${PROJ_DEEP}">
        ${rr(0, 0, W, H, R, '#14151A')}
      </g>

      <!-- Top face. -->
      <g transform="${PROJ}">
        ${rr(0, 0, W, H, R, '#FFFFFF')}
        ${rr(4, 4, W - 8, H - 8, R - 4, '#FAF9F7')}

        <!-- Screen, at the printer end. -->
        ${rr(128, 18, 86, H - 36, 10, '#ECEAE6')}

        ${keypad()}

        <!-- Card slot along the printer-end edge. -->
        ${rr(62, -5, 128, 9, 4, '#23242A')}
      </g>

      <!-- Printer cover: a dark cap over the far end. -->
      <g transform="${PROJ}">
        <path d="M ${W - 34} -2 H ${W - R} A ${R} ${R} 0 0 1 ${W + 2} ${R}
                 V ${H - R} A ${R} ${R} 0 0 1 ${W - R} ${H + 2} H ${W - 34} Z"
              fill="#191A1F"/>
      </g>

      <!-- Tick, stroked onto the screen. -->
      <g transform="${PROJ}">
        <path class="term__tick" d="M 134 97 L 149 115 L 187 66"
              fill="none" stroke="#2BC96B" stroke-width="11"
              stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </g>

    <!-- The card, sitting in the slot on top of the body. The outer group is
         what animates; the projection lives on the inner one so the two
         transforms cannot overwrite each other. -->
    <g class="term__card"><g transform="${PROJ}">
      ${rr(64, -14, 122, 74, 7, 'url(#termGold)',
           'stroke="rgba(0,0,0,0.10)" stroke-width="1"')}
      <g transform="translate(160,4) rotate(90) scale(0.40)" opacity="0.55">
        ${[8, 15, 22].map((r, i) => {
          const s = 62 * Math.PI / 180;
          const x1 = (r * Math.cos(-s)).toFixed(1), y1 = (r * Math.sin(-s)).toFixed(1);
          const x2 = (r * Math.cos(s)).toFixed(1),  y2 = (r * Math.sin(s)).toFixed(1);
          return `<path d="M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}"
                        fill="none" stroke="#2A2519" stroke-width="4" stroke-linecap="round"/>`;
        }).join('')}
      </g>
      <text x="78" y="50" font-family="Poppins, sans-serif" font-size="20"
            font-weight="700" font-style="italic" fill="#2A2519" opacity="0.6">VISA</text>
    </g></g>
  </svg>`;
}

/** Runs the arrival sequence: body settles, card drops in, tick strokes on. */
export function playTerminal(root) {
  const q = s => root.querySelector(s);
  const body = q('.term__body'), card = q('.term__card');
  const tick = q('.term__tick'), receipt = q('.term__receipt');
  if (!body || !card || !tick || !receipt) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = n => (reduced ? 1 : n);

  body.animate(
    [{ transform: 'scale(0.84) translateY(16px)', opacity: 0 },
     { transform: 'scale(1) translateY(0)',       opacity: 1 }],
    { duration: ms(680), easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'both' });

  // Slides in along the card's own long axis so it reads as entering the slot.
  card.animate(
    [{ transform: 'translate(-54px, -74px)', opacity: 0 },
     { transform: 'translate(-22px, -30px)', opacity: 1, offset: 0.5 },
     { transform: 'translate(0, 0)',         opacity: 1 }],
    { duration: ms(820), delay: ms(300), easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'both' });

  receipt.animate(
    [{ transform: 'translate(-30px, 26px)', opacity: 0 },
     { transform: 'translate(0, 0)',        opacity: 1 }],
    { duration: ms(700), delay: ms(820), easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'both' });

  const len = tick.getTotalLength ? tick.getTotalLength() : 120;
  tick.style.strokeDasharray = `${len}`;
  tick.animate(
    [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
    { duration: ms(560), delay: ms(1040), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' });
}
