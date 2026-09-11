import type { AttackDef, TelegraphDef, Zone } from '../combat/Attack';
import type { Appearance, AIConfig } from './types';

/** Builds an attack definition from a short spec, filling arcade-sane defaults. */
export function atk(o: {
  id: string;
  name: string;
  zone?: Zone;
  hand?: 'left' | 'right' | 'both';
  startup?: number;
  active?: number;
  recovery?: number;
  damage?: number;
  chip?: number;
  stunPower?: number;
  weight?: number;
  counterMult?: number;
  parryWindow?: number;
  perfectDodgeWindow?: number;
  hits?: number;
  unblockable?: boolean;
  tracking?: 'left' | 'right';
  tell?: TelegraphDef;
  sfx?: string;
  anim?: string;
}): AttackDef {
  return {
    id: o.id,
    name: o.name,
    zone: o.zone ?? 'head',
    hand: o.hand ?? 'right',
    startup: o.startup ?? 6,
    active: o.active ?? 3,
    recovery: o.recovery ?? 18,
    damage: o.damage ?? 7,
    stamina: 0,
    chip: o.chip ?? 0.2,
    stunPower: o.stunPower ?? 8,
    weight: o.weight ?? 1.2,
    counterMult: o.counterMult ?? 1.6,
    parryWindow: o.parryWindow ?? 9,
    perfectDodgeWindow: o.perfectDodgeWindow ?? 9,
    telegraph: o.tell,
    hits: o.hits,
    unblockable: o.unblockable,
    tracking: o.tracking,
    sfx: o.sfx ?? 'punchMed',
    anim: o.anim ?? 'hook',
  };
}

/** Builds a telegraph. `frames` is the read window — bigger is easier. */
export function tell(
  kind: TelegraphDef['kind'],
  frames: number,
  color: string,
  label: string,
  side: 'left' | 'right' | 'center' = 'center',
  sfx = 'tellLow',
): TelegraphDef {
  return { kind, frames, color, label, side, sfx };
}

/** Sensible AI defaults; each boxer overrides what makes them them. */
export function ai(o: Partial<AIConfig>): AIConfig {
  return {
    idleGap: [34, 62],
    counterChance: 0.15,
    blockChance: 0.2,
    reaction: 0.3,
    phaseSpeed: [1, 1.1, 1.22],
    phaseTempo: [1, 0.84, 0.68],
    phaseDamage: [1, 1.08, 1.18],
    phaseThresholds: [0.66, 0.33],
    rageAfterKnockdowns: 0,
    getUpSpeed: 1,
    ...o,
  };
}

/** Builds an appearance from a short spec. */
export function look(o: {
  skin: string;
  height?: number; width?: number; headScale?: number; armLength?: number;
  gut?: number; shoulder?: number; neck?: number;
  hair: Appearance['hair'];
  facialHair?: Appearance['facialHair'];
  facialHairColor?: string;
  trunks: Appearance['trunks'];
  gloves: Appearance['gloves'];
  boots?: string;
  accessory?: Appearance['accessory'];
  accessoryColor?: string;
  glow: string;
  browAngle?: number; eyeSize?: number; noseSize?: number; jaw?: number; mouth?: number;
}): Appearance {
  return {
    skin: o.skin,
    build: {
      height: o.height ?? 1,
      width: o.width ?? 1,
      headScale: o.headScale ?? 1,
      armLength: o.armLength ?? 1,
      gut: o.gut ?? 0.2,
      shoulder: o.shoulder ?? 1,
      neck: o.neck ?? 1,
    },
    hair: o.hair,
    facialHair: o.facialHair ?? 'none',
    facialHairColor: o.facialHairColor,
    trunks: o.trunks,
    gloves: o.gloves,
    boots: o.boots ?? '#1b1f2a',
    accessory: o.accessory ?? 'none',
    accessoryColor: o.accessoryColor,
    glow: o.glow,
    face: {
      browAngle: o.browAngle ?? -0.18,
      eyeSize: o.eyeSize ?? 1,
      noseSize: o.noseSize ?? 1,
      jaw: o.jaw ?? 1,
      mouth: o.mouth ?? 1,
    },
  };
}
