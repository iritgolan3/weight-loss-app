/** Configuration for a training-room bout. */
export interface TrainingConfig {
  id: string;
  name: string;
  description: string;
  /** The player cannot be hurt. */
  invincible: boolean;
  /** The opponent stands still and never attacks. */
  passive: boolean;
  /** Forces the opponent to loop one routine, for isolating a pattern. */
  forcedRoutine?: string;
  infiniteStamina: boolean;
  /** Tokens to start with, for practising specials. */
  startTokens: number;
  /** Scales the opponent's starting health so drills end quickly. */
  opponentHealthScale: number;
  /** Which drill counter the results panel should show. */
  goal: 'none' | 'dodges' | 'blocks' | 'counters' | 'reaction' | 'combo' | 'survive';
  /** Target count to complete the drill. 0 = endless. */
  target: number;
  rounds: number;
  roundSeconds: number;
}

export const TRAINING_DRILLS: TrainingConfig[] = [
  {
    id: 'free', name: 'FREE PRACTICE',
    description: 'No pressure, no clock. Full fight rules, but you cannot be knocked out. Learn the patterns at your own pace.',
    invincible: true, passive: false, infiniteStamina: false, startTokens: 0,
    opponentHealthScale: 1, goal: 'none', target: 0, rounds: 9, roundSeconds: 600,
  },
  {
    id: 'dodge', name: 'DODGE PRACTICE',
    description: 'They attack, you slip. Land twenty perfect dodges. Remember: a late dodge is the perfect one.',
    invincible: true, passive: false, infiniteStamina: true, startTokens: 0,
    opponentHealthScale: 1, goal: 'dodges', target: 20, rounds: 9, roundSeconds: 600,
  },
  {
    id: 'block', name: 'BLOCK PRACTICE',
    description: 'Guard high against the head, low against the body. Twenty correct blocks. Wrong height still hurts.',
    invincible: true, passive: false, infiniteStamina: true, startTokens: 0,
    opponentHealthScale: 1, goal: 'blocks', target: 20, rounds: 9, roundSeconds: 600,
  },
  {
    id: 'counter', name: 'COUNTER PRACTICE',
    description: 'Slip or parry, then punish the opening. Fifteen counters. This is the whole game in one drill.',
    invincible: true, passive: false, infiniteStamina: true, startTokens: 0,
    opponentHealthScale: 1, goal: 'counters', target: 15, rounds: 9, roundSeconds: 600,
  },
  {
    id: 'reaction', name: 'REACTION TEST',
    description: 'Short tells, no warning, no mercy. See how many you read before the timer runs out.',
    invincible: true, passive: false, infiniteStamina: true, startTokens: 0,
    opponentHealthScale: 1, goal: 'reaction', target: 0, rounds: 1, roundSeconds: 60,
  },
  {
    id: 'combo', name: 'COMBO PRACTICE',
    description: 'A still target and infinite stamina. Find out how much you can land in one window.',
    invincible: true, passive: true, infiniteStamina: true, startTokens: 3,
    opponentHealthScale: 1, goal: 'combo', target: 0, rounds: 9, roundSeconds: 600,
  },
  {
    id: 'boss', name: 'BOSS PRACTICE',
    description: 'Straight into their final phase, at a sliver of health, as angry as they get. Learn the hardest version first.',
    invincible: true, passive: false, infiniteStamina: false, startTokens: 0,
    opponentHealthScale: 0.19, goal: 'survive', target: 0, rounds: 9, roundSeconds: 600,
  },
];
