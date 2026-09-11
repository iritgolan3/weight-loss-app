import { Fighter, FState } from './Fighter';
import type { FightEvents } from './types';
import { EventBus } from '../core/EventBus';

export enum FightPhase {
  Intro = 'Intro',
  RoundCard = 'RoundCard',
  Fighting = 'Fighting',
  Count = 'Count',
  BetweenRounds = 'BetweenRounds',
  Decision = 'Decision',
  Finished = 'Finished',
}

export interface FightConfig {
  rounds: number;
  /** Round length in seconds. */
  roundSeconds: number;
  /** Knockdowns in a single round that end it by stoppage. */
  tkoKnockdowns: number;
  /** Total knockdowns after which a fighter simply does not get up. */
  koKnockdowns: number;
  /** Seconds per number in the referee's count. */
  countInterval: number;
  /** Seconds of the entrance sequence. */
  introSeconds: number;
  /** Seconds the round card is held. */
  roundCardSeconds: number;
  /** Seconds between rounds. */
  breakSeconds: number;
  /** The player must mash to beat the count. */
  mashToRise: boolean;
}

export const DEFAULT_FIGHT: FightConfig = {
  rounds: 3,
  roundSeconds: 150,
  tkoKnockdowns: 3,
  koKnockdowns: 3,
  countInterval: 0.82,
  introSeconds: 3.6,
  roundCardSeconds: 1.9,
  breakSeconds: 3.4,
  mashToRise: true,
};

export interface FightResult {
  winner: Fighter | null;
  loser: Fighter | null;
  method: 'KO' | 'TKO' | 'DEC' | 'DRAW';
  round: number;
  seconds: number;
  playerScore: number;
  opponentScore: number;
}

/**
 * Runs the bout: rounds, the bell, the ten-count and how the fight ends.
 *
 * The count is where a lot of the drama lives, so it is deliberately
 * interactive: the player mashes to beat it, and the opponent's own
 * `getUpSpeed` decides how much of the count they burn before rising.
 */
export class Referee {
  phase: FightPhase = FightPhase.Intro;
  round = 1;
  /** Seconds remaining in the current round. */
  clock: number;
  /** Seconds elapsed in the fight overall. */
  elapsed = 0;
  /** Phase timer. */
  timer = 0;

  /** Who is on the canvas during a Count. */
  downed: Fighter | null = null;
  /** Current count number, 1..10. */
  count = 0;
  private countTimer = 0;
  /** 0..1 — how close the downed fighter is to rising. */
  riseProgress = 0;

  result: FightResult | null = null;

  /** Round-by-round scorecards, for a decision. */
  cards: { player: number; opponent: number }[] = [];
  playerScore = 0;
  opponentScore = 0;
  /** Damage dealt this round, used to score the card. */
  private roundDamage = { player: 0, opponent: 0 };

  /** Set true when the player skips the entrance. */
  introSkipped = false;

  constructor(
    readonly config: FightConfig,
    private readonly player: Fighter,
    private readonly opponent: Fighter,
    private readonly bus: EventBus<FightEvents>,
    /** Called when a fighter should rise; lets the AI reset its routine. */
    private readonly onRise: (f: Fighter) => void,
  ) {
    this.clock = config.roundSeconds;
  }

  get fighting(): boolean { return this.phase === FightPhase.Fighting; }
  get over(): boolean { return this.phase === FightPhase.Finished; }
  get isFinalRound(): boolean { return this.round >= this.config.rounds; }

  /** True while inputs should be accepted for combat. */
  get inputsLive(): boolean { return this.phase === FightPhase.Fighting; }

  skipIntro(): void {
    if (this.phase === FightPhase.Intro) {
      this.introSkipped = true;
      this.timer = this.config.introSeconds;
    }
  }

  noteDamage(byPlayer: boolean, amount: number): void {
    if (byPlayer) { this.roundDamage.player += amount; this.playerScore += amount * 10; }
    else { this.roundDamage.opponent += amount; this.opponentScore += amount * 6; }
  }

  addScore(points: number): void { this.playerScore += points; }

  /** Called by the fight when a knockdown happens. */
  onKnockdown(f: Fighter): void {
    this.downed = f;
    this.phase = FightPhase.Count;
    this.count = 0;
    this.countTimer = 0;
    this.riseProgress = 0;
    if (f.isPlayer) this.opponentScore += 300;
    else this.playerScore += 900;
  }

  /** Player mashed a button during the count. */
  mash(): void {
    if (this.phase !== FightPhase.Count || !this.downed?.isPlayer) return;
    this.riseProgress = Math.min(1, this.riseProgress + 0.075);
  }

  update(dt: number, aiGetUpSpeed: number): void {
    switch (this.phase) {
      case FightPhase.Intro:
        this.timer += dt;
        if (this.timer >= this.config.introSeconds) {
          this.timer = 0;
          this.phase = FightPhase.RoundCard;
          this.bus.emit('roundStart', { round: this.round });
        }
        break;

      case FightPhase.RoundCard:
        this.timer += dt;
        if (this.timer >= this.config.roundCardSeconds) {
          this.timer = 0;
          this.phase = FightPhase.Fighting;
          // Never reset a fighter who is on the canvas — the count owns them.
          if (!this.player.isDown) this.player.setState(FState.Idle, 0);
          if (!this.opponent.isDown) this.opponent.setState(FState.Idle, 0);
        }
        break;

      case FightPhase.Fighting:
        this.clock -= dt;
        this.elapsed += dt;
        if (this.clock <= 0) {
          this.clock = 0;
          this.endRound();
        }
        break;

      case FightPhase.Count:
        this.elapsed += dt;
        this.updateCount(dt, aiGetUpSpeed);
        break;

      case FightPhase.BetweenRounds:
        this.timer += dt;
        if (this.timer >= this.config.breakSeconds) {
          this.timer = 0;
          this.round++;
          this.clock = this.config.roundSeconds;
          this.player.resetForRound();
          this.opponent.resetForRound();
          this.phase = FightPhase.RoundCard;
          this.bus.emit('roundStart', { round: this.round });
        }
        break;

      default:
        break;
    }
  }

  private updateCount(dt: number, aiGetUpSpeed: number): void {
    const f = this.downed;
    if (!f) return;

    this.countTimer += dt;
    if (this.countTimer >= this.config.countInterval) {
      this.countTimer = 0;
      this.count++;
      this.bus.emit('countOut', { fighter: f });

      if (this.count >= 10) {
        this.finish(f === this.player ? this.opponent : this.player, f, 'KO');
        return;
      }
    }

    if (f.isPlayer) {
      // Mash to rise; a slow trickle means a first-time player still gets up.
      if (this.config.mashToRise) this.riseProgress += dt * 0.11;
      else this.riseProgress += dt * 0.34;
    } else {
      // A tougher boxer beats the count sooner; later knockdowns take longer.
      const riseAt = Math.min(9, Math.max(2, Math.round((4 + f.knockdowns * 1.7) / Math.max(0.4, aiGetUpSpeed))));
      this.riseProgress = this.count / riseAt;
    }

    const tkoThisRound = f.knockdowns >= this.config.tkoKnockdowns;
    const koTotal = f.totalKnockdowns >= this.config.koKnockdowns;

    if (this.riseProgress >= 1 && !tkoThisRound && !koTotal) {
      this.riseProgress = 1;
      f.beginGetUp();
      this.onRise(f);
      this.bus.emit('getUp', { fighter: f });
      this.downed = null;
      this.count = 0;
      this.phase = FightPhase.Fighting;
    } else if ((tkoThisRound || koTotal) && this.count >= 3) {
      // They are not getting up from this one.
      f.countOut();
      this.finish(
        f === this.player ? this.opponent : this.player, f,
        tkoThisRound ? 'TKO' : 'KO',
      );
    }
  }

  private endRound(): void {
    this.bus.emit('roundEnd', { round: this.round });
    // Score the round: 10-9 to whoever did more, 10-10 only if it is very close.
    const p = this.roundDamage.player;
    const o = this.roundDamage.opponent;
    const diff = p - o;
    const card = Math.abs(diff) < 3
      ? { player: 10, opponent: 10 }
      : diff > 0
        ? { player: 10, opponent: p > o * 2.5 ? 8 : 9 }
        : { player: o > p * 2.5 ? 8 : 9, opponent: 10 };
    this.cards.push(card);
    this.roundDamage.player = 0;
    this.roundDamage.opponent = 0;

    if (this.round >= this.config.rounds) {
      this.decide();
    } else {
      this.phase = FightPhase.BetweenRounds;
      this.timer = 0;
    }
  }

  private decide(): void {
    let p = 0, o = 0;
    for (const c of this.cards) { p += c.player; o += c.opponent; }
    // A tie on the cards goes to whoever has more health left.
    if (p === o) {
      if (this.player.health.fraction > this.opponent.health.fraction) p++;
      else if (this.opponent.health.fraction > this.player.health.fraction) o++;
    }
    if (p > o) this.finish(this.player, this.opponent, 'DEC');
    else if (o > p) this.finish(this.opponent, this.player, 'DEC');
    else this.finish(null, null, 'DRAW');
  }

  private finish(winner: Fighter | null, loser: Fighter | null, method: FightResult['method']): void {
    this.phase = FightPhase.Finished;
    this.downed = null;
    if (winner) winner.setState(FState.Victory, 0);
    if (loser && !loser.isDown) loser.setState(FState.Defeat, 0);
    // A decisive finish is worth a chunk of score.
    if (winner === this.player) {
      this.playerScore += method === 'KO' ? 3000 : method === 'TKO' ? 2200 : 900;
      this.playerScore += Math.round(this.player.health.fraction * 1500);
    }
    this.result = {
      winner, loser, method,
      round: this.round,
      seconds: this.elapsed,
      playerScore: Math.round(this.playerScore),
      opponentScore: Math.round(this.opponentScore),
    };
    if (winner && loser) {
      this.bus.emit('fightEnd', { winner, loser, method: method === 'DRAW' ? 'DEC' : method, round: this.round });
    }
  }

  /** Ends the fight immediately — used when the player quits from the pause menu. */
  forfeit(): void {
    if (this.phase === FightPhase.Finished) return;
    this.finish(this.opponent, this.player, 'TKO');
  }

  reset(): void {
    this.phase = FightPhase.Intro;
    this.round = 1;
    this.clock = this.config.roundSeconds;
    this.elapsed = 0;
    this.timer = 0;
    this.downed = null;
    this.count = 0;
    this.countTimer = 0;
    this.riseProgress = 0;
    this.result = null;
    this.cards = [];
    this.playerScore = 0;
    this.opponentScore = 0;
    this.roundDamage = { player: 0, opponent: 0 };
    this.introSkipped = false;
  }
}
