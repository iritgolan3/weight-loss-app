import { clamp } from '../core/MathUtil';

/**
 * Health with a "recent damage" ghost bar. The ghost drains toward the real
 * value so the player can see how much a combo just took off.
 */
export class HealthSystem {
  current: number;
  ghost: number;
  readonly max: number;

  constructor(max: number) {
    this.max = max;
    this.current = max;
    this.ghost = max;
  }

  get fraction(): number { return this.current / this.max; }
  get ghostFraction(): number { return this.ghost / this.max; }
  get isDown(): boolean { return this.current <= 0; }

  /** Returns the damage actually applied (clipped at 0). */
  damage(amount: number): number {
    const before = this.current;
    this.current = clamp(this.current - amount, 0, this.max);
    return before - this.current;
  }

  heal(amount: number): void {
    this.current = clamp(this.current + amount, 0, this.max);
    if (this.ghost < this.current) this.ghost = this.current;
  }

  /** Refill to a fraction of max — used when a fighter beats the count. */
  restoreTo(fraction: number): void {
    this.current = clamp(this.max * fraction, 0, this.max);
    this.ghost = this.current;
  }

  update(dt: number): void {
    if (this.ghost > this.current) {
      // Hang for a moment, then drain fast, so the hit reads before it settles.
      this.ghost = Math.max(this.current, this.ghost - this.max * 0.55 * dt);
    } else if (this.ghost < this.current) {
      this.ghost = this.current;
    }
  }
}
