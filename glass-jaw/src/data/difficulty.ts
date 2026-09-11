export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'champion';

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  blurb: string;
  color: string;
  /** Multiplies AI reaction latency. >1 = slower to react. */
  reaction: number;
  /** Multiplies telegraph duration. >1 = easier to read. */
  telegraph: number;
  /** Multiplies the gap between routines. >1 = less pressure. */
  tempo: number;
  /** Multiplies attack startup/recovery speed. */
  speed: number;
  /** Chance of inserting an extra feint before a real attack. */
  feint: number;
  /** Multiplies the AI's reactive counter chance. */
  counter: number;
  /** Multiplies the AI's blocking chance. */
  block: number;
  /** Chance of chaining straight into another routine with no breather. */
  chain: number;
  /** Damage dealt by the opponent. */
  enemyDamage: number;
  /** Damage dealt by the player. */
  playerDamage: number;
  /** Multiplies the player's parry and perfect-dodge windows. */
  window: number;
  /** How strongly adaptive routine weights apply. */
  adapt: number;
  /** Opponent stamina regeneration multiplier. */
  enemyStamina: number;
}

/**
 * Difficulty changes *what the opponent does*, never how much health it has.
 * Health and damage barely move between tiers; reaction speed, feint density,
 * counter frequency and your own timing windows carry almost all of it.
 */
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: {
    id: 'easy', name: 'EASY', color: '#7ef9a2',
    blurb: 'Long, obvious tells. They wait for you. Learn the patterns here.',
    reaction: 1.9, telegraph: 1.45, tempo: 1.45, speed: 0.85, feint: 0, counter: 0.35,
    block: 0.5, chain: 0, enemyDamage: 0.68, playerDamage: 1.2, window: 1.45, adapt: 0.3,
    enemyStamina: 0.8,
  },
  normal: {
    id: 'normal', name: 'NORMAL', color: '#4cc9f0',
    blurb: 'The fight as designed. Readable, fair, and it will still knock you down.',
    reaction: 1.25, telegraph: 1.12, tempo: 1.1, speed: 0.95, feint: 0.08, counter: 0.75,
    block: 0.8, chain: 0.08, enemyDamage: 0.88, playerDamage: 1.05, window: 1.15, adapt: 0.65,
    enemyStamina: 0.95,
  },
  hard: {
    id: 'hard', name: 'HARD', color: '#ffd166',
    blurb: 'Tighter tells, real feints, and they punish the habit you did not notice.',
    reaction: 1, telegraph: 1, tempo: 1, speed: 1, feint: 0.18, counter: 1,
    block: 1, chain: 0.16, enemyDamage: 1, playerDamage: 1, window: 1, adapt: 1,
    enemyStamina: 1,
  },
  expert: {
    id: 'expert', name: 'EXPERT', color: '#ff9a3c',
    blurb: 'Short tells, layered fakes, near-instant counters. Every habit is a liability.',
    reaction: 0.78, telegraph: 0.86, tempo: 0.86, speed: 1.1, feint: 0.3, counter: 1.3,
    block: 1.2, chain: 0.28, enemyDamage: 1.14, playerDamage: 0.95, window: 0.88, adapt: 1.35,
    enemyStamina: 1.1,
  },
  champion: {
    id: 'champion', name: 'CHAMPION', color: '#ff1e56',
    blurb: 'The tell is still there. It is just barely there. Good luck.',
    reaction: 0.6, telegraph: 0.74, tempo: 0.72, speed: 1.2, feint: 0.42, counter: 1.6,
    block: 1.4, chain: 0.4, enemyDamage: 1.3, playerDamage: 0.9, window: 0.78, adapt: 1.7,
    enemyStamina: 1.25,
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard', 'expert', 'champion'];

export function getDifficulty(id: Difficulty): DifficultyDef {
  return DIFFICULTIES[id] ?? DIFFICULTIES.normal;
}
