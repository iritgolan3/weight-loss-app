import { rgba, shade, tint } from './Renderer';

export type Ctx = CanvasRenderingContext2D;

/**
 * Stylised drawing primitives.
 *
 * House style: every form gets a dark contour plus a two-or-three-stop gradient
 * fill and a rim light on the key side. That combination is what reads as
 * "modern high-resolution cartoon" rather than flat vector shapes, and it keeps
 * silhouettes strong at any distance.
 */

export const OUTLINE = 'rgba(18,12,20,0.92)';

export function setShadow(ctx: Ctx, color: string, blur: number, dy = 0): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = dy;
}

export function clearShadow(ctx: Ctx): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Tapered capsule between two points — the workhorse for arms and legs. */
export function limbPath(ctx: Ctx, ax: number, ay: number, bx: number, by: number, wA: number, wB: number): void {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 0.0001;
  const nx = -dy / len, ny = dx / len;

  ctx.beginPath();
  ctx.moveTo(ax + nx * wA, ay + ny * wA);
  ctx.lineTo(bx + nx * wB, by + ny * wB);
  ctx.arc(bx, by, wB, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(ax - nx * wA, ay - ny * wA);
  ctx.arc(ax, ay, wA, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
}

/**
 * NOTE ON UNITS: fighters are drawn inside a scaled context where one unit is
 * roughly a third of a body height, so every line width here must be expressed
 * in those same units. Clamping to a pixel minimum would blow the stroke up by
 * two orders of magnitude.
 */
/**
 * Draws a multi-jointed limb as ONE continuous rounded stroke.
 *
 * Drawing an arm as two overlapping capsules looks fine when it is straight and
 * terrible when it is bent: the two shapes merge into a single pointed flap
 * with a seam through it. Stroking the whole chain — once fat in the outline
 * colour, once thinner in the fill — gives a clean jointed limb at any angle.
 */
export function drawChain(
  ctx: Ctx, pts: { x: number; y: number }[],
  width: number, color: string, rim: string, outlineWidth: number,
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

  if (outlineWidth > 0) {
    trace();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = width + outlineWidth * 2;
    ctx.stroke();
  }

  trace();
  const a = pts[0], b = pts[pts.length - 1];
  const g = ctx.createLinearGradient(a.x - width, a.y - width, b.x + width, b.y + width);
  g.addColorStop(0, tint(color, 0.18));
  g.addColorStop(0.35, color);
  g.addColorStop(1, shade(color, 0.62));
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  ctx.stroke();

  // Rim highlight running down the limb, inset so it reads as a lit edge.
  trace();
  ctx.strokeStyle = rgba(rim, 0.22);
  ctx.lineWidth = width * 0.34;
  ctx.stroke();
  ctx.restore();
}

export function drawLimb(
  ctx: Ctx, ax: number, ay: number, bx: number, by: number,
  wA: number, wB: number, color: string, rim: string, lineWidth: number,
): void {
  limbPath(ctx, ax, ay, bx, by, wA, wB);
  const g = ctx.createLinearGradient(ax - wA, ay - wA, ax + wA * 1.6, ay + wA * 1.6);
  g.addColorStop(0, tint(color, 0.16));
  g.addColorStop(0.32, color);
  g.addColorStop(1, shade(color, 0.6));
  ctx.fillStyle = g;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  // Rim light down the key side.
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 0.0001;
  const nx = -dy / len, ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(ax + nx * wA * 0.78, ay + ny * wA * 0.78);
  ctx.lineTo(bx + nx * wB * 0.78, by + ny * wB * 0.78);
  ctx.strokeStyle = rgba(rim, 0.35);
  ctx.lineWidth = lineWidth * 0.9;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Rounded blob defined by a centre, radii and a squash. */
export function blobPath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

/** A closed spline through points, used for torsos and hair. */
export function splinePath(ctx: Ctx, pts: { x: number; y: number }[], closed = true): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  const n = pts.length;
  const get = (i: number) => pts[((i % n) + n) % n];
  ctx.moveTo((get(0).x + get(1).x) / 2, (get(0).y + get(1).y) / 2);
  const end = closed ? n : n - 1;
  for (let i = 1; i <= end; i++) {
    const p = get(i);
    const next = get(i + 1);
    ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  }
  if (closed) ctx.closePath();
}

/** Fills the current path with a top-lit gradient and a dark contour. */
export function fillForm(
  ctx: Ctx, color: string, x: number, y: number, r: number,
  rim: string, outlineWidth = 3, rich = true,
): void {
  if (rich) {
    const g = ctx.createRadialGradient(x - r * 0.36, y - r * 0.44, r * 0.06, x, y, r * 1.32);
    g.addColorStop(0, tint(color, 0.2));
    g.addColorStop(0.3, color);
    g.addColorStop(1, shade(color, 0.54));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = color;
  }
  ctx.fill();
  if (outlineWidth > 0) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = outlineWidth;
    ctx.stroke();
  }
  void rim;
}

/** Soft contact shadow on the canvas beneath a fighter. */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.5})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A star polygon — used for tokens, stun and impact bursts. */
export function starPath(ctx: Ctx, x: number, y: number, outer: number, inner: number, points = 5, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Rounded rectangle path. */
export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Chevron / speed lines radiating from a point — arcade impact language. */
export function speedLines(
  ctx: Ctx, x: number, y: number, inner: number, outer: number,
  count: number, color: string, width: number, phase = 0,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
    ctx.stroke();
  }
}

export { shade, tint, rgba };
