import { AttackDef, DEFENSE, FRAME, HITSTUN } from './Attack';
import { Fighter, FState } from './Fighter';
import { impactPoint, isCleanHit, judge } from './HitDetection';
import type { FightEvents, HitResult } from './types';
import { EventBus } from '../core/EventBus';
import { GameTime } from '../core/Time';
import type { TokenReason } from './SpecialSystem';

export interface CombatOptions {
  /** Global damage scale — difficulty tuning, never a health-bar inflation. */
  playerDamageScale: number;
  enemyDamageScale: number;
  /** Multiplies every hit-stop duration (accessibility / feel preference). */
  hitStopScale: number;
  /** Multiplies slow-motion durations. 0 disables it entirely. */
  slowMoScale: number;
}

export const DEFAULT_COMBAT_OPTIONS: CombatOptions = {
  playerDamageScale: 1,
  enemyDamageScale: 1,
  hitStopScale: 1,
  slowMoScale: 1,
};

/**
 * Applies verdicts from HitDetection: damage, reactions, tokens, and the
 * time-domain effects (hit-stop, slow motion) that make impacts land.
 */
export class CombatSystem {
  options: CombatOptions = { ...DEFAULT_COMBAT_OPTIONS };
  /** Set true to make the player invincible (training mode). */
  playerInvincible = false;

  constructor(
    private readonly bus: EventBus<FightEvents>,
    private readonly time: GameTime,
  ) {}

  /** Polls both fighters for live hitboxes and resolves them. */
  update(a: Fighter, b: Fighter): void {
    if (a.pollHitWindow() && a.attack) this.resolve(a, b, a.attack);
    if (b.pollHitWindow() && b.attack) this.resolve(b, a, b.attack);
  }

  resolve(attacker: Fighter, defender: Fighter, attack: AttackDef): HitResult {
    const v = judge(attacker, defender, attack);
    const pt = impactPoint(attack.zone, defender);
    const scale = attacker.isPlayer ? this.options.playerDamageScale : this.options.enemyDamageScale;

    const result: HitResult = {
      attacker, defender, attack,
      outcome: v.outcome,
      damage: 0,
      zone: attack.zone,
      x: pt.x, y: pt.y,
      intensity: 0,
      causedStun: false,
      causedKnockdown: false,
      tokenAwarded: false,
    };

    // Gassed fighters throw arm punches that barely register.
    const gasPenalty = attacker.stamina.gassed ? 0.42 : 1;
    const base = attack.damage * attacker.stats.power * scale * gasPenalty * v.mult;

    switch (v.outcome) {
      case 'perfectDodge':
        this.onPerfectDodge(attacker, defender, result);
        break;

      case 'dodge':
        defender.special.charge += 0.08;
        result.intensity = 0.14;
        this.bus.emit('dodge', { fighter: defender, dir: defender.dodgeDir === -1 ? 'left' : defender.dodgeDir === 1 ? 'right' : 'duck', perfect: false });
        this.bus.emit('attackWhiff', { fighter: attacker, attack });
        break;

      case 'parry':
        this.onParry(attacker, defender, result);
        break;

      case 'block':
      case 'grazeBlock':
        this.onBlock(attacker, defender, attack, v.outcome, base, result);
        break;

      default:
        this.onLanded(attacker, defender, attack, v, base, result);
        break;
    }

    if (v.outcome !== 'dodge' && v.outcome !== 'perfectDodge' && v.outcome !== 'parry') {
      attacker.attackConnected = true;
    }

    this.bus.emit('hit', result);
    return result;
  }

  // -- Outcome handlers ------------------------------------------------------

  private onPerfectDodge(attacker: Fighter, defender: Fighter, result: HitResult): void {
    // The whole point of the game: read it, slip it, make them pay for it.
    attacker.interrupt();
    attacker.setState(FState.Recovery, DEFENSE.counterWindow);
    attacker.open(DEFENSE.counterWindow);

    const reason: TokenReason = 'perfectDodgeCounter';
    if (defender.special.award(reason)) {
      result.tokenAwarded = true;
      this.bus.emit('token', { fighter: defender, tokens: defender.special.tokens, reason });
    }
    defender.stamina.reward(14);

    result.intensity = 0.55;
    this.time.hitStop(0.055 * this.options.hitStopScale);
    this.time.slowMo(0.36 * this.options.slowMoScale, 0.3);
    this.bus.emit('dodge', { fighter: defender, dir: defender.dodgeDir === -1 ? 'left' : defender.dodgeDir === 1 ? 'right' : 'duck', perfect: true });
    this.bus.emit('counterWindowOpen', { fighter: attacker, frames: DEFENSE.counterWindow });
  }

  private onParry(attacker: Fighter, defender: Fighter, result: HitResult): void {
    attacker.interrupt();
    attacker.setState(FState.Stagger, DEFENSE.parryStagger);
    attacker.open(DEFENSE.parryCounterWindow);
    attacker.stamina.spend(12);

    defender.parryTimer = 0;
    defender.setState(FState.Parry, 12);
    defender.stamina.reward(18);

    const reason: TokenReason = 'parryCounter';
    if (defender.special.award(reason)) {
      result.tokenAwarded = true;
      this.bus.emit('token', { fighter: defender, tokens: defender.special.tokens, reason });
    }

    result.intensity = 0.5;
    this.time.hitStop(0.07 * this.options.hitStopScale);
    this.time.slowMo(0.18 * this.options.slowMoScale, 0.42);
    this.bus.emit('parry', { fighter: defender });
    this.bus.emit('counterWindowOpen', { fighter: attacker, frames: DEFENSE.parryCounterWindow });
  }

  private onBlock(
    attacker: Fighter, defender: Fighter, attack: AttackDef,
    outcome: 'block' | 'grazeBlock', base: number, result: HitResult,
  ): void {
    result.damage = this.applyChip(defender, base, attack.weight, attacker.isPlayer ? 1 : -1);

    const drain = DEFENSE.blockStaminaCost * attack.weight * (outcome === 'grazeBlock' ? 1.7 : 1);
    defender.stamina.spend(drain);
    defender.parryTimer = 0;

    if (defender.stamina.current <= 0 && !defender.isDown) {
      // Guard break: hold block forever and you WILL get opened up.
      defender.interrupt();
      defender.setState(FState.Stunned, DEFENSE.guardBreakStun);
      defender.open(DEFENSE.guardBreakStun);
      this.bus.emit('guardBreak', { fighter: defender });
      result.intensity = 0.6;
      this.time.hitStop(0.06 * this.options.hitStopScale);
    } else {
      result.intensity = outcome === 'grazeBlock' ? 0.3 : 0.18;
      this.time.hitStop(0.022 * attack.weight * this.options.hitStopScale);
    }
    this.bus.emit('block', { fighter: defender, correct: outcome === 'block' });
  }

  private onLanded(
    attacker: Fighter, defender: Fighter, attack: AttackDef,
    v: { outcome: string; stunBonus: number }, base: number, result: HitResult,
  ): void {
    const heavy = attack.weight >= 2 || v.outcome === 'perfectCounter' || v.outcome === 'weakness';
    const dir = attacker.isPlayer ? 1 : -1;
    const wasDown = defender.isDown;
    // Only these earn the right to stop a committed attack outright.
    const breakArmor = v.outcome === 'weakness' || v.outcome === 'perfectCounter' ||
      attack.tier !== undefined;
    const wasArmored = defender.hasArmor && !breakArmor;

    const dmg = this.applyDamage(
      defender, base, attack.stunPower + v.stunBonus, attack.weight, dir, heavy, breakArmor,
    );
    result.damage = dmg;
    result.causedKnockdown = !wasDown && defender.isDown;
    result.causedStun = defender.state === FState.Stunned;

    // Landing clean pays back stamina: precision sustains offence, mashing
    // doesn't. Chipping an armoured opponent pays nothing — you are about to
    // be hit for it.
    attacker.stamina.reward(wasArmored ? 0 : attack.stamina * (v.outcome === 'hit' ? 0.35 : 0.9));

    // Getting hit cleanly costs the defender a token — unless they ate it on
    // purpose behind the armour of their own attack.
    if (wasArmored) {
      // no token penalty
    } else if (defender.special.tokens > 0) {
      defender.special.penalize();
      this.bus.emit('tokenLost', { fighter: defender });
    } else {
      defender.special.charge = Math.max(0, defender.special.charge - 0.35);
    }

    // A counter that lands buys the defender a moment where they cannot be
    // countered again, so a good read pays once and has to be earned afresh.
    if (v.outcome === 'perfectCounter' || v.outcome === 'weakness') {
      defender.counterLock = 0.95;
      this.bus.emit('countered', { fighter: defender, perfect: true });
    } else if (v.outcome === 'counter') {
      defender.counterLock = 0.5;
      this.bus.emit('countered', { fighter: defender, perfect: false });
    }

    let reason: TokenReason | null = null;
    if (v.outcome === 'weakness') reason = 'weakness';
    else if (v.outcome === 'perfectCounter') reason = 'perfectCounter';
    // Trading into an armoured wind-up is not a counter; it is greed.
    else if (v.outcome === 'counter' && attack.weight >= 1.2 && !wasArmored) reason = 'perfectCounter';
    else if (defender.state === FState.Stunned && attack.tier) reason = 'stunFinish';

    if (reason && attacker.special.award(reason)) {
      result.tokenAwarded = true;
      this.bus.emit('token', { fighter: attacker, tokens: attacker.special.tokens, reason });
    }

    // --- Feel: intensity drives shake, hit-stop, slow-mo, VFX scale ---------
    let intensity = 0.28 + attack.weight * 0.14;
    let stop = 0.035 + attack.weight * 0.018;
    if (v.outcome === 'counter') { intensity += 0.16; stop += 0.018; }
    if (v.outcome === 'perfectCounter') {
      intensity += 0.34; stop += 0.04;
      this.time.slowMo(0.26 * this.options.slowMoScale, 0.34);
    }
    if (v.outcome === 'weakness') {
      intensity += 0.42; stop += 0.05;
      this.time.slowMo(0.32 * this.options.slowMoScale, 0.3);
    }
    if (result.causedStun) { intensity += 0.25; stop += 0.05; }
    if (result.causedKnockdown) {
      intensity = 1;
      stop = 0.13;
      this.time.slowMo(0.7 * this.options.slowMoScale, 0.26);
    }

    result.intensity = Math.min(1, intensity);
    this.time.hitStop(stop * this.options.hitStopScale);

    if (result.causedStun) this.bus.emit('stun', { fighter: defender });
    if (result.causedKnockdown) {
      this.bus.emit('knockdown', { fighter: defender, count: defender.knockdowns });
    }
  }

  private applyChip(defender: Fighter, amount: number, weight: number, dir: number): number {
    if (defender.isPlayer && this.playerInvincible) return 0;
    const before = defender.health.current;
    defender.takeChip(amount, weight, dir);
    return before - defender.health.current;
  }

  private applyDamage(
    defender: Fighter, amount: number, stun: number,
    weight: number, dir: number, heavy: boolean, breakArmor: boolean,
  ): number {
    if (defender.isPlayer && this.playerInvincible) {
      defender.flash = 1;
      defender.recoil = 0.3;
      defender.recoilDir = dir;
      return 0;
    }
    const before = defender.health.current;
    defender.takeDamage(amount, stun, weight, dir, heavy, breakArmor);
    return before - defender.health.current;
  }

  /** Used by training mode to chip a dummy without full reactions. */
  static isCleanOutcome = isCleanHit;
}

export { FRAME, HITSTUN };
