import { Simulator, type BotSkill } from '../src/sim/Simulator';
import { boxersInLeague } from '../src/data/boxers';
for (const b of boxersInLeague('championship')) {
  for (const skill of ['masher', 'good'] as BotSkill[]) {
    const runs = Array.from({ length: 6 }, (_, i) =>
      new Simulator(b, 'normal', skill, 5000 + i * 131).run());
    const w = runs.filter((r) => r.won).length;
    const un = (runs.reduce((s, r) => s + r.unavoidableHits, 0) / runs.length).toFixed(1);
    const hp = (runs.reduce((s, r) => s + r.playerHealth, 0) / runs.length * 100).toFixed(0);
    console.log(`${b.id.padEnd(9)} ${skill.padEnd(7)} wins ${w}/6  unavoidable ${un}  playerHP ${hp}%`);
  }
}
