import type { AttackDef } from '../combat/Attack';
import type { FighterStats, Weakness } from '../combat/Fighter';
import type { PlayerProfile } from '../ai/PlayerProfile';

// ---------------------------------------------------------------------------
// AI SCRIPTING
// ---------------------------------------------------------------------------

export type AIStep =
  /** Stand and breathe. A range picks a random duration in frames. */
  | { t: 'wait'; frames: number | [number, number] }
  /** Full telegraph + attack. `id` keys into the boxer's attack table. */
  | { t: 'attack'; id: string }
  /** Telegraph an attack, then abort it — the fake-out. */
  | { t: 'feint'; id: string; frames?: number }
  /** Raise the guard. */
  | { t: 'guard'; frames: number | [number, number] }
  /** Showboat. Leaves them open, which is the point. */
  | { t: 'taunt'; frames?: number; line?: string }
  /** Slip to one side — makes the opponent hard to pin down. */
  | { t: 'dodge'; dir: 'left' | 'right' | 'duck' }
  /** Reposition, changing the rhythm. */
  | { t: 'step'; dir: 'in' | 'out' }
  /** Hold the pose that exposes the weak point, begging to be punished. */
  | { t: 'expose'; frames: number };

export interface Routine {
  id: string;
  steps: AIStep[];
  /** Base selection weight. */
  weight: number;
  /** Phases this routine is legal in. Omit for all phases. */
  phases?: number[];
  /** Only selectable once the boxer is enraged. */
  rageOnly?: boolean;
  /** Never selectable in rage (calm-phase-only behaviour). */
  calmOnly?: boolean;
  /**
   * Adaptive weight multiplier. Returning >1 makes the routine more likely
   * against the player's current habits. Must stay bounded and must always be
   * counterable by simply changing that habit.
   */
  adapt?: (p: PlayerProfile) => number;
  /** Seconds before this routine may be chosen again. */
  cooldown?: number;
  /** Only selectable when the boxer's health fraction is below this. */
  belowHealth?: number;
}

export interface AIConfig {
  /** Idle frames between routines: [min, max]. */
  idleGap: [number, number];
  /** Chance of punishing a player whiff with an immediate counter. */
  counterChance: number;
  /** Chance of raising the guard when the player starts a punch. */
  blockChance: number;
  /** Reaction latency in seconds. Difficulty scales this. */
  reaction: number;
  /** Attack-speed multiplier per phase index. */
  phaseSpeed: number[];
  /** Idle-gap multiplier per phase (smaller = more relentless). */
  phaseTempo: number[];
  /** Damage multiplier per phase. */
  phaseDamage: number[];
  /** Health fraction thresholds that trigger each phase. */
  phaseThresholds: number[];
  /** Enters rage after this many knockdowns suffered. 0 = never. */
  rageAfterKnockdowns: number;
  /** Seconds to beat the count. Lower = gets up faster. */
  getUpSpeed: number;
  /** Attack id used as the reactive counter-punch. */
  counterAttack?: string;
  /** Attack id thrown when enraged, ignoring the routine list. */
  rageAttack?: string;
}

// ---------------------------------------------------------------------------
// APPEARANCE
// ---------------------------------------------------------------------------

export type HairStyle =
  | 'bald' | 'buzz' | 'afro' | 'mohawk' | 'long' | 'topknot' | 'curls'
  | 'flattop' | 'braids' | 'pompadour' | 'shaggy' | 'ponytail';

export type FacialHair = 'none' | 'stubble' | 'mustache' | 'goatee' | 'beard' | 'muttonchops';

export type TrunkPattern = 'solid' | 'stripe' | 'flame' | 'stars' | 'zigzag' | 'check' | 'waves' | 'split';

export type Accessory =
  | 'none' | 'headband' | 'shades' | 'tattoo' | 'facepaint' | 'crown'
  | 'eyepatch' | 'chain' | 'scar' | 'mask' | 'tape';

export interface Appearance {
  skin: string;
  /** Build knobs, all multipliers around 1. */
  build: {
    height: number;
    width: number;
    headScale: number;
    armLength: number;
    /** Belly bulge, 0..1. */
    gut: number;
    /** Shoulder width multiplier. */
    shoulder: number;
    /** Neck thickness. */
    neck: number;
  };
  hair: { style: HairStyle; color: string };
  facialHair: FacialHair;
  facialHairColor?: string;
  trunks: { main: string; accent: string; pattern: TrunkPattern };
  gloves: { main: string; accent: string };
  boots: string;
  accessory: Accessory;
  accessoryColor?: string;
  /** Rage aura / tell glow colour. */
  glow: string;
  /** Face shape knobs. */
  face: {
    browAngle: number;   // negative = angry
    eyeSize: number;
    noseSize: number;
    jaw: number;         // 1 = square, <1 = narrow
    mouth: number;       // width
  };
}

// ---------------------------------------------------------------------------
// BOXER
// ---------------------------------------------------------------------------

export type League = 'rookie' | 'pro' | 'world' | 'championship';

export interface BoxerQuotes {
  intro: string[];
  taunt: string[];
  win: string[];
  lose: string[];
  hurt: string[];
}

export interface BoxerDef {
  id: string;
  name: string;
  nickname: string;
  country: string;
  /** Two colours used for the procedural flag/banner. */
  flag: [string, string];
  age: number;
  /** Centimetres. */
  height: number;
  /** Kilograms. */
  weight: number;
  record: { w: number; l: number; ko: number };
  archetype: string;
  personality: string;
  bio: string;
  style: string;
  strengths: string[];
  flaws: string[];
  league: League;
  /** Order within the league. */
  order: number;
  stats: Partial<FighterStats>;
  weakness: Weakness;
  attacks: Record<string, AttackDef>;
  routines: Routine[];
  ai: AIConfig;
  appearance: Appearance;
  quotes: BoxerQuotes;
  /** Music track id. */
  music: string;
  /** Arena id this boxer fights in. */
  arena: string;
  /** Voice synthesis character. */
  voice: { pitch: number; grit: number };
  /** Prize money for beating them in career mode. */
  purse: number;
  /** Number of distinct phases (informational; the AI uses phaseThresholds). */
  phases: number;
  /** True for multi-phase boss encounters. */
  boss?: boolean;
  /**
   * Optional per-phase weak points. The final champion relocates his weakness
   * between phases, so learning him means re-learning him three times.
   */
  phaseWeaknesses?: Weakness[];
  /** Shown on the versus screen for boss encounters. */
  bossTitle?: string;
}
