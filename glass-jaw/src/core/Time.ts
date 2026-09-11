import { clamp, damp } from './MathUtil';

/**
 * Central clock. Everything gameplay-facing reads `dt` (already scaled), while
 * presentation that must keep running during hit-stop reads `rawDt`.
 */
export class GameTime {
  /** Scaled delta seconds for simulation. */
  dt = 0;
  /** Unscaled delta seconds — UI animation, music, pause menus. */
  rawDt = 0;
  /** Total scaled seconds since fight start. */
  elapsed = 0;

  private targetScale = 1;
  private currentScale = 1;
  private slowMoTimer = 0;
  private slowMoScale = 1;
  private hitStopTimer = 0;

  /** Freeze frames on impact — the single biggest contributor to punch feel. */
  hitStop(seconds: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
  }

  /** Temporary slow motion (perfect dodge / perfect counter). */
  slowMo(seconds: number, scale = 0.32): void {
    if (seconds > this.slowMoTimer || scale < this.slowMoScale) {
      this.slowMoTimer = Math.max(this.slowMoTimer, seconds);
      this.slowMoScale = Math.min(this.slowMoScale, scale);
    }
  }

  clearEffects(): void {
    this.slowMoTimer = 0;
    this.hitStopTimer = 0;
    this.slowMoScale = 1;
    this.currentScale = 1;
    this.targetScale = 1;
  }

  get scale(): number { return this.currentScale; }
  get inHitStop(): boolean { return this.hitStopTimer > 0; }
  get inSlowMo(): boolean { return this.slowMoTimer > 0; }

  advance(rawDt: number): void {
    this.rawDt = rawDt;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      this.targetScale = 0;
    } else if (this.slowMoTimer > 0) {
      this.slowMoTimer -= rawDt;
      this.targetScale = this.slowMoScale;
      if (this.slowMoTimer <= 0) this.slowMoScale = 1;
    } else {
      this.targetScale = 1;
    }

    // Ease into/out of slow motion, but snap hit-stop on/off for a crisp freeze.
    this.currentScale = this.targetScale === 0 || this.currentScale === 0
      ? this.targetScale
      : damp(this.currentScale, this.targetScale, 26, rawDt);

    this.dt = clamp(rawDt * this.currentScale, 0, 0.05);
    this.elapsed += this.dt;
  }

  reset(): void {
    this.clearEffects();
    this.elapsed = 0;
    this.dt = 0;
    this.rawDt = 0;
  }
}
