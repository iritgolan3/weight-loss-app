import { clamp, clamp01, damp, lerp, TAU } from '../core/MathUtil';
import { RNG } from '../core/RNG';

export interface CameraSettings {
  /** 0 disables shake entirely (accessibility). */
  shakeScale: number;
  /** 0 disables zoom punches and rotation. */
  motionScale: number;
}

/**
 * Screen-space arcade camera.
 *
 * This camera is LOCKED, and that is the whole design. The ring composition —
 * opponent centred, ropes across his shoulders, the player's head over his
 * shins — is the game's readability system, and a camera that pans and zooms
 * around during play dismantles it: the player has to re-find the frame every
 * exchange instead of reading the fighter in it.
 *
 * So the numbers here are small on purpose. Shake is a trauma model (squared
 * falloff) tuned so a jab barely registers, a knockdown rocks the room, and
 * neither one moves the framing anywhere the eye has to follow. Zoom exists
 * only as a few percent of punch on real impacts.
 */
export class CameraController {
  settings: CameraSettings = { shakeScale: 1, motionScale: 1 };

  /** 0..1. Displacement scales with trauma^2. */
  private trauma = 0;
  /** Directional impulse, decays to zero. */
  private impX = 0;
  private impY = 0;
  /** Additive zoom on top of the base. */
  private zoomPunch = 0;
  private zoomTarget = 0;
  /** Slow push-in used during counters and knockdowns. */
  private focusZoom = 0;
  private focusTarget = 0;
  private focusX = 0;
  private focusY = 0;
  private focusXTarget = 0;
  private focusYTarget = 0;

  private seed = 0;
  private rng = new RNG(1234);

  /** Final values consumed by the render pass. */
  x = 0;
  y = 0;
  zoom = 1;
  rotation = 0;

  /** Adds shake. `amount` 0..1. */
  shake(amount: number): void {
    this.trauma = clamp01(this.trauma + amount);
  }

  /** Directional kick, e.g. away from an impact. */
  impulse(dx: number, dy: number): void {
    this.impX += dx;
    this.impY += dy;
  }

  /** A quick zoom pop. */
  punchZoom(amount: number): void {
    this.zoomTarget = Math.max(this.zoomTarget, amount);
  }

  /** A sustained push-in toward a point, for counters and knockdowns. */
  focus(amount: number, x = 0, y = 0, seconds = 0.5): void {
    this.focusTarget = Math.max(this.focusTarget, amount);
    this.focusXTarget = x;
    this.focusYTarget = y;
    this.focusHold = Math.max(this.focusHold, seconds);
  }
  private focusHold = 0;

  /** Convenience: the standard reaction to a landed hit. */
  onHit(intensity: number, dirX: number): void {
    this.shake(0.10 + intensity * 0.34);
    this.impulse(dirX * intensity * 10, intensity * 4);
    this.punchZoom(intensity * 0.012);
  }

  onCounter(x: number, y: number): void {
    this.shake(0.42);
    this.punchZoom(0.022);
    this.focus(0.035, x, y, 0.36);
  }

  onKnockdown(x: number, y: number): void {
    this.shake(1);
    this.impulse(0, 18);
    this.punchZoom(0.035);
    this.focus(0.06, x, y, 1.1);
  }

  reset(): void {
    this.trauma = 0;
    this.impX = this.impY = 0;
    this.zoomPunch = this.zoomTarget = 0;
    this.focusZoom = this.focusTarget = 0;
    this.focusX = this.focusY = this.focusXTarget = this.focusYTarget = 0;
    this.focusHold = 0;
    this.x = this.y = 0;
    this.zoom = 1;
    this.rotation = 0;
  }

  /** Advances on UNSCALED time so the camera keeps living through hit-stop. */
  update(rawDt: number): void {
    const s = this.settings;

    this.trauma = Math.max(0, this.trauma - rawDt * 1.9);
    this.seed += rawDt * 60;

    // Trauma^2 keeps small hits subtle and big ones violent.
    const t2 = this.trauma * this.trauma * s.shakeScale;
    this.rng.reseed((this.seed * 977) | 0);
    const shakeX = (this.rng.next() * 2 - 1) * 22 * t2;
    const shakeY = (this.rng.next() * 2 - 1) * 16 * t2;
    // Rotation is deliberately tiny — a tilting ring is unreadable.
    const shakeR = (this.rng.next() * 2 - 1) * 0.016 * t2 * s.motionScale;

    this.impX = damp(this.impX, 0, 11, rawDt);
    this.impY = damp(this.impY, 0, 11, rawDt);

    this.zoomTarget = damp(this.zoomTarget, 0, 7, rawDt);
    this.zoomPunch = damp(this.zoomPunch, this.zoomTarget, 24, rawDt);

    if (this.focusHold > 0) {
      this.focusHold -= rawDt;
      if (this.focusHold <= 0) this.focusTarget = 0;
    }
    this.focusZoom = damp(this.focusZoom, this.focusTarget, 6, rawDt);
    this.focusX = damp(this.focusX, this.focusTarget > 0 ? this.focusXTarget : 0, 5, rawDt);
    this.focusY = damp(this.focusY, this.focusTarget > 0 ? this.focusYTarget : 0, 5, rawDt);

    const motion = s.motionScale;
    // Hard clamps, not guidelines: whatever happens, the locked framing moves
    // by at most a few dozen pixels.
    this.x = clamp(shakeX + this.impX * motion - this.focusX * this.focusZoom * 0.8, -58, 58);
    this.y = clamp(shakeY + this.impY * motion - this.focusY * this.focusZoom * 0.8, -40, 40);
    this.zoom = 1 + (this.zoomPunch + this.focusZoom) * motion;
    this.rotation = shakeR;
  }

  /** Applies the camera transform about the screen centre. */
  apply(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.translate(cx + this.x, cy + this.y);
    if (this.rotation !== 0) ctx.rotate(this.rotation);
    if (this.zoom !== 1) ctx.scale(this.zoom, this.zoom);
    ctx.translate(-cx, -cy);
  }
}

export { lerp, TAU };
