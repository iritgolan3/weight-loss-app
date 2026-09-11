import test from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAI } from '../src/ai/EnemyAI';
import { PlayerProfile } from '../src/ai/PlayerProfile';
import { Fighter, FState } from '../src/combat/Fighter';
import { EventBus } from '../src/core/EventBus';
import { RNG } from '../src/core/RNG';
import { getBoxer } from '../src/data/boxers';
import { getDifficulty } from '../src/data/difficulty';
import type { FightEvents } from '../src/combat/types';

/** Counts which attacks an AI chooses over many routine selections. */
function sampleAttacks(boxerId: string, shape: (p: PlayerProfile) => void, samples = 900): Record<string, number> {
  const def = getBoxer(boxerId);
  const bus = new EventBus<FightEvents>();
  const profile = new PlayerProfile();
  shape(profile);

  const counts: Record<string, number> = {};
  bus.on('attackStart', ({ attack }) => {
    counts[attack.id] = (counts[attack.id] ?? 0) + 1;
  });

  const fighter = new Fighter(def.name, false, def.stats);
  const ai = new EnemyAI(def, fighter, profile, bus, new RNG(4242), getDifficulty('hard'));
  ai.reset();

  const dt = 1 / 120;
  const player = new Fighter('p', true);
  for (let i = 0; i < samples * 60; i++) {
    // Keep the fighter free to act so routine selection is what is measured.
    if (fighter.state !== FState.Idle && fighter.state !== FState.Windup &&
      fighter.state !== FState.Block) {
      fighter.interrupt();
      fighter.setState(FState.Idle, 0);
    }
    ai.update(dt, player);
    fighter.update(dt);
    if (Object.values(counts).reduce((a, b) => a + b, 0) >= samples) break;
  }
  return counts;
}

function share(counts: Record<string, number>, id: string): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return total ? (counts[id] ?? 0) / total : 0;
}

test('the profile tracks a dodge habit and forgets it again', () => {
  const p = new PlayerProfile();
  for (let i = 0; i < 40; i++) p.recordDodge(-1);
  assert.ok(p.leftDodgeHabit > 0.7, `habit only reached ${p.leftDodgeHabit.toFixed(2)}`);
  assert.ok(p.rightDodgeHabit < 0.1);

  // Stop doing it and the read decays back toward neutral.
  for (let i = 0; i < 2400; i++) p.update(1 / 60);
  assert.ok(p.leftDodgeHabit < 0.35, `habit did not decay (${p.leftDodgeHabit.toFixed(2)})`);
});

test('an opponent with a left-dodge punish uses it against a left-dodger', () => {
  const neutral = sampleAttacks('zara', () => undefined);
  const leftHabit = sampleAttacks('zara', (p) => {
    for (let i = 0; i < 60; i++) p.recordDodge(-1);
  });
  const before = share(neutral, 'zara_hl');
  const after = share(leftHabit, 'zara_hl');
  assert.ok(after > before * 1.3,
    `left-dodge punish did not increase (${before.toFixed(3)} -> ${after.toFixed(3)})`);
});

test('the same opponent punishes a right-dodger with the mirrored attack', () => {
  const rightHabit = sampleAttacks('zara', (p) => {
    for (let i = 0; i < 60; i++) p.recordDodge(1);
  });
  assert.ok(share(rightHabit, 'zara_hr') > share(rightHabit, 'zara_hl'),
    'a right-dodge habit should draw the right-side punish');
});

test('blocking too much draws body attacks', () => {
  const neutral = sampleAttacks('sven', () => undefined);
  const turtle = sampleAttacks('sven', (p) => {
    for (let i = 0; i < 60; i++) p.recordBlock();
  });
  assert.ok(share(turtle, 'sven_split') > share(neutral, 'sven_split'),
    'turtling should be punished with body work');
});

function topShare(counts: Record<string, number>): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return total ? Math.max(...Object.values(counts)) / total : 0;
}

test('adaptation never crowds out the rest of a boxer\'s repertoire', () => {
  // Fairness rule: against a maximally predictable player the punish may become
  // more common, but it must not take over the fight. What is measured is the
  // SHIFT adaptation causes, not the raw share — a boxer whose identity is one
  // signature attack (Rico's counter, Kane's metronome) is allowed to lean on
  // it, so long as reading them is still about a pattern and not one loop.
  for (const id of ['zara', 'rico', 'kane', 'zarkov', 'hiroshi']) {
    const neutral = sampleAttacks(id, () => undefined);
    const extreme = sampleAttacks(id, (p) => {
      for (let i = 0; i < 80; i++) { p.recordDodge(-1); p.recordBlock(); }
      p.aggression = 6;
    });
    const shift = topShare(extreme) - topShare(neutral);
    assert.ok(shift < 0.25,
      `${id}: adaptation shifted its top attack by ${(shift * 100).toFixed(0)} points`);
    assert.ok(Object.keys(extreme).length >= Math.min(2, Object.keys(neutral).length),
      `${id} narrowed from ${Object.keys(neutral).length} to ${Object.keys(extreme).length} attacks`);
  }
});

test('a predictable player draws the punish without facing only the punish', () => {
  // The counter-play must always exist: stop the habit, and the punish stops.
  const habit = sampleAttacks('zara', (p) => {
    for (let i = 0; i < 80; i++) p.recordDodge(-1);
  });
  assert.ok(share(habit, 'zara_hl') < 0.5,
    `the left-dodge punish reached ${(share(habit, 'zara_hl') * 100).toFixed(0)}% of her offence`);
  assert.ok(share(habit, 'zara_hl') > 0,
    'the punish never appeared at all');
});

test('every boxer still throws a variety of attacks against a neutral player', () => {
  for (const id of ['paco', 'mimi', 'bruno', 'kip', 'olga', 'kwame', 'sven', 'rico',
    'hiroshi', 'duke', 'zara', 'mcgraw', 'augusto', 'zarkov', 'tempest', 'kane']) {
    const counts = sampleAttacks(id, () => undefined, 400);
    assert.ok(Object.keys(counts).length >= 2, `${id} only ever throws one attack`);
  }
});

test('phase changes unlock new attacks rather than only scaling numbers', () => {
  const def = getBoxer('kane');
  const bus = new EventBus<FightEvents>();
  const fighter = new Fighter(def.name, false, def.stats);
  const ai = new EnemyAI(def, fighter, new PlayerProfile(), bus, new RNG(7), getDifficulty('hard'));

  const seen = new Set<string>();
  bus.on('attackStart', ({ attack }) => seen.add(attack.id));

  const player = new Fighter('p', true);
  const perPhase: number[] = [];
  for (let phase = 0; phase < 5; phase++) {
    seen.clear();
    ai.reset();
    // Drive him to the target phase by health.
    const thresholds = def.ai.phaseThresholds;
    fighter.health.current = fighter.health.max *
      (phase === 0 ? 1 : (thresholds[phase - 1] ?? 0.1) - 0.01);
    for (let i = 0; i < 240 * 60; i++) {
      if (fighter.state !== FState.Idle && fighter.state !== FState.Windup &&
        fighter.state !== FState.Block) {
        fighter.interrupt();
        fighter.setState(FState.Idle, 0);
      }
      ai.update(1 / 120, player);
      fighter.update(1 / 120);
      if (seen.size >= 6) break;
    }
    perPhase.push(seen.size);
  }
  // The final phase must have access to strictly more than the first.
  assert.ok(perPhase[4] > perPhase[0],
    `phase 5 sees ${perPhase[4]} attacks vs phase 1's ${perPhase[0]}`);
});

test('the final champion relocates his weak point as phases advance', () => {
  const def = getBoxer('kane');
  const fighter = new Fighter(def.name, false, def.stats);
  const ai = new EnemyAI(def, fighter, new PlayerProfile(), new EventBus<FightEvents>(),
    new RNG(1), getDifficulty('hard'));
  ai.reset();

  const seen: string[] = [];
  const player = new Fighter('p', true);
  for (const frac of [1, 0.75, 0.55, 0.35, 0.15]) {
    fighter.health.current = fighter.health.max * frac;
    ai.update(1 / 120, player);
    seen.push(`${ai.currentWeakness.telegraphKinds.join()}:${ai.currentWeakness.zone}`);
  }
  assert.equal(new Set(seen).size, seen.length, `weak point repeated: ${seen.join(' | ')}`);
});
