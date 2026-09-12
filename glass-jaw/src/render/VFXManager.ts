import { ParticleSystem } from './ParticleSystem';
import { clamp01, Ease, lerp } from '../core/MathUtil';
import { Ctx, rgba, speedLines, starPath } from './draw';

export interface FloatingText {
  text: string;
  x: number; y: number;
  vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  outline: string;
  /** 0 = pop in, 1 = drift. */
  style: 'pop' | 'slam' | 'drift';
}

interface ImpactBurst {
  x: number; y: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  rings: number;
  lines: number;
  rot: number;
}

interface ScreenFlash {
  life: number; maxLife: number;
  color: string;
  strength: number;
}

interface ShockRing {
  x: number; y: number;
  life: number; maxLife: number;
  radius: number;
  color: string;
  width: number;
}

/**
 * Arcade impact language: sparks, bursts, speed lines, shock rings, screen
 * flashes and big readable callout text.
 *
 * Everything here can be dialled down or switched off via `intensity`, which
 * the accessibility settings drive — the gameplay never depends on an effect.
 */
export class VFXManager {
  readonly particles = new ParticleSystem(900);
  private texts: FloatingText[] = [];
  private bursts: ImpactBurst[] = [];
  private flashes: ScreenFlash[] = [];
  private rings: ShockRing[] = [];

  /** 0..1 master scale for screen effects (accessibility). */
  intensity = 1;
  /** Separate scale for full-screen flashes, which some players find harsh. */
  flashIntensity = 1;
  /** Speed lines drawn around the frame during big moments. */
  private speedLineTimer = 0;
  private speedLineColor = '#ffffff';

  clear(): void {
    this.particles.clear();
    this.texts.length = 0;
    this.bursts.length = 0;
    this.flashes.length = 0;
    this.rings.length = 0;
    this.speedLineTimer = 0;
  }

  // -- Spawners --------------------------------------------------------------

  /** The standard "punch landed" package, scaled by severity. */
  impact(x: number, y: number, intensity: number, color = '#ffe9a8', heavy = false): void {
    const n = 8 + intensity * 22;
    this.particles.spawn('spark', x, y, n, {
      speed: [200, 200 + intensity * 900],
      life: [0.14, 0.3 + intensity * 0.25],
      size: [2.5, 5 + intensity * 5],
      color: [color, '#ffffff', '#ffd166'],
      drag: 0.9,
    });
    this.bursts.push({
      x, y, life: 0.22 + intensity * 0.14, maxLife: 0.22 + intensity * 0.14,
      size: 40 + intensity * 120, color, rings: heavy ? 2 : 1,
      lines: Math.round(6 + intensity * 8), rot: Math.random() * Math.PI,
    });
    if (heavy) {
      this.particles.spawn('shard', x, y, 5 + intensity * 8, {
        speed: [150, 620], life: [0.3, 0.65], size: [4, 11],
        color: [color, '#ffffff'], gravity: 900, drag: 0.96, additive: false,
      });
    }
  }

  /** Absorbed by the guard: duller, tighter, no screen flash. */
  block(x: number, y: number, correct: boolean): void {
    this.particles.spawn('spark', x, y, correct ? 6 : 11, {
      speed: [120, 420], life: [0.12, 0.26], size: [2, 5],
      color: correct ? ['#9fd4ff', '#ffffff'] : ['#ffb347', '#ffffff'],
      drag: 0.88,
    });
    this.rings.push({ x, y, life: 0.2, maxLife: 0.2, radius: 26, color: correct ? '#9fd4ff' : '#ffb347', width: 6 });
  }

  /** A slip: a whoosh of motion streaks trailing the dodge. */
  dodge(x: number, y: number, dir: number, perfect: boolean): void {
    const color = perfect ? '#7ef9a2' : '#cfd8e8';
    this.particles.spawn('dust', x, y, perfect ? 14 : 7, {
      speed: [80, 320],
      angle: dir > 0 ? [-0.5, 0.5] : [Math.PI - 0.5, Math.PI + 0.5],
      life: [0.2, 0.45], size: [5, 14], color, drag: 0.9, additive: true,
    });
    if (perfect) {
      this.rings.push({ x, y, life: 0.38, maxLife: 0.38, radius: 40, color, width: 9 });
      this.speedLineTimer = 0.4;
      this.speedLineColor = color;
    }
  }

  parry(x: number, y: number): void {
    this.particles.spawn('spark', x, y, 20, {
      speed: [260, 780], life: [0.18, 0.42], size: [3, 8],
      color: ['#ffe066', '#ffffff', '#ffd166'], drag: 0.9,
    });
    this.rings.push({ x, y, life: 0.34, maxLife: 0.34, radius: 44, color: '#ffe066', width: 11 });
    this.flash('#fff6c2', 0.28, 0.14);
  }

  /** Awarded a token: stars spiral off toward the HUD. */
  token(x: number, y: number, color = '#ffd166'): void {
    this.particles.spawn('star', x, y, 12, {
      speed: [140, 520], life: [0.4, 0.85], size: [7, 16],
      color: [color, '#ffffff'], gravity: -140, drag: 0.93, spin: 10,
    });
    this.rings.push({ x, y, life: 0.45, maxLife: 0.45, radius: 50, color, width: 8 });
  }

  knockdown(x: number, y: number): void {
    this.particles.spawn('spark', x, y, 40, {
      speed: [300, 1300], life: [0.3, 0.8], size: [4, 12],
      color: ['#ffffff', '#ffd166', '#ff6b35'], drag: 0.93,
    });
    this.particles.spawn('dust', x, y + 40, 24, {
      speed: [180, 700], angle: [Math.PI * 0.1, Math.PI * 0.9],
      life: [0.5, 1.2], size: [14, 40], color: ['#d8cdb8', '#ffffff'],
      drag: 0.9, additive: false,
    });
    this.rings.push({ x, y, life: 0.6, maxLife: 0.6, radius: 110, color: '#ffffff', width: 16 });
    this.flash('#ffffff', 0.55, 0.2);
    this.speedLineTimer = 0.75;
    this.speedLineColor = '#ffd166';
  }

  stun(x: number, y: number): void {
    this.particles.spawn('star', x, y, 16, {
      speed: [90, 300], life: [0.7, 1.3], size: [9, 18],
      color: ['#ffe066', '#ffffff'], gravity: -60, drag: 0.96, spin: 6,
    });
  }

  sweat(x: number, y: number, count = 3): void {
    this.particles.spawn('sweat', x, y, count, {
      speed: [80, 260], angle: [-Math.PI, 0], life: [0.35, 0.7],
      size: [3, 6], color: '#bfe6ff', gravity: 900, drag: 0.99, additive: false,
    });
  }

  /** Big readable callout — the game's voice for "you did the thing". */
  callout(text: string, x: number, y: number, color: string, size = 92, style: FloatingText['style'] = 'slam'): void {
    if (style === 'slam') {
      // One big callout at a time. Two of these landing together — a perfect
      // dodge and the counter it opened — used to print on top of each other
      // and neither could be read. The newest event is the one that matters.
      for (const t of this.texts) {
        if (t.style === 'slam') t.life = Math.min(t.life, 0.1);
      }
    }
    this.texts.push({
      text, x, y, vy: style === 'drift' ? -60 : -18,
      life: style === 'drift' ? 0.9 : 1.15,
      maxLife: style === 'drift' ? 0.9 : 1.15,
      size, color, outline: '#1a1020', style,
    });
  }

  damageNumber(value: number, x: number, y: number, color: string): void {
    this.texts.push({
      text: String(Math.round(value)), x: x + (Math.random() - 0.5) * 90, y, vy: -120,
      life: 0.7, maxLife: 0.7, size: 46, color, outline: '#1a1020', style: 'drift',
    });
  }

  /**
   * A screen flash.
   *
   * Hard-capped in both length and strength on purpose. A quarter-second
   * additive wash over the whole frame is what made hits look like lens bloom
   * instead of impact; an arcade hit flash is two or three frames and gone.
   */
  flash(color: string, strength: number, seconds: number): void {
    this.flashes.push({
      life: Math.min(seconds, 0.11), maxLife: Math.min(seconds, 0.11),
      color, strength: Math.min(strength, 0.3),
    });
  }

  shockRing(x: number, y: number, color: string, radius = 90): void {
    this.rings.push({ x, y, life: 0.45, maxLife: 0.45, radius, color, width: 12 });
  }

  // -- Lifecycle -------------------------------------------------------------

  /** Runs on UNSCALED time so effects keep animating during hit-stop. */
  update(dt: number): void {
    this.particles.update(dt);

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.9, dt * 60);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].life -= dt;
      if (this.bursts[i].life <= 0) this.bursts.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    this.speedLineTimer = Math.max(0, this.speedLineTimer - dt);
  }

  // -- Drawing ---------------------------------------------------------------

  /** World-space effects, drawn between the fighters and the HUD. */
  drawWorld(ctx: Ctx): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bursts) {
      const t = clamp01(b.life / b.maxLife);
      const grow = Ease.quartOut(1 - t);
      ctx.globalAlpha = t * this.intensity;
      // Core flash.
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.size * (0.4 + grow));
      g.addColorStop(0, rgba('#ffffff', 0.95));
      g.addColorStop(0.35, rgba(b.color, 0.7));
      g.addColorStop(1, rgba(b.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * (0.4 + grow), 0, Math.PI * 2);
      ctx.fill();
      // Radiating impact lines.
      speedLines(ctx, b.x, b.y, b.size * (0.3 + grow * 0.7), b.size * (0.8 + grow * 1.5),
        b.lines, rgba('#ffffff', 0.8 * t), 4 * t, b.rot);
      // A four-pointed star flare on the heaviest hits.
      if (b.rings > 1) {
        ctx.fillStyle = rgba('#ffffff', 0.8 * t);
        starPath(ctx, b.x, b.y, b.size * (1 + grow), b.size * 0.12, 4, b.rot * 0.4);
        ctx.fill();
      }
    }
    for (const r of this.rings) {
      const t = clamp01(r.life / r.maxLife);
      ctx.globalAlpha = t * this.intensity;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * t;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (1.35 - t * 1.0), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    this.particles.draw(ctx);
  }

  /** Screen-space effects: callouts, flashes, frame speed lines. */
  drawScreen(ctx: Ctx, dw: number, dh: number): void {
    if (this.speedLineTimer > 0 && this.intensity > 0.05) {
      const t = clamp01(this.speedLineTimer / 0.75);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t * 0.45 * this.intensity;
      const cx = dw / 2, cy = dh / 2;
      speedLines(ctx, cx, cy, dh * 0.42, dh * 1.1, 42, this.speedLineColor, 5, t * 3);
      ctx.restore();
    }

    for (const t of this.texts) {
      const k = clamp01(t.life / t.maxLife);
      let scale = 1;
      let alpha = 1;
      if (t.style === 'slam') {
        // Overshoot in, hold, fade out. Reads instantly at a glance.
        const age = 1 - k;
        scale = age < 0.12 ? lerp(2.1, 1, Ease.quartOut(age / 0.12)) : 1 + Math.sin(age * 18) * 0.012;
        alpha = k < 0.25 ? k / 0.25 : 1;
      } else if (t.style === 'pop') {
        scale = Ease.backOut(clamp01((1 - k) / 0.2));
        alpha = k;
      } else {
        alpha = k;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(t.x, t.y);
      ctx.scale(scale, scale);
      ctx.font = `900 ${t.size}px Impact, "Arial Black", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = t.outline;
      ctx.lineWidth = t.size * 0.17;
      ctx.strokeText(t.text, 0, 0);
      const g = ctx.createLinearGradient(0, -t.size * 0.5, 0, t.size * 0.5);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, t.color);
      g.addColorStop(1, t.color);
      ctx.fillStyle = g;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }

    for (const f of this.flashes) {
      // Stepped, not faded: the flash holds for a couple of frames, drops
      // once, and goes. A smooth ramp reads as a glow.
      const t = clamp01(f.life / f.maxLife);
      const step = t > 0.62 ? 1 : t > 0.28 ? 0.4 : 0;
      const a = step * f.strength * this.flashIntensity * this.intensity;
      if (a <= 0.002) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(f.color, a);
      ctx.fillRect(0, 0, dw, dh);
      ctx.restore();
    }
  }
}
