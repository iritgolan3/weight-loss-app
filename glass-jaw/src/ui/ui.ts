import { clamp01 } from '../core/MathUtil';
import { Ctx, rgba, roundRect, shade, tint, starPath } from '../render/draw';

export const FONT_DISPLAY = 'Impact, "Arial Black", "Haettenschweiler", system-ui, sans-serif';
export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_MONO = 'ui-monospace, Menlo, Consolas, monospace';

export const PALETTE = {
  ink: '#0d0a14',
  panel: '#171326',
  panelLight: '#241d3a',
  line: '#3d3358',
  text: '#f4eee6',
  dim: '#a99fc0',
  gold: '#ffd166',
  orange: '#ff9a3c',
  red: '#ff4d4d',
  green: '#7ef9a2',
  blue: '#4cc9f0',
  purple: '#c77dff',
};

/** Outlined display text — legible over any background. */
export function displayText(
  ctx: Ctx, text: string, x: number, y: number, size: number,
  fill: string | CanvasGradient, opts: {
    align?: CanvasTextAlign; baseline?: CanvasTextBaseline;
    outline?: string; outlineWidth?: number; font?: string;
    shadow?: string; letterSpacing?: string;
  } = {},
): void {
  ctx.save();
  ctx.font = `900 ${size}px ${opts.font ?? FONT_DISPLAY}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.lineJoin = 'round';
  if (opts.letterSpacing && 'letterSpacing' in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = opts.letterSpacing;
  }
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow;
    ctx.shadowBlur = size * 0.4;
  }
  const ow = opts.outlineWidth ?? size * 0.14;
  if (ow > 0) {
    ctx.strokeStyle = opts.outline ?? PALETTE.ink;
    ctx.lineWidth = ow;
    ctx.strokeText(text, x, y);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Plain UI text with an optional subtle shadow. */
export function label(
  ctx: Ctx, text: string, x: number, y: number, size: number, color: string,
  opts: { align?: CanvasTextAlign; baseline?: CanvasTextBaseline; weight?: number; font?: string; alpha?: number } = {},
): void {
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.font = `${opts.weight ?? 600} ${size}px ${opts.font ?? FONT_UI}`;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A beveled arcade panel. */
export function panel(
  ctx: Ctx, x: number, y: number, w: number, h: number,
  opts: { radius?: number; fill?: string; border?: string; glow?: string; alpha?: number; borderWidth?: number } = {},
): void {
  const r = opts.radius ?? 14;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = 26;
  }
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  const base = opts.fill ?? PALETTE.panel;
  g.addColorStop(0, tint(base, 0.12));
  g.addColorStop(1, shade(base, 0.72));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = opts.border ?? PALETTE.line;
  ctx.lineWidth = opts.borderWidth ?? 2.5;
  ctx.stroke();
  // Top highlight.
  ctx.beginPath();
  ctx.moveTo(x + r, y + 2);
  ctx.lineTo(x + w - r, y + 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export interface BarOptions {
  /** Trailing "recent damage" value, drawn behind the fill. */
  ghost?: number;
  color: string;
  ghostColor?: string;
  bg?: string;
  /** Skew the bar for an aggressive arcade slant. */
  skew?: number;
  /** Draw the fill from the right instead of the left. */
  rightToLeft?: boolean;
  /** Segment ticks every N fraction. */
  segments?: number;
  height?: number;
  radius?: number;
  /** 0..1 pulse used when low. */
  pulse?: number;
  label?: string;
}

/** The workhorse stat bar: ghost layer, gradient fill, gloss and ticks. */
export function bar(
  ctx: Ctx, x: number, y: number, w: number, h: number, value: number, o: BarOptions,
): void {
  const v = clamp01(value);
  const ghost = clamp01(o.ghost ?? v);
  const r = o.radius ?? h * 0.34;

  ctx.save();
  // Track.
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = o.bg ?? 'rgba(8,6,14,0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(0, r - 2));
  ctx.clip();
  const iw = w - 4;

  const place = (frac: number): [number, number] =>
    o.rightToLeft ? [x + 2 + iw * (1 - frac), iw * frac] : [x + 2, iw * frac];

  // Ghost (damage taken a moment ago).
  if (ghost > v) {
    const [gx, gw] = place(ghost);
    ctx.fillStyle = o.ghostColor ?? 'rgba(255,90,90,0.6)';
    ctx.fillRect(gx, y + 2, gw, h - 4);
  }

  // Fill.
  const [fx, fw] = place(v);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tint(o.color, 0.45));
  g.addColorStop(0.42, o.color);
  g.addColorStop(1, shade(o.color, 0.62));
  ctx.fillStyle = g;
  ctx.fillRect(fx, y + 2, fw, h - 4);

  // Gloss.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(fx, y + 3, fw, (h - 4) * 0.36);

  // Low-health pulse.
  if (o.pulse && o.pulse > 0) {
    ctx.fillStyle = rgba('#ffffff', 0.2 * o.pulse);
    ctx.fillRect(fx, y + 2, fw, h - 4);
  }

  // Segment ticks.
  if (o.segments && o.segments > 1) {
    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.lineWidth = 2;
    for (let i = 1; i < o.segments; i++) {
      const px = x + 2 + (iw * i) / o.segments;
      ctx.beginPath();
      ctx.moveTo(px, y + 2);
      ctx.lineTo(px, y + h - 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Leading edge highlight.
  if (v > 0.005 && v < 0.995) {
    const [ex, ew] = place(v);
    const edge = o.rightToLeft ? ex : ex + ew;
    ctx.strokeStyle = rgba('#ffffff', 0.7);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(edge, y + 3);
    ctx.lineTo(edge, y + h - 3);
    ctx.stroke();
  }
  ctx.restore();
}

/** A token star, filled or empty, with a pop animation. */
export function tokenStar(
  ctx: Ctx, x: number, y: number, r: number, filled: boolean, pop: number, color = PALETTE.gold,
): void {
  ctx.save();
  ctx.translate(x, y);
  const s = 1 + pop * 0.55;
  ctx.scale(s, s);
  ctx.rotate(pop * 0.5);
  if (filled) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + pop * 26;
    starPath(ctx, 0, 0, r, r * 0.45);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, color);
    g.addColorStop(1, shade(color, 0.7));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(60,36,0,0.8)';
    ctx.lineWidth = r * 0.14;
    ctx.stroke();
  } else {
    starPath(ctx, 0, 0, r, r * 0.45);
    ctx.fillStyle = 'rgba(10,8,16,0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.35)';
    ctx.lineWidth = r * 0.13;
    ctx.stroke();
  }
  ctx.restore();
}

/** A small country banner built from two colours. */
export function flagChip(ctx: Ctx, x: number, y: number, w: number, h: number, colors: [string, string]): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, 4);
  ctx.clip();
  ctx.fillStyle = colors[0];
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.moveTo(x + w * 0.42, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w * 0.22, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** A chevron arrow pointing left or right — the dodge hint. */
export function dodgeArrow(ctx: Ctx, x: number, y: number, size: number, dir: -1 | 1, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    const o = i * size * 0.55;
    ctx.moveTo(-size * 0.3 + o, -size * 0.6);
    ctx.lineTo(size * 0.25 + o, 0);
    ctx.lineTo(-size * 0.3 + o, size * 0.6);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.24;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.6;
  ctx.stroke();
  ctx.restore();
}

/** Truncates text to fit a width, adding an ellipsis. */
export function fitText(ctx: Ctx, text: string, maxWidth: number, font: string): string {
  ctx.save();
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) { ctx.restore(); return text; }
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  ctx.restore();
  return text.slice(0, lo) + '…';
}

/** Wraps text into lines that fit `maxWidth`. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number, font: string): string[] {
  ctx.save();
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

export { clamp01, rgba, roundRect };
