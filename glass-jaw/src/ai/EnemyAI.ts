import { AttackDef, FRAME, scaleAttack } from '../combat/Attack';
import { Fighter, FState, Weakness } from '../combat/Fighter';
import type { AIStep, BoxerDef, Routine } from '../data/types';
import type { DifficultyDef } from '../data/difficulty';
import type { FightEvents } from '../combat/types';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { PlayerProfile } from './PlayerProfile';
import { clamp } from '../core/MathUtil';

/**
 * Pattern-driven opponent brain.
 *
 * Design rules this class enforces:
 *  1. Nothing is random at the level the player perceives. Routines are picked
 *     from a weighted list, but every routine is a fixed, learnable sequence
 *     with an honest telegraph in front of each attack.
 *  2. Adaptation only re-weights routines the boxer already owns. It never
 *     invents an unreadable attack, and every adaptive routine has its own
 *     distinct tell — so the counter-play is always visible.
 *  3. Phases add routines and tempo, never health.
 */
export class EnemyAI {
  readonly def: BoxerDef;
  readonly fighter: Fighter;

  private routine: Routine | null = null;
  private stepIndex = 0;
  private stepTimer = 0;
  private stepDuration = 0;
  private stepStarted = false;
  private idleTimer = 0;

  /** Cooldown bookkeeping, keyed by routine id. */
  private cooldowns = new Map<string, number>();
  /** Cache of phase-scaled attacks, keyed by `${attackKey}:${phase}`. */
  private scaledCache = new Map<string, AttackDef>();

  /** Pending reactive decision (block / counter) with its latency. */
  private reactTimer = 0;
  private reactAction: 'block' | 'counter' | null = null;
  /** The player attack we have already reacted to, so we react once per punch. */
  private seenAttack: AttackDef | null = null;
  private seenWhiff = false;

  /** Seconds the fighter has been holding a reactive guard. */
  private guardHold = 0;
  /** Whether this idle gap is being spent behind a guard. */
  private idleGuard = false;
  private idleGuardDecided = false;

  /** How long the opponent has gone without landing anything — drives frustration. */
  private frustration = 0;

  enabled = true;
  /** Training mode can pin the AI to a single routine. */
  forcedRoutine: string | null = null;
  /** Training mode: never attack, only stand there. */
  passive = false;

  constructor(
    def: BoxerDef,
    fighter: Fighter,
    private readonly profile: PlayerProfile,
    private readonly bus: EventBus<FightEvents>,
    private readonly rng: RNG,
    private difficulty: DifficultyDef,
  ) {
    this.def = def;
    this.fighter = fighter;
    this.fighter.weakness = def.phaseWeaknesses?.[0] ?? def.weakness;
  }

  setDifficulty(d: DifficultyDef): void {
    this.difficulty = d;
    this.scaledCache.clear();
  }

  get phase(): number { return this.fighter.phase; }

  /** The weak point currently in effect — bosses relocate theirs. */
  get currentWeakness(): Weakness {
    return this.fighter.weakness ?? this.def.weakness;
  }

  // -- Attack scaling --------------------------------------------------------

  private resolveAttack(key: string): AttackDef | null {
    const base = this.def.attacks[key];
    if (!base) return null;
    const cacheKey = `${key}:${this.fighter.phase}:${this.fighter.rage ? 'r' : 'n'}`;
    const cached = this.scaledCache.get(cacheKey);
    if (cached) return cached;

    const ph = this.fighter.phase;
    const speed = (this.def.ai.phaseSpeed[ph] ?? 1) * this.difficulty.speed * (this.fighter.rage ? 1.1 : 1);
    const dmg = (this.def.ai.phaseDamage[ph] ?? 1) * (this.fighter.rage ? 1.12 : 1);

    const scaled = scaleAttack(base, speed, dmg);
    // Telegraphs shrink with difficulty but never below a readable floor.
    if (scaled.telegraph) {
      scaled.telegraph.frames = Math.max(
        10, Math.round(base.telegraph!.frames * this.difficulty.telegraph / speed),
      );
    }
    this.scaledCache.set(cacheKey, scaled);
    return scaled;
  }

  // -- Phase management ------------------------------------------------------

  private updatePhase(): void {
    const thresholds = this.def.ai.phaseThresholds;
    const frac = this.fighter.health.fraction;
    let target = 0;
    for (let i = 0; i < thresholds.length; i++) if (frac <= thresholds[i]) target = i + 1;

    if (target !== this.fighter.phase) {
      this.fighter.phase = target;
      this.scaledCache.clear();
      // Bosses relocate their weak point between phases.
      const pw = this.def.phaseWeaknesses;
      if (pw && pw.length) this.fighter.weakness = pw[Math.min(target, pw.length - 1)];
      this.bus.emit('phaseChange', { fighter: this.fighter, phase: target, rage: this.fighter.rage });
      // A phase change always breaks the current routine so the new tempo reads.
      this.routine = null;
    }
  }

  /** Called by the referee when this fighter beats the count. */
  onGetUp(): void {
    this.routine = null;
    this.reactAction = null;
    const needed = this.def.ai.rageAfterKnockdowns;
    if (needed > 0 && this.fighter.totalKnockdowns >= needed && !this.fighter.rage) {
      this.fighter.rage = true;
      this.scaledCache.clear();
      this.bus.emit('phaseChange', { fighter: this.fighter, phase: this.fighter.phase, rage: true });
    }
  }

  // -- Routine selection -----------------------------------------------------

  private eligible(r: Routine): boolean {
    if ((this.cooldowns.get(r.id) ?? 0) > 0) return false;
    if (r.phases && !r.phases.includes(this.fighter.phase)) return false;
    if (r.rageOnly && !this.fighter.rage) return false;
    if (r.calmOnly && this.fighter.rage) return false;
    if (r.belowHealth !== undefined && this.fighter.health.fraction > r.belowHealth) return false;
    return true;
  }

  private weightOf(r: Routine): number {
    let w = r.weight;
    if (r.adapt) {
      // Adaptive multipliers are damped by difficulty and hard-capped.
      //
      // The cap is a fairness invariant, not a tuning knob: however
      // predictable the player becomes, no single punish may crowd out the
      // rest of a boxer's repertoire. An opponent that answers one habit with
      // one attack on loop has stopped being a pattern to learn and become a
      // wall. Raising this above ~2.6 measurably breaks that (see ai.test.ts).
      const raw = r.adapt(this.profile);
      const damped = 1 + (raw - 1) * this.difficulty.adapt;
      w *= clamp(damped, 0.4, 2.6);
    }
    // A boxer that keeps missing starts reaching for its heavier options.
    if (this.frustration > 3 && r.steps.some((s) => s.t === 'attack')) w *= 1.25;
    return w;
  }

  private pickRoutine(): Routine | null {
    if (this.forcedRoutine) {
      return this.def.routines.find((r) => r.id === this.forcedRoutine) ?? null;
    }
    const pool = this.def.routines.filter((r) => this.eligible(r));
    if (!pool.length) {
      // Cooldowns locked everything out — fall back to anything phase-legal.
      const fallback = this.def.routines.filter(
        (r) => (!r.phases || r.phases.includes(this.fighter.phase)) && !r.rageOnly,
      );
      return fallback.length ? this.rng.pick(fallback) : null;
    }
    return this.rng.pickWeighted(pool, pool.map((r) => this.weightOf(r)));
  }

  private startRoutine(): void {
    const r = this.pickRoutine();
    if (!r) return;
    this.routine = r;
    this.stepIndex = 0;
    this.stepStarted = false;
    if (r.cooldown) this.cooldowns.set(r.id, r.cooldown);
  }

  // -- Step execution --------------------------------------------------------

  private frames(v: number | [number, number]): number {
    return Array.isArray(v) ? this.rng.int(v[0], v[1]) : v;
  }

  private beginStep(step: AIStep): void {
    const f = this.fighter;
    this.stepStarted = true;
    this.stepTimer = 0;
    const tempo = (this.def.ai.phaseTempo[f.phase] ?? 1) * this.difficulty.tempo * (f.rage ? 0.8 : 1);

    switch (step.t) {
      case 'wait':
        this.stepDuration = this.frames(step.frames) * FRAME * tempo;
        break;

      case 'attack': {
        const def = this.resolveAttack(step.id);
        if (!def) { this.stepDuration = 0; break; }
        // Difficulty can slip an extra fake in front of any real attack.
        if (this.rng.chance(this.difficulty.feint) && def.telegraph) {
          f.beginWindup(def);
          this.feinting = true;
          this.stepDuration = def.telegraph.frames * FRAME * 0.6;
        } else {
          f.beginWindup(def);
          this.stepDuration = 0; // driven by the fighter's own state machine
        }
        if (def.telegraph) {
          this.bus.emit('telegraph', {
            fighter: f, kind: def.telegraph.kind, label: def.telegraph.label,
            color: def.telegraph.color, side: def.telegraph.side ?? 'center',
            frames: def.telegraph.frames,
          });
        }
        this.bus.emit('attackStart', { fighter: f, attack: def });
        break;
      }

      case 'feint': {
        const def = this.resolveAttack(step.id);
        if (!def) { this.stepDuration = 0; break; }
        f.beginWindup(def);
        this.feinting = true;
        const tf = step.frames ?? Math.round((def.telegraph?.frames ?? 18) * 0.65);
        this.stepDuration = tf * FRAME;
        if (def.telegraph) {
          this.bus.emit('telegraph', {
            fighter: f, kind: def.telegraph.kind, label: def.telegraph.label,
            color: def.telegraph.color, side: def.telegraph.side ?? 'center',
            frames: tf,
          });
        }
        break;
      }

      case 'guard':
        f.startBlock(this.rng.chance(0.3 + this.profile.highAim * 0.4) ? 'head' : 'body');
        this.stepDuration = this.frames(step.frames) * FRAME * tempo;
        break;

      case 'taunt':
        f.taunt(step.frames ?? 48);
        f.open(Math.round((step.frames ?? 48) * 0.75));
        this.stepDuration = (step.frames ?? 48) * FRAME;
        this.bus.emit('taunt', { fighter: f });
        break;

      case 'dodge':
        if (step.dir === 'duck') f.startDuck();
        else f.startDodge(step.dir === 'left' ? -1 : 1);
        this.stepDuration = 22 * FRAME;
        break;

      case 'step':
        this.stepDuration = 18 * FRAME * tempo;
        break;

      case 'expose':
        // Deliberate bait: stand open and dare the player to commit.
        f.setState(FState.Idle, 0);
        f.open(step.frames);
        this.stepDuration = step.frames * FRAME;
        break;
    }
  }

  private feinting = false;

  private stepComplete(): boolean {
    const f = this.fighter;
    const step = this.routine!.steps[this.stepIndex];
    if (step.t === 'attack' && !this.feinting) {
      // Real attacks finish when the fighter's own state machine says so.
      return f.state !== FState.Windup && f.state !== FState.Startup &&
        f.state !== FState.Active && f.state !== FState.Recovery;
    }
    return this.stepTimer >= this.stepDuration;
  }

  // -- Reactions -------------------------------------------------------------

  private considerReaction(player: Fighter): void {
    const f = this.fighter;
    if (this.passive || !this.enabled) return;

    // A new player attack resets the once-per-punch reaction latches.
    if (player.attack !== this.seenAttack) {
      this.seenAttack = player.attack;
      this.seenWhiff = false;
      if (player.attack && player.state === FState.Startup) {
        const blockP = this.def.ai.blockChance * this.difficulty.block;
        const counterP = this.def.ai.counterChance * this.difficulty.counter;
        if (f.state === FState.Idle || f.state === FState.Block) {
          if (this.def.ai.counterAttack && this.rng.chance(counterP)) this.queueReaction('counter');
          else if (this.rng.chance(blockP)) this.queueReaction('block');
        }
      }
    }

    // Punish a whiffed player punch, once per whiff.
    if (!this.seenWhiff && player.state === FState.Recovery && !player.attackConnected) {
      this.seenWhiff = true;
      const counterP = this.def.ai.counterChance * this.difficulty.counter;
      if (this.def.ai.counterAttack && this.rng.chance(counterP) &&
        (f.state === FState.Idle || f.state === FState.Block)) {
        this.queueReaction('counter');
      }
    }
  }

  private queueReaction(action: 'block' | 'counter'): void {
    this.reactAction = action;
    // Raising a guard is a reflex, not a decision. At full reaction latency the
    // block lands after the player's jab has already finished, which made
    // reactive defence useless — so blocks react roughly twice as fast.
    const latency = this.def.ai.reaction * this.difficulty.reaction;
    this.reactTimer = action === 'block' ? latency * 0.42 : latency;
  }

  private fireReaction(): void {
    const f = this.fighter;
    const action = this.reactAction;
    this.reactAction = null;
    if (!action || f.state !== FState.Idle && f.state !== FState.Block) return;

    if (action === 'block') {
      // Guard the height the player has been favouring.
      f.startBlock(this.profile.highAim > 0.5 ? 'head' : 'body');
      this.guardHold = 0.55;
    } else if (action === 'counter' && this.def.ai.counterAttack) {
      const def = this.resolveAttack(this.def.ai.counterAttack);
      if (def) {
        this.routine = null;
        f.beginWindup(def);
        if (def.telegraph) {
          this.bus.emit('telegraph', {
            fighter: f, kind: def.telegraph.kind, label: def.telegraph.label,
            color: def.telegraph.color, side: def.telegraph.side ?? 'center',
            frames: def.telegraph.frames,
          });
        }
        this.bus.emit('attackStart', { fighter: f, attack: def });
      }
    }
  }

  /** Called by the fight when this fighter lands or misses, for frustration. */
  notifyLanded(): void { this.frustration = 0; }
  notifyMissed(): void { this.frustration += 1; }

  // -- Main tick -------------------------------------------------------------

  update(dt: number, player: Fighter): void {
    const f = this.fighter;

    for (const [k, v] of this.cooldowns) {
      if (v > 0) this.cooldowns.set(k, Math.max(0, v - dt));
    }
    f.stamina.regenRate = 26 * this.difficulty.enemyStamina;
    this.updatePhase();

    if (!this.enabled || f.defeated || f.isDown) {
      this.routine = null;
      this.reactAction = null;
      return;
    }

    // Being hit cancels whatever we were doing.
    if (f.state === FState.HitStun || f.state === FState.Stagger ||
      f.state === FState.Stunned || f.state === FState.GettingUp) {
      this.routine = null;
      this.reactAction = null;
      this.feinting = false;
      // Take a beat behind the guard before committing again, instead of
      // walking straight into the next punch with the hands down.
      this.idleTimer = Math.max(this.idleTimer, 0.3);
      this.idleGuardDecided = false;
      return;
    }

    // Resolve a queued reaction after its latency.
    if (this.reactAction) {
      this.reactTimer -= dt;
      if (this.reactTimer <= 0) this.fireReaction();
    } else {
      this.considerReaction(player);
    }

    // Drop a reactive guard once its hold expires.
    if (this.guardHold > 0) {
      this.guardHold -= dt;
      if (this.guardHold <= 0 && f.state === FState.Block && !this.routine) f.stopBlock();
    }

    // A feint aborts the wind-up before the punch ever comes out.
    if (this.feinting && f.state === FState.Windup && this.stepTimer >= this.stepDuration) {
      f.pendingAttack = null;
      f.weaknessOpen = false;
      f.setState(FState.Recovery, 8);
      this.feinting = false;
    }

    if (this.passive) return;

    // --- Routine driver ---
    if (!this.routine) {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.startRoutine();
        if (this.routine) { this.idleTimer = 0; this.idleGuard = false; }
      }
      if (!this.routine) {
        // Between routines a boxer keeps their hands up. Standing with the
        // guard down is what made it possible to punch them for free all fight.
        if (!this.idleGuardDecided) {
          this.idleGuardDecided = true;
          this.idleGuard = this.rng.chance(
            clamp(this.def.ai.blockChance * this.difficulty.block * 2.2, 0, 0.92),
          );
        }
        if (this.idleGuard && f.state === FState.Idle) {
          f.startBlock(this.profile.highAim > 0.5 ? 'head' : 'body');
        }
        return;
      }
      this.idleGuardDecided = false;
    }

    const steps = this.routine.steps;
    if (!this.stepStarted) {
      if (f.busy && steps[this.stepIndex].t !== 'wait') return; // let the previous action finish
      this.beginStep(steps[this.stepIndex]);
      return;
    }

    this.stepTimer += dt;
    if (this.stepComplete()) {
      if (this.routine.steps[this.stepIndex].t === 'guard' && f.state === FState.Block) f.stopBlock();
      this.stepIndex++;
      this.stepStarted = false;
      if (this.stepIndex >= steps.length) {
        this.routine = null;
        const tempo = (this.def.ai.phaseTempo[f.phase] ?? 1) * this.difficulty.tempo * (f.rage ? 0.75 : 1);
        // Occasionally chain straight into the next routine with no breather.
        const chain = this.rng.chance(this.difficulty.chain + (f.rage ? 0.2 : 0));
        const gap = chain ? 0 : this.rng.int(this.def.ai.idleGap[0], this.def.ai.idleGap[1]) * FRAME * tempo;
        this.idleTimer = gap;
        this.idleGuardDecided = false;
      }
    }
  }

  reset(): void {
    this.routine = null;
    this.stepIndex = 0;
    this.stepStarted = false;
    this.idleTimer = 0.6;
    this.reactAction = null;
    this.feinting = false;
    this.seenAttack = null;
    this.seenWhiff = false;
    this.frustration = 0;
    this.idleGuard = false;
    this.idleGuardDecided = false;
    this.cooldowns.clear();
    this.scaledCache.clear();
    this.fighter.weakness = this.def.phaseWeaknesses?.[0] ?? this.def.weakness;
  }
}
