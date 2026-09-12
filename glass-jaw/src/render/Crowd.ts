import { RNG } from '../core/RNG';
import { clamp01 } from '../core/MathUtil';
import { Ctx, darken, INK } from './Cel';

export type CrowdMood = 'idle' | 'interested' | 'excited' | 'roaring';

/** One spectator. Kept as plain numbers so the whole crowd is one flat array. */
interface Fan {
  x: number;
  y: number;
  /** 0 = furthest row. Drives size and darkness. */
  row: number;
  /** 0 = back of the hall, 1 = ringside. */
  depth: number;
  scale: number;
  /** Behaviour variant, so the crowd is not one animation repeated. */
  variant: number;
  /** Per-fan phase offset, so nothing is in lockstep. */
  phase: number;
  /** Individual tempo multiplier. */
  rate: number;
  body: string;
  skin: string;
  /** 0..1 how far this fan is out of their seat right now. */
  rise: number;
  /** Target rise, set by crowd events. */
  target: number;
  /** Holds a sign. */
  sign: boolean;
  signColor: string;
}

const BODY_COLOURS = [
  '#2a2540', '#33283f', '#25304a', '#3a2a34', '#2c3340', '#443048',
  '#1f2a3c', '#382f2a', '#2d2438', '#34384a',
];
const SKIN_COLOURS = ['#d9a877', '#b67f52', '#8a5a38', '#e8c49f', '#6b4227', '#f0cfae'];
const SIGN_COLOURS = ['#ffd166', '#ff6b6b', '#7ef9a2', '#8ecae6', '#ffffff'];

/**
 * The audience.
 *
 * This is deliberately not a static backdrop. Every spectator is an individual
 * with their own size, colour, behaviour variant, phase and tempo, and the
 * whole crowd responds to gameplay events — a clean counter lifts part of the
 * room, a knockdown lifts all of it. A crowd that animates in lockstep, or
 * doesn't react at all, is what makes an arcade ring feel dead.
 *
 * Drawn live rather than baked, because reacting to events is the entire point.
 * Each fan is three or four flat shapes, so a few hundred of them cost little.
 */
export class Crowd {
  private fans: Fan[] = [];
  private mood: CrowdMood = 'idle';
  /** 0..1, decays. Drives how animated the room is. */
  private energy = 0.2;
  /** Short-lived spike from a single event. */
  private surge = 0;
  private rng = new RNG(0xc0ffee);

  /**
   * Builds the crowd for a given frame width.
   *
   * `rows` and `density` come from the graphics quality setting; the layout is
   * deterministic for a given seed so the audience does not reshuffle on a
   * resize.
   */
  build(width: number, top: number, bottom: number, rows: number, density: number, seed = 0xc0ffee): void {
    this.rng.reseed(seed);
    this.fans = [];
    for (let row = 0; row < rows; row++) {
      const t = rows <= 1 ? 0 : row / (rows - 1);
      const y = top + t * (bottom - top);
      // Nearer rows are larger; the spacing follows, so rows overlap the way
      // real tiered seating does — heads in front of the shoulders behind.
      const scale = 1.35 + t * 2.5;
      const step = 26 * scale;
      const count = Math.ceil((width / step) * density) + 2;
      for (let i = 0; i < count; i++) {
        const jitter = (this.rng.next() - 0.5) * step * 0.55;
        this.fans.push({
          x: (i / count) * (width + step * 2) - step + jitter,
          y: y + (this.rng.next() - 0.5) * 6 * scale,
          row,
          scale: scale * (0.86 + this.rng.next() * 0.3),
          depth: t,
          variant: this.rng.int(0, 5),
          phase: this.rng.range(0, Math.PI * 2),
          rate: 0.75 + this.rng.next() * 0.7,
          body: BODY_COLOURS[this.rng.int(0, BODY_COLOURS.length - 1)],
          skin: SKIN_COLOURS[this.rng.int(0, SKIN_COLOURS.length - 1)],
          rise: 0,
          target: 0,
          sign: t > 0.45 && this.rng.chance(0.05),
          signColor: SIGN_COLOURS[this.rng.int(0, SIGN_COLOURS.length - 1)],
        });
      }
    }
  }

  get population(): number { return this.fans.length; }

  setMood(m: CrowdMood): void { this.mood = m; }

  /**
   * A gameplay event. `strength` 0..1 decides how much of the room gets out of
   * its seat, so a jab and a knockdown do not look the same.
   */
  react(strength: number): void {
    this.surge = Math.max(this.surge, clamp01(strength));
    this.energy = clamp01(this.energy + strength * 0.45);
    // Lift a fraction of the crowd, chosen at random, for a ragged human wave
    // rather than a single synchronised jump.
    const share = 0.12 + strength * 0.8;
    for (const f of this.fans) {
      if (this.rng.next() < share) f.target = Math.min(1, f.target + 0.5 + strength * 0.6);
    }
  }

  /** Everyone up, for a knockout or the final bell. */
  standingOvation(): void {
    this.surge = 1;
    this.energy = 1;
    for (const f of this.fans) f.target = 1;
  }

  update(dt: number): void {
    const base = this.mood === 'roaring' ? 0.75
      : this.mood === 'excited' ? 0.45
      : this.mood === 'interested' ? 0.25 : 0.12;
    this.energy += (base - this.energy) * dt * 0.55;
    this.surge = Math.max(0, this.surge - dt * 1.3);

    for (const f of this.fans) {
      // Sitting back down is slower than jumping up, which reads as a crowd
      // settling rather than a switch flipping.
      const speed = f.target > f.rise ? 9 : 2.2;
      f.rise += (f.target - f.rise) * Math.min(1, dt * speed);
      f.target *= Math.pow(0.22, dt);
    }
  }

  draw(ctx: Ctx, time: number, detail: boolean): void {
    const energy = this.energy;
    ctx.save();
    ctx.lineWidth = 1.2;

    for (const f of this.fans) {
      const s = f.scale;
      const beat = time * f.rate * 2.4 + f.phase;
      let bob = 0;
      let armL = 0, armR = 0;

      // Behaviour variants. Nobody shares an animation with their neighbour.
      switch (f.variant) {
        case 0: // seated, small bob
          bob = Math.sin(beat) * 1.2 * s;
          break;
        case 1: // clapping
          bob = Math.sin(beat * 1.6) * 1.6 * s;
          armL = armR = 0.35 + Math.abs(Math.sin(beat * 3.2)) * 0.4;
          break;
        case 2: // one arm waving
          bob = Math.sin(beat * 0.9) * 1.4 * s;
          armL = 0.75 + Math.sin(beat * 2.6) * 0.25;
          break;
        case 3: // both arms up when the room is loud
          bob = Math.sin(beat * 1.2) * 2 * s;
          armL = armR = 0.3 + energy * 0.85;
          break;
        case 4: // bouncing
          bob = Math.abs(Math.sin(beat * 1.8)) * 3.5 * s * (0.4 + energy);
          break;
        default: // leaning, occasional shout
          bob = Math.sin(beat * 0.7) * 1.1 * s;
          armR = Math.max(0, Math.sin(beat * 1.3)) * 0.5;
          break;
      }

      const rise = f.rise;
      const y = f.y - bob - rise * 16 * s;
      const x = f.x;
      // Excitement raises everyone's arms a little, on top of their variant.
      const lift = Math.max(armL, energy * 0.5 + rise * 0.7);
      const liftR = Math.max(armR, energy * 0.45 + rise * 0.7);

      // Back of the hall sinks toward black; ringside stays a readable
      // silhouette. Either way nobody is brighter than the ring.
      const body = darken(f.body, 0.42 + f.depth * 0.62);
      const dark = 0.5 + f.depth * 0.5;

      // Torso: a flat rounded blob.
      ctx.beginPath();
      ctx.moveTo(x - 7 * s, y + 17 * s);
      ctx.quadraticCurveTo(x - 8 * s, y + 2 * s, x, y + 1 * s);
      ctx.quadraticCurveTo(x + 8 * s, y + 2 * s, x + 7 * s, y + 17 * s);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();

      // Head.
      ctx.beginPath();
      ctx.arc(x, y - 4.5 * s, 4.4 * s, 0, Math.PI * 2);
      ctx.fillStyle = detail ? darken(f.skin, dark * 0.58) : body;
      ctx.fill();

      // Arms, only where they are actually raised — keeps the cost down.
      if (lift > 0.12 || liftR > 0.12) {
        ctx.strokeStyle = body;
        ctx.lineWidth = 2.4 * s;
        ctx.lineCap = 'round';
        if (lift > 0.12) {
          ctx.beginPath();
          ctx.moveTo(x - 5.5 * s, y + 6 * s);
          ctx.lineTo(x - 7 * s - lift * 2 * s, y + 6 * s - lift * 13 * s);
          ctx.stroke();
        }
        if (liftR > 0.12) {
          ctx.beginPath();
          ctx.moveTo(x + 5.5 * s, y + 6 * s);
          ctx.lineTo(x + 7 * s + liftR * 2 * s, y + 6 * s - liftR * 13 * s);
          ctx.stroke();
        }
      }

      if (f.sign && detail) {
        ctx.save();
        ctx.translate(x + 8 * s, y - 12 * s - rise * 6 * s);
        ctx.rotate(Math.sin(beat * 1.1) * 0.22);
        ctx.fillStyle = f.signColor;
        ctx.fillRect(-5 * s, -7 * s, 10 * s, 9 * s);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1 * s;
        ctx.strokeRect(-5 * s, -7 * s, 10 * s, 9 * s);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /** Camera flashes from the press rows, tied to how loud the room is. */
  get flashChance(): number { return 0.2 + this.energy * 1.4 + this.surge * 4; }
  get level(): number { return this.energy; }
}
