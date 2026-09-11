import type { BoxerDef, League } from './types';
import { ROOKIE_LEAGUE } from './roster/rookie';
import { PRO_LEAGUE } from './roster/pro';
import { WORLD_LEAGUE } from './roster/world';
import { CHAMPIONSHIP_LEAGUE } from './roster/championship';

export const ALL_BOXERS: BoxerDef[] = [
  ...ROOKIE_LEAGUE, ...PRO_LEAGUE, ...WORLD_LEAGUE, ...CHAMPIONSHIP_LEAGUE,
];

const byId = new Map(ALL_BOXERS.map((b) => [b.id, b]));

export function getBoxer(id: string): BoxerDef {
  const b = byId.get(id);
  if (!b) throw new Error(`Unknown boxer: ${id}`);
  return b;
}

export function boxersInLeague(league: League): BoxerDef[] {
  return ALL_BOXERS.filter((b) => b.league === league).sort((a, b) => a.order - b.order);
}

export const LEAGUE_ORDER: League[] = ['rookie', 'pro', 'world', 'championship'];

export const LEAGUE_INFO: Record<League, { name: string; tagline: string; color: string }> = {
  rookie: { name: 'ROOKIE LEAGUE', tagline: 'Learn to read a punch before it arrives.', color: '#7ef9a2' },
  pro: { name: 'PRO LEAGUE', tagline: 'They have noticed your habits.', color: '#4cc9f0' },
  world: { name: 'WORLD LEAGUE', tagline: 'Now they lie to you.', color: '#c77dff' },
  championship: { name: 'CHAMPIONSHIP LEAGUE', tagline: 'Everything you know. All at once.', color: '#f4c430' },
};

/**
 * Dev-time integrity check. Every routine step, counter and rage attack must
 * name a real entry in the boxer's attack table, or the AI would silently
 * stall mid-fight.
 */
export function validateRoster(): string[] {
  const errors: string[] = [];
  for (const b of ALL_BOXERS) {
    const keys = new Set(Object.keys(b.attacks));
    for (const r of b.routines) {
      for (const step of r.steps) {
        if ((step.t === 'attack' || step.t === 'feint') && !keys.has(step.id)) {
          errors.push(`${b.id}: routine "${r.id}" references missing attack "${step.id}"`);
        }
      }
      if (r.steps.length === 0) errors.push(`${b.id}: routine "${r.id}" has no steps`);
    }
    if (b.ai.counterAttack && !keys.has(b.ai.counterAttack)) {
      errors.push(`${b.id}: counterAttack "${b.ai.counterAttack}" is not an attack key`);
    }
    if (b.ai.rageAttack && !keys.has(b.ai.rageAttack)) {
      errors.push(`${b.id}: rageAttack "${b.ai.rageAttack}" is not an attack key`);
    }
    const phaseCount = b.ai.phaseThresholds.length + 1;
    if (b.ai.phaseSpeed.length < phaseCount) errors.push(`${b.id}: phaseSpeed needs ${phaseCount} entries`);
    if (b.ai.phaseTempo.length < phaseCount) errors.push(`${b.id}: phaseTempo needs ${phaseCount} entries`);
    if (b.ai.phaseDamage.length < phaseCount) errors.push(`${b.id}: phaseDamage needs ${phaseCount} entries`);
    // Every boxer must be beatable by exploiting a tell that actually exists.
    const tellKinds = new Set(
      Object.values(b.attacks).map((a) => a.telegraph?.kind).filter(Boolean) as string[],
    );
    const wk = b.phaseWeaknesses ?? [b.weakness];
    for (const w of wk) {
      if (!w.telegraphKinds.some((k) => tellKinds.has(k))) {
        errors.push(`${b.id}: weakness tell [${w.telegraphKinds}] never appears in any attack`);
      }
    }
    if (!b.routines.some((r) => !r.rageOnly && !r.belowHealth && (!r.phases || r.phases.includes(0)))) {
      errors.push(`${b.id}: has no routine available in phase 0`);
    }
  }
  return errors;
}
