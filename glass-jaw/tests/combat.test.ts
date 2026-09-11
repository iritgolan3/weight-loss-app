import test from 'node:test';
import assert from 'node:assert/strict';
import { Fighter, FState } from '../src/combat/Fighter';
import { CombatSystem } from '../src/combat/CombatSystem';
import { judge } from '../src/combat/HitDetection';
import { DEFENSE, FRAME, PLAYER_ATTACKS, playerPunch, specialForTokens, totalFrames } from '../src/combat/Attack';
import { EventBus } from '../src/core/EventBus';
import { GameTime } from '../src/core/Time';
import type { FightEvents } from '../src/combat/types';
import { atk, tell } from '../src/data/factory';

const STEP = 1 / 120;

function rig() {
  const bus = new EventBus<FightEvents>();
  const time = new GameTime();
  const combat = new CombatSystem(bus, time);
  const p = new Fighter('P', true);
  const e = new Fighter('E', false);
  return { bus, time, combat, p, e };
}

/** Advances a fighter by N 60fps frames using the real 120Hz sim step. */
function advance(f: Fighter, frames: number, onStep?: () => void): void {
  const steps = Math.round(frames * 2);
  for (let i = 0; i < steps; i++) { f.update(STEP); onStep?.(); }
}

test('an attack reaches its active frames exactly on schedule', () => {
  const { p } = rig();
  const a = PLAYER_ATTACKS.jabL;
  p.startAttack(a);
  assert.equal(p.state, FState.Startup);
  advance(p, a.startup - 1);
  assert.equal(p.state, FState.Startup, 'went active a frame early');
  advance(p, 2);
  assert.equal(p.state, FState.Active, 'did not go active on time');
});

test('an attack runs for exactly its total frame count', () => {
  const { p } = rig();
  const a = PLAYER_ATTACKS.bodyR;
  p.startAttack(a);
  advance(p, totalFrames(a) - 2);
  assert.notEqual(p.state, FState.Idle, 'recovered early');
  advance(p, 4);
  assert.equal(p.state, FState.Idle, 'never recovered');
});

test('a multi-hit special resolves every one of its hits', () => {
  const { combat, p, e } = rig();
  const special = PLAYER_ATTACKS.special3;
  assert.equal(special.hits, 4);
  let landed = 0;
  p.startAttack(special);
  for (let i = 0; i < 400; i++) {
    p.update(STEP); e.update(STEP);
    if (p.pollHitWindow() && p.attack) { combat.resolve(p, e, p.attack); landed++; }
    if (p.state === FState.Idle) break;
  }
  assert.equal(landed, 4, `resolved ${landed} of 4 hits`);
});

test('dodge i-frames cover the window they advertise', () => {
  const { p } = rig();
  p.startDodge(-1);
  advance(p, DEFENSE.dodgeStartup - 1);
  assert.equal(p.isInvulnerable, false, 'invulnerable before the dodge began');
  advance(p, 2);
  assert.equal(p.isInvulnerable, true, 'no i-frames after startup');
  advance(p, DEFENSE.dodgeIFrames);
  assert.equal(p.isInvulnerable, false, 'i-frames outlasted their window');
});

test('a late dodge is a PERFECT dodge, an early one is an ordinary dodge', () => {
  const jab = PLAYER_ATTACKS.jabL;
  {
    const { p, e } = rig();
    p.startAttack(jab);
    e.startDodge(1);
    advance(e, DEFENSE.dodgeStartup + 1);
    assert.equal(judge(p, e, jab).outcome, 'perfectDodge');
  }
  {
    const { p, e } = rig();
    p.startAttack(jab);
    e.startDodge(1);
    // Bailing out early still evades, but earns nothing.
    advance(e, DEFENSE.dodgeStartup + jab.perfectDodgeWindow + 2);
    assert.equal(judge(p, e, jab).outcome, 'dodge');
  }
});

test('a tracking attack beats the dodge direction it hunts', () => {
  const hunter = atk({
    id: 't', name: 'Trap', tracking: 'left', tell: tell('eyeFlash', 30, '#fff', 'CUTS OFF LEFT'),
  });
  const { p, e } = rig();
  p.startAttack(hunter);
  e.startDodge(-1);
  advance(e, DEFENSE.dodgeStartup + 1);
  assert.equal(judge(p, e, hunter).outcome, 'hit', 'left-tracking attack missed a left dodge');
  // ...but slipping the other way still beats it.
  const r2 = rig();
  r2.p.startAttack(hunter);
  r2.e.startDodge(1);
  advance(r2.e, DEFENSE.dodgeStartup + 1);
  assert.equal(judge(r2.p, r2.e, hunter).outcome, 'perfectDodge');
});

test('a fresh block parries; a held block only blocks', () => {
  const jab = PLAYER_ATTACKS.jabL;
  {
    const { p, e } = rig();
    p.startAttack(jab);
    e.startBlock('head');
    advance(e, 2);
    assert.equal(judge(p, e, jab).outcome, 'parry');
  }
  {
    const { p, e } = rig();
    p.startAttack(jab);
    e.startBlock('head');
    advance(e, DEFENSE.parryWindow + 4);
    assert.equal(judge(p, e, jab).outcome, 'block', 'turtling should never parry');
  }
});

test('guarding the wrong height lets damage through', () => {
  const { p, e } = rig();
  const body = PLAYER_ATTACKS.bodyL;
  p.startAttack(body);
  e.startBlock('head');
  advance(e, DEFENSE.parryWindow + 4);
  const v = judge(p, e, body);
  assert.equal(v.outcome, 'grazeBlock');
  assert.ok(v.mult > PLAYER_ATTACKS.bodyL.chip, 'wrong guard should hurt more than a correct one');
});

test('unblockable attacks cannot be blocked or parried', () => {
  const nasty = atk({ id: 'u', name: 'Nasty', unblockable: true, tell: tell('roar', 40, '#fff', 'UNBLOCKABLE') });
  const { p, e } = rig();
  p.startAttack(nasty);
  e.startBlock('head');
  advance(e, 1);
  assert.equal(judge(p, e, nasty).outcome, 'hit');
});

test('hitting the weak point on its tell is worth far more than a clean hit', () => {
  const { p, e } = rig();
  const wind = atk({ id: 'w', name: 'Wind', tell: tell('wideWind', 40, '#fff', 'BIG') });
  e.weakness = { telegraphKinds: ['wideWind'], zone: 'head', damageMult: 3.4, stunBonus: 30, hint: '' };
  e.beginWindup(wind);
  advance(e, 5);
  const v = judge(p, e, PLAYER_ATTACKS.jabL);
  assert.equal(v.outcome, 'weakness');
  assert.ok(v.mult >= 3, 'weak point should pay out heavily');
  // The wrong punch to the same tell is merely a counter, not a weak point hit.
  assert.equal(judge(p, e, PLAYER_ATTACKS.bodyL).outcome, 'counter');
});

test('a perfect dodge opens the attacker up for a counter', () => {
  const { combat, p, e } = rig();
  const jab = PLAYER_ATTACKS.jabL;
  e.startAttack(jab);
  p.startDodge(1);
  advance(p, DEFENSE.dodgeStartup + 1);
  const r = combat.resolve(e, p, jab);
  assert.equal(r.outcome, 'perfectDodge');
  assert.ok(e.isOpen, 'attacker should be wide open after being slipped');
  assert.equal(judge(p, e, jab).outcome, 'perfectCounter');
});

test('taking a clean hit costs the defender a token', () => {
  const { combat, p, e } = rig();
  p.special.tokens = 2;
  combat.resolve(e, p, PLAYER_ATTACKS.jabL);
  assert.equal(p.special.tokens, 1);
});

test('token tiers map to escalating specials and are all spendable', () => {
  assert.equal(specialForTokens(0), null);
  assert.equal(specialForTokens(1)!.tier, 1);
  assert.equal(specialForTokens(2)!.tier, 2);
  assert.equal(specialForTokens(3)!.tier, 3);
  assert.ok(specialForTokens(3)!.damage * (specialForTokens(3)!.hits ?? 1)
    > specialForTokens(1)!.damage, 'three tokens must beat one');
});

test('blocking forever drains stamina and eventually breaks the guard', () => {
  const { combat, p, e } = rig();
  const heavy = atk({ id: 'h', name: 'Heavy', weight: 3, damage: 10, tell: tell('roar', 40, '#f', 'X') });
  e.startBlock('head');
  for (let i = 0; i < 40 && e.state === FState.Block; i++) {
    e.parryTimer = 0;              // hold the guard rather than re-pressing
    combat.resolve(p, e, heavy);
    if (e.state !== FState.Block) break;
  }
  assert.equal(e.state, FState.Stunned, 'endless blocking should be punished');
});

test('landing clean refunds stamina so accuracy sustains offence', () => {
  const { combat, p, e } = rig();
  p.stamina.current = 50;
  const before = p.stamina.current;
  combat.resolve(p, e, PLAYER_ATTACKS.jabL);
  assert.ok(p.stamina.current > before, 'a landed punch should pay some stamina back');
});

test('a gassed fighter punches weakly instead of not at all', () => {
  const { combat, p, e } = rig();
  p.stamina.current = 0;
  const weak = combat.resolve(p, e, PLAYER_ATTACKS.jabL).damage;
  const r2 = rig();
  const full = r2.combat.resolve(r2.p, r2.e, PLAYER_ATTACKS.jabL).damage;
  assert.ok(weak > 0, 'gassed punches should still connect');
  assert.ok(weak < full * 0.6, 'gassed punches should be much weaker');
});

test('depleting health causes a knockdown, and the count restores less each time', () => {
  const { p } = rig();
  p.health.current = 1;
  p.takeDamage(50, 0, 2, 1, true);
  assert.equal(p.state, FState.KnockedDown);
  assert.equal(p.knockdowns, 1);
  p.beginGetUp();
  const first = p.health.fraction;
  p.health.current = 1;
  p.takeDamage(50, 0, 2, 1, true);
  p.beginGetUp();
  assert.ok(p.health.fraction < first, 'each knockdown should leave less in the tank');
});

test('hit-stop and slow motion are applied on impact and can be disabled', () => {
  const { combat, time, p, e } = rig();
  combat.resolve(p, e, PLAYER_ATTACKS.special2);
  assert.ok(time.inHitStop, 'a heavy landing should freeze frames');

  const r2 = rig();
  r2.combat.options.hitStopScale = 0;
  r2.combat.options.slowMoScale = 0;
  r2.combat.resolve(r2.p, r2.e, PLAYER_ATTACKS.special2);
  r2.time.advance(1 / 60);
  assert.equal(r2.time.inSlowMo, false, 'slow motion must be fully disableable');
});

test('player punch selection honours hand and aim', () => {
  assert.equal(playerPunch('left', 'head').hand, 'left');
  assert.equal(playerPunch('left', 'head').zone, 'head');
  assert.equal(playerPunch('right', 'body').hand, 'right');
  assert.equal(playerPunch('right', 'body').zone, 'body');
});

test('recovery frames are late-cancellable so punches chain fluidly', () => {
  const { p } = rig();
  const a = PLAYER_ATTACKS.jabL;
  p.startAttack(a);
  advance(p, a.startup + a.active + 1);
  assert.equal(p.state, FState.Recovery);
  assert.equal(p.canAct, false, 'should be committed early in recovery');
  advance(p, a.recovery - 3);
  assert.equal(p.canAct, true, 'late recovery should accept the next input');
});

test('a whiffed attack leaves the attacker more exposed than a landed one', () => {
  const a = PLAYER_ATTACKS.bodyR;
  const whiff = rig();
  whiff.p.startAttack(a);
  advance(whiff.p, a.startup + a.active + 1);
  const whiffOpen = whiff.p.openTimer;

  const land = rig();
  land.p.startAttack(a);
  land.p.attackConnected = true;
  advance(land.p, a.startup + a.active + 1);
  assert.ok(whiffOpen > land.p.openTimer, 'missing should cost more than connecting');
});

test('the simulation step matches the 60fps frame data it is authored in', () => {
  assert.ok(Math.abs(FRAME - 1 / 60) < 1e-9);
});
