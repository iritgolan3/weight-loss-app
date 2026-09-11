/** Runs the headless simulator across the roster and prints a balance table. */
import { Simulator, type BotSkill } from '../src/sim/Simulator';
import { ALL_BOXERS } from '../src/data/boxers';
import { DIFFICULTY_ORDER } from '../src/data/difficulty';

const skills: BotSkill[] = ['perfect', 'good', 'sloppy', 'masher'];
const RUNS = 3;

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('-'));

console.log('\n=== WIN RATE BY BOT SKILL (normal difficulty) ===\n');
const header = 'BOXER'.padEnd(12) + skills.map((s) => s.toUpperCase().padStart(10)).join('');
console.log(header);
console.log('-'.repeat(header.length));

for (const b of ALL_BOXERS) {
  if (only && b.id !== only) continue;
  let line = b.id.padEnd(12);
  for (const skill of skills) {
    let wins = 0;
    for (let i = 0; i < RUNS; i++) {
      const sim = new Simulator(b, 'normal', skill, 1000 + i * 77);
      if (sim.run().won) wins++;
    }
    line += `${Math.round((wins / RUNS) * 100)}%`.padStart(10);
  }
  console.log(line);
}

console.log('\n=== "GOOD" BOT ACROSS DIFFICULTIES ===\n');
const h2 = 'BOXER'.padEnd(12) + DIFFICULTY_ORDER.map((d) => d.toUpperCase().slice(0, 8).padStart(10)).join('');
console.log(h2);
console.log('-'.repeat(h2.length));
for (const b of ALL_BOXERS) {
  if (only && b.id !== only) continue;
  let line = b.id.padEnd(12);
  for (const d of DIFFICULTY_ORDER) {
    let wins = 0;
    for (let i = 0; i < RUNS; i++) {
      const sim = new Simulator(b, d, 'good', 2000 + i * 91);
      if (sim.run().won) wins++;
    }
    line += `${Math.round((wins / RUNS) * 100)}%`.padStart(10);
  }
  console.log(line);
}

console.log('\n=== DETAIL: "good" bot vs each boxer on normal ===\n');
console.log(
  'BOXER'.padEnd(12) + 'RESULT'.padEnd(9) + 'RND'.padStart(4) + 'TIME'.padStart(7) +
  'ACC'.padStart(6) + 'DODGE'.padStart(7) + 'PARRY'.padStart(7) + 'CTR'.padStart(5) +
  'WEAK'.padStart(6) + 'KD+'.padStart(5) + 'KD-'.padStart(5) + 'HP'.padStart(6),
);
for (const b of ALL_BOXERS) {
  if (only && b.id !== only) continue;
  const sim = new Simulator(b, 'normal', 'good', 4242);
  const r = sim.run();
  const acc = r.punchesThrown ? Math.round((r.punchesLanded / r.punchesThrown) * 100) : 0;
  console.log(
    b.id.padEnd(12) +
    `${r.won ? 'WIN' : 'LOSS'} ${r.method}`.padEnd(9) +
    String(r.rounds).padStart(4) +
    `${r.seconds.toFixed(0)}s`.padStart(7) +
    `${acc}%`.padStart(6) +
    String(r.perfectDodges).padStart(7) +
    String(r.parries).padStart(7) +
    String(r.counters).padStart(5) +
    String(r.weaknessHits).padStart(6) +
    String(r.knockdownsDealt).padStart(5) +
    String(r.knockdownsTaken).padStart(5) +
    `${Math.round(r.playerHealth * 100)}%`.padStart(6),
  );
}
console.log('');
