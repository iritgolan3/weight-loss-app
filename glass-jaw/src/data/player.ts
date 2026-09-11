import type { Appearance } from './types';
import { look } from './factory';
import type { FighterStats } from '../combat/Fighter';

/** The player character. Career mode upgrades these base stats. */
export const PLAYER_NAME = 'Rusty Kovac';
export const PLAYER_NICKNAME = 'Kid Comet';

export const PLAYER_BASE_STATS: FighterStats = {
  maxHealth: 100,
  maxStamina: 100,
  defense: 0.1,
  power: 1,
  speed: 1,
  counter: 1,
  poise: 100,
  getUpHealth: 0.62,
  knockdownResistance: 1,
};

export const PLAYER_LOOK: Appearance = look({
  skin: '#e8b48c', height: 1, width: 1, shoulder: 1.06, gut: 0.08, armLength: 1.04,
  hair: { style: 'shaggy', color: '#c8622a' },
  trunks: { main: '#1b3a6b', accent: '#ffd166', pattern: 'flame' },
  gloves: { main: '#ffd166', accent: '#1b3a6b' },
  accessory: 'none',
  glow: '#ffd166', browAngle: -0.2, eyeSize: 1, jaw: 1, mouth: 1,
});

/** Upgradeable career attributes and what each point buys. */
export interface StatUpgrade {
  key: keyof FighterStats;
  label: string;
  description: string;
  /** Value added per level. */
  perLevel: number;
  maxLevel: number;
  /** Cost of the Nth level (0-indexed). */
  cost: (level: number) => number;
}

export const UPGRADES: StatUpgrade[] = [
  {
    key: 'maxHealth', label: 'CHIN', description: 'Raises your health. Fewer trips to the canvas.',
    perLevel: 9, maxLevel: 6, cost: (l) => 500 + l * 380,
  },
  {
    key: 'maxStamina', label: 'LUNGS', description: 'More stamina. Punch and block for longer before you gas.',
    perLevel: 10, maxLevel: 6, cost: (l) => 450 + l * 340,
  },
  {
    key: 'power', label: 'POWER', description: 'Every punch hits harder.',
    perLevel: 0.07, maxLevel: 6, cost: (l) => 600 + l * 450,
  },
  {
    key: 'speed', label: 'SPEED', description: 'Shorter recovery frames. Chain punches faster.',
    perLevel: 0.05, maxLevel: 6, cost: (l) => 650 + l * 470,
  },
  {
    key: 'counter', label: 'COUNTER', description: 'Widens dodge and parry windows, and pays more for counters.',
    perLevel: 0.06, maxLevel: 6, cost: (l) => 700 + l * 520,
  },
  {
    key: 'defense', label: 'DEFENSE', description: 'Reduces all incoming damage.',
    perLevel: 0.05, maxLevel: 6, cost: (l) => 550 + l * 420,
  },
  {
    key: 'poise', label: 'POISE', description: 'Resists being stunned by heavy shots.',
    perLevel: 12, maxLevel: 6, cost: (l) => 500 + l * 360,
  },
  {
    key: 'knockdownResistance', label: 'HEART', description: 'Get up stronger after a knockdown.',
    perLevel: 0.09, maxLevel: 6, cost: (l) => 800 + l * 600,
  },
];

export function applyUpgrades(levels: Record<string, number>): FighterStats {
  const stats: FighterStats = { ...PLAYER_BASE_STATS };
  for (const u of UPGRADES) {
    const lvl = Math.min(levels[u.key] ?? 0, u.maxLevel);
    (stats[u.key] as number) = (stats[u.key] as number) + u.perLevel * lvl;
  }
  // getUpHealth scales with HEART rather than being its own upgrade line.
  stats.getUpHealth = Math.min(0.85, 0.62 + (levels.knockdownResistance ?? 0) * 0.03);
  return stats;
}
