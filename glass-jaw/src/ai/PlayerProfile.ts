import { clamp01 } from '../core/MathUtil';

/**
 * Rolling behavioural profile of the player, used by the adaptive AI.
 *
 * Every value is a decaying average so the opponent responds to what you are
 * doing *now*, and — just as importantly — forgets it once you change. That
 * forgetting is what keeps adaptation fair: the counter to an adaptation is
 * always simply to stop doing the thing.
 */
export class PlayerProfile {
  /** 0 = always dodges left, 1 = always dodges right, 0.5 = balanced. */
  dodgeBias = 0.5;
  /** Fraction of recent defensive actions that were blocks rather than dodges. */
  blockiness = 0.4;
  /** Punches per second, smoothed. */
  aggression = 0;
  /** Fraction of recent punches aimed at the head. */
  highAim = 0.6;
  /** How often the player throws while the opponent is winding up. */
  greed = 0.3;
  /** How often the player successfully counters. Drives "respect". */
  skill = 0.3;

  private punchWindow = 0;
  private punchCount = 0;

  private static readonly DECAY = 0.055;

  private blend(current: number, sample: number, weight = PlayerProfile.DECAY): number {
    return clamp01(current + (sample - current) * weight);
  }

  recordDodge(dir: -1 | 1): void {
    this.dodgeBias = this.blend(this.dodgeBias, dir === 1 ? 1 : 0, 0.1);
    this.blockiness = this.blend(this.blockiness, 0, 0.08);
  }

  recordBlock(): void {
    this.blockiness = this.blend(this.blockiness, 1, 0.08);
  }

  recordPunch(zone: 'head' | 'body', opponentWindingUp: boolean): void {
    this.punchCount++;
    this.highAim = this.blend(this.highAim, zone === 'head' ? 1 : 0, 0.09);
    this.greed = this.blend(this.greed, opponentWindingUp ? 1 : 0, 0.07);
  }

  recordCounter(success: boolean): void {
    this.skill = this.blend(this.skill, success ? 1 : 0, 0.12);
  }

  recordHitTaken(): void {
    this.skill = this.blend(this.skill, 0, 0.05);
  }

  update(dt: number): void {
    this.punchWindow += dt;
    if (this.punchWindow >= 1) {
      this.aggression = this.aggression + (this.punchCount - this.aggression) * 0.35;
      this.punchCount = 0;
      this.punchWindow = 0;
    }
    // Everything drifts back to neutral so old habits stop being punished.
    const pull = dt * 0.06;
    this.dodgeBias += (0.5 - this.dodgeBias) * pull;
    this.blockiness += (0.4 - this.blockiness) * pull;
    this.greed += (0.3 - this.greed) * pull;
  }

  /** Strength of the left-dodge habit, 0..1. */
  get leftDodgeHabit(): number { return clamp01((0.5 - this.dodgeBias) * 2.4); }
  get rightDodgeHabit(): number { return clamp01((this.dodgeBias - 0.5) * 2.4); }
  get turtling(): number { return clamp01((this.blockiness - 0.45) * 2.2); }
  get rushing(): number { return clamp01((this.aggression - 1.6) / 2.2); }
  get highGuardHabit(): number { return clamp01((this.highAim - 0.5) * 2); }

  reset(): void {
    this.dodgeBias = 0.5;
    this.blockiness = 0.4;
    this.aggression = 0;
    this.highAim = 0.6;
    this.greed = 0.3;
    this.skill = 0.3;
    this.punchCount = 0;
    this.punchWindow = 0;
  }
}
