export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface QualitySettings {
  /** Multiplies the backing-store resolution. */
  pixelScale: number;
  /** Soft shadows and glows via ctx.shadowBlur. Expensive; first thing to go. */
  softShadows: boolean;
  /** Floor reflections of the fighters. */
  reflections: boolean;
  /** Particle budget multiplier. */
  particles: number;
  /** Crowd rows drawn. */
  crowdRows: number;
  /** Per-crowd-member detail (heads + arms vs. blobs). */
  crowdDetail: boolean;
  /** Volumetric light cones and haze. */
  atmosphere: boolean;
  /** Gradient stops used for body shading. */
  richShading: boolean;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { pixelScale: 0.75, softShadows: false, reflections: false, particles: 0.35, crowdRows: 3, crowdDetail: false, atmosphere: false, richShading: false },
  medium: { pixelScale: 1, softShadows: false, reflections: true, particles: 0.7, crowdRows: 5, crowdDetail: false, atmosphere: true, richShading: true },
  high: { pixelScale: 1, softShadows: true, reflections: true, particles: 1, crowdRows: 7, crowdDetail: true, atmosphere: true, richShading: true },
  ultra: { pixelScale: 1.35, softShadows: true, reflections: true, particles: 1.5, crowdRows: 9, crowdDetail: true, atmosphere: true, richShading: true },
};

/**
 * Owns the canvas and the design-space transform.
 *
 * Everything in the game is laid out in a virtual 1080-tall design space, so a
 * single layout works identically at 720p and 4K. The backing store is sized to
 * the device pixel ratio (times a quality multiplier), which is what keeps the
 * vector art genuinely high-resolution rather than an upscaled low-res image.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Design-space dimensions. Height is always DESIGN_H. */
  static readonly DESIGN_H = 1080;
  dw = 1920;
  readonly dh = Renderer.DESIGN_H;

  /** Device pixels per design unit. */
  scale = 1;
  quality: QualitySettings = QUALITY.high;
  qualityName: Quality = 'high';

  /** Physical canvas size in CSS pixels. */
  cssW = 0;
  cssH = 0;

  private gradientCache = new Map<string, CanvasGradient>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
    this.ctx = ctx;
    this.resize();
  }

  setQuality(q: Quality): void {
    this.qualityName = q;
    this.quality = QUALITY[q];
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.cssW = w;
    this.cssH = h;

    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality.pixelScale;
    const bw = Math.max(1, Math.round(w * dpr));
    const bh = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    // Design space: fixed height, width follows the aspect ratio within limits.
    const aspect = w / h;
    this.dw = Math.round(Math.min(2560, Math.max(1280, this.dh * aspect)));
    this.scale = bh / this.dh;
    this.gradientCache.clear();
  }

  /** Resets the transform to design space for this frame. */
  begin(): CanvasRenderingContext2D {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Letterbox horizontally: design width maps to the full backing width.
    const sx = this.canvas.width / this.dw;
    const sy = this.canvas.height / this.dh;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return ctx;
  }

  get cx(): number { return this.dw / 2; }
  get cy(): number { return this.dh / 2; }

  /** Cached linear gradient. Key must capture every parameter. */
  linear(key: string, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
    const k = `L${key}`;
    let g = this.gradientCache.get(k);
    if (!g) {
      g = this.ctx.createLinearGradient(x0, y0, x1, y1);
      for (const [o, c] of stops) g.addColorStop(o, c);
      this.gradientCache.set(k, g);
    }
    return g;
  }

  radial(key: string, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, stops: [number, string][]): CanvasGradient {
    const k = `R${key}`;
    let g = this.gradientCache.get(k);
    if (!g) {
      g = this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
      for (const [o, c] of stops) g.addColorStop(o, c);
      this.gradientCache.set(k, g);
    }
    return g;
  }

  clearGradientCache(): void { this.gradientCache.clear(); }
}

// ---------------------------------------------------------------------------
// Colour helpers — used everywhere for procedural shading.
// ---------------------------------------------------------------------------

/** Parses #rgb / #rrggbb into [r,g,b]. */
export function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Multiplies brightness. `amount` > 1 lightens, < 1 darkens. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Blends toward white by `t`. */
export function tint(hex: string, t: number): string {
  const [r, g, b] = parseHex(hex);
  const f = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${f(r1, r2)},${f(g1, g2)},${f(b1, b2)})`;
}
