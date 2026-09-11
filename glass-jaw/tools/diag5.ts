import { EnemyAI } from '../src/ai/EnemyAI';
import { PlayerProfile } from '../src/ai/PlayerProfile';
import { Fighter, FState } from '../src/combat/Fighter';
import { EventBus } from '../src/core/EventBus';
import { RNG } from '../src/core/RNG';
import { getBoxer } from '../src/data/boxers';
import { getDifficulty } from '../src/data/difficulty';
import type { FightEvents } from '../src/combat/types';

const def = getBoxer('kane');
const bus = new EventBus<FightEvents>();
const profile = new PlayerProfile();
for (let i = 0; i < 80; i++) { profile.recordDodge(-1); profile.recordBlock(); }
profile.aggression = 6;
const counts: Record<string, number> = {};
bus.on('attackStart', ({ attack }) => { counts[attack.id] = (counts[attack.id] ?? 0) + 1; });
const f = new Fighter(def.name, false, def.stats);
const ai = new EnemyAI(def, f, profile, bus, new RNG(4242), getDifficulty('hard'));
ai.reset();
const player = new Fighter('p', true);
for (let i = 0; i < 900 * 60; i++) {
  if (f.state !== FState.Idle && f.state !== FState.Windup && f.state !== FState.Block) {
    f.interrupt(); f.setState(FState.Idle, 0);
  }
  ai.update(1 / 120, player); f.update(1 / 120);
  if (Object.values(counts).reduce((a, b) => a + b, 0) >= 900) break;
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('phase', f.phase, 'total', total);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)} ${v} (${((v / total) * 100).toFixed(0)}%)`);
}
