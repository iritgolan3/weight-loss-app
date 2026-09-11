import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveSystem, emptySave } from '../src/save/SaveSystem';
import { CareerSystem } from '../src/career/CareerSystem';
import { ALL_BOXERS, boxersInLeague, LEAGUE_ORDER } from '../src/data/boxers';
import { UPGRADES, applyUpgrades, PLAYER_BASE_STATS } from '../src/data/player';
import { ARENA_LIST } from '../src/data/arenas';
import { TRAINING_DRILLS } from '../src/scenes/TrainingConfig';

function freshCareer(): { save: SaveSystem; career: CareerSystem } {
  const save = new SaveSystem();
  save.data = emptySave();
  const career = new CareerSystem(save);
  career.start();
  return { save, career };
}

test('a new career starts at the first rookie opponent', () => {
  const { career } = freshCareer();
  assert.equal(career.nextOpponent?.id, boxersInLeague('rookie')[0].id);
  assert.equal(career.complete, false);
  assert.equal(career.state.money, 0);
});

test('winning the whole ladder advances every league and crowns a champion', () => {
  const { save, career } = freshCareer();
  const beaten: string[] = [];

  for (let i = 0; i < ALL_BOXERS.length; i++) {
    const next = career.nextOpponent;
    assert.ok(next, `ran out of opponents after ${i} wins`);
    const reward = career.onWin(next!.id, 'KO', 12000, 60);
    assert.ok(reward.money > 0, `${next!.id} paid nothing`);
    assert.ok(reward.rank > 0);
    beaten.push(next!.id);
  }

  assert.equal(career.complete, true, 'career did not complete');
  assert.equal(career.state.champion, true, 'never became champion');
  assert.equal(career.nextOpponent, null);
  assert.equal(beaten.length, ALL_BOXERS.length);
  assert.equal(new Set(beaten).size, ALL_BOXERS.length, 'an opponent was fought twice');

  // Everyone is unlocked for Arcade and Training once beaten.
  for (const b of ALL_BOXERS) {
    assert.ok(save.isUnlocked(b.id), `${b.id} never unlocked`);
  }
  // And every arena tied to a win has opened up.
  for (const a of ARENA_LIST) {
    if (a.unlockedBy) assert.ok(save.data.unlockedArenas.includes(a.id), `${a.id} locked`);
  }
});

test('opponents are met in league order, hardest last', () => {
  const { career } = freshCareer();
  const order: string[] = [];
  for (let i = 0; i < ALL_BOXERS.length; i++) {
    const n = career.nextOpponent!;
    order.push(n.league);
    career.onWin(n.id, 'DEC', 1000, 120);
  }
  const firstIndexOf = (lg: string) => order.indexOf(lg);
  for (let i = 1; i < LEAGUE_ORDER.length; i++) {
    assert.ok(firstIndexOf(LEAGUE_ORDER[i]) > firstIndexOf(LEAGUE_ORDER[i - 1]),
      `${LEAGUE_ORDER[i]} came before ${LEAGUE_ORDER[i - 1]}`);
  }
});

test('losing costs ranking but never costs progress', () => {
  const { career } = freshCareer();
  const target = career.nextOpponent!.id;
  career.onWin(target, 'KO', 5000, 40);
  const afterWin = { next: career.nextOpponent?.id, rank: career.state.rank };

  career.onLoss(career.nextOpponent!.id);
  assert.equal(career.nextOpponent?.id, afterWin.next, 'a loss moved the ladder');
  assert.ok(career.state.rank <= afterWin.rank, 'a loss should not raise rank');
  assert.ok(career.state.rank >= 0, 'rank went negative');
});

test('a faster knockout pays better than a slow decision', () => {
  const a = freshCareer();
  const b = freshCareer();
  const id = a.career.nextOpponent!.id;
  const fast = a.career.onWin(id, 'KO', 9000, 20).money;
  const slow = b.career.onWin(id, 'DEC', 9000, 220).money;
  assert.ok(fast > slow, `KO in 20s paid ${fast}, decision in 220s paid ${slow}`);
});

test('gym upgrades cost money, apply to stats, and cap out', () => {
  const { career } = freshCareer();
  career.state.money = 1_000_000;

  for (const u of UPGRADES) {
    let bought = 0;
    while (career.buyUpgrade(u.key)) bought++;
    assert.equal(bought, u.maxLevel, `${u.label} bought ${bought} of ${u.maxLevel}`);
    assert.equal(career.upgradeCost(u.key), null, `${u.label} still sells past max`);
  }

  const maxed = career.playerStats();
  for (const u of UPGRADES) {
    const base = PLAYER_BASE_STATS[u.key] as number;
    assert.ok((maxed[u.key] as number) > base, `${u.label} did not improve ${String(u.key)}`);
  }
  assert.ok(career.state.money < 1_000_000, 'upgrades were free');
});

test('an upgrade cannot be bought without the money for it', () => {
  const { career } = freshCareer();
  career.state.money = 0;
  assert.equal(career.buyUpgrade('power'), false);
  assert.equal(career.upgradeLevel('power'), 0);
});

test('upgrades never push stats to absurd values', () => {
  const maxed = applyUpgrades(Object.fromEntries(UPGRADES.map((u) => [u.key, u.maxLevel])));
  assert.ok(maxed.power < 1.6, `power reached ${maxed.power}`);
  assert.ok(maxed.speed < 1.5, `speed reached ${maxed.speed}`);
  assert.ok(maxed.getUpHealth <= 0.85);
  assert.ok(maxed.maxHealth < 180);
});

test('restarting a career keeps unlocks and records but clears the ladder', () => {
  const { save, career } = freshCareer();
  for (let i = 0; i < 5; i++) career.onWin(career.nextOpponent!.id, 'KO', 3000, 45);
  const unlockedBefore = save.data.unlockedBoxers.length;
  const recordsBefore = Object.keys(save.data.records).length;

  career.restart();
  assert.equal(career.state.cleared.length, 0);
  assert.equal(career.state.money, 0);
  assert.equal(career.nextOpponent?.id, boxersInLeague('rookie')[0].id);
  assert.equal(save.data.unlockedBoxers.length, unlockedBefore, 'restart lost unlocks');
  assert.equal(Object.keys(save.data.records).length, recordsBefore, 'restart lost records');
});

test('a save survives a round trip through export and import', () => {
  const { save, career } = freshCareer();
  for (let i = 0; i < 6; i++) career.onWin(career.nextOpponent!.id, 'TKO', 4200, 70);
  career.state.money = 4321;
  save.addStats({ punchesLanded: 99, perfectDodges: 12 });

  const json = save.export();
  const other = new SaveSystem();
  other.data = emptySave();
  assert.equal(other.import(json), true);

  assert.equal(other.data.career.money, 4321);
  assert.deepEqual(other.data.career.cleared, save.data.career.cleared);
  assert.equal(other.data.stats.punchesLanded, 99);
  assert.equal(other.data.stats.perfectDodges, 12);
});

test('a corrupt or partial save loads instead of crashing', () => {
  const s = new SaveSystem();
  assert.equal(s.import('not json at all'), false);
  assert.equal(s.import('null'), false);

  // A save from an older build missing whole sections must still load.
  assert.equal(s.import(JSON.stringify({ career: { money: 50 } })), true);
  assert.equal(s.data.career.money, 50);
  assert.equal(s.data.career.league, 0, 'missing fields were not defaulted');
  assert.ok(Array.isArray(s.data.unlockedBoxers) && s.data.unlockedBoxers.length > 0);
  assert.ok(typeof s.data.stats.totalFights === 'number');
});

test('the player always has somebody available to fight', () => {
  const s = new SaveSystem();
  s.data = emptySave();
  const career = new CareerSystem(s);
  assert.ok(career.unlockedBoxers().length >= 1, 'Arcade would be empty on a fresh save');
});

test('every training drill is coherent', () => {
  const ids = new Set<string>();
  for (const d of TRAINING_DRILLS) {
    assert.ok(!ids.has(d.id), `duplicate drill id ${d.id}`);
    ids.add(d.id);
    assert.ok(d.name.length > 0 && d.description.length > 20, `${d.id} is under-described`);
    assert.ok(d.rounds >= 1 && d.roundSeconds >= 30, `${d.id} has an unusable fight length`);
    // A drill with a target must have a goal that something actually counts.
    if (d.target > 0) {
      assert.ok(['dodges', 'blocks', 'counters'].includes(d.goal),
        `${d.id} has target ${d.target} but goal "${d.goal}" is not counted`);
    }
    // Nobody should be able to lose a drill.
    assert.equal(d.invincible, true, `${d.id} lets the player be knocked out`);
  }
  assert.ok(TRAINING_DRILLS.length >= 7, `only ${TRAINING_DRILLS.length} drills`);
});
