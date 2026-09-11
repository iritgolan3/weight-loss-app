import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulator, type BotSkill } from '../src/sim/Simulator';
import { ALL_BOXERS, boxersInLeague, getBoxer } from '../src/data/boxers';
import { DIFFICULTY_ORDER } from '../src/data/difficulty';
import type { Difficulty } from '../src/data/difficulty';

// Enough runs that a single unlucky seed does not flip a threshold.
const RUNS = 6;

function winRate(boxerId: string, difficulty: Difficulty, skill: BotSkill): number {
  let wins = 0;
  for (let i = 0; i < RUNS; i++) {
    const sim = new Simulator(getBoxer(boxerId), difficulty, skill, 5000 + i * 131);
    if (sim.run().won) wins++;
  }
  return wins / RUNS;
}

function avg(boxerId: string, difficulty: Difficulty, skill: BotSkill) {
  const runs = Array.from({ length: RUNS }, (_, i) =>
    new Simulator(getBoxer(boxerId), difficulty, skill, 6000 + i * 137).run());
  const n = runs.length;
  return {
    seconds: runs.reduce((s, r) => s + r.seconds, 0) / n,
    playerHealth: runs.reduce((s, r) => s + r.playerHealth, 0) / n,
    unavoidable: runs.reduce((s, r) => s + r.unavoidableHits, 0) / n,
    won: runs.filter((r) => r.won).length / n,
  };
}

test('every fight reaches a decisive result rather than timing out', () => {
  for (const b of ALL_BOXERS) {
    const r = new Simulator(b, 'normal', 'good', 777).run();
    assert.notEqual(r.method, 'DRAW', `${b.id} produced no result`);
    assert.ok(r.seconds < 600, `${b.id} took ${r.seconds}s`);
  }
});

test('a skilled player can beat every opponent on normal', () => {
  for (const b of ALL_BOXERS) {
    assert.equal(winRate(b.id, 'normal', 'perfect'), 1, `${b.id} is not beatable`);
  }
});

test('button mashing loses to the championship league', () => {
  for (const b of boxersInLeague('championship')) {
    assert.ok(winRate(b.id, 'normal', 'masher') <= 0.34,
      `${b.id} can be beaten by mashing`);
  }
});

test('the rookie league is winnable by an unskilled player', () => {
  // The first league has to teach, not filter. A sloppy player must get through.
  for (const b of boxersInLeague('rookie')) {
    assert.ok(winRate(b.id, 'easy', 'sloppy') >= 0.66, `${b.id} is too harsh for a rookie league`);
  }
});

test('skill beats mashing more often than not, across the roster', () => {
  let good = 0, masher = 0;
  for (const b of ALL_BOXERS) {
    good += winRate(b.id, 'normal', 'good');
    masher += winRate(b.id, 'normal', 'masher');
  }
  assert.ok(good > masher * 1.3,
    `reading the opponent (${good.toFixed(1)}) barely beats mashing (${masher.toFixed(1)})`);
});

test('bosses take longer to beat than rookies', () => {
  const rookie = boxersInLeague('rookie').reduce((s, b) => s + avg(b.id, 'normal', 'good').seconds, 0) / 4;
  const champ = boxersInLeague('championship').reduce((s, b) => s + avg(b.id, 'normal', 'good').seconds, 0) / 4;
  assert.ok(champ > rookie * 1.25, `champions (${champ.toFixed(0)}s) are not tougher than rookies (${rookie.toFixed(0)}s)`);
});

test('difficulty makes a measurable difference without touching health', () => {
  // Same opponent, same bot: higher tiers must cost the player more health.
  const easy = avg('duke', 'easy', 'good').playerHealth;
  const champ = avg('duke', 'champion', 'good').playerHealth;
  assert.ok(easy > champ, `easy (${easy.toFixed(2)}) should be gentler than champion (${champ.toFixed(2)})`);
  // ...and the opponent's max health must be identical across tiers.
  const a = new Simulator(getBoxer('duke'), 'easy', 'good', 1);
  const b = new Simulator(getBoxer('duke'), 'champion', 'good', 1);
  assert.equal(a.opponent.health.max, b.opponent.health.max,
    'difficulty must not change opponent health');
});

test('the difficulty ladder is monotonic in how hard it hits back', () => {
  const health = DIFFICULTY_ORDER.map((d) => avg('mcgraw', d, 'good').playerHealth);
  // Allow noise, but the ends must be clearly ordered.
  assert.ok(health[0] > health[health.length - 1] + 0.1,
    `easy ${health[0].toFixed(2)} vs champion ${health[health.length - 1].toFixed(2)}`);
});

test('opponents land their attacks instead of being mashed out of them', () => {
  // Regression: committed attacks are armoured, so a masher cannot simply
  // interrupt every wind-up and take zero damage all fight.
  const r = avg('paco', 'normal', 'masher');
  assert.ok(r.playerHealth < 0.97, `a masher finished on ${(r.playerHealth * 100).toFixed(0)}% health`);
});

test('nobody can chain-stun the player into a loss', () => {
  // "Difficult but fair": being hit while already reeling, with no input
  // possible, has to stay rare. Whiff punishes do not count — those are earned.
  for (const b of ALL_BOXERS) {
    const r = avg(b.id, 'normal', 'good');
    assert.ok(r.unavoidable <= 3, `${b.id} chain-stunned the player ${r.unavoidable.toFixed(1)} times`);
  }
});
