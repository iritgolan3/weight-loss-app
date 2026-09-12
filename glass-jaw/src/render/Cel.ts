import { parseHex } from './Renderer';

export type Ctx = CanvasRenderingContext2D;

/**
 * Flat cel drawing primitives.
 *
 * HOUSE RULES — these exist because the previous renderer broke all of them and
 * the result looked airbrushed rather than drawn:
 *
 *   1. No gradients on characters. Ever. A form gets ONE flat fill and at most
 *      ONE hard-edged shadow shape clipped inside it.
 *   2. Every form gets a black contour of uniform width. Line weight does not
 *      vary with the size of the form.
 *   3. No blur, no glow, no rim light, no soft shadow on any character part.
 *      `shadowBlur` is reserved for screen effects, never for anatomy.
 *   4. Palettes are small and deliberate: a base and a shade, picked by hand
 *      per character, not computed per pixel.
 *
 * The look this produces is a cartoon that could have been inked, which is the
 * whole point of the style.
 */

/** The single ink colour used for every contour in the game. */
export const INK = '#17111c';

/** Contour width in local (character) units. */
export const LINE = 0.05;

/** Shades a colour by a fixed step, for the two-tone cel shadow. */
export function darken(hex: string, amount = 0.76): string {
  const [r, g, b] = parseHex(hex);
  const f = (v: number) => Math.max(0, Math.round(v * amount));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function lighten(hex: string, amount = 0.22): string {
  const [r, g, b] = parseHex(hex);
  const f = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/**
 * Fills the current path flat and inks its contour.
 *
 * Call after building a path. Pass `lw = 0` for forms that sit inside another
 * form and should not be outlined again.
 */
export function ink(ctx: Ctx, fill: string, lw = LINE): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

/**
 * Two-tone cel shading: fills the form flat, then clips to it and lays a
 * hard-edged shadow across one side. `shadeSide` is -1 for a shadow on the
 * fighter's left, +1 for their right.
 */
export function inkShaded(
  ctx: Ctx, buildPath: () => void, fill: string, shade: string,
  bounds: { x: number; y: number; w: number; h: number },
  shadeSide: -1 | 1 = 1, shadeFrac = 0.36, lw = LINE,
): void {
  ctx.save();
  buildPath();
  ctx.fillStyle = fill;
  ctx.fill();

  // Hard-edged shadow, clipped to the form. No gradient, no feathering.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = shade;
  const w = bounds.w * shadeFrac;
  ctx.fillRect(shadeSide > 0 ? bounds.x + bounds.w - w : bounds.x, bounds.y - 1, w, bounds.h + 2);
  ctx.restore();

  if (lw > 0) {
    buildPath();
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/** A capsule between two points — arms, legs, necks. */
export function capsule(
  ctx: Ctx, ax: number, ay: number, bx: number, by: number, wa: number, wb = wa,
): void {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1e-4;
  const nx = -dy / len, ny = dx / len;
  const a0 = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.moveTo(ax + nx * wa, ay + ny * wa);
  ctx.lineTo(bx + nx * wb, by + ny * wb);
  ctx.arc(bx, by, wb, a0, a0 + Math.PI, false);
  ctx.lineTo(ax - nx * wa, ay - ny * wa);
  ctx.arc(ax, ay, wa, a0 + Math.PI, a0 + Math.PI * 2, false);
  ctx.closePath();
}

/**
 * A bent limb drawn as ONE inked stroke through its joints.
 *
 * Stroking the whole chain — once fat in ink, once thinner in the fill colour —
 * gives a clean jointed limb at any angle with no internal seam, which two
 * overlapping capsules cannot do.
 */
export function inkChain(
  ctx: Ctx, pts: { x: number; y: number }[], width: number,
  fill: string, lw = LINE,
): void {
  if (pts.length < 2) return;
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  trace();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + lw * 2;
  ctx.stroke();
  trace();
  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** Adds a hard-edged shadow down one side of a chain limb. */
export function chainShade(
  ctx: Ctx, pts: { x: number; y: number }[], width: number,
  shade: string, side: -1 | 1,
): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x + side * width * 0.26, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + side * width * 0.26, pts[i].y);
  ctx.strokeStyle = shade;
  ctx.lineWidth = width * 0.46;
  ctx.stroke();
  ctx.restore();
}

/** An ellipse path. */
export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

/** A closed quadratic spline through the given points. */
export function blobPath(ctx: Ctx, pts: { x: number; y: number }[]): void {
  const n = pts.length;
  if (n < 3) return;
  const at = (i: number) => pts[((i % n) + n) % n];
  ctx.beginPath();
  ctx.moveTo((at(0).x + at(1).x) / 2, (at(0).y + at(1).y) / 2);
  for (let i = 1; i <= n; i++) {
    const p = at(i), q = at(i + 1);
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  ctx.closePath();
}

/** A flat contact shadow: a hard ellipse, not a blurred blob. */
export function celShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.3): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();
}

/** A hard-edged star, used for tokens and stun. */
export function starPath(
  ctx: Ctx, x: number, y: number, outer: number, inner: number,
  points = 5, rot = -Math.PI / 2,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
