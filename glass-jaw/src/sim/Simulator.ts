import { Fighter, FState, FighterStats } from '../combat/Fighter';
import { CombatSystem } from '../combat/CombatSystem';
import { DEFAULT_FIGHT, FightConfig, FightPhase, FightResult, Referee } from '../combat/Referee';
import { EnemyAI } from '../ai/EnemyAI';
import { PlayerProfile } from '../ai/PlayerProfile';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { getDifficulty, type Difficulty } from '../data/difficulty';
import type { BoxerDef } from '../data/types';
import { DEFENSE, FRAME, playerPunch, specialForTokens } from '../combat/Attack';
import type { FightEvents, HitResult } from '../combat/types';
import { PLAYER_BASE_STATS } from '../data/player';

export interface SimResult {
  boxer: string;
  difficulty: Difficulty;
  won: boolean;
  method: FightResult['method'];
  rounds: number;
  seconds: number;
  playerHealth: number;
  opponentHealth: number;
  punchesThrown: number;
  punchesLanded: number;
  perfectDodges: number;
  parries: number;
  counters: number;
  weaknessHits: number;
  knockdownsDealt: number;
  knockdownsTaken: number;
  blocked: number;
  /**
   * Hits taken while genuinely unable to respond — that is, already in hit
   * reaction. Being hit during your own punch recovery is NOT counted: that is
   * a fair whiff punish, and the player chose to throw it.
   */
  unavoidableHits: number;
}

export type BotSkill = 'perfect' | 'good' | 'sloppy' | 'masher';

interface BotConfig {
  /** Probability of correctly reacting to a telegraph. */
  reactAccuracy: number;
  /** Reaction delay in seconds after a telegraph starts. */
  reactionTime: number;
  /** Probability of taking an offered counter window. */
  counterUptake: number;
  /** Probability of going for the weak point when it is exposed. */
  weaknessUptake: number;
  /** Chance of throwing a pointless punch on any given idle frame. */
  idleAggression: number;
  /** Prefers dodging over blocking. */
  dodgePreference: number;
}

const BOTS: Record<BotSkill, BotConfig> = {
  perfect: { reactAccuracy: 0.98, reactionTime: 0.1, counterUptake: 0.95, weaknessUptake: 0.95, idleAggression: 0.004, dodgePreference: 0.8 },
  good: { reactAccuracy: 0.82, reactionTime: 0.19, counterUptake: 0.75, weaknessUptake: 0.6, idleAggression: 0.012, dodgePreference: 0.6 },
  sloppy: { reactAccuracy: 0.5, reactionTime: 0.3, counterUptake: 0.4, weaknessUptake: 0.2, idleAggression: 0.03, dodgePreference: 0.45 },
  masher: { reactAccuracy: 0.05, reactionTime: 0.4, counterUptake: 0.1, weaknessUptake: 0.02, idleAggression: 0.35, dodgePreference: 0.2 },
};

/**
 * Headless fight runner.
 *
 * Runs a complete bout with a scripted player, with no rendering, audio or
 * input. This is how the game is balance-tested: a "perfect" bot should beat
 * everybody, a "masher" should lose to almost everybody, and the gap between
 * them is the skill ceiling the design is aiming for.
 */
export class Simulator {
  private readonly bus = new EventBus<FightEvents>();
  private readonly rng: RNG;
  readonly player: Fighter;
  readonly opponent: Fighter;
  private readonly combat: CombatSystem;
  private readonly ai: EnemyAI;
  private readonly ref: Referee;
  private readonly profile = new PlayerProfile();
  private readonly bot: BotConfig;

  private stats = {
    punchesThrown: 0, punchesLanded: 0, perfectDodges: 0, parries: 0,
    counters: 0, weaknessHits: 0, knockdownsDealt: 0, knockdownsTaken: 0,
    blocked: 0, unavoidableHits: 0,
  };

  /** Set while the bot has decided to react to the current telegraph. */
  private reactTimer = -1;
  private reactPlan: 'dodgeLeft' | 'dodgeRight' | 'block' | 'weakness' | null = null;
  private reactedTo: string | null = null;
  /** The opponent attack that put the player into their current hit reaction. */
  private stunnedBy = -1;

  constructor(
    private readonly def: BoxerDef,
    private readonly difficulty: Difficulty,
    skill: BotSkill = 'good',
    seed = 12345,
    playerStats: Partial<FighterStats> = {},
    config: Partial<FightConfig> = {},
  ) {
    this.rng = new RNG(seed);
    this.bot = BOTS[skill];
    const d = getDifficulty(difficulty);

    this.player = new Fighter('Bot', true, { ...PLAYER_BASE_STATS, ...playerStats });
    this.player.stats.counter *= d.window;
    this.opponent = new Fighter(def.name, false, def.stats);

    this.combat = new CombatSystem(this.bus, {
      // A stub clock: hit-stop and slow motion are presentation only.
      hitStop: () => undefined, slowMo: () => undefined,
    } as never);
    this.combat.options.enemyDamageScale = d.enemyDamage;
    this.combat.options.playerDamageScale = d.playerDamage;

    this.ai = new EnemyAI(def, this.opponent, this.profile, this.bus, this.rng, d);
    this.ref = new Referee(
      { ...DEFAULT_FIGHT, ...config }, this.player, this.opponent, this.bus,
      (f) => { if (!f.isPlayer) this.ai.onGetUp(); },
    );

    this.bus.on('hit', (r) => this.onHit(r));
    this.bus.on('knockdown', ({ fighter }) => {
      if (fighter.isPlayer) this.stats.knockdownsTaken++;
      else this.stats.knockdownsDealt++;
      this.ref.onKnockdown(fighter);
    });
  }

  private onHit(r: HitResult): void {
    if (r.attacker.isPlayer) {
      switch (r.outcome) {
        case 'hit': case 'counter': case 'perfectCounter': case 'weakness':
          this.stats.punchesLanded++;
          if (r.outcome === 'weakness') this.stats.weaknessHits++;
          if (r.outcome === 'counter' || r.outcome === 'perfectCounter') this.stats.counters++;
          break;
        default: break;
      }
      this.ref.noteDamage(true, r.damage);
    } else {
      if (r.outcome === 'perfectDodge') this.stats.perfectDodges++;
      else if (r.outcome === 'parry') this.stats.parries++;
      else if (r.outcome === 'block' || r.outcome === 'grazeBlock') this.stats.blocked++;
      else if (r.outcome === 'hit' || r.outcome === 'counter' || r.outcome === 'perfectCounter') {
        this.ref.noteDamage(false, r.damage);
        // True chain-stun: a SEPARATE attack landing while the player is still
        // reeling. Later hits of one multi-hit combo are not counted — landing
        // a whole combo is the point of throwing one.
        const reeling = this.player.state === FState.HitStun ||
          this.player.state === FState.Stagger || this.player.state === FState.Stunned;
        if (reeling && this.opponent.attackSeq !== this.stunnedBy) this.stats.unavoidableHits++;
        this.stunnedBy = this.opponent.attackSeq;
      }
    }
  }

  // -- The scripted player ---------------------------------------------------

  private think(dt: number): void {
    const p = this.player;
    const o = this.opponent;
    if (p.isDown || p.defeated) return;

    // React to a telegraph exactly once.
    if (o.state === FState.Windup && o.telegraphKind && this.reactedTo !== o.telegraphKind + o.stateTime) {
      if (this.reactTimer < 0) {
        this.reactedTo = null;
        const w = o.weakness;
        const canWeakness = o.weaknessOpen && w && o.telegraphKind &&
          w.telegraphKinds.includes(o.telegraphKind);

        if (canWeakness && this.rng.chance(this.bot.weaknessUptake)) {
          this.reactPlan = 'weakness';
          // Go early — the weak point closes when the punch comes out.
          this.reactTimer = this.bot.reactionTime * 0.4;
        } else if (this.rng.chance(this.bot.reactAccuracy)) {
          const tracking = o.pendingAttack?.tracking;
          if (this.rng.chance(this.bot.dodgePreference)) {
            // Slip away from the incoming hand, and never into a tracking shot.
            let dir: 'dodgeLeft' | 'dodgeRight' =
              o.telegraphSide === 'left' ? 'dodgeRight' : 'dodgeLeft';
            if (tracking === 'left' && dir === 'dodgeLeft') dir = 'dodgeRight';
            if (tracking === 'right' && dir === 'dodgeRight') dir = 'dodgeLeft';
            this.reactPlan = dir;
          } else {
            this.reactPlan = 'block';
          }
          // Time the reaction to land just before impact for a perfect window.
          const untilImpact = Math.max(0, o.stateDuration - o.stateTime);
          this.reactTimer = Math.max(0, untilImpact - DEFENSE.dodgeStartup * FRAME - 0.03);
        }
      }
    }

    if (this.reactTimer >= 0) {
      this.reactTimer -= dt;
      if (this.reactTimer <= 0) {
        this.reactTimer = -1;
        this.reactedTo = (o.telegraphKind ?? '') + o.stateTime;
        this.execute();
        return;
      }
    }

    if (!p.canAct) return;

    // Punish an opening.
    if (o.isOpen && this.rng.chance(this.bot.counterUptake)) {
      const special = specialForTokens(p.special.tokens);
      if (special && p.special.tokens >= 2) {
        p.special.spend(p.special.tokens);
        p.startAttack(special);
      } else {
        const a = playerPunch(this.rng.chance(0.5) ? 'left' : 'right', 'head');
        p.startAttack(a);
        p.stamina.spend(a.stamina);
      }
      this.stats.punchesThrown++;
      return;
    }

    // Otherwise throw the occasional speculative punch.
    if (this.rng.chance(this.bot.idleAggression)) {
      const a = playerPunch(this.rng.chance(0.5) ? 'left' : 'right', this.rng.chance(0.7) ? 'head' : 'body');
      p.startAttack(a);
      p.stamina.spend(a.stamina);
      this.profile.recordPunch(a.zone, o.state === FState.Windup);
      this.stats.punchesThrown++;
    } else if (p.state === FState.Block) {
      p.stopBlock();
    }
  }

  private execute(): void {
    const p = this.player;
    const o = this.opponent;
    if (!p.canAct) return;
    switch (this.reactPlan) {
      case 'dodgeLeft':
        p.startDodge(-1);
        this.profile.recordDodge(-1);
        break;
      case 'dodgeRight':
        p.startDodge(1);
        this.profile.recordDodge(1);
        break;
      case 'block':
        p.startBlock(o.pendingAttack?.zone ?? 'head');
        this.profile.recordBlock();
        break;
      case 'weakness': {
        const zone = o.weakness?.zone ?? 'head';
        const a = playerPunch(this.rng.chance(0.5) ? 'left' : 'right', zone);
        p.startAttack(a);
        p.stamina.spend(a.stamina);
        this.stats.punchesThrown++;
        this.profile.recordPunch(zone, true);
        break;
      }
      default: break;
    }
    this.reactPlan = null;
  }

  /** Runs the whole bout. Returns once it is decided or the cap is hit. */
  run(maxSeconds = 900): SimResult {
    const dt = 1 / 120;
    this.player.resetForFight();
    this.opponent.resetForFight();
    this.ai.reset();
    this.ref.reset();
    // Skip the entrance; there is nothing to watch.
    this.ref.skipIntro();

    let t = 0;
    while (this.ref.phase !== FightPhase.Finished && t < maxSeconds) {
      this.ref.update(dt, this.def.ai.getUpSpeed);
      if (this.ref.phase === FightPhase.Count && this.ref.downed?.isPlayer) this.ref.mash();

      if (this.ref.inputsLive) {
        this.think(dt);
        this.ai.update(dt, this.player);
        this.combat.update(this.player, this.opponent);
      }
      this.player.update(dt);
      this.opponent.update(dt);
      this.profile.update(dt);
      t += dt;
    }

    const r = this.ref.result;
    return {
      boxer: this.def.id,
      difficulty: this.difficulty,
      won: r?.winner === this.player,
      method: r?.method ?? 'DRAW',
      rounds: this.ref.round,
      seconds: this.ref.elapsed,
      playerHealth: this.player.health.fraction,
      opponentHealth: this.opponent.health.fraction,
      ...this.stats,
    };
  }

  /** Exposes the profile so adaptation can be inspected. */
  get playerProfile(): PlayerProfile { return this.profile; }
  get enemyAI(): EnemyAI { return this.ai; }
}
