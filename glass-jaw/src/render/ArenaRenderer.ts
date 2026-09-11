import type { ArenaDef } from '../data/arenas';
import { RNG } from '../core/RNG';
import { clamp01 } from '../core/MathUtil';
import { Ctx, rgba, roundRect, shade, tint } from './draw';
import type { Renderer } from './Renderer';

/** Fixed layout landmarks in design space, shared by every arena and the HUD. */
export const RING = {
  /** Y of the far ring apron. */
  horizon: 430,
  /** Y where the opponent's feet stand. */
  opponentFeet: 836,
  /** Y where the player's feet stand (below the frame). */
  playerFeet: 1432,
  /** Y of the near mat edge. */
  matNear: 1080,
  matFar: 512,
  /** Half-width of the mat at the far edge. */
  matFarHalf: 560,
  /** Half-width of the mat at the near edge. */
  matNearHalf: 1180,
  /** Half-distance between the corner posts. */
  postHalf: 648,
  postTop: 286,
  postBottom: 566,
} as const;

/**
 * Draws the arena.
 *
 * The sky, crowd, ropes, posts and mat never change during a fight, so they are
 * baked once into an offscreen canvas and blitted. The only per-frame work is
 * the crowd's cheer wave (six sliced blits), camera flashes, and the lighting
 * pass — which keeps a very detailed backdrop essentially free.
 */
export class ArenaRenderer {
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';
  private flashes: { x: number; y: number; t: number }[] = [];
  private flashTimer = 0;
  private rng = new RNG(0xa11ce);

  constructor(private readonly renderer: Renderer) {}

  invalidate(): void { this.cache = null; }

  private buildCache(arena: ArenaDef): void {
    const r = this.renderer;
    const q = r.quality;
    const c = document.createElement('canvas');
    c.width = r.dw;
    c.height = r.dh;
    const ctx = c.getContext('2d')!;

    this.drawBackdrop(ctx, arena, r.dw, r.dh);
    this.drawCrowd(ctx, arena, r.dw, q.crowdRows, q.crowdDetail);
    this.drawRingBack(ctx, arena, r.dw);
    this.drawMat(ctx, arena, r.dw);

    this.cache = c;
    this.cacheKey = `${arena.id}:${r.dw}:${r.dh}:${r.qualityName}`;
  }

  // -- Static layers ---------------------------------------------------------

  private drawBackdrop(ctx: Ctx, a: ArenaDef, w: number, h: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, a.sky[0]);
    g.addColorStop(0.55, a.sky[1]);
    g.addColorStop(1, shade(a.sky[1], 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Overhead light rig.
    const cx = w / 2;
    for (let i = -2; i <= 2; i++) {
      const lx = cx + i * w * 0.19;
      const ly = 54;
      ctx.beginPath();
      ctx.moveTo(lx - 46, 0);
      ctx.lineTo(lx + 46, 0);
      ctx.lineTo(lx + 30, ly);
      ctx.lineTo(lx - 30, ly);
      ctx.closePath();
      ctx.fillStyle = '#1a1a22';
      ctx.fill();
      const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70);
      lg.addColorStop(0, rgba(a.light, 0.95));
      lg.addColorStop(1, rgba(a.light, 0));
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, 70, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCrowd(ctx: Ctx, a: ArenaDef, w: number, rows: number, detail: boolean): void {
    const rng = new RNG(0xc0ffee ^ w);
    const top = 118;
    const bottom = RING.horizon + 6;
    const skinTones = ['#f0c8a8', '#d9a66c', '#a9714b', '#7a4a2b', '#e8b48c', '#5c3620'];

    for (let row = 0; row < rows; row++) {
      const t = row / Math.max(1, rows - 1);
      const y = top + t * (bottom - top);
      // Nearer rows are larger and darker — cheap depth.
      const size = 15 + t * 30;
      const dark = 1 - t * 0.55;
      const count = Math.ceil((w / (size * 1.25)) * a.density);

      for (let i = 0; i < count; i++) {
        const x = ((i + rng.next() * 0.7) / count) * (w + size * 2) - size;
        const bodyCol = shade(a.crowd, dark * (0.8 + rng.next() * 0.55));

        // Torso.
        ctx.beginPath();
        ctx.moveTo(x - size * 0.62, y + size * 1.5);
        ctx.quadraticCurveTo(x - size * 0.66, y + size * 0.22, x, y + size * 0.16);
        ctx.quadraticCurveTo(x + size * 0.66, y + size * 0.22, x + size * 0.62, y + size * 1.5);
        ctx.closePath();
        ctx.fillStyle = bodyCol;
        ctx.fill();

        // Head.
        ctx.beginPath();
        ctx.arc(x, y - size * 0.2, size * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = detail
          ? shade(skinTones[Math.floor(rng.next() * skinTones.length)], dark * 0.5)
          : bodyCol;
        ctx.fill();

        // A fraction of the crowd has their arms in the air.
        if (detail && rng.next() < 0.3) {
          ctx.strokeStyle = bodyCol;
          ctx.lineWidth = size * 0.17;
          ctx.lineCap = 'round';
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x + s * size * 0.44, y + size * 0.5);
            ctx.lineTo(x + s * size * 0.66, y - size * 0.6);
            ctx.stroke();
          }
        }
      }
      // Haze between rows pushes the far crowd back.
      ctx.fillStyle = rgba(a.sky[1], 0.12 * (1 - t));
      ctx.fillRect(0, y - size, w, size * 2.6);
    }
  }

  private drawRingBack(ctx: Ctx, a: ArenaDef, w: number): void {
    const cx = w / 2;
    const half = RING.postHalf;

    // Apron skirt below the far ropes.
    ctx.fillStyle = shade(a.mat, 0.45);
    ctx.fillRect(cx - half - 40, RING.horizon + 88, (half + 40) * 2, 46);
    ctx.fillStyle = rgba('#000000', 0.3);
    ctx.fillRect(cx - half - 40, RING.horizon + 124, (half + 40) * 2, 12);

    // Ropes.
    for (let i = 0; i < 3; i++) {
      const y = RING.horizon - 62 + i * 56;
      const sag = 12 + i * 3;
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.quadraticCurveTo(cx, y + sag, cx + half, y);
      ctx.strokeStyle = a.ropes[i];
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Highlight + contour.
      ctx.beginPath();
      ctx.moveTo(cx - half, y - 3);
      ctx.quadraticCurveTo(cx, y + sag - 3, cx + half, y - 3);
      ctx.strokeStyle = rgba('#ffffff', 0.28);
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    // Corner posts.
    for (const s of [-1, 1]) {
      const px = cx + s * half;
      const g = ctx.createLinearGradient(px - 24, 0, px + 24, 0);
      g.addColorStop(0, shade(a.post, 0.55));
      g.addColorStop(0.4, tint(a.post, 0.25));
      g.addColorStop(1, shade(a.post, 0.4));
      ctx.fillStyle = g;
      roundRect(ctx, px - 22, RING.postTop, 44, RING.postBottom - RING.postTop + 120, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,8,14,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Padded cap.
      ctx.beginPath();
      ctx.ellipse(px, RING.postTop, 27, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = tint(a.post, 0.4);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawMat(ctx: Ctx, a: ArenaDef, w: number): void {
    const cx = w / 2;
    // Perspective trapezoid.
    ctx.beginPath();
    ctx.moveTo(cx - RING.matFarHalf, RING.matFar);
    ctx.lineTo(cx + RING.matFarHalf, RING.matFar);
    ctx.lineTo(cx + RING.matNearHalf, RING.matNear + 40);
    ctx.lineTo(cx - RING.matNearHalf, RING.matNear + 40);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, RING.matFar, 0, RING.matNear);
    g.addColorStop(0, shade(a.mat, 0.62));
    g.addColorStop(0.4, a.mat);
    g.addColorStop(1, shade(a.mat, 0.78));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.clip();

    // Converging floor lines sell the perspective without a 3D projection.
    ctx.strokeStyle = rgba(a.matAccent, 0.3);
    ctx.lineWidth = 2.5;
    for (let i = -6; i <= 6; i++) {
      const fx = cx + (i / 6) * RING.matFarHalf;
      const nx = cx + (i / 6) * RING.matNearHalf;
      ctx.beginPath();
      ctx.moveTo(fx, RING.matFar);
      ctx.lineTo(nx, RING.matNear + 40);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const t = Math.pow(i / 5, 1.7);
      const y = RING.matFar + t * (RING.matNear + 40 - RING.matFar);
      ctx.beginPath();
      ctx.moveTo(cx - (RING.matFarHalf + t * (RING.matNearHalf - RING.matFarHalf)), y);
      ctx.lineTo(cx + (RING.matFarHalf + t * (RING.matNearHalf - RING.matFarHalf)), y);
      ctx.stroke();
    }

    // Centre logo — an original mark, not a licensed one.
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.translate(cx, RING.opponentFeet + 120);
    ctx.scale(1, 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, 190, 0, Math.PI * 2);
    ctx.strokeStyle = a.matAccent;
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 148, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.font = 'bold 120px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = a.matAccent;
    ctx.fillText('GJ', 0, 6);
    ctx.restore();

    ctx.restore();

    // Mat edge highlight.
    ctx.beginPath();
    ctx.moveTo(cx - RING.matFarHalf, RING.matFar);
    ctx.lineTo(cx + RING.matFarHalf, RING.matFar);
    ctx.strokeStyle = rgba('#ffffff', 0.22);
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // -- Per-frame -------------------------------------------------------------

  /** Draws the arena behind the fighters. */
  drawBack(ctx: Ctx, arena: ArenaDef, time: number, excitement: number): void {
    const r = this.renderer;
    const key = `${arena.id}:${r.dw}:${r.dh}:${r.qualityName}`;
    if (!this.cache || this.cacheKey !== key) this.buildCache(arena);
    const cache = this.cache!;

    // Cheer wave: six horizontal slices of the cached crowd, each bobbing.
    const crowdTop = 100;
    const crowdBottom = RING.horizon - 40;
    const slices = 6;
    const amp = 4 + excitement * 11;
    ctx.drawImage(cache, 0, 0, r.dw, crowdTop, 0, 0, r.dw, crowdTop);
    for (let i = 0; i < slices; i++) {
      const sx = (i / slices) * r.dw;
      const sw = r.dw / slices + 1;
      const off = Math.sin(time * 4.4 + i * 0.9) * amp;
      ctx.drawImage(
        cache, sx, crowdTop, sw, crowdBottom - crowdTop,
        sx, crowdTop + off, sw, crowdBottom - crowdTop,
      );
    }
    ctx.drawImage(
      cache, 0, crowdBottom, r.dw, r.dh - crowdBottom,
      0, crowdBottom, r.dw, r.dh - crowdBottom,
    );

    this.updateFlashes(ctx, arena, time, excitement);
    if (r.quality.atmosphere) this.drawLightCones(ctx, arena, time);
  }

  private updateFlashes(ctx: Ctx, a: ArenaDef, time: number, excitement: number): void {
    const rate = a.flashRate * (0.5 + excitement * 2.2);
    this.flashTimer += 1 / 60;
    if (rate > 0 && this.flashTimer > 1 / rate) {
      this.flashTimer = 0;
      this.flashes.push({
        x: this.rng.range(0, this.renderer.dw),
        y: this.rng.range(130, RING.horizon - 30),
        t: 1,
      });
      if (this.flashes.length > 26) this.flashes.shift();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= 0.075;
      if (f.t <= 0) { this.flashes.splice(i, 1); continue; }
      const rr = 46 * f.t;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
      g.addColorStop(0, `rgba(255,255,250,${0.85 * f.t})`);
      g.addColorStop(1, 'rgba(255,255,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    void time;
  }

  private drawLightCones(ctx: Ctx, a: ArenaDef, time: number): void {
    const w = this.renderer.dw;
    const cx = w / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = -1; i <= 1; i++) {
      const lx = cx + i * w * 0.22;
      const flicker = 0.9 + Math.sin(time * 7 + i * 2) * 0.05;
      const g = ctx.createLinearGradient(lx, 40, lx, RING.matNear);
      g.addColorStop(0, rgba(a.light, 0.16 * flicker));
      g.addColorStop(0.6, rgba(a.light, 0.05 * flicker));
      g.addColorStop(1, rgba(a.light, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(lx - 40, 40);
      ctx.lineTo(lx + 40, 40);
      ctx.lineTo(lx + 420, RING.matNear);
      ctx.lineTo(lx - 420, RING.matNear);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Foreground framing drawn after the fighters. */
  drawFront(ctx: Ctx, a: ArenaDef, dw: number, dh: number): void {
    const cx = dw / 2;
    // Near ropes, kept in the corners so they frame without ever occluding.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const y0 = dh - 240 + i * 92;
        ctx.beginPath();
        ctx.moveTo(cx + s * dw * 0.5, y0 - 150);
        ctx.quadraticCurveTo(cx + s * dw * 0.34, y0, cx + s * dw * 0.2, y0 + 120);
        ctx.strokeStyle = rgba(a.ropes[i], 0.85);
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', 0.16);
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }

    // Vignette — focuses the eye on the opponent.
    const vg = ctx.createRadialGradient(cx, dh * 0.44, dh * 0.28, cx, dh * 0.46, dh * 0.92);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, dw, dh);
  }

  /** Key light pooled on the canvas beneath the fighters. */
  drawSpotlight(ctx: Ctx, a: ArenaDef, dw: number, intensity: number): void {
    const cx = dw / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, RING.opponentFeet - 40, 20, cx, RING.opponentFeet + 40, 620);
    g.addColorStop(0, rgba(a.light, 0.1 * intensity));
    g.addColorStop(1, rgba(a.light, 0));
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, RING.opponentFeet);
    ctx.scale(1.4, 0.55);
    ctx.translate(-cx, -RING.opponentFeet);
    ctx.beginPath();
    ctx.arc(cx, RING.opponentFeet, 620, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
}

export { clamp01 };
