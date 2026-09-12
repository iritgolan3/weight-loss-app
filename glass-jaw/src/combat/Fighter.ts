import { AttackDef, DEFENSE, FRAME, HITSTUN, REEL_BREAK, Zone } from './Attack';
import { HealthSystem } from './HealthSystem';
import { StaminaSystem } from './StaminaSystem';
import { SpecialSystem } from './SpecialSystem';
import { clamp, clamp01, damp } from '../core/MathUtil';

export enum FState {
  Intro = 'Intro',
  Idle = 'Idle',
  Windup = 'Windup',
  Startup = 'Startup',
  Active = 'Active',
  Recovery = 'Recovery',
  Block = 'Block',
  Parry = 'Parry',
  Dodge = 'Dodge',
  Duck = 'Duck',
  HitStun = 'HitStun',
  Stagger = 'Stagger',
  Stunned = 'Stunned',
  KnockedDown = 'KnockedDown',
  GettingUp = 'GettingUp',
  Taunt = 'Taunt',
  Victory = 'Victory',
  Defeat = 'Defeat',
}

/** The specific tell + punch pairing that opens a boxer up. */
export interface Weakness {
  /** Telegraph kinds during which the weak point is exposed. */
  telegraphKinds: string[];
  /** The punch zone that exploits it. */
  zone: Zone;
  damageMult: number;
  stunBonus: number;
  /** Player-facing description, shown on the boxer profile screen. */
  hint: string;
}

export interface FighterStats {
  maxHealth: number;
  maxStamina: number;
  /** Incoming damage multiplier is 1 / (1 + defense). */
  defense: number;
  /** Outgoing damage multiplier. */
  power: number;
  /** Scales startup/recovery: >1 is faster. */
  speed: number;
  /** Widens perfect-dodge/parry windows and boosts counter damage. */
  counter: number;
  /** Stun meter capacity — higher resists dizzying. */
  poise: number;
  /** Fraction of health restored after beating the count, per knockdown. */
  getUpHealth: number;
  /** Higher = fewer knockdowns needed to finish them. */
  knockdownResistance: number;
}

export const DEFAULT_STATS: FighterStats = {
  maxHealth: 100, maxStamina: 100, defense: 0, power: 1, speed: 1,
  counter: 1, poise: 100, getUpHealth: 0.6, knockdownResistance: 1,
};

/**
 * Shared fighter state machine. The player and every opponent are the same
 * class; only the controller on top differs (PlayerController vs EnemyAI).
 *
 * All timing is expressed in 60fps frames and stored in seconds, so the same
 * frame data reads identically regardless of the simulation rate.
 */
export class Fighter {
  readonly health: HealthSystem;
  readonly stamina: StaminaSystem;
  readonly special = new SpecialSystem();
  stats: FighterStats;

  readonly isPlayer: boolean;
  name: string;

  state: FState = FState.Idle;
  /** Seconds spent in the current state. */
  stateTime = 0;
  /** Planned duration of the current state, in seconds. 0 = open-ended. */
  stateDuration = 0;

  // --- Attack bookkeeping ---
  attack: AttackDef | null = null;
  /** Seconds at which each hit of the current attack becomes live. */
  readonly hitTimes: number[] = [];
  /** Seconds since the current attack was committed. Independent of stateTime. */
  attackClock = 0;
  /**
   * Monotonic id for the current attack. Lets observers tell a multi-hit combo
   * (one attack, several hits) apart from two separate attacks.
   */
  attackSeq = 0;
  /** Total seconds the current attack will take, wind-up excluded. */
  attackTotal = 0;
  /** Index of the next hit to resolve. */
  hitIndex = 0;
  /** True once the current hit has been resolved by the combat system. */
  hitResolved = true;
  /** Set false when any hit of this attack connects — drives whiff punishing. */
  attackConnected = false;

  // --- Telegraph ---
  telegraphKind: string | null = null;
  telegraphSide: 'left' | 'right' | 'center' = 'center';
  telegraphColor = '#ffd166';
  telegraphLabel = '';
  /** The tell that preceded the current attack, kept so the wind-up can
   *  carry through into the punch instead of popping back to guard. */
  lastTelegraphKind: string | null = null;
  /** Queued attack that fires when the wind-up completes. */
  pendingAttack: AttackDef | null = null;

  // --- Defence ---
  guardZone: Zone = 'head';
  /** Seconds of invulnerability remaining. */
  invuln = 0;
  dodgeDir: -1 | 0 | 1 = 0;
  /** Seconds remaining in which a block counts as a parry. */
  parryTimer = 0;
  /**
   * Seconds this fighter is wide open to a PERFECT counter.
   *
   * This is only ever set by something the opponent earned — a perfect dodge,
   * a parry, a guard break or a stun. Ordinary attack recovery is not "open":
   * hitting someone in recovery is a normal counter, which is worth less and
   * does not need to be read. Keeping these separate is what stops a player
   * from mashing their way into a stream of maximum-value counters.
   */
  openTimer = 0;
  /** The tell/punch pairing that punishes this fighter. Null for the player. */
  weakness: Weakness | null = null;
  /** True while this fighter's weak point is exposed. */
  weaknessOpen = false;

  // --- Damage state ---
  stunMeter = 0;
  knockdowns = 0;
  /** Fight-wide count of times this fighter hit the canvas. */
  totalKnockdowns = 0;
  countdown = 0;
  /** Set while a fighter is being counted out. */
  counting = false;
  defeated = false;

  // --- Presentation (read by the renderer; never affects logic) ---
  /** Horizontal body offset in ring units, -1..1. */
  lean = 0;
  /** Vertical crouch, 0 = standing, 1 = fully ducked. */
  crouch = 0;
  /** Recoil impulse from being hit; decays to 0. */
  recoil = 0;
  recoilDir = 0;
  /** White hit flash, 0..1. */
  flash = 0;
  /** Glow used for telegraph tells, 0..1. */
  tellGlow = 0;
  /** Rage/phase visual intensity. */
  ragePulse = 0;
  /** Breathing/bob phase. */
  bob = 0;
  /** Set on knockdown; drives the sprawl pose. */
  downPose = 0;
  /** Current phase index (opponents use this for multi-phase fights). */
  phase = 0;
  rage = false;

  constructor(name: string, isPlayer: boolean, stats: Partial<FighterStats> = {}) {
    this.name = name;
    this.isPlayer = isPlayer;
    this.stats = { ...DEFAULT_STATS, ...stats };
    this.health = new HealthSystem(this.stats.maxHealth);
    this.stamina = new StaminaSystem(this.stats.maxStamina);
  }

  // -- Queries ---------------------------------------------------------------

  get busy(): boolean {
    return this.state === FState.Startup || this.state === FState.Active ||
      this.state === FState.Recovery || this.state === FState.Windup ||
      this.state === FState.HitStun || this.state === FState.Stagger ||
      this.state === FState.Stunned || this.state === FState.KnockedDown ||
      this.state === FState.GettingUp || this.state === FState.Taunt ||
      this.state === FState.Dodge || this.state === FState.Parry;
  }

  /** Can this fighter start a new voluntary action right now? */
  get canAct(): boolean {
    if (this.defeated) return false;
    switch (this.state) {
      case FState.Idle:
      case FState.Block:
      case FState.Duck:
        return true;
      case FState.Recovery:
        // Late-cancel: the last few recovery frames accept a new input, which
        // is what makes chained punches feel fluid instead of sticky.
        return this.stateTime >= this.stateDuration - 3 * FRAME;
      default:
        return false;
    }
  }

  get isAttacking(): boolean {
    return this.state === FState.Startup || this.state === FState.Active || this.state === FState.Recovery;
  }

  /**
   * Committed to an offensive action — wind-up included. Catching someone
   * mid-telegraph is a counter, which is the whole reward for reading a tell.
   */
  /**
   * In a read window: winding up, or recovering from something that missed.
   *
   * These are the two moments a pattern-based fight is ABOUT — the tell you
   * saw coming, and the recovery you earned by making him miss. Startup and
   * active frames are deliberately excluded: trading punches with a fighter
   * mid-swing is not a counter, it is a trade, and letting it score as one
   * meant every exchange in the game paid counter damage.
   */
  get isCommitted(): boolean {
    if (this.counterLock > 0) return false;
    return this.state === FState.Windup || this.state === FState.Recovery;
  }

  /**
   * Blocks counter chaining.
   *
   * Set whenever a counter lands. Without it a heavy counter staggers them,
   * a stagger reads as an opening, and the opening pays another heavy
   * counter -- a loop that let a mediocre player TKO the entire roster
   * inside one round without ever reading a telegraph.
   */
  counterLock = 0;

  get isDown(): boolean {
    return this.state === FState.KnockedDown || this.state === FState.GettingUp;
  }

  get isStunned(): boolean { return this.state === FState.Stunned; }

  get isBlocking(): boolean { return this.state === FState.Block; }

  get isInvulnerable(): boolean { return this.invuln > 0; }

  /**
   * Wide open: guaranteed perfect counter for the attacker.
   *
   * Only states the ATTACKER earned. A stagger used to be on this list, which
   * made every heavy hit its own next opening.
   */
  get isOpen(): boolean {
    if (this.counterLock > 0) return false;
    return this.openTimer > 0 || this.state === FState.Stunned;
  }

  /** 0..1 progress through the current state. */
  get progress(): number {
    return this.stateDuration > 0 ? clamp01(this.stateTime / this.stateDuration) : 0;
  }

  /** 0..1 progress through the whole current attack, wind-up excluded. */
  get attackProgress(): number {
    if (!this.attack || this.attackTotal <= 0) return 0;
    return clamp01(this.attackClock / this.attackTotal);
  }

  /** Seconds until the next hit goes live; negative once it has passed. */
  get timeToImpact(): number {
    if (!this.attack || this.hitIndex >= this.hitTimes.length) return Infinity;
    return this.hitTimes[this.hitIndex] - this.attackClock;
  }

  get stunFraction(): number { return clamp01(this.stunMeter / this.stats.poise); }

  // -- State control ---------------------------------------------------------

  setState(state: FState, durationFrames = 0): void {
    this.state = state;
    this.stateTime = 0;
    this.stateDuration = durationFrames * FRAME;
  }

  /** Open this fighter up to perfect counters for a number of frames. */
  open(frames: number): void {
    this.openTimer = Math.max(this.openTimer, frames * FRAME);
  }

  /** Enter a telegraphed wind-up that resolves into `def`. */
  beginWindup(def: AttackDef): void {
    const tg = def.telegraph;
    this.pendingAttack = def;
    this.telegraphKind = tg?.kind ?? null;
    this.telegraphSide = tg?.side ?? 'center';
    this.telegraphColor = tg?.color ?? '#ffd166';
    this.telegraphLabel = tg?.label ?? def.name;
    this.weaknessOpen = !!(this.weakness && tg && this.weakness.telegraphKinds.includes(tg.kind));
    this.lastTelegraphKind = tg?.kind ?? null;
    this.setState(FState.Windup, tg?.frames ?? 12);
  }

  /** Commit to an attack immediately (no wind-up). */
  startAttack(def: AttackDef): void {
    this.attack = def;
    this.attackSeq++;
    this.pendingAttack = null;
    this.telegraphKind = null;
    this.weaknessOpen = false;
    this.attackConnected = false;
    this.hitIndex = 0;
    this.hitResolved = false;

    const hits = def.hits ?? 1;
    // Each extra strike costs its active frames plus a short re-chamber.
    const stride = def.active + 6;
    this.hitTimes.length = 0;
    for (let i = 0; i < hits; i++) this.hitTimes.push((def.startup + i * stride) * FRAME);

    this.attackClock = 0;
    this.attackTotal = (def.startup + (hits - 1) * stride + def.active + def.recovery) * FRAME;
    this.setState(FState.Startup, def.startup);
  }

  /** Cancel the current action outright (interrupted by a hit). */
  interrupt(): void {
    this.attack = null;
    this.pendingAttack = null;
    this.telegraphKind = null;
    this.hitTimes.length = 0;
    this.weaknessOpen = false;
    this.attackClock = 0;
    this.attackTotal = 0;
    this.invuln = 0;
    this.dodgeDir = 0;
  }

  startDodge(dir: -1 | 1): void {
    this.dodgeDir = dir;
    this.invuln = 0; // granted after startup
    const total = DEFENSE.dodgeStartup + DEFENSE.dodgeIFrames + DEFENSE.dodgeRecovery;
    this.setState(FState.Dodge, total);
  }

  startDuck(): void {
    this.dodgeDir = 0;
    const total = DEFENSE.dodgeStartup + DEFENSE.dodgeIFrames + DEFENSE.dodgeRecovery;
    this.setState(FState.Duck, total);
  }

  startBlock(zone: Zone): void {
    const fresh = this.state !== FState.Block;
    this.guardZone = zone;
    if (fresh) {
      this.setState(FState.Block, 0);
      // Fresh guard = parry window. Holding block forever never parries.
      this.parryTimer = DEFENSE.parryWindow * FRAME * this.stats.counter;
    }
  }

  stopBlock(): void {
    if (this.state === FState.Block) this.setState(FState.Idle, 0);
  }

  taunt(frames = 48): void {
    this.setState(FState.Taunt, frames);
  }

  // -- Damage ----------------------------------------------------------------

  /**
   * Chip damage through a guard. Costs health without breaking the block —
   * a blocked punch must never knock the defender out of their own stance.
   */
  takeChip(amount: number, weight: number, dir: number): boolean {
    this.health.damage(amount / (1 + Math.max(0, this.stats.defense)));
    this.flash = Math.max(this.flash, 0.5);
    this.recoil = Math.max(this.recoil, 0.16 + weight * 0.08);
    this.recoilDir = dir;
    if (this.health.isDown) { this.knockDown(); return true; }
    return false;
  }

  /**
   * True while this fighter is committed to an attack and therefore armoured.
   *
   * A punch that lands here still hurts, but it does NOT cancel the attack.
   * Without this the game has no risk: a player can simply mash, interrupt
   * every wind-up on reaction, and the opponent never gets a punch off. With
   * it, hitting someone mid-wind-up means trading — which is exactly the
   * decision the game is meant to be about.
   */
  get hasArmor(): boolean {
    return this.state === FState.Windup || this.state === FState.Startup ||
      this.state === FState.Active;
  }

  /**
   * Applies damage and the appropriate reaction. Returns true if knocked down.
   *
   * `breakArmor` is set for the hits that have earned the right to stop an
   * attack outright: a weak-point hit, a special punch, or anything that fills
   * the stun meter or empties the health bar.
   */
  takeDamage(
    amount: number, stunPower: number, weight: number, dir: number,
    heavy: boolean, breakArmor = false,
  ): boolean {
    const mitigated = amount / (1 + Math.max(0, this.stats.defense));
    this.health.damage(mitigated);
    this.stunMeter = clamp(this.stunMeter + stunPower, 0, this.stats.poise * 1.2);
    this.flash = 1;
    this.recoil = Math.min(1.4, 0.42 + weight * 0.3);
    this.recoilDir = dir;

    if (this.health.isDown) { this.knockDown(); return true; }

    // --- Reel break ---------------------------------------------------------
    //
    // Count hits taken without ever getting back to neutral in between. On the
    // third, the fighter is shoved clear with a short window of invulnerability
    // instead of being pinned in place.
    //
    // "Difficult but fair" has to mean something mechanical, and this is it:
    // however badly you are losing, you always get the ring back and a chance
    // to do something about it. Without it the reeling states feed each other
    // -- a stunned fighter is wide open, a hit on a wide-open fighter is a
    // counter, a counter stuns -- and a bad moment becomes a fight you never
    // touch a button in again.
    //
    // Counted here, above the stun and armour branches, because a hit that
    // stuns is still a hit the fighter could not answer; leaving it out let a
    // run reach four.
    const willReact = this.stunMeter >= this.stats.poise || !this.hasArmor || breakArmor;
    if (willReact) {
      const reeling = this.state === FState.HitStun || this.state === FState.Stagger ||
        this.state === FState.Stunned;
      this.reelCount = reeling ? this.reelCount + 1 : 1;
      if (this.reelCount >= 3) {
        this.reelCount = 0;
        this.stunMeter = 0;
        // Clear the dodge direction with it. A tracking attack is allowed to
        // follow a predictable DODGE through its i-frames, but the reel break
        // is not a dodge — it is the guarantee that the fighter gets the ring
        // back, and a stale dodgeDir was letting tracking attacks through it.
        this.dodgeDir = 0;
        this.invuln = REEL_BREAK * FRAME;
        this.interrupt();
        this.setState(FState.HitStun, REEL_BREAK);
        return false;
      }
    }

    if (this.stunMeter >= this.stats.poise) {
      this.stunMeter = 0;
      this.interrupt();
      this.setState(FState.Stunned, HITSTUN.stunned);
      return false;
    }

    // Armoured: take the damage, flinch visibly, but throw the punch anyway.
    if (this.hasArmor && !breakArmor) return false;

    this.invuln = 0;
    this.openTimer = 0;
    this.interrupt();
    this.setState(heavy ? FState.Stagger : FState.HitStun, heavy ? HITSTUN.heavy : HITSTUN.light);
    return false;
  }

  /** Consecutive hits taken without returning to neutral. See takeDamage. */
  reelCount = 0;

  knockDown(): void {
    this.interrupt();
    this.knockdowns++;
    this.totalKnockdowns++;
    this.stunMeter = 0;
    this.health.current = 0;
    this.downPose = 0;
    this.counting = true;
    this.countdown = 0;
    this.setState(FState.KnockedDown, 0);
  }

  beginGetUp(): void {
    this.counting = false;
    // Each trip to the canvas leaves them with less in the tank.
    const restore = Math.max(0.28, this.stats.getUpHealth - 0.12 * (this.knockdowns - 1));
    this.health.restoreTo(restore);
    this.stamina.current = this.stamina.max * 0.75;
    this.setState(FState.GettingUp, HITSTUN.knockdownGetUp);
  }

  countOut(): void {
    this.counting = false;
    this.defeated = true;
    this.setState(FState.Defeat, 0);
  }

  // -- Per-frame -------------------------------------------------------------

  update(dt: number): void {
    this.stateTime += dt;
    this.health.update(dt);
    this.stamina.update(dt, this.state === FState.Block);
    this.special.update(dt);

    this.invuln = Math.max(0, this.invuln - dt);
    this.parryTimer = Math.max(0, this.parryTimer - dt);
    this.openTimer = Math.max(0, this.openTimer - dt);
    this.stunMeter = Math.max(0, this.stunMeter - dt * this.stats.poise * 0.12);

    if (this.attack) this.attackClock += dt;

    // Fast enough to read as an impact frame rather than a glow.
    this.flash = Math.max(0, this.flash - dt * 13);
    this.counterLock = Math.max(0, this.counterLock - dt);
    // Back on their feet and able to act: the reel is over.
    if (this.state === FState.Idle || this.state === FState.Block) this.reelCount = 0;
    this.recoil = damp(this.recoil, 0, 9, dt);
    this.bob += dt;

    if (this.rage) this.ragePulse = 0.6 + Math.sin(this.bob * 9) * 0.4;
    else this.ragePulse = damp(this.ragePulse, 0, 4, dt);

    this.updateLean(dt);
    this.updateStateMachine(dt);
  }

  private updateLean(dt: number): void {
    let targetLean = 0;
    let targetCrouch = 0;

    if (this.state === FState.Dodge) {
      // Dodge displacement peaks in the middle of the i-frames.
      const p = this.progress;
      const bell = Math.sin(clamp01(p) * Math.PI);
      targetLean = this.dodgeDir * bell;
    } else if (this.state === FState.Duck) {
      targetCrouch = Math.sin(clamp01(this.progress) * Math.PI);
    } else if (this.state === FState.Block) {
      targetCrouch = this.guardZone === 'body' ? 0.28 : 0.1;
    }

    this.lean = damp(this.lean, targetLean, 26, dt);
    this.crouch = damp(this.crouch, targetCrouch, 24, dt);
    this.tellGlow = damp(this.tellGlow, this.state === FState.Windup ? 1 : 0, 14, dt);
  }

  private updateStateMachine(dt: number): void {
    switch (this.state) {
      case FState.Dodge:
      case FState.Duck: {
        const startup = DEFENSE.dodgeStartup * FRAME;
        const iEnd = startup + DEFENSE.dodgeIFrames * FRAME * this.stats.counter;
        if (this.stateTime >= startup && this.stateTime < iEnd) {
          this.invuln = Math.max(this.invuln, iEnd - this.stateTime);
        }
        if (this.stateTime >= this.stateDuration) {
          this.dodgeDir = 0;
          this.setState(FState.Idle, 0);
        }
        break;
      }

      case FState.Windup:
        if (this.stateTime >= this.stateDuration) {
          const next = this.pendingAttack;
          if (next) this.startAttack(next);
          else this.setState(FState.Idle, 0);
        }
        break;

      case FState.Startup:
        if (this.attack && this.attackClock >= this.hitTimes[this.hitIndex]) {
          this.setState(FState.Active, this.attack.active);
          this.hitResolved = false;
        }
        break;

      case FState.Active:
        if (this.attack && this.stateTime >= this.stateDuration) {
          this.hitIndex++;
          if (this.hitIndex < this.hitTimes.length) {
            // Re-chamber for the next strike of a multi-hit special.
            const gap = (this.hitTimes[this.hitIndex] - this.attackClock) / FRAME;
            this.setState(FState.Startup, Math.max(1, gap));
          } else {
            const rec = this.attack.recovery;
            this.setState(FState.Recovery, rec);
            // Missing is punished: a whiff leaves a genuine opening. Landing
            // does not — otherwise every exchange hands the other fighter a
            // free maximum-value counter and mashing becomes optimal.
            if (!this.attackConnected) this.open(Math.round(rec * 0.55));
          }
        }
        break;

      case FState.Recovery:
        if (this.stateTime >= this.stateDuration) {
          this.attack = null;
          this.setState(FState.Idle, 0);
        }
        break;

      case FState.HitStun:
      case FState.Stagger:
      case FState.Parry:
        if (this.stateTime >= this.stateDuration) this.setState(FState.Idle, 0);
        break;

      case FState.Stunned:
        if (this.stateTime >= this.stateDuration) {
          this.setState(FState.Idle, 0);
          this.stunMeter = 0;
        }
        break;

      case FState.KnockedDown:
        this.downPose = Math.min(1, this.downPose + dt * 3.5);
        break;

      case FState.GettingUp:
        if (this.stateTime >= this.stateDuration) {
          this.downPose = 0;
          this.setState(FState.Idle, 0);
        }
        break;

      case FState.Taunt:
        if (this.stateTime >= this.stateDuration) this.setState(FState.Idle, 0);
        break;

      default:
        break;
    }
  }

  /** True on the exact frame a hit should be resolved. */
  pollHitWindow(): boolean {
    if (this.state !== FState.Active || !this.attack || this.hitResolved) return false;
    this.hitResolved = true;
    return true;
  }

  resetForFight(): void {
    this.health.restoreTo(1);
    this.stamina.reset();
    this.special.reset();
    this.stunMeter = 0;
    this.knockdowns = 0;
    this.totalKnockdowns = 0;
    this.defeated = false;
    this.counting = false;
    this.countdown = 0;
    this.phase = 0;
    this.rage = false;
    this.downPose = 0;
    this.lean = 0;
    this.crouch = 0;
    this.recoil = 0;
    this.flash = 0;
    this.interrupt();
    this.setState(FState.Idle, 0);
  }

  resetForRound(): void {
    this.stamina.reset();
    this.stunMeter = 0;
    this.knockdowns = 0;
    this.counting = false;
    this.interrupt();
    this.setState(FState.Idle, 0);
  }
}
