import { Simulator } from '../src/sim/Simulator';
import { getBoxer } from '../src/data/boxers';

for (const skill of ['masher', 'good'] as const) {
  const sim = new Simulator(getBoxer('paco'), 'normal', skill, 999);
  const states: Record<string, number> = {};
  const orig = sim.opponent.update.bind(sim.opponent);
  sim.opponent.update = (dt: number) => {
    states[sim.opponent.state] = (states[sim.opponent.state] ?? 0) + 1;
    orig(dt);
  };
  const r = sim.run();
  const total = Object.values(states).reduce((a, b) => a + b, 0);
  const pct = Object.fromEntries(
    Object.entries(states).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, `${((v / total) * 100).toFixed(1)}%`]),
  );
  console.log(skill.toUpperCase(), JSON.stringify({
    won: r.won, sec: +r.seconds.toFixed(1), playerHP: +r.playerHealth.toFixed(2),
    thrown: r.punchesThrown, kdDealt: r.knockdownsDealt, kdTaken: r.knockdownsTaken,
  }));
  console.log('  opponent state distribution:', JSON.stringify(pct));
}
