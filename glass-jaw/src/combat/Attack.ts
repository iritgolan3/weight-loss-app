/** Frame data lives in 60fps frames; the sim converts to seconds on use. */
export const FRAME = 1 / 60;

export type Zone = 'head' | 'body';
export type Hand = 'left' | 'right' | 'both';

/**
 * A visual/audible "tell" played during an attack's wind-up. Highly readable
 * telegraphs are the core promise of this game: every attack announces itself.
 */
export interface TelegraphDef {
  /** Drives which procedural wind-up pose the animator uses. */
  kind: 'shoulder' | 'wideWind' | 'crouch' | 'lean' | 'raiseBoth' | 'eyeFlash'
      | 'hop' | 'spin' | 'guardDrop' | 'stomp' | 'point' | 'roar';
  /** Duration in frames. Longer = easier to read. */
  frames: number;
  /** Accent colour for the tell glow (CSS colour). */
  color: string;
  /** Short label shown when the "attack indicator" accessibility option is on. */
  label: string;
  /** Audio cue id. */
  sfx?: string;
  /** Which side the incoming attack comes from — drives the dodge hint arrow. */
  side?: 'left' | 'right' | 'center';
}

export interface AttackDef {
  id: string;
  name: string;
  zone: Zone;
  hand: Hand;
  /** Frames of wind-up before the hitbox goes live. */
  startup: number;
  /** Frames the hitbox is live. */
  active: number;
  /** Frames of recovery — the defender's counter window. */
  recovery: number;
  damage: number;
  /** Stamina the attacker spends. */
  stamina: number;
  /** Fraction of damage that still gets through a correct block (0..1). */
  chip: number;
  /** Contribution to the target's stun meter. */
  stunPower: number;
  /** Screen-shake / hit-stop weight. 1 = jab, 3 = haymaker. */
  weight: number;
  /** Multiplier when this lands as a counter hit. */
  counterMult: number;
  /** Frames before impact during which a block counts as a PARRY. */
  parryWindow: number;
  /** Frames of i-frames a well-timed dodge needs to overlap to be PERFECT. */
  perfectDodgeWindow: number;
  telegraph?: TelegraphDef;
  /** Special-move tier: how many tokens it costs. 0 = normal punch. */
  tier?: number;
  /** Multi-hit specials fire this many times. */
  hits?: number;
  /** True for attacks that cannot be blocked and MUST be dodged. */
  unblockable?: boolean;
  /** True if the attack tracks a dodge (punishes a predictable dodge direction). */
  tracking?: 'left' | 'right';
  sfx?: string;
  /** Animation flavour hint for the renderer. */
  anim?: string;
}

export function totalFrames(a: AttackDef): number {
  return a.startup + a.active + a.recovery;
}

export function attackDuration(a: AttackDef): number {
  return totalFrames(a) * FRAME;
}

/** Deep-copies and scales an attack's timings — used by difficulty + phases. */
export function scaleAttack(a: AttackDef, speed: number, damage: number): AttackDef {
  const s = { ...a, telegraph: a.telegraph ? { ...a.telegraph } : undefined };
  s.startup = Math.max(2, Math.round(a.startup / speed));
  s.recovery = Math.max(3, Math.round(a.recovery / speed));
  s.damage = a.damage * damage;
  if (s.telegraph) s.telegraph.frames = Math.max(3, Math.round(s.telegraph.frames / speed));
  return s;
}

// ---------------------------------------------------------------------------
// PLAYER MOVES
// ---------------------------------------------------------------------------

/**
 * Damage budget note: an ordinary jab is deliberately feeble. A fight is meant
 * to be won with counters, weak-point hits and specials — the numbers below are
 * tuned so that landing only plain punches takes far longer than the round
 * timer allows, while a player who reads the opponent finishes inside a round.
 */
const jabBase = {
  zone: 'head' as Zone, startup: 4, active: 3, recovery: 10,
  damage: 2.5, stamina: 7, chip: 0.16, stunPower: 4, weight: 1,
  counterMult: 2.8, parryWindow: 7, perfectDodgeWindow: 7,
};

const bodyBase = {
  zone: 'body' as Zone, startup: 5, active: 3, recovery: 12,
  damage: 3.2, stamina: 9, chip: 0.22, stunPower: 3, weight: 1.2,
  counterMult: 2.8, parryWindow: 7, perfectDodgeWindow: 7,
};

export const PLAYER_ATTACKS: Record<string, AttackDef> = {
  jabL: { ...jabBase, id: 'jabL', name: 'Left Jab', hand: 'left', sfx: 'punchLight', anim: 'jab' },
  jabR: { ...jabBase, id: 'jabR', name: 'Right Jab', hand: 'right', sfx: 'punchLight', anim: 'jab' },
  bodyL: { ...bodyBase, id: 'bodyL', name: 'Left Body Hook', hand: 'left', sfx: 'punchBody', anim: 'hook' },
  bodyR: { ...bodyBase, id: 'bodyR', name: 'Right Body Hook', hand: 'right', sfx: 'punchBody', anim: 'hook' },

  special1: {
    id: 'special1', name: 'COMET JAB', zone: 'head', hand: 'right',
    startup: 7, active: 4, recovery: 16, damage: 13, stamina: 0, chip: 0.5,
    stunPower: 22, weight: 2.4, counterMult: 1.5, parryWindow: 5, perfectDodgeWindow: 5,
    tier: 1, sfx: 'special1', anim: 'straight',
  },
  special2: {
    id: 'special2', name: 'METEOR CROSS', zone: 'head', hand: 'right',
    startup: 9, active: 5, recovery: 20, damage: 21, stamina: 0, chip: 0.6,
    stunPower: 34, weight: 3, counterMult: 1.5, parryWindow: 5, perfectDodgeWindow: 5,
    tier: 2, sfx: 'special2', anim: 'overhand',
  },
  special3: {
    id: 'special3', name: 'SUPERNOVA COMBO', zone: 'head', hand: 'both',
    startup: 8, active: 4, recovery: 26, damage: 10, stamina: 0, chip: 0.7,
    stunPower: 24, weight: 3.4, counterMult: 1.4, parryWindow: 4, perfectDodgeWindow: 4,
    tier: 3, hits: 4, sfx: 'special3', anim: 'combo',
  },
};

/** Picks the right player punch for a hand + aim combination. */
export function playerPunch(hand: 'left' | 'right', zone: Zone): AttackDef {
  if (zone === 'body') return hand === 'left' ? PLAYER_ATTACKS.bodyL : PLAYER_ATTACKS.bodyR;
  return hand === 'left' ? PLAYER_ATTACKS.jabL : PLAYER_ATTACKS.jabR;
}

export function specialForTokens(tokens: number): AttackDef | null {
  if (tokens >= 3) return PLAYER_ATTACKS.special3;
  if (tokens === 2) return PLAYER_ATTACKS.special2;
  if (tokens === 1) return PLAYER_ATTACKS.special1;
  return null;
}

// ---------------------------------------------------------------------------
// DEFENSIVE ACTION TIMINGS (player)
// ---------------------------------------------------------------------------

export const DEFENSE = {
  /** Frames before i-frames begin. Kept tiny — dodges must feel instant. */
  dodgeStartup: 2,
  /** Frames of full invulnerability. */
  dodgeIFrames: 13,
  /** Frames of recovery after i-frames end. */
  dodgeRecovery: 8,
  /** Frames after a perfect dodge during which the opponent is wide open. */
  counterWindow: 26,
  /** Frames of block wind-up. */
  blockStartup: 1,
  /** Frames after pressing block during which an incoming hit is PARRIED. */
  parryWindow: 9,
  /** Frames the opponent staggers after a parry. */
  parryStagger: 26,
  /** Frames of counter window granted by a parry. */
  parryCounterWindow: 22,
  /** Stamina drained per blocked hit (scaled by attack weight). */
  blockStaminaCost: 7,
  /** Guard-break threshold: blocking at 0 stamina breaks the guard. */
  guardBreakStun: 48,
} as const;

export const HITSTUN = {
  light: 13,
  heavy: 22,
  stagger: 34,
  stunned: 150,
  knockdownGetUp: 90,
} as const;

/**
 * Frames of shove-clear invulnerability after the third consecutive hit with
 * no chance to act in between. Short enough that it is not a free escape,
 * long enough to get the ring back. See Fighter.takeDamage.
 */
export const REEL_BREAK = 20;
