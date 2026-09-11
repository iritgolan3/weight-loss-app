import { AttackDef, DEFENSE, FRAME, Zone } from './Attack';
import { Fighter, FState } from './Fighter';
import type { HitOutcome } from './types';

export interface Verdict {
  outcome: HitOutcome;
  /** Damage multiplier applied on top of base damage. */
  mult: number;
  /** Extra stun applied on top of the attack's stunPower. */
  stunBonus: number;
}

/**
 * Decides what happens when `attack` reaches `defender`. Kept pure and
 * side-effect free so it can be unit-tested against the frame data directly.
 *
 * Precedence, strictest first:
 *   invulnerability > parry > block > weakness > open > counter > clean hit
 */
export function judge(attacker: Fighter, defender: Fighter, attack: AttackDef): Verdict {
  // --- 1. Evasion ---------------------------------------------------------
  const dodging = defender.state === FState.Dodge || defender.state === FState.Duck;
  if (defender.isInvulnerable) {
    // A tracking attack follows a predictable dodge and beats the i-frames.
    const tracked =
      (attack.tracking === 'left' && defender.dodgeDir === -1) ||
      (attack.tracking === 'right' && defender.dodgeDir === 1);
    if (!tracked) {
      // A dodge started *late* (close to impact) is the frame-perfect one.
      const window = attack.perfectDodgeWindow * FRAME * defender.stats.counter;
      const sinceStart = defender.stateTime - DEFENSE.dodgeStartup * FRAME;
      const perfect = dodging && sinceStart <= window;
      return { outcome: perfect ? 'perfectDodge' : 'dodge', mult: 0, stunBonus: 0 };
    }
  }

  // --- 2. Parry -----------------------------------------------------------
  if (defender.isBlocking && defender.parryTimer > 0 && !attack.unblockable) {
    return { outcome: 'parry', mult: 0, stunBonus: 0 };
  }

  // --- 3. Block -----------------------------------------------------------
  if (defender.isBlocking && !attack.unblockable) {
    const correct = defender.guardZone === attack.zone;
    return correct
      ? { outcome: 'block', mult: attack.chip, stunBonus: 0 }
      // Guarding the wrong height still takes the edge off, but it hurts.
      : { outcome: 'grazeBlock', mult: 0.5, stunBonus: attack.stunPower * 0.4 };
  }

  // --- 4. Weak point ------------------------------------------------------
  const w = defender.weakness;
  if (
    defender.weaknessOpen && w &&
    defender.state === FState.Windup &&
    attack.zone === w.zone &&
    defender.telegraphKind && w.telegraphKinds.includes(defender.telegraphKind)
  ) {
    return { outcome: 'weakness', mult: w.damageMult, stunBonus: w.stunBonus };
  }

  // --- 5. Counters --------------------------------------------------------
  if (defender.isOpen) {
    return {
      outcome: 'perfectCounter',
      mult: attack.counterMult * 1.35 * attacker.stats.counter,
      stunBonus: attack.stunPower * 1.4,
    };
  }
  if (defender.isCommitted) {
    return {
      outcome: 'counter',
      mult: attack.counterMult * attacker.stats.counter,
      stunBonus: attack.stunPower * 0.7,
    };
  }

  // --- 6. Clean hit -------------------------------------------------------
  return { outcome: 'hit', mult: 1, stunBonus: 0 };
}

/** Impact point in the target's local body space, used to place VFX. */
export function impactPoint(zone: Zone, defender: Fighter): { x: number; y: number } {
  const lean = defender.lean * 0.42;
  if (zone === 'head') return { x: lean, y: -1.18 + defender.crouch * 0.5 };
  return { x: lean, y: -0.5 + defender.crouch * 0.22 };
}

/** True if an outcome means the defender actually took meaningful damage. */
export function isCleanHit(outcome: HitOutcome): boolean {
  return outcome === 'hit' || outcome === 'counter' ||
    outcome === 'perfectCounter' || outcome === 'weakness';
}

export function isDefended(outcome: HitOutcome): boolean {
  return outcome === 'block' || outcome === 'grazeBlock' || outcome === 'parry' ||
    outcome === 'dodge' || outcome === 'perfectDodge';
}
