import type { AttackDef, Zone } from './Attack';
import type { Fighter } from './Fighter';

export type HitOutcome =
  | 'hit'           // clean landing
  | 'counter'       // landed while target was attacking
  | 'perfectCounter'// landed while target was wide open
  | 'weakness'      // landed on the target's specific weak point
  | 'block'         // absorbed by a correct guard
  | 'grazeBlock'    // absorbed by the wrong guard height
  | 'parry'         // timed block — attacker is punished
  | 'dodge'         // evaded
  | 'perfectDodge'  // evaded with frame-perfect timing
  | 'whiff';        // nothing was there

export interface HitResult {
  attacker: Fighter;
  defender: Fighter;
  attack: AttackDef;
  outcome: HitOutcome;
  damage: number;
  zone: Zone;
  /** World-ish impact point for VFX, in ring space. */
  x: number;
  y: number;
  /** 0..1 severity used by camera shake, hit-stop and VFX scale. */
  intensity: number;
  causedStun: boolean;
  causedKnockdown: boolean;
  tokenAwarded: boolean;
}

export interface FightEvents extends Record<string, unknown> {
  hit: HitResult;
  telegraph: { fighter: Fighter; kind: string; label: string; color: string; side: string; frames: number };
  attackStart: { fighter: Fighter; attack: AttackDef };
  attackWhiff: { fighter: Fighter; attack: AttackDef };
  dodge: { fighter: Fighter; dir: 'left' | 'right' | 'duck'; perfect: boolean };
  block: { fighter: Fighter; correct: boolean };
  parry: { fighter: Fighter };
  guardBreak: { fighter: Fighter };
  /** A counter landed on this fighter; they should reset rather than swing back. */
  countered: { fighter: Fighter; perfect: boolean };
  stun: { fighter: Fighter };
  stunRecover: { fighter: Fighter };
  knockdown: { fighter: Fighter; count: number };
  getUp: { fighter: Fighter };
  countOut: { fighter: Fighter };
  token: { fighter: Fighter; tokens: number; reason: string };
  tokenLost: { fighter: Fighter };
  counterWindowOpen: { fighter: Fighter; frames: number };
  taunt: { fighter: Fighter };
  phaseChange: { fighter: Fighter; phase: number; rage: boolean };
  roundStart: { round: number };
  roundEnd: { round: number };
  fightEnd: { winner: Fighter; loser: Fighter; method: 'KO' | 'TKO' | 'DEC'; round: number };
}
