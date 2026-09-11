import type { Game } from '../core/Game';
import { FightScene, FightSetup, FightStats } from './FightScene';
import type { FightResult } from '../combat/Referee';
import { ResultScreen } from '../ui/screens/ResultScreen';
import type { FightReward } from '../career/CareerSystem';

export interface LaunchOptions {
  opponent: FightSetup['opponent'];
  difficulty: FightSetup['difficulty'];
  mode: FightSetup['mode'];
  playerStats?: FightSetup['playerStats'];
  rounds?: number;
  roundSeconds?: number;
  training?: FightSetup['training'];
  /**
   * Runs the moment the fight resolves, before the result screen appears.
   * Return a reward and the result screen will show the payout.
   */
  onResolve?: (result: FightResult, stats: FightStats) => FightReward | undefined;
  /** Runs after the player dismisses the result screen. */
  onDone?: (result: FightResult, stats: FightStats) => void;
}

/**
 * The single entry point for starting a bout.
 *
 * Career, Arcade and Training all come through here, so a fight is set up
 * identically whichever door you came through, and lifetime statistics are
 * recorded in exactly one place.
 */
export function startFight(game: Game, o: LaunchOptions): void {
  const scene: FightScene = new FightScene(game, {
    opponent: o.opponent,
    difficulty: o.difficulty,
    mode: o.mode,
    playerStats: o.playerStats,
    rounds: o.rounds,
    roundSeconds: o.roundSeconds,
    training: o.training,

    onComplete: (result, stats) => {
      if (o.mode !== 'training') recordStats(game, result, stats);
      const reward = o.onResolve?.(result, stats);
      game.save.flush();

      game.push(new ResultScreen(game, {
        result, stats, opponent: o.opponent, mode: o.mode,
        difficulty: o.difficulty,
        reward,
        onDone: () => {
          game.pop(); // result
          game.pop(); // fight
          o.onDone?.(result, stats);
        },
        onRematch: () => {
          game.pop();
          game.pop();
          startFight(game, o);
        },
      }));
    },

    onQuit: () => {
      game.pop();
      o.onDone?.(
        { winner: null, loser: null, method: 'DRAW', round: 1, seconds: 0, playerScore: 0, opponentScore: 0 },
        scene.stats,
      );
    },
  });
  game.push(scene);
}

/** Folds a finished fight into the lifetime statistics. */
function recordStats(game: Game, result: FightResult, s: FightStats): void {
  const won = result.winner?.isPlayer === true;
  const save = game.save;
  save.addStats({
    punchesThrown: s.punchesThrown,
    punchesLanded: s.punchesLanded,
    perfectDodges: s.perfectDodges,
    parries: s.parries,
    counters: s.counters,
    weaknessHits: s.weaknessHits,
    knockdownsDealt: s.knockdownsDealt,
    knockdownsTaken: s.knockdownsTaken,
    specialsThrown: s.specialsThrown,
    totalFights: 1,
    totalWins: won ? 1 : 0,
    totalLosses: won ? 0 : 1,
    koWins: won && result.method !== 'DEC' ? 1 : 0,
    timeInRing: result.seconds,
  });

  const stats = save.data.stats;
  stats.currentWinStreak = won ? stats.currentWinStreak + 1 : 0;
  stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentWinStreak);
  save.markDirty();
}
