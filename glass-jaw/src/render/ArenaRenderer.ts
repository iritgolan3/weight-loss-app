import type { ArenaDef } from '../data/arenas';
import { RNG } from '../core/RNG';
import { clamp01, lerp } from '../core/MathUtil';
import { Ctx, darken, ink, INK, lighten, oval } from './Cel';
import type { Renderer } from './Renderer';
import { Crowd, type CrowdMood } from './Crowd';

/** The ring composition is authored for a fixed 1080-tall band. */
export const RING_BAND_H = 1080;

/**
 * Fixed layout landmarks, in design space.
 *
 * These numbers ARE the camera. There is no free camera in this game: the
 * composition is locked to the classic arcade framing — the opponent large and
 * centred with the ropes crossing his shoulders, the player small, low and
 * seen from behind, overlapping the opponent's shins. The player is rendered
 * SMALLER than the opponent on purpose. He is not further away; he is the
 * underdog, and the framing says so before a punch is thrown.
 */
export const RING = {
  /** Height of the overlaid HUD strips. The ring is composed behind them. */
  hudTop: 150,
  hudBottom: 930,

  /** The audience fills everything behind and between the far ropes. */
  crowdTop: 24,
  crowdBottom: 566,

  /**
   * The three far ropes. The top one deliberately crosses the opponent at the
   * shoulder line: his head and shoulders read against the crowd, his body
   * against the ring. That single relationship is most of the classic framing.
   */
  ropeY: [386, 470, 554] as const,
  postHalf: 786,
  postTop: 300,
  postBottom: 606,

  /**
   * Mat trapezoid. The camera is low and close, so very little floor is
   * visible — a deep floor is what makes a boxing screen look like a diorama.
   */
  matFar: 600,
  matFarHalf: 740,
  matNear: 1080,
  matNearHalf: 2040,

  /**
   * Where each fighter stands. The player's feet are BELOW the frame: he is
   * seen from the chest up, from behind, and his head sits across the
   * opponent's shins. Nothing else places the camera as clearly as that
   * overlap does.
   */
  opponentFeet: 812,
  playerFeet: 1275,

  /** Referee's resting position, as an offset from centre. */
  refX: 640,
  refY: 764,
} as const;

/** Per-unit scale for each fighter. The player is deliberately the smaller. */
export const OPPONENT_UNIT = 200;
export const PLAYER_UNIT = 186;

/**
 * Draws the arena as flat cel artwork.
 *
 * The static parts (backdrop, ropes, posts, mat) are baked once into an
 * offscreen canvas; only the crowd, the lights and the referee are live, since
 * those are the parts that have to react to the fight.
 */
export class ArenaRenderer {
  readonly crowd = new Crowd();
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';
  private flashes: { x: number; y: number; t: number }[] = [];
  private flashTimer = 0;
  private rng = new RNG(0xa11ce);

  constructor(private readonly renderer: Renderer) {}

  invalidate(): void { this.cache = null; }

  // -- Static bake -----------------------------------------------------------

  private buildCache(a: ArenaDef): void {
    const r = this.renderer;
    const c = document.createElement('canvas');
    c.width = r.dw;
    c.height = RING_BAND_H;
    const ctx = c.getContext('2d')!;
    const cx = r.dw / 2;

    // NOTE: this canvas stays TRANSPARENT where there is no ring furniture.
    // It is composited over the live crowd, so painting a backdrop here would
    // simply erase the audience — which is exactly what it used to do.
    this.drawRig(ctx, a, r.dw);
    this.drawMat(ctx, a, cx);
    this.drawRopesAndPosts(ctx, a, cx);

    this.cache = c;
    this.cacheKey = `${a.id}:${r.dw}:${r.qualityName}`;

    this.crowd.build(
      r.dw, RING.crowdTop, RING.crowdBottom,
      r.quality.crowdRows, a.density, 0xc0ffee ^ Math.round(r.dw),
    );
  }

  /** Overhead light rig: flat trapezoids, no bloom. */
  private drawRig(ctx: Ctx, a: ArenaDef, w: number): void {
    const cx = w / 2;
    for (let i = -3; i <= 3; i++) {
      const lx = cx + i * w * 0.155;
      ctx.beginPath();
      ctx.moveTo(lx - 40, 0);
      ctx.lineTo(lx + 40, 0);
      ctx.lineTo(lx + 26, 42);
      ctx.lineTo(lx - 26, 42);
      ctx.closePath();
      ink(ctx, '#20202c', 3);
      ctx.beginPath();
      ctx.ellipse(lx, 42, 26, 9, 0, 0, Math.PI * 2);
      ink(ctx, a.light, 3);
    }
  }

  private drawMat(ctx: Ctx, a: ArenaDef, cx: number): void {
    // Perspective trapezoid, flat filled.
    ctx.beginPath();
    ctx.moveTo(cx - RING.matFarHalf, RING.matFar);
    ctx.lineTo(cx + RING.matFarHalf, RING.matFar);
    ctx.lineTo(cx + RING.matNearHalf, RING.matNear + 40);
    ctx.lineTo(cx - RING.matNearHalf, RING.matNear + 40);
    ctx.closePath();
    ctx.fillStyle = a.mat;
    ctx.fill();

    ctx.save();
    ctx.clip();

    // Focused ring lighting, done flat: a bright pool where the opponent
    // stands, the mat itself a step down, and the near foreground a step down
    // again. Three hard values, no gradient — that is what a lit ring looks
    // like in this style, and it puts the eye exactly where the fight is.
    ctx.fillStyle = lighten(a.mat, 0.13);
    ctx.beginPath();
    ctx.ellipse(cx, RING.opponentFeet - 30, 430, 96, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = darken(a.mat, 0.66);
    ctx.fillRect(0, RING.matFar + 286, this.renderer.dw, RING.matNear);

    // Perspective lines: few, flat, deliberate.
    ctx.strokeStyle = a.matAccent;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + (i / 3) * RING.matFarHalf, RING.matFar);
      ctx.lineTo(cx + (i / 3) * RING.matNearHalf, RING.matNear + 40);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Centre mark: a flat ring and the promotion's initials.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.translate(cx, RING.opponentFeet + 150);
    ctx.scale(1, 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, 210, 0, Math.PI * 2);
    ctx.strokeStyle = a.matAccent;
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.font = 'bold 150px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = a.matAccent;
    ctx.fillText('GJ', 0, 8);
    ctx.restore();
    ctx.restore();

    // Apron lip along the far edge.
    ctx.beginPath();
    ctx.moveTo(cx - RING.matFarHalf, RING.matFar);
    ctx.lineTo(cx + RING.matFarHalf, RING.matFar);
    ctx.lineTo(cx + RING.matFarHalf + 30, RING.matFar + 34);
    ctx.lineTo(cx - RING.matFarHalf - 30, RING.matFar + 34);
    ctx.closePath();
    ink(ctx, darken(a.mat, 0.6), 3);
  }

  private drawRopesAndPosts(ctx: Ctx, a: ArenaDef, cx: number): void {
    const half = RING.postHalf;

    for (let i = 0; i < 3; i++) {
      const y = RING.ropeY[i];
      const sag = 10 + i * 4;
      // Ink underlay then flat colour: a cel rope, not a shaded tube.
      for (const [col, wdt] of [[INK, 20], [a.ropes[i], 13]] as const) {
        ctx.beginPath();
        ctx.moveTo(cx - half, y);
        ctx.quadraticCurveTo(cx, y + sag, cx + half, y);
        ctx.strokeStyle = col;
        ctx.lineWidth = wdt;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    for (const s of [-1, 1]) {
      const px = cx + s * half;
      // Padded post: a flat capsule with an inked contour.
      ctx.beginPath();
      ctx.roundRect?.(px - 26, RING.postTop, 52, RING.postBottom - RING.postTop + 150, 20);
      if (!ctx.roundRect) ctx.rect(px - 26, RING.postTop, 52, RING.postBottom - RING.postTop + 150);
      ink(ctx, a.post, 4);
      // One hard shade band down one side.
      ctx.save();
      ctx.beginPath();
      ctx.roundRect?.(px - 26, RING.postTop, 52, RING.postBottom - RING.postTop + 150, 20);
      if (!ctx.roundRect) ctx.rect(px - 26, RING.postTop, 52, RING.postBottom - RING.postTop + 150);
      ctx.clip();
      ctx.fillStyle = darken(a.post, 0.74);
      ctx.fillRect(px + 4, RING.postTop - 10, 24, 400);
      ctx.restore();
      oval(ctx, px, RING.postTop, 30, 16);
      ink(ctx, lighten(a.post, 0.2), 4);
    }
  }

  // -- Live layers -----------------------------------------------------------

  /** Everything behind the fighters. */
  drawBack(ctx: Ctx, a: ArenaDef, time: number, dt: number): void {
    const r = this.renderer;
    const key = `${a.id}:${r.dw}:${r.qualityName}`;
    if (!this.cache || this.cacheKey !== key) this.buildCache(a);

    // Backdrop band first, then the live crowd, then the baked ring on top so
    // the ropes and posts correctly occlude the audience.
    ctx.fillStyle = a.sky[0];
    ctx.fillRect(0, 0, r.dw, RING.crowdBottom + 20);
    ctx.fillStyle = a.sky[1];
    ctx.fillRect(0, RING.crowdBottom + 20, r.dw, RING_BAND_H - RING.crowdBottom - 20);

    this.crowd.update(dt);
    this.crowd.draw(ctx, time, r.quality.crowdDetail);
    this.drawFlashes(ctx, dt);

    // Baked ring furniture (rig, mat, ropes, posts) over the crowd.
    ctx.drawImage(this.cache!, 0, 0);
  }

  private drawFlashes(ctx: Ctx, dt: number): void {
    this.flashTimer -= dt;
    const rate = this.crowd.flashChance;
    if (rate > 0 && this.flashTimer <= 0) {
      this.flashTimer = 1 / rate;
      this.flashes.push({
        x: this.rng.range(0, this.renderer.dw),
        y: this.rng.range(RING.crowdTop, RING.crowdBottom),
        t: 1,
      });
      if (this.flashes.length > 24) this.flashes.shift();
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= dt * 7;
      if (f.t <= 0) { this.flashes.splice(i, 1); continue; }
      // A flat four-point flare, not a soft bloom.
      ctx.save();
      ctx.globalAlpha = clamp01(f.t);
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      const s = 16 * f.t + 6;
      ctx.moveTo(f.x, f.y - s);
      ctx.lineTo(f.x + s * 0.3, f.y);
      ctx.lineTo(f.x, f.y + s);
      ctx.lineTo(f.x - s * 0.3, f.y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(f.x - s, f.y);
      ctx.lineTo(f.x, f.y + s * 0.3);
      ctx.lineTo(f.x + s, f.y);
      ctx.lineTo(f.x, f.y - s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** Foreground framing, drawn after the fighters. */
  drawFront(ctx: Ctx, a: ArenaDef, dw: number): void {
    const cx = dw / 2;
    // Near ropes sweep in from the bottom corners, framing without occluding.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const y0 = RING_BAND_H - 150 + i * 74;
        for (const [col, wdt] of [[INK, 26], [a.ropes[i], 18]] as const) {
          ctx.beginPath();
          ctx.moveTo(cx + s * dw * 0.52, y0 - 190);
          ctx.quadraticCurveTo(cx + s * dw * 0.36, y0, cx + s * dw * 0.235, y0 + 130);
          ctx.strokeStyle = col;
          ctx.lineWidth = wdt;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
    }
  }

  setMood(m: CrowdMood): void { this.crowd.setMood(m); }
  react(strength: number): void { this.crowd.react(strength); }
  ovation(): void { this.crowd.standingOvation(); }

  // -- Referee ---------------------------------------------------------------

  /**
   * The referee. He stands at the side of the ring, steps in to count, and
   * waves the fight off at the end. He is the thing that makes the ring read
   * as an officiated bout rather than two men in a room.
   */
  drawReferee(
    ctx: Ctx, dw: number, time: number,
    state: 'idle' | 'counting' | 'waveOff' | 'raiseWinner' | 'instruct', t: number,
  ): void {
    const cx = dw / 2;
    // Steps toward the middle when he has something to do. He is drawn at the
    // same apparent scale as the boxers — a doll-sized referee at the edge of
    // the mat destroys the perspective the whole composition depends on.
    //
    // The pre-fight instructions are their own arrival: he comes in, talks,
    // and walks back out again, so the bell lands on an empty centre.
    const instruct = state === 'instruct'
      ? Math.min(clamp01(t * 4), clamp01((1 - t) * 5))
      : 0;
    const inRing = state === 'counting' ? clamp01(t * 2)
      : state === 'waveOff' ? 1
      : instruct;
    // He works the right-hand side, and steps toward the middle — but never
    // into it: the centre belongs to the two fighters.
    // He stands BESIDE the man he is counting over, never on top of him.
    const target = state === 'instruct' ? 250 : state === 'counting' ? 470 : 340;
    const x = lerp(cx + RING.refX, cx + target, inRing);
    const y = lerp(RING.refY, state === 'instruct' ? 840 : 880, inRing);
    const s = lerp(270, 340, inRing);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 100, s / 100);

    const bob = Math.sin(time * 3) * 3;
    const skin = '#d9a877';
    const shirt = '#f2f0ea';
    const stripe = '#23232e';

    // Legs.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * 9, -52);
      ctx.lineTo(sd * 13, 0);
      ctx.stroke();
    }
    ctx.strokeStyle = '#2b2b38';
    ctx.lineWidth = 11;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * 9, -52);
      ctx.lineTo(sd * 13, -6);
      ctx.stroke();
    }
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sd * 15, -3, 13, 6, 0, 0, Math.PI * 2);
      ink(ctx, '#15151d', 4);
    }

    // Torso, in the striped shirt. The stripes are the whole point: they are
    // the one silhouette in boxing that reads instantly as "official", and
    // they keep him from being mistaken for a third fighter.
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(-24, -48 + bob * 0.2);
      ctx.quadraticCurveTo(-29, -100 + bob, 0, -103 + bob);
      ctx.quadraticCurveTo(29, -100 + bob, 24, -48 + bob * 0.2);
      ctx.closePath();
    };
    ctx.save();
    torso();
    ctx.fillStyle = shirt;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = stripe;
    for (let i = -3; i <= 3; i++) ctx.fillRect(i * 13 - 4, -112 + bob, 8, 74);
    ctx.restore();
    torso();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Bow tie.
    ctx.beginPath();
    ctx.moveTo(-9, -100 + bob);
    ctx.lineTo(0, -96 + bob);
    ctx.lineTo(9, -100 + bob);
    ctx.lineTo(9, -90 + bob);
    ctx.lineTo(0, -94 + bob);
    ctx.lineTo(-9, -90 + bob);
    ctx.closePath();
    ink(ctx, '#1d1d28', 4);

    // Arms: raised for a count, swept for a wave-off.
    const armUp = state === 'counting' || state === 'raiseWinner' ? 1 : 0;
    const sweep = state === 'waveOff' ? Math.sin(time * 9) * 0.9
      // Talking with his hands: a slow chop between the two of them.
      : state === 'instruct' ? Math.sin(time * 5) * 0.45 * instruct
      : 0;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 15;
    ctx.beginPath();
    for (const [col, wd] of [[INK, 17], [shirt, 12]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sd * 23, -90 + bob);
        ctx.lineTo(sd * (33 + sweep * 22), -66 + bob - armUp * 48);
        ctx.stroke();
      }
    }

    // Head. Drawn to the same rules as the boxers — flat fill, one hard
    // shade, black contour — so he sits in the same picture as them.
    const hy = -122 + bob;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, hy, 17.5, 0, Math.PI * 2);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = darken(skin, 0.82);
    ctx.fillRect(5, hy - 22, 22, 44);
    // Hair, cropped short.
    ctx.fillStyle = '#3a3038';
    ctx.beginPath();
    ctx.arc(0, hy - 3, 17.5, Math.PI * 1.04, Math.PI * 1.96);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, hy, 17.5, 0, Math.PI * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    // Eyes, brows and a moustache. Small, but they point where he is looking,
    // which is how the player reads that he is officiating rather than idle.
    const look = state === 'counting' || state === 'instruct' ? -0.35 : 0;
    ctx.fillStyle = INK;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sd * 6.5 + look * 5, hy - 1, 2.4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sd * 10 - 4.5, hy - 9, 9, 2.6);
    }
    // Moustache, not a letterbox.
    ctx.fillRect(-5.5, hy + 7, 11, 3);
    ctx.restore();
  }
}

export { clamp01 };
