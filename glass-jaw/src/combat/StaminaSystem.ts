import { clamp } from '../core/MathUtil';

/**
 * Stamina gates mashing without gating *skill*. Landing a clean punch refunds
 * stamina, so an accurate player effectively never runs dry while a masher does.
 */
export class StaminaSystem {
  current: number;
  readonly max: number;

  /** Seconds of no-spend required before regen kicks in. */
  regenDelay = 0.45;
  /** Points per second once regen is active. */
  regenRate: number;
  /** Regen multiplier while blocking (you catch your breath behind the guard). */
  blockRegenMult = 0.35;

  private idleTimer = 0;
  /** Rises above 0 when the fighter is gassed; drives the visual "exhausted" cue. */
  exhaustion = 0;

  constructor(max: number, regenRate = 26) {
    this.max = max;
    this.current = max;
    this.regenRate = regenRate;
  }

  get fraction(): number { return this.current / this.max; }
  /** Below this the fighter throws weak, slow punches. */
  get gassed(): boolean { return this.current < this.max * 0.18; }

  canSpend(amount: number): boolean {
    // Always allow the attempt; a gassed punch is weak rather than impossible.
    return this.current > 0 || amount <= 0;
  }

  spend(amount: number): void {
    this.current = clamp(this.current - amount, 0, this.max);
    this.idleTimer = 0;
    if (this.current <= 0) this.exhaustion = 1;
  }

  /** Clean hits pay stamina back — accuracy is rewarded, spam is not. */
  reward(amount: number): void {
    this.current = clamp(this.current + amount, 0, this.max);
  }

  update(dt: number, blocking: boolean): void {
    this.idleTimer += dt;
    if (this.idleTimer >= this.regenDelay) {
      const rate = this.regenRate * (blocking ? this.blockRegenMult : 1);
      this.current = clamp(this.current + rate * dt, 0, this.max);
    }
    if (this.exhaustion > 0) {
      this.exhaustion = Math.max(0, this.exhaustion - dt * (this.gassed ? 0.15 : 1.4));
    }
  }

  reset(): void {
    this.current = this.max;
    this.idleTimer = 0;
    this.exhaustion = 0;
  }
}
