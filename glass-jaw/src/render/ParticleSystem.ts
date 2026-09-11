import { RNG } from '../core/RNG';
import { clamp01 } from '../core/MathUtil';
import type { Ctx } from './draw';
import { rgba, starPath } from './draw';

export type ParticleKind = 'spark' | 'dust' | 'shard' | 'star' | 'ring' | 'sweat' | 'ember';

interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  rot: number; spin: number;
  gravity: number;
  drag: number;
  color: string;
  additive: boolean;
}

/**
 * Fixed-capacity, pooled particle system. Zero allocation after construction,
 * which matters: impacts spawn dozens of particles at once and a garbage pause
 * during a counter window would be felt immediately.
 */
export class ParticleSystem {
  private pool: Particle[] = [];
  private cursor = 0;
  private rng = new RNG(0x5eed);
  /** Scales every spawn count — driven by the graphics quality setting. */
  budget = 1;

  constructor(capacity = 900) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        active: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 1, rot: 0, spin: 0,
        gravity: 0, drag: 0.98, color: '#fff', additive: true,
      });
    }
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }

  private take(): Particle {
    // Ring-buffer allocation: the oldest particle is recycled under pressure.
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[(this.cursor + i) % this.pool.length];
      if (!p.active) {
        this.cursor = (this.cursor + i + 1) % this.pool.length;
        return p;
      }
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return p;
  }

  spawn(
    kind: ParticleKind, x: number, y: number, count: number,
    opts: {
      speed?: [number, number];
      angle?: [number, number];
      life?: [number, number];
      size?: [number, number];
      gravity?: number;
      drag?: number;
      color: string | string[];
      additive?: boolean;
      spin?: number;
    },
  ): void {
    const n = Math.max(1, Math.round(count * this.budget));
    const [s0, s1] = opts.speed ?? [100, 400];
    const [a0, a1] = opts.angle ?? [0, Math.PI * 2];
    const [l0, l1] = opts.life ?? [0.25, 0.6];
    const [z0, z1] = opts.size ?? [3, 9];
    const colors = Array.isArray(opts.color) ? opts.color : [opts.color];

    for (let i = 0; i < n; i++) {
      const p = this.take();
      const a = this.rng.range(a0, a1);
      const sp = this.rng.range(s0, s1);
      p.active = true;
      p.kind = kind;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = this.rng.range(l0, l1);
      p.life = p.maxLife;
      p.size = this.rng.range(z0, z1);
      p.rot = this.rng.range(0, Math.PI * 2);
      p.spin = this.rng.range(-1, 1) * (opts.spin ?? 8);
      p.gravity = opts.gravity ?? 0;
      p.drag = opts.drag ?? 0.94;
      p.color = colors[Math.floor(this.rng.next() * colors.length)];
      p.additive = opts.additive ?? true;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  draw(ctx: Ctx): void {
    // Two passes so additive particles composite correctly without per-particle
    // state thrash on the context.
    for (const additive of [false, true]) {
      let opened = false;
      for (const p of this.pool) {
        if (!p.active || p.additive !== additive) continue;
        if (!opened) {
          ctx.save();
          if (additive) ctx.globalCompositeOperation = 'lighter';
          opened = true;
        }
        const t = clamp01(p.life / p.maxLife);
        ctx.globalAlpha = t;
        this.drawOne(ctx, p, t);
      }
      if (opened) ctx.restore();
    }
  }

  private drawOne(ctx: Ctx, p: Particle, t: number): void {
    switch (p.kind) {
      case 'spark': {
        // Stretched along its velocity — reads as a streak, not a dot.
        const sp = Math.hypot(p.vx, p.vy);
        const len = Math.min(34, sp * 0.03);
        const a = Math.atan2(p.vy, p.vx);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * t;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
        ctx.stroke();
        break;
      }
      case 'star':
        ctx.fillStyle = p.color;
        starPath(ctx, p.x, p.y, p.size * (0.5 + t), p.size * 0.42 * (0.5 + t), 5, p.rot);
        ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * t * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2.4 - t * 1.8), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'shard':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.5, p.size * 0.7);
        ctx.lineTo(-p.size * 0.5, p.size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      case 'sweat':
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.5, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'ember':
      case 'dust':
      default: {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        g.addColorStop(0, rgba(p.color, 0.85));
        g.addColorStop(1, rgba(p.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }
}
