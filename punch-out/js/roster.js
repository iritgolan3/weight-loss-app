/* Punch-Out!! — the boxers: looks, title-card data, and move scripts.
   Timings are in 60ths of a second. A move runs wind -> strike -> recover;
   `counter` marks the window inside the wind-up where a punch earns a star. */
(function () {
  'use strict';
  var PO = window.PO, C = PO.C, Art = PO.Art;

  /* shared move templates ------------------------------------------------ */
  function jab(o) {
    var m = {
      kind: 'jab', wind: 26, strike: 7, recover: 20, glove: 'L', target: 'head',
      dmg: 3, block: 0.4, counter: { from: 6, to: 22, target: 'any', dmg: 7 },
      open: 26, openMul: 1.7, tell: 'tell'
    };
    for (var k in o) m[k] = o[k];
    return m;
  }

  var R = {};

  /* ===================================================================== */
  R.glassjoe = {
    id: 'glassjoe', name: 'GLASS JOE', short: 'JOE',
    record: '1- 99  1KO', home: 'PARIS,\n  FRANCE', age: 38, weight: 110,
    quote: '"I HAVE NEVER\n  BEEN HIT!"',    hp: 60, guardBreak: 1, getUp: [4, 6, 9], maxDowns: 3, decisionPoints: 3000,
    gap: [50, 80], gapR: [0, -8, -14],
    moves: [
      jab({ id: 'jabL', glove: 'L', wind: 34, dmg: 2 }),
      jab({ id: 'jabR', glove: 'R', wind: 34, dmg: 2 }),
      jab({ id: 'bodyL', glove: 'L', target: 'body', wind: 32, dmg: 2, counter: { from: 6, to: 26, target: 'any', dmg: 7 } }),
      { id: 'triple', kind: 'combo', reps: 3, wind: 22, strike: 6, recover: 26, glove: 'A',
        target: 'head', dmg: 2, counter: { from: 5, to: 18, target: 'any', dmg: 6 }, open: 24, openMul: 1.6 },
      { id: 'taunt', kind: 'taunt', wind: 70, dmg: 0, openAll: true }
    ],
    weights: [3, 3, 2, 2, 1]
  };

  /* ===================================================================== */
  R.vonkaiser = {
    id: 'vonkaiser', name: 'VON KAISER', short: 'KAISER',
    record: '23- 13 10KO', home: 'BERLIN,\n  GERMANY', age: 42, weight: 144,
    quote: '"I AM THE\n  BEST TEACHER!"',    hp: 78, getUp: [5, 7, 9], maxDowns: 3, decisionPoints: 4000,
    gap: [40, 66], gapR: [0, -6, -12],
    moves: [
      jab({ id: 'jabL', glove: 'L', wind: 26, dmg: 3 }),
      jab({ id: 'jabR', glove: 'R', wind: 26, dmg: 3 }),
      jab({ id: 'bodyR', glove: 'R', target: 'body', wind: 24, dmg: 3 }),
      { id: 'kaiserwave', kind: 'special', special: 'shiver', wind: 44, strike: 8, recover: 30,
        glove: 'A', target: 'head', dmg: 7, counter: { from: 10, to: 38, target: 'body', dmg: 12 },
        open: 34, openMul: 2.0, tell: 'tell' },
      { id: 'triple', kind: 'combo', reps: 3, wind: 20, strike: 6, recover: 24, glove: 'A',
        target: 'head', dmg: 3, counter: { from: 4, to: 16, target: 'any', dmg: 7 }, open: 22, openMul: 1.6 }
    ],
    weights: [3, 3, 2, 2, 2]
  };

  /* ===================================================================== */
  R.pistonhonda = {
    id: 'pistonhonda', name: 'PISTON HONDA', short: 'HONDA',
    record: '26- 1  12KO', home: 'TOKYO,\n  JAPAN', age: 28, weight: 170,
    quote: '"SUSHI, KARATE,\n  BANZAI!"',    hp: 92, getUp: [5, 7, 9], maxDowns: 3, decisionPoints: 5000,
    gap: [34, 58], gapR: [0, -6, -12],
    moves: [
      jab({ id: 'jabL', glove: 'L', wind: 20, strike: 6, dmg: 4, counter: { from: 4, to: 17, target: 'any', dmg: 8 } }),
      jab({ id: 'jabR', glove: 'R', wind: 20, strike: 6, dmg: 4, counter: { from: 4, to: 17, target: 'any', dmg: 8 } }),
      jab({ id: 'bodyL', glove: 'L', target: 'body', wind: 22, dmg: 4 }),
      { id: 'hondarush', kind: 'special', special: 'rush', wind: 60, strike: 10, recover: 40,
        glove: 'A', target: 'head', dmg: 10, reps: 5,
        counter: { from: 24, to: 54, target: 'any', dmg: 14, knockdown: true },
        open: 30, openMul: 2.0, tell: 'tell' },
      { id: 'triple', kind: 'combo', reps: 3, wind: 16, strike: 5, recover: 20, glove: 'A',
        target: 'head', dmg: 4, counter: { from: 3, to: 13, target: 'any', dmg: 8 }, open: 18, openMul: 1.5 }
    ],
    weights: [3, 3, 2, 2, 2]
  };

  /* ===================================================================== */
  R.donflamenco = {
    id: 'donflamenco', name: 'DON FLAMENCO', short: 'FLAMENCO',
    record: '9- 0   9KO', home: 'MADRID,\n  SPAIN', age: 23, weight: 176,
    quote: '"I AM THE\n  MATADOR!"',    hp: 88, getUp: [5, 7, 9], maxDowns: 3, decisionPoints: 5000,
    gap: [40, 64], gapR: [0, -6, -12],
    moves: [
      { id: 'pose', kind: 'guard', wind: 80, dmg: 0, guard: true },
      { id: 'matador', kind: 'special', special: 'matador', wind: 40, strike: 8, recover: 44,
        glove: 'R', target: 'head', dmg: 8, counter: { from: 8, to: 34, target: 'head', dmg: 12 },
        open: 42, openMul: 2.2, tell: 'tell' },
      jab({ id: 'jabL', glove: 'L', wind: 24, dmg: 4 }),
      jab({ id: 'jabR', glove: 'R', wind: 24, dmg: 4 }),
      { id: 'combo', kind: 'combo', reps: 4, wind: 18, strike: 5, recover: 26, glove: 'A',
        target: 'head', dmg: 4, counter: { from: 4, to: 15, target: 'any', dmg: 8 }, open: 20, openMul: 1.6 }
    ],
    weights: [2, 4, 2, 2, 2]
  };

  /* ===================================================================== */
  R.kinghippo = {
    id: 'kinghippo', name: 'KING HIPPO', short: 'HIPPO',
    record: '18- 9  18KO', home: 'HIPPO ISLAND,\n  SOUTH PACIFIC', age: '??', weight: '???',
    quote: '"I NEVER\n  GO DOWN!"',    hp: 130, getUp: [99], maxDowns: 1, decisionPoints: 6000, neverGetsUp: true,
    invulnerable: true,   /* until the belly is exposed */
    gap: [50, 78], gapR: [0, -8, -14],
    moves: [
      { id: 'overhand', kind: 'special', special: 'mouth', wind: 46, strike: 10, recover: 34,
        glove: 'A', target: 'head', dmg: 9, counter: { from: 14, to: 40, target: 'head', dmg: 0, exposeMouth: true },
        open: 30, openMul: 1.6, tell: 'tell' },
      { id: 'bellyflop', kind: 'special', special: 'flop', wind: 52, strike: 12, recover: 40,
        glove: 'A', target: 'body', dmg: 10, counter: { from: 16, to: 46, target: 'head', dmg: 0, exposeMouth: true },
        open: 34, openMul: 1.6, tell: 'tell' },
      jab({ id: 'jabL', glove: 'L', wind: 30, dmg: 6, counter: { from: 8, to: 26, target: 'head', dmg: 0, exposeMouth: true } }),
      jab({ id: 'jabR', glove: 'R', wind: 30, dmg: 6, counter: { from: 8, to: 26, target: 'head', dmg: 0, exposeMouth: true } })
    ],
    weights: [3, 2, 2, 2]
  };

  /* ===================================================================== */
  R.greattiger = {
    id: 'greattiger', name: 'GREAT TIGER', short: 'TIGER',
    record: '24- 5  20KO', home: 'BOMBAY,\n  INDIA', age: 29, weight: 165,
    quote: '"I READ YOUR\n  MIND!"',    hp: 100, getUp: [5, 7, 9], maxDowns: 3, decisionPoints: 6000,
    gap: [36, 58], gapR: [0, -6, -12],
    moves: [
      jab({ id: 'jabL', glove: 'L', wind: 20, dmg: 5, counter: { from: 4, to: 17, target: 'any', dmg: 9 } }),
      jab({ id: 'jabR', glove: 'R', wind: 20, dmg: 5, counter: { from: 4, to: 17, target: 'any', dmg: 9 } }),
      { id: 'tigerpunch', kind: 'special', special: 'teleport', wind: 38, strike: 9, recover: 26,
        glove: 'A', target: 'head', dmg: 8, counter: { from: 10, to: 32, target: 'any', dmg: 12 },
        open: 30, openMul: 1.9, tell: 'tell' },
      { id: 'tigercombo', kind: 'combo', reps: 4, wind: 16, strike: 5, recover: 22, glove: 'A',
        target: 'head', dmg: 5, counter: { from: 3, to: 13, target: 'any', dmg: 9 }, open: 18, openMul: 1.5 }
    ],
    weights: [2, 2, 4, 2],
    teleportDizzy: 4
  };

  /* ===================================================================== */
  R.baldbull = {
    id: 'baldbull', name: 'BALD BULL', short: 'BULL',
    record: '35- 8  32KO', home: 'ISTANBUL,\n  TURKEY', age: 36, weight: 298,
    quote: '"NOBODY STOPS\n  THE CHARGE!"',    hp: 115, getUp: [5, 7, 9], maxDowns: 3, decisionPoints: 7000,
    gap: [36, 58], gapR: [0, -6, -12],
    moves: [
      jab({ id: 'jabL', glove: 'L', wind: 22, dmg: 6, counter: { from: 4, to: 18, target: 'any', dmg: 10 } }),
      jab({ id: 'jabR', glove: 'R', wind: 22, dmg: 6, counter: { from: 4, to: 18, target: 'any', dmg: 10 } }),
      jab({ id: 'hookBody', glove: 'R', target: 'body', wind: 24, dmg: 6 }),
      { id: 'bullcharge', kind: 'special', special: 'charge', wind: 86, strike: 12, recover: 44,
        glove: 'A', target: 'head', dmg: 16,
        counter: { from: 58, to: 78, target: 'body', dmg: 0, knockdown: true },
        open: 30, openMul: 1.8, tell: 'tell' },
      { id: 'combo', kind: 'combo', reps: 3, wind: 18, strike: 5, recover: 24, glove: 'A',
        target: 'head', dmg: 6, counter: { from: 3, to: 15, target: 'any', dmg: 10 }, open: 20, openMul: 1.5 }
    ],
    weights: [3, 3, 2, 3, 2]
  };

  /* ===================================================================== */
  R.sodapopinski = {
    id: 'sodapopinski', name: 'SODA POPINSKI', short: 'POPINSKI',
    record: '28- 3  25KO', home: 'MOSCOW,\n  U.S.S.R.', age: 35, weight: 237,
    quote: '"I DRINK TO\n  YOUR HEALTH!"',    hp: 125, getUp: [5, 7, 9], maxDowns: 3, decisionPoints: 8000,
    gap: [32, 52], gapR: [0, -6, -12],
    moves: [
      jab({ id: 'upperL', glove: 'L', wind: 20, dmg: 7, counter: { from: 4, to: 16, target: 'any', dmg: 11 } }),
      jab({ id: 'upperR', glove: 'R', wind: 20, dmg: 7, counter: { from: 4, to: 16, target: 'any', dmg: 11 } }),
      jab({ id: 'bodyL', glove: 'L', target: 'body', wind: 22, dmg: 7 }),
      { id: 'drink', kind: 'special', special: 'drink', wind: 76, dmg: 0, heal: 18,
        counter: { from: 10, to: 66, target: 'head', dmg: 14 }, openAll: true },
      { id: 'combo', kind: 'combo', reps: 4, wind: 16, strike: 5, recover: 22, glove: 'A',
        target: 'head', dmg: 7, counter: { from: 3, to: 13, target: 'any', dmg: 11 }, open: 18, openMul: 1.5 }
    ],
    weights: [3, 3, 2, 2, 3]
  };

  /* ===================================================================== */
  R.mrsandman = {
    id: 'mrsandman', name: 'MR. SANDMAN', short: 'SANDMAN',
    record: '27- 2  27KO', home: 'PHILADELPHIA,\n  PA.', age: 31, weight: 284,
    quote: '"BED TIME,\n  KID!"',    hp: 145, getUp: [5, 7, 9], maxDowns: 3, decisionPoints: 9000,
    gap: [26, 44], gapR: [0, -5, -10],
    moves: [
      jab({ id: 'jabL', glove: 'L', wind: 17, strike: 5, dmg: 8, counter: { from: 3, to: 14, target: 'any', dmg: 12 } }),
      jab({ id: 'jabR', glove: 'R', wind: 17, strike: 5, dmg: 8, counter: { from: 3, to: 14, target: 'any', dmg: 12 } }),
      jab({ id: 'bodyR', glove: 'R', target: 'body', wind: 19, dmg: 8 }),
      { id: 'dreamland', kind: 'special', special: 'express', wind: 30, strike: 8, recover: 40,
        glove: 'A', target: 'head', dmg: 11, reps: 3,
        counter: { from: 6, to: 26, target: 'any', dmg: 14 }, open: 26, openMul: 1.8, tell: 'tell' },
      { id: 'combo', kind: 'combo', reps: 4, wind: 14, strike: 4, recover: 20, glove: 'A',
        target: 'head', dmg: 8, counter: { from: 3, to: 11, target: 'any', dmg: 12 }, open: 16, openMul: 1.4 }
    ],
    weights: [3, 3, 2, 3, 2]
  };

  /* ===================================================================== */
  R.machoman = {
    id: 'machoman', name: 'SUPER MACHO MAN', short: 'MACHO MAN',
    record: '30- 0  30KO', home: 'HOLLYWOOD,\n  CALIFORNIA', age: 27, weight: 242,
    quote: '"I AM THE\n  SUPERSTAR!"',    hp: 155, getUp: [5, 7, 9], maxDowns: 3, decisionPoints: 10000,
    gap: [26, 44], gapR: [0, -5, -10],
    moves: [
      jab({ id: 'jabL', glove: 'L', wind: 17, strike: 5, dmg: 8, counter: { from: 3, to: 14, target: 'any', dmg: 12 } }),
      jab({ id: 'jabR', glove: 'R', wind: 17, strike: 5, dmg: 8, counter: { from: 3, to: 14, target: 'any', dmg: 12 } }),
      { id: 'spin', kind: 'special', special: 'spin', wind: 46, strike: 9, recover: 34,
        glove: 'R', target: 'head', dmg: 12, reps: 2,
        counter: { from: 8, to: 40, target: 'any', dmg: 14 }, open: 30, openMul: 1.8, tell: 'tell' },
      { id: 'superspin', kind: 'special', special: 'spin', wind: 74, strike: 10, recover: 44,
        glove: 'R', target: 'head', dmg: 18, reps: 5,
        counter: { from: 10, to: 66, target: 'any', dmg: 16 }, open: 34, openMul: 2.0, tell: 'tell' },
      { id: 'flex', kind: 'taunt', wind: 60, dmg: 0, openAll: true }
    ],
    weights: [3, 3, 3, 2, 1]
  };

  /* ===================================================================== */
  function dreamFighter(id, name, record, home, age, weight, quote, hairCol, hp) {
    return {
      id: id, name: name, short: name,
      record: record, home: home, age: age, weight: weight, quote: quote,
      hp: hp, getUp: [6, 8, 9], maxDowns: 3, decisionPoints: 0, surviveToWin: true,
      gap: [22, 38], gapR: [0, -4, -8],
      moves: [
        { id: 'dynamite', kind: 'special', special: 'dynamite', wind: 24, strike: 7, recover: 40,
          glove: 'A', target: 'head', dmg: 999, instantDown: true,
          counter: { from: 4, to: 20, target: 'any', dmg: 16 }, open: 40, openMul: 2.2, tell: 'tell' },
        jab({ id: 'jabL', glove: 'L', wind: 15, strike: 4, dmg: 10, counter: { from: 2, to: 12, target: 'any', dmg: 14 } }),
        jab({ id: 'jabR', glove: 'R', wind: 15, strike: 4, dmg: 10, counter: { from: 2, to: 12, target: 'any', dmg: 14 } }),
        jab({ id: 'bodyL', glove: 'L', target: 'body', wind: 17, dmg: 10 }),
        { id: 'combo', kind: 'combo', reps: 5, wind: 13, strike: 4, recover: 20, glove: 'A',
          target: 'head', dmg: 10, counter: { from: 2, to: 10, target: 'any', dmg: 14 }, open: 14, openMul: 1.4 }
      ],
      weights: [4, 2, 2, 2, 2],
      phase1Until: 90   /* seconds of round 1 spent throwing only the one-hit uppercut */
    };
  }

  R.tyson = dreamFighter('tyson', 'MIKE TYSON', '31- 0  27KO', 'CATSKILLS,\n  N.Y.', 21, 220,
    '"THEY SAY\n  I CANT LOSE."', C.black, 180);
  R.tyson.nick = 'KID DYNAMITE';
  R.mrdream = dreamFighter('mrdream', 'MR. DREAM', '99- 0  99KO', 'LAS VEGAS,\n  NEVADA', 28, 230,
    '"NOBODY HAS\n  BEATEN ME."', C.brownD, 190);
  R.mrdream.nick = 'THE LEGENDARY';

  /* ===================================================================== */
  /* Rematches — same boxer, meaner numbers                                 */
  function rematch(base, over) {
    var o = {};
    for (var k in base) o[k] = base[k];
    o.moves = base.moves.map(function (m) {
      var c = {};
      for (var j in m) c[j] = m[j];
      c.wind = Math.max(8, Math.round(m.wind * 0.72));
      if (m.counter) {
        c.counter = { from: Math.round(m.counter.from * 0.72), to: Math.round(m.counter.to * 0.72),
                      target: m.counter.target, dmg: Math.round((m.counter.dmg || 0) * 1.2),
                      knockdown: m.counter.knockdown, exposeMouth: m.counter.exposeMouth };
      }
      c.dmg = m.dmg > 100 ? m.dmg : Math.round(m.dmg * 1.5);
      c.open = Math.round((m.open || 20) * 0.75);
      return c;
    });
    o.gap = [Math.round(base.gap[0] * 0.7), Math.round(base.gap[1] * 0.7)];
    for (var k2 in over) o[k2] = over[k2];
    return o;
  }

  R.pistonhonda2 = rematch(R.pistonhonda, {
    id: 'pistonhonda2', hp: 130, record: '27- 1  13KO', decisionPoints: 8000,
    quote: '"I AM STRONGER\n  NOW!"'
  });
  R.baldbull2 = rematch(R.baldbull, {
    id: 'baldbull2', hp: 150, record: '36- 8  33KO', decisionPoints: 9000,
    quote: '"THE CHARGE\n  IS FASTER!"'
  });
  R.donflamenco2 = rematch(R.donflamenco, {
    id: 'donflamenco2', hp: 140, record: '12- 1  10KO', decisionPoints: 9000,
    quote: '"MY ROSE IS\n  BROKEN!"', trunk: C.purple, trunkD: C.purpleD,
    weights: [1, 4, 3, 3, 3]
  });

  /* ---------------------------------------------------------------------
     Difficulty dial. Damage is a fraction of the opponent's bar (see
     fight.js), so `tough` is what actually separates Glass Joe from Tyson:
     the higher it is, the more clean counters it takes to drop him. */
  var TOUGH = {
    glassjoe: 0.55, vonkaiser: 0.75, pistonhonda: 0.90, donflamenco: 0.90,
    kinghippo: 0.80, greattiger: 1.00, baldbull: 1.10, pistonhonda2: 1.20,
    sodapopinski: 1.25, baldbull2: 1.35, donflamenco2: 1.30, mrsandman: 1.50,
    machoman: 1.60, tyson: 1.70, mrdream: 1.75
  };

  /* Normalise every move into one rhythm: the counter window sits in the back
     half of the wind-up, the opening after a dodge is only long enough for a
     punch or two, and punches hurt enough that mistakes cost rounds.
     Signature moves keep their hand-tuned windows. */
  Object.keys(R).forEach(function (key) {
    var d = R[key];
    d.tough = TOUGH[d.id] === undefined ? 1 : TOUGH[d.id];
    d.moves.forEach(function (m) {
      if (m.counter && m.wind && !m.special) {
        m.counter.from = Math.max(2, Math.round(m.wind * 0.42));
        m.counter.to = Math.max(m.counter.from + 3, Math.round(m.wind * 0.80));
      }
      if (m.open) m.open = Math.min(m.open, 20);
      if (m.openMul) m.openMul = Math.min(m.openMul, 1.8);
      if (m.dmg && !m.instantDown) m.dmg = Math.round(m.dmg * 3);
    });
  });

  PO.Roster = R;

  /* ===================================================================== */
  /* Career: the full 14-fight card, plus Mr. Dream as the bonus rematch    */
  PO.CAREER = [
    { opp: 'glassjoe',    circuit: 'MINOR', rankFrom: 3, rankTo: 2, oppRank: 2 },
    { opp: 'vonkaiser',   circuit: 'MINOR', rankFrom: 2, rankTo: 1, oppRank: 1 },
    { opp: 'pistonhonda', circuit: 'MINOR', rankFrom: 1, title: 'MINOR', oppRank: 0 },
    { opp: 'donflamenco', circuit: 'MAJOR', rankFrom: 4, rankTo: 3, oppRank: 3 },
    { opp: 'kinghippo',   circuit: 'MAJOR', rankFrom: 3, rankTo: 2, oppRank: 2 },
    { opp: 'greattiger',  circuit: 'MAJOR', rankFrom: 2, rankTo: 1, oppRank: 1 },
    { opp: 'baldbull',    circuit: 'MAJOR', rankFrom: 1, title: 'MAJOR', oppRank: 0 },
    { opp: 'pistonhonda2',circuit: 'WORLD', rankFrom: 5, rankTo: 4, oppRank: 4 },
    { opp: 'sodapopinski',circuit: 'WORLD', rankFrom: 4, rankTo: 3, oppRank: 3 },
    { opp: 'baldbull2',   circuit: 'WORLD', rankFrom: 3, rankTo: 2, oppRank: 2 },
    { opp: 'donflamenco2',circuit: 'WORLD', rankFrom: 2, rankTo: 1, oppRank: 1 },
    { opp: 'mrsandman',   circuit: 'WORLD', rankFrom: 1, rankTo: 1, oppRank: 1, contender: true },
    { opp: 'machoman',    circuit: 'WORLD', rankFrom: 1, title: 'WORLD', oppRank: 0 },
    { opp: 'tyson',       circuit: 'DREAM', dream: true },
    { opp: 'mrdream',     circuit: 'DREAM', dream: true }
  ];

  /* Little Mac's record grows one win at a time through the card */
  PO.macRecord = function (fightIndex) {
    var w = fightIndex, kos = fightIndex;
    return (w < 10 ? ' ' : '') + w + '- 0  ' + kos + 'KO';
  };
})();
