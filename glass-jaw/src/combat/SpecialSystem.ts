import { clamp } from '../core/MathUtil';

export type TokenReason =
  | 'perfectCounter' | 'weakness' | 'parryCounter' | 'perfectDodgeCounter' | 'stunFinish';

/**
 * The star/token economy.
 *
 * Tokens are *earned by reading the opponent*, never by volume of punches:
 * every source below requires correct timing against a specific tell. Getting
 * hit costs a token, so the meter also measures how cleanly you are fighting.
 */
export class SpecialSystem {
  tokens = 0;
  readonly maxTokens = 3;

  /** Charge toward the next token, 0..1 — small feats build it partially. */
  charge = 0;

  /** Set briefly when a token is gained/lost so the HUD can react. */
  flashTimer = 0;
  lastGain: TokenReason | null = null;
  lostFlashTimer = 0;

  private static readonly CHARGE: Record<TokenReason, number> = {
    perfectCounter: 0.5,
    weakness: 1.0,
    parryCounter: 0.55,
    perfectDodgeCounter: 0.7,
    stunFinish: 0.34,
  };

  award(reason: TokenReason): boolean {
    if (this.tokens >= this.maxTokens) { this.charge = 1; return false; }
    this.charge += SpecialSystem.CHARGE[reason] ?? 0.3;
    if (this.charge >= 1) {
      this.charge -= 1;
      this.tokens = Math.min(this.maxTokens, this.tokens + 1);
      this.flashTimer = 0.9;
      this.lastGain = reason;
      return true;
    }
    return false;
  }

  /** Taking a clean hit costs a token — mirrors the classic "lose your stars". */
  penalize(): void {
    if (this.tokens > 0) {
      this.tokens--;
      this.lostFlashTimer = 0.7;
    }
    this.charge = Math.max(0, this.charge - 0.5);
  }

  spend(count: number): boolean {
    if (this.tokens < count) return false;
    this.tokens -= count;
    return true;
  }

  update(dt: number): void {
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.lostFlashTimer = Math.max(0, this.lostFlashTimer - dt);
    this.charge = clamp(this.charge, 0, 1);
  }

  reset(): void {
    this.tokens = 0;
    this.charge = 0;
    this.flashTimer = 0;
    this.lostFlashTimer = 0;
  }
}
