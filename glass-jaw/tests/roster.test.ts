import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_BOXERS, boxersInLeague, validateRoster, LEAGUE_ORDER } from '../src/data/boxers';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../src/data/difficulty';
import { ARENAS } from '../src/data/arenas';

test('roster passes integrity validation', () => {
  assert.deepEqual(validateRoster(), []);
});

test('roster has at least 16 boxers with unique ids', () => {
  assert.ok(ALL_BOXERS.length >= 16, `only ${ALL_BOXERS.length} boxers`);
  const ids = new Set(ALL_BOXERS.map((b) => b.id));
  assert.equal(ids.size, ALL_BOXERS.length);
});

test('every league has opponents in contiguous order', () => {
  for (const lg of LEAGUE_ORDER) {
    const list = boxersInLeague(lg);
    assert.ok(list.length >= 4, `${lg} has ${list.length}`);
    list.forEach((b, i) => assert.equal(b.order, i, `${lg} order gap at ${i}`));
  }
});

test('every boxer names an arena that exists', () => {
  for (const b of ALL_BOXERS) {
    assert.ok(ARENAS[b.arena], `${b.id} -> ${b.arena}`);
  }
});

test('every attack that an opponent throws is telegraphed', () => {
  for (const b of ALL_BOXERS) {
    for (const [key, a] of Object.entries(b.attacks)) {
      assert.ok(a.telegraph, `${b.id}.${key} has no telegraph`);
      assert.ok(a.telegraph!.frames >= 13, `${b.id}.${key} tell is only ${a.telegraph!.frames}f`);
      assert.ok(a.telegraph!.label.length > 0, `${b.id}.${key} tell has no label`);
    }
  }
});

test('heavier attacks are telegraphed for longer than light ones', () => {
  for (const b of ALL_BOXERS) {
    const list = Object.values(b.attacks);
    const heavy = list.filter((a) => a.weight >= 2.4);
    const light = list.filter((a) => a.weight <= 1.2);
    if (!heavy.length || !light.length) continue;
    const minHeavy = Math.min(...heavy.map((a) => a.telegraph!.frames));
    const maxLight = Math.max(...light.map((a) => a.telegraph!.frames));
    assert.ok(minHeavy > maxLight, `${b.id}: heavy tell ${minHeavy}f <= light tell ${maxLight}f`);
  }
});

test('unblockable attacks always carry an explicit warning label', () => {
  for (const b of ALL_BOXERS) {
    for (const a of Object.values(b.attacks)) {
      if (!a.unblockable) continue;
      assert.match(a.telegraph!.label, /UNBLOCKABLE|DODGE|SLIP/i, `${b.id}.${a.id}`);
      assert.ok(a.telegraph!.frames >= 34, `${b.id}.${a.id} unblockable tell too short`);
    }
  }
});

test('difficulty scales behaviour, not health', () => {
  // Enemy damage must stay within a narrow band across all five tiers: the
  // difficulty must come from timing and behaviour, not damage inflation.
  const dmgs = DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d].enemyDamage);
  assert.ok(Math.max(...dmgs) / Math.min(...dmgs) < 2.1, `damage spread too wide: ${dmgs}`);
  // Reaction latency, feints and counters must move monotonically instead.
  for (let i = 1; i < DIFFICULTY_ORDER.length; i++) {
    const prev = DIFFICULTIES[DIFFICULTY_ORDER[i - 1]];
    const cur = DIFFICULTIES[DIFFICULTY_ORDER[i]];
    assert.ok(cur.reaction < prev.reaction, `reaction not tightening at ${cur.id}`);
    assert.ok(cur.feint >= prev.feint, `feints not increasing at ${cur.id}`);
    assert.ok(cur.counter > prev.counter, `counters not increasing at ${cur.id}`);
    assert.ok(cur.telegraph <= prev.telegraph, `tells not tightening at ${cur.id}`);
  }
});

test('bosses have more phases than ordinary opponents', () => {
  for (const b of ALL_BOXERS) {
    if (b.boss) assert.ok(b.ai.phaseThresholds.length >= 3, `${b.id} boss has too few phases`);
    else assert.ok(b.ai.phaseThresholds.length >= 1, `${b.id} has no phases`);
  }
});

test('the final champion relocates his weak point every phase', () => {
  const kane = ALL_BOXERS.find((b) => b.id === 'kane')!;
  assert.ok(kane.phaseWeaknesses && kane.phaseWeaknesses.length >= 5);
  const sigs = new Set(kane.phaseWeaknesses!.map((w) => `${w.telegraphKinds.join()}:${w.zone}`));
  assert.equal(sigs.size, kane.phaseWeaknesses!.length, 'weak points repeat between phases');
});

test('difficulty curve rises across leagues', () => {
  const avg = (lg: (typeof LEAGUE_ORDER)[number]) => {
    const l = boxersInLeague(lg);
    return l.reduce((s, b) => s + (b.stats.maxHealth ?? 100) * (b.stats.power ?? 1), 0) / l.length;
  };
  const vals = LEAGUE_ORDER.map(avg);
  for (let i = 1; i < vals.length; i++) {
    assert.ok(vals[i] > vals[i - 1], `league ${LEAGUE_ORDER[i]} is not tougher`);
  }
});
