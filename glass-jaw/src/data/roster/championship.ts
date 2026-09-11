import type { BoxerDef } from '../types';
import { ai, atk, look, tell } from '../factory';

/**
 * CHAMPIONSHIP LEAGUE — multi-phase boss encounters.
 *
 * Bosses differ from ordinary opponents structurally, not statistically: they
 * gain new routines and new attacks as they lose health, and the final champion
 * moves his weak point between phases. None of them simply get more health.
 */

export const AUGUSTO: BoxerDef = {
  id: 'augusto',
  name: 'Augusto Silva',
  nickname: 'Velho Leão',
  country: 'Brazil',
  flag: ['#0f9d58', '#f4c430'],
  age: 44, height: 184, weight: 88,
  record: { w: 58, l: 11, ko: 39 },
  archetype: 'THE OLD CHAMPION',
  personality: 'Warm, unhurried, and entirely without fear. He has done this before.',
  bio: 'Augusto held three belts before you were born and gave them all back on his own terms. He fights at half speed for two rounds because he does not need the other half, and then he shows you exactly why they called him the Old Lion.',
  style: 'Conserves everything, then spends it all at once.',
  strengths: ['Thirty years of ring craft', 'Explosive when he finally commits'],
  flaws: ['Old legs', 'Has to set his guard down to unload'],
  league: 'championship', order: 0,
  boss: true,
  bossTitle: 'THE OLD LION',
  stats: { maxHealth: 233, power: 1.28, speed: 1.06, defense: 0.3, poise: 112, getUpHealth: 0.66, knockdownResistance: 1.45 },
  weakness: {
    telegraphKinds: ['guardDrop'],
    zone: 'body',
    damageMult: 3.2,
    stunBonus: 40,
    hint: 'Old legs. When the guard drops and he loads up, the body is where the years live.',
  },
  attacks: {
    measure: atk({
      id: 'aug_meas', name: 'Measuring Jab', hand: 'left', damage: 7, weight: 1.2, startup: 5, recovery: 18,
      tell: tell('shoulder', 20, '#ffd166', 'JAB', 'left'), anim: 'jab',
    }),
    lion: atk({
      id: 'aug_lion', name: "Lion's Paw", hand: 'right', damage: 20, weight: 2.8, stunPower: 28,
      startup: 6, recovery: 32, chip: 0.5,
      tell: tell('guardDrop', 32, '#ff9a3c', "LION'S PAW", 'right', 'tellBig'), anim: 'overhand',
    }),
    veteran: atk({
      id: 'aug_vet', name: 'Old Tricks', hand: 'both', damage: 7, hits: 3, weight: 1.6,
      startup: 5, recovery: 28,
      tell: tell('lean', 24, '#f4c430', 'COMBINATION', 'center'), anim: 'combo',
    }),
    body: atk({
      id: 'aug_body', name: 'Veteran Dig', zone: 'body', hand: 'left', damage: 13, weight: 2,
      startup: 5, recovery: 24,
      tell: tell('crouch', 24, '#4cc9f0', 'BODY', 'left'), anim: 'uppercut',
    }),
    roar: atk({
      id: 'aug_roar', name: 'THE OLD LION', hand: 'both', damage: 11, hits: 4, weight: 2.6, stunPower: 20,
      startup: 6, recovery: 38, chip: 0.6,
      tell: tell('roar', 44, '#ff1e56', 'THE OLD LION!!', 'center', 'tellBig'), anim: 'combo',
    }),
  },
  routines: [
    // Phase 0: conserving. Slow, correct, almost lazy.
    { id: 'measure', weight: 34, phases: [0, 1], steps: [{ t: 'attack', id: 'measure' }, { t: 'wait', frames: 22 }, { t: 'attack', id: 'measure' }] },
    { id: 'rest', weight: 26, phases: [0], steps: [{ t: 'guard', frames: [50, 84] }] },
    { id: 'paw', weight: 24, steps: [{ t: 'wait', frames: [16, 28] }, { t: 'attack', id: 'lion' }], cooldown: 2.8 },
    // Phase 1: he starts actually trying.
    { id: 'tricks', weight: 26, phases: [1, 2, 3], steps: [{ t: 'attack', id: 'veteran' }] },
    { id: 'bodywork', weight: 22, phases: [1, 2, 3], steps: [{ t: 'attack', id: 'body' }, { t: 'wait', frames: 12 }, { t: 'attack', id: 'measure' }], adapt: (p) => 1 + p.turtling * 1.8 },
    // Phase 2+: the belt years.
    { id: 'oldLion', weight: 30, phases: [2, 3], steps: [{ t: 'attack', id: 'roar' }], cooldown: 4.5 },
    { id: 'chain', weight: 26, phases: [2, 3], steps: [{ t: 'attack', id: 'veteran' }, { t: 'wait', frames: 8 }, { t: 'attack', id: 'lion' }] },
    { id: 'ragePaw', weight: 36, rageOnly: true, steps: [{ t: 'attack', id: 'lion' }, { t: 'wait', frames: 10 }, { t: 'attack', id: 'roar' }] },
    // He only showboats at someone who is giving him time to. Swarm him and
    // the hands come up instead.
    { id: 'respect', weight: 14, phases: [0], calmOnly: true, adapt: (p) => 1 - p.rushing, steps: [{ t: 'taunt', frames: 52, line: 'Take your time, filho. I have plenty.' }] },
    // Conserving energy never means standing there. Against an aggressive
    // opponent the old man simply waits behind the guard and counters.
    { id: 'veteranGuard', weight: 20, phases: [0, 1], steps: [{ t: 'guard', frames: [40, 70] }, { t: 'attack', id: 'lion' }], adapt: (p) => 1 + p.rushing * 2.4 },
    { id: 'punishGreed', weight: 18, steps: [{ t: 'guard', frames: 26 }, { t: 'attack', id: 'body' }, { t: 'wait', frames: 10 }, { t: 'attack', id: 'measure' }], adapt: (p) => 1 + p.rushing * 2.0 },
  ],
  ai: ai({
    idleGap: [40, 70], counterChance: 0.578, blockChance: 0.638, reaction: 0.2,
    phaseSpeed: [0.92, 1.06, 1.24, 1.34], phaseTempo: [1.15, 0.9, 0.68, 0.56],
    phaseDamage: [0.9, 1.05, 1.2, 1.3], phaseThresholds: [0.7, 0.42, 0.18],
    rageAfterKnockdowns: 1, counterAttack: 'lion', rageAttack: 'roar', getUpSpeed: 0.9,
  }),
  appearance: look({
    skin: '#8a5a34', height: 1.07, width: 1.06, shoulder: 1.14, gut: 0.28, neck: 1.12,
    hair: { style: 'buzz', color: '#d8d8d8' },
    facialHair: 'beard', facialHairColor: '#d8d8d8',
    trunks: { main: '#f4c430', accent: '#0f9d58', pattern: 'flame' },
    gloves: { main: '#0f9d58', accent: '#f4c430' },
    accessory: 'crown', accessoryColor: '#f0c040',
    glow: '#ff9a3c', browAngle: -0.16, eyeSize: 0.92, noseSize: 1.2, jaw: 1.15,
  }),
  quotes: {
    intro: ['I have fought your teacher. And his.', 'Come. Show me what is new.'],
    taunt: ['Take your time, filho. I have plenty.', 'Was that the fast one?'],
    win: ['The old lion still has teeth.', 'Train. Come back. I will be here.'],
    lose: ['Ahh... finally. Someone new.', 'Take it. It was always going to be someone.'],
    hurt: ['Hnh!', 'Ha!'],
  },
  music: 'boss', arena: 'coliseum', voice: { pitch: 0.78, grit: 0.5 }, purse: 7000, phases: 4,
};

export const ZARKOV: BoxerDef = {
  id: 'zarkov',
  name: 'Niko Zarkov',
  nickname: 'The Surgeon',
  country: 'Serbia',
  flag: ['#e63946', '#2b4fb0'],
  age: 35, height: 189, weight: 95,
  record: { w: 41, l: 4, ko: 33 },
  archetype: 'THE SURGEON',
  personality: 'Clinical. Discusses your injuries in the third person, mid-fight.',
  bio: 'Zarkov trained as a physician and never entirely stopped. He does not beat opponents; he diagnoses them, opens them along the seam he has found, and closes the fight. He will tell you which rib, and he will be correct.',
  style: 'Cold, precise, targets exactly what you protect least.',
  strengths: ['Surgical accuracy', 'Reads guard habits instantly'],
  flaws: ['Must point out the target first', 'Vain about his own precision'],
  league: 'championship', order: 1,
  boss: true,
  bossTitle: 'THE SURGEON',
  stats: { maxHealth: 226, power: 1.3, speed: 1.16, defense: 0.3, poise: 106, getUpHealth: 0.64, knockdownResistance: 1.35 },
  weakness: {
    telegraphKinds: ['point'],
    zone: 'head',
    damageMult: 3.2,
    stunBonus: 42,
    hint: 'He points at the rib he intends to break. That is a whole second of a man not defending his own jaw.',
  },
  attacks: {
    scalpel: atk({
      id: 'zar_scal', name: 'Scalpel', hand: 'left', damage: 8, weight: 1.3, startup: 4, recovery: 16,
      tell: tell('shoulder', 17, '#a8dadc', 'SCALPEL', 'left'), anim: 'jab',
    }),
    incision: atk({
      id: 'zar_inc', name: 'Incision', hand: 'right', damage: 19, weight: 2.6, stunPower: 26,
      startup: 5, recovery: 28,
      tell: tell('point', 34, '#ff4d4d', 'MARKS THE SPOT', 'right', 'tellBig'), anim: 'straight',
    }),
    suture: atk({
      id: 'zar_sut', name: 'Suture', zone: 'body', hand: 'both', damage: 8, hits: 3, weight: 1.7, chip: 0.55,
      startup: 5, recovery: 28,
      tell: tell('crouch', 26, '#4cc9f0', 'BODY x3', 'center'), anim: 'combo',
    }),
    anesthetic: atk({
      id: 'zar_anes', name: 'Anaesthetic', hand: 'right', damage: 16, weight: 2.4, tracking: 'right',
      startup: 6, recovery: 30, stunPower: 24,
      tell: tell('eyeFlash', 30, '#c77dff', 'CUTS OFF RIGHT', 'right', 'tellBig'), anim: 'hook',
    }),
    anestheticL: atk({
      id: 'zar_anesl', name: 'Anaesthetic (L)', hand: 'left', damage: 16, weight: 2.4, tracking: 'left',
      startup: 6, recovery: 30, stunPower: 24,
      tell: tell('eyeFlash', 30, '#c77dff', 'CUTS OFF LEFT', 'left', 'tellBig'), anim: 'hook',
    }),
    operate: atk({
      id: 'zar_op', name: 'OPERATE', hand: 'both', damage: 12, hits: 4, weight: 2.8, stunPower: 22, chip: 0.65,
      startup: 6, recovery: 40,
      tell: tell('roar', 42, '#ff1e56', 'OPERATING', 'center', 'tellBig'), anim: 'combo',
    }),
  },
  routines: [
    { id: 'probe', weight: 28, steps: [{ t: 'attack', id: 'scalpel' }, { t: 'wait', frames: 12 }, { t: 'attack', id: 'scalpel' }] },
    { id: 'mark', weight: 24, steps: [{ t: 'wait', frames: [14, 24] }, { t: 'attack', id: 'incision' }], cooldown: 2.4 },
    { id: 'sutures', weight: 22, steps: [{ t: 'attack', id: 'suture' }], adapt: (p) => 1 + p.turtling * 2.4 },
    { id: 'anesL', weight: 14, steps: [{ t: 'attack', id: 'anestheticL' }], adapt: (p) => 1 + p.leftDodgeHabit * 3.4, cooldown: 2.4 },
    { id: 'anesR', weight: 14, steps: [{ t: 'attack', id: 'anesthetic' }], adapt: (p) => 1 + p.rightDodgeHabit * 3.4, cooldown: 2.4 },
    { id: 'consult', weight: 18, phases: [0, 1], steps: [{ t: 'guard', frames: [38, 62] }], adapt: (p) => 1 + p.rushing * 1.8 },
    { id: 'operate', weight: 30, phases: [2, 3], steps: [{ t: 'attack', id: 'operate' }], cooldown: 4.5 },
    { id: 'chain', weight: 26, phases: [1, 2, 3], steps: [{ t: 'attack', id: 'scalpel' }, { t: 'wait', frames: 8 }, { t: 'attack', id: 'incision' }] },
    { id: 'rageOp', weight: 36, rageOnly: true, steps: [{ t: 'attack', id: 'operate' }, { t: 'wait', frames: 10 }, { t: 'attack', id: 'incision' }] },
  ],
  ai: ai({
    idleGap: [26, 46], counterChance: 0.714, blockChance: 0.609, reaction: 0.17,
    phaseSpeed: [1, 1.1, 1.24, 1.34], phaseTempo: [1, 0.82, 0.66, 0.54],
    phaseDamage: [1, 1.08, 1.18, 1.26], phaseThresholds: [0.7, 0.42, 0.18],
    rageAfterKnockdowns: 1, counterAttack: 'incision', rageAttack: 'operate', getUpSpeed: 1,
  }),
  appearance: look({
    skin: '#e8cbb0', height: 1.09, width: 1.04, shoulder: 1.16, gut: 0.12, neck: 1.1, armLength: 1.1,
    hair: { style: 'pompadour', color: '#2a2a2a' },
    facialHair: 'goatee', facialHairColor: '#2a2a2a',
    trunks: { main: '#0d1b2a', accent: '#a8dadc', pattern: 'split' },
    gloves: { main: '#a8dadc', accent: '#0d1b2a' },
    accessory: 'tape', accessoryColor: '#ffffff',
    glow: '#a8dadc', browAngle: -0.3, eyeSize: 0.88, jaw: 1.12, mouth: 0.8,
  }),
  quotes: {
    intro: ['Relax. This will take four minutes.', 'The left rib. I will begin there.'],
    taunt: ['The patient is protecting the wrong side.', 'Good. Keep that arm exactly there.'],
    win: ['Procedure complete. Rest.', 'Textbook. I will write it up.'],
    lose: ['Mis... diagnosis...', 'I opened the wrong seam. Remarkable.'],
    hurt: ['Kk!', 'Hnn!'],
  },
  music: 'boss', arena: 'coliseum', voice: { pitch: 0.86, grit: 0.4 }, purse: 9000, phases: 4,
};

export const TEMPEST: BoxerDef = {
  id: 'tempest',
  name: 'Nia Okonjo',
  nickname: 'Tempest',
  country: 'Trinidad & Tobago',
  flag: ['#e63946', '#1a1a1a'],
  age: 27, height: 181, weight: 82,
  record: { w: 37, l: 1, ko: 30 },
  archetype: 'THE STORM',
  personality: 'Escalating. Starts as weather and ends as a disaster.',
  bio: 'Nia fights in four movements and everyone who has faced her describes it the same way: a breeze, then wind, then something you take shelter from. The trick is that the storm has an eye, and the eye is where she is beaten.',
  style: 'Continuously escalating pressure across four distinct phases.',
  strengths: ['Escalates relentlessly', 'Overwhelming late-round output'],
  flaws: ['Telegraphs each escalation', 'Wide open in the eye of her own storm'],
  league: 'championship', order: 2,
  boss: true,
  bossTitle: 'THE STORM',
  stats: { maxHealth: 237, power: 1.24, speed: 1.2, defense: 0.26, poise: 104, getUpHealth: 0.66, knockdownResistance: 1.4 },
  weakness: {
    telegraphKinds: ['spin'],
    zone: 'head',
    damageMult: 3.2,
    stunBonus: 44,
    hint: 'Every escalation starts with a full turn. That turn is the eye of the storm — get inside it.',
  },
  attacks: {
    breeze: atk({
      id: 'tem_brz', name: 'Breeze', hand: 'left', damage: 6.5, weight: 1.1, startup: 4, recovery: 15,
      tell: tell('shoulder', 16, '#8ecae6', 'BREEZE', 'left'), anim: 'jab',
    }),
    gust: atk({
      id: 'tem_gst', name: 'Gust', hand: 'both', damage: 7, hits: 2, weight: 1.5,
      startup: 5, recovery: 24,
      tell: tell('hop', 20, '#4cc9f0', 'GUST x2', 'center'), anim: 'combo',
    }),
    squall: atk({
      id: 'tem_sql', name: 'Squall', hand: 'right', damage: 17, weight: 2.5, stunPower: 24,
      startup: 5, recovery: 28,
      tell: tell('spin', 32, '#ff9a3c', 'SQUALL', 'right', 'tellBig'), anim: 'spin',
    }),
    downpour: atk({
      id: 'tem_dp', name: 'Downpour', zone: 'body', hand: 'both', damage: 8, hits: 4, weight: 1.9, chip: 0.6,
      startup: 5, recovery: 32,
      tell: tell('crouch', 26, '#4cc9f0', 'BODY x4', 'center', 'tellBig'), anim: 'combo',
    }),
    hurricane: atk({
      id: 'tem_hur', name: 'HURRICANE', hand: 'both', damage: 13, hits: 5, weight: 3, stunPower: 24, chip: 0.7,
      startup: 6, recovery: 44,
      tell: tell('spin', 46, '#ff1e56', 'HURRICANE!!', 'center', 'tellBig'), anim: 'spin',
    }),
    eyewall: atk({
      id: 'tem_eye', name: 'Eyewall', hand: 'right', damage: 22, weight: 3, unblockable: true, stunPower: 32,
      startup: 7, recovery: 38,
      tell: tell('roar', 46, '#ff1e56', 'UNBLOCKABLE! SLIP IT!', 'right', 'tellBig'), anim: 'overhand',
    }),
  },
  routines: [
    // Phase 0 — a breeze.
    { id: 'calm', weight: 34, phases: [0], steps: [{ t: 'attack', id: 'breeze' }, { t: 'wait', frames: 20 }, { t: 'attack', id: 'breeze' }] },
    { id: 'drift', weight: 22, phases: [0], steps: [{ t: 'dodge', dir: 'left' }, { t: 'wait', frames: 10 }, { t: 'attack', id: 'gust' }] },
    // Rush the calm and you get the storm early. Swarming her is never free.
    { id: 'earlySquall', weight: 16, phases: [0, 1], steps: [{ t: 'guard', frames: 22 }, { t: 'attack', id: 'squall' }], adapt: (p) => 1 + p.rushing * 2.8 },
    { id: 'closeQuarters', weight: 14, phases: [0, 1], steps: [{ t: 'attack', id: 'downpour' }], adapt: (p) => 1 + p.rushing * 2.2, cooldown: 3 },
    // Phase 1 — wind.
    { id: 'gusts', weight: 30, phases: [1, 2, 3], steps: [{ t: 'attack', id: 'gust' }, { t: 'wait', frames: 10 }, { t: 'attack', id: 'breeze' }] },
    { id: 'squalls', weight: 26, phases: [1, 2, 3], steps: [{ t: 'attack', id: 'squall' }], cooldown: 2.4 },
    // Phase 2 — the rain arrives.
    { id: 'downpour', weight: 28, phases: [2, 3], steps: [{ t: 'attack', id: 'downpour' }], adapt: (p) => 1 + p.turtling * 2, cooldown: 3 },
    { id: 'stacked', weight: 26, phases: [2, 3], steps: [{ t: 'attack', id: 'gust' }, { t: 'wait', frames: 8 }, { t: 'attack', id: 'squall' }] },
    // Phase 3 — landfall.
    { id: 'hurricane', weight: 34, phases: [3], steps: [{ t: 'attack', id: 'hurricane' }], cooldown: 5 },
    { id: 'eyewall', weight: 28, phases: [3], steps: [{ t: 'attack', id: 'eyewall' }], cooldown: 4.5 },
    { id: 'rageStorm', weight: 40, rageOnly: true, steps: [{ t: 'attack', id: 'squall' }, { t: 'wait', frames: 8 }, { t: 'attack', id: 'hurricane' }] },
  ],
  ai: ai({
    idleGap: [30, 54], counterChance: 0.51, blockChance: 0.435, reaction: 0.19,
    phaseSpeed: [1.0, 1.1, 1.22, 1.38], phaseTempo: [0.98, 0.86, 0.7, 0.52],
    phaseDamage: [1.0, 1.1, 1.2, 1.32], phaseThresholds: [0.8, 0.52, 0.24],
    rageAfterKnockdowns: 1, counterAttack: 'squall', rageAttack: 'hurricane', getUpSpeed: 1.1,
  }),
  appearance: look({
    skin: '#6b4226', height: 1.05, width: 1.0, shoulder: 1.12, gut: 0.08, armLength: 1.1,
    hair: { style: 'braids', color: '#2a1a3a' },
    trunks: { main: '#1a1a2e', accent: '#4cc9f0', pattern: 'waves' },
    gloves: { main: '#4cc9f0', accent: '#1a1a2e' },
    accessory: 'facepaint', accessoryColor: '#4cc9f0',
    glow: '#4cc9f0', browAngle: -0.28, eyeSize: 1.05, jaw: 1.02, mouth: 1.05,
  }),
  quotes: {
    intro: ['Feel that? That is just the wind.', 'It gets worse. It always gets worse.'],
    taunt: ['Still a breeze to you?', 'Wait for the rain.'],
    win: ['Should have found shelter.', 'That was only the first half.'],
    lose: ['You... walked into the eye...', 'Every storm breaks. Fine.'],
    hurt: ['Hah!', 'Chah!'],
  },
  music: 'boss', arena: 'coliseum', voice: { pitch: 1.0, grit: 0.45 }, purse: 12000, phases: 4,
};

export const KANE: BoxerDef = {
  id: 'kane',
  name: 'Maxim Kane',
  nickname: 'The Machine',
  country: 'Undisclosed',
  flag: ['#1a1a1a', '#f4c430'],
  age: 38, height: 196, weight: 108,
  record: { w: 64, l: 0, ko: 61 },
  archetype: 'THE FINAL CHAMPION',
  personality: 'Silent, absolute, unimpressed. He has never lost and does not expect to start.',
  bio: 'Nobody knows where Kane trained, what he does between fights, or why he never speaks. What is known is the record: sixty-four fights, sixty-four wins, sixty-one of them inside the distance. He fights in five movements and changes what he protects between each one. Everything you have learned, you will use here — and it will not quite be enough the first time.',
  style: 'Every archetype at once, rotating his own weak point between phases.',
  strengths: ['No pattern survives contact with him', 'Complete, flawless technique'],
  flaws: ['Even a machine has a seam — it simply moves'],
  league: 'championship', order: 3,
  boss: true,
  bossTitle: 'THE UNDEFEATED',
  stats: { maxHealth: 259, power: 1.34, speed: 1.22, defense: 0.34, poise: 128, getUpHealth: 0.7, knockdownResistance: 1.6 },
  weakness: {
    telegraphKinds: ['guardDrop'],
    zone: 'head',
    damageMult: 3.0,
    stunBonus: 40,
    hint: 'Phase one: his guard drops before the straight. Take the head. It will not stay true for long.',
  },
  phaseWeaknesses: [
    {
      telegraphKinds: ['guardDrop'], zone: 'head', damageMult: 3.0, stunBonus: 40,
      hint: 'PHASE 1 — the guard drops before his straight. Head.',
    },
    {
      telegraphKinds: ['stomp'], zone: 'body', damageMult: 3.0, stunBonus: 42,
      hint: 'PHASE 2 — he plants his foot before the piston. Body.',
    },
    {
      telegraphKinds: ['eyeFlash'], zone: 'head', damageMult: 3.0, stunBonus: 44,
      hint: 'PHASE 3 — his eyes lock on before the trap. Head.',
    },
    {
      telegraphKinds: ['spin'], zone: 'body', damageMult: 3.0, stunBonus: 46,
      hint: 'PHASE 4 — the turn loads the overdrive. Body.',
    },
    {
      telegraphKinds: ['roar'], zone: 'head', damageMult: 3.2, stunBonus: 50,
      hint: 'FINAL — the only sound he makes. Head. Now.',
    },
  ],
  attacks: {
    piston: atk({
      id: 'kane_pis', name: 'Piston', zone: 'body', hand: 'right', damage: 14, weight: 2.2, stunPower: 20,
      startup: 5, recovery: 24,
      tell: tell('stomp', 28, '#f4c430', 'PISTON', 'right', 'tellBig'), anim: 'uppercut',
    }),
    straight: atk({
      id: 'kane_str', name: 'Zero Straight', hand: 'right', damage: 18, weight: 2.5, stunPower: 24,
      startup: 4, recovery: 24,
      tell: tell('guardDrop', 26, '#f4c430', 'STRAIGHT', 'right', 'tellBig'), anim: 'straight',
    }),
    jab: atk({
      id: 'kane_jab', name: 'Metronome', hand: 'left', damage: 8, weight: 1.2, startup: 4, recovery: 14,
      tell: tell('shoulder', 15, '#dddddd', 'JAB', 'left'), anim: 'jab',
    }),
    trapL: atk({
      id: 'kane_tl', name: 'Left Interdiction', hand: 'right', damage: 17, weight: 2.4, tracking: 'left',
      startup: 5, recovery: 28, stunPower: 22,
      tell: tell('eyeFlash', 28, '#c77dff', 'CUTS OFF LEFT', 'left', 'tellBig'), anim: 'hook',
    }),
    trapR: atk({
      id: 'kane_tr', name: 'Right Interdiction', hand: 'left', damage: 17, weight: 2.4, tracking: 'right',
      startup: 5, recovery: 28, stunPower: 22,
      tell: tell('eyeFlash', 28, '#c77dff', 'CUTS OFF RIGHT', 'right', 'tellBig'), anim: 'hook',
    }),
    overdrive: atk({
      id: 'kane_ovr', name: 'OVERDRIVE', hand: 'both', damage: 12, hits: 5, weight: 2.9, stunPower: 22, chip: 0.7,
      startup: 5, recovery: 40,
      tell: tell('spin', 40, '#ff9a3c', 'OVERDRIVE x5', 'center', 'tellBig'), anim: 'combo',
    }),
    zero: atk({
      id: 'kane_zero', name: 'ZERO HOUR', hand: 'right', damage: 30, weight: 3.4, unblockable: true, stunPower: 40,
      startup: 7, recovery: 42,
      tell: tell('roar', 48, '#ff1e56', 'UNBLOCKABLE — SLIP IT', 'right', 'tellBig'), anim: 'overhand',
    }),
  },
  routines: [
    // PHASE 1 — the metronome. Clean, correct, beatable.
    { id: 'metronome', weight: 32, phases: [0, 1], steps: [{ t: 'attack', id: 'jab' }, { t: 'wait', frames: 14 }, { t: 'attack', id: 'jab' }, { t: 'wait', frames: 14 }, { t: 'attack', id: 'straight' }] },
    { id: 'straight', weight: 24, phases: [0, 1, 2], steps: [{ t: 'wait', frames: [12, 20] }, { t: 'attack', id: 'straight' }], cooldown: 2 },
    // PHASE 2 — the body work starts.
    { id: 'pistons', weight: 28, phases: [1, 2, 3, 4], steps: [{ t: 'attack', id: 'piston' }, { t: 'wait', frames: 10 }, { t: 'attack', id: 'piston' }], adapt: (p) => 1 + p.turtling * 2.2 },
    // PHASE 3 — he starts reading you.
    { id: 'interdictL', weight: 18, phases: [2, 3, 4], steps: [{ t: 'attack', id: 'trapL' }], adapt: (p) => 1 + p.leftDodgeHabit * 3.6, cooldown: 2.2 },
    { id: 'interdictR', weight: 18, phases: [2, 3, 4], steps: [{ t: 'attack', id: 'trapR' }], adapt: (p) => 1 + p.rightDodgeHabit * 3.6, cooldown: 2.2 },
    { id: 'punishGreed', weight: 20, phases: [2, 3, 4], steps: [{ t: 'expose', frames: 26 }, { t: 'attack', id: 'straight' }], adapt: (p) => 1 + p.rushing * 2.2 },
    // PHASE 4 — overdrive.
    { id: 'overdrive', weight: 30, phases: [3, 4], steps: [{ t: 'attack', id: 'overdrive' }], cooldown: 4 },
    { id: 'chain', weight: 26, phases: [3, 4], steps: [{ t: 'attack', id: 'jab' }, { t: 'wait', frames: 6 }, { t: 'attack', id: 'piston' }, { t: 'wait', frames: 6 }, { t: 'attack', id: 'straight' }] },
    // FINAL PHASE — zero hour.
    { id: 'zeroHour', weight: 34, phases: [4], steps: [{ t: 'attack', id: 'zero' }], cooldown: 4.5 },
    { id: 'finale', weight: 30, phases: [4], steps: [{ t: 'attack', id: 'overdrive' }, { t: 'wait', frames: 8 }, { t: 'attack', id: 'zero' }] },
    { id: 'rageZero', weight: 44, rageOnly: true, steps: [{ t: 'attack', id: 'overdrive' }, { t: 'wait', frames: 6 }, { t: 'attack', id: 'zero' }] },
  ],
  ai: ai({
    idleGap: [26, 44], counterChance: 0.75, blockChance: 0.667, reaction: 0.15,
    phaseSpeed: [1, 1.08, 1.17, 1.26, 1.38],
    phaseTempo: [1, 0.86, 0.72, 0.6, 0.48],
    phaseDamage: [1, 1.06, 1.12, 1.2, 1.3],
    phaseThresholds: [0.8, 0.6, 0.4, 0.2],
    rageAfterKnockdowns: 1, counterAttack: 'straight', rageAttack: 'zero', getUpSpeed: 0.85,
  }),
  appearance: look({
    skin: '#d8b89a', height: 1.16, width: 1.16, shoulder: 1.3, gut: 0.1, neck: 1.3, headScale: 0.95, armLength: 1.12,
    hair: { style: 'bald', color: '#1a1a1a' },
    trunks: { main: '#0a0a0a', accent: '#f4c430', pattern: 'solid' },
    gloves: { main: '#0a0a0a', accent: '#f4c430' },
    accessory: 'mask', accessoryColor: '#f4c430',
    glow: '#f4c430', browAngle: -0.45, eyeSize: 0.78, noseSize: 0.9, jaw: 1.35, mouth: 0.7,
  }),
  quotes: {
    intro: ['...', 'Sixty-four.'],
    taunt: ['...', '*adjusts nothing*'],
    win: ['Sixty-five.', '...'],
    lose: ['...one.', '*finally, he nods*'],
    hurt: ['...', 'Hn.'],
  },
  music: 'final', arena: 'coliseum', voice: { pitch: 0.66, grit: 0.8 }, purse: 25000, phases: 5,
};

export const CHAMPIONSHIP_LEAGUE: BoxerDef[] = [AUGUSTO, ZARKOV, TEMPEST, KANE];
