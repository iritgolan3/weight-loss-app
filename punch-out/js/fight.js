/* Punch-Out!! — the fight itself: state machines for Little Mac and the
   opponent, dodging, counters, stars, hearts, knockdowns and the round clock.
   All timings are frames at 60fps. */
(function () {
  'use strict';
  var PO = window.PO, C = PO.C, Art = PO.Art, Snd = PO.Audio, BTN = PO.BTN;
  var F = (PO.Fight = {});

  var OPP_BASE = 150, MAC_BASE = 218, CENTER = 128;
  var ROUND_SECONDS = 180;
  var MAC_MAX_HEARTS = 48;
  var MAC_MAX_HP = 100;

  /* bake the head expressions once per boxer */
  var fighterCache = {};
  function makeFighter(def) {
    if (fighterCache[def.id]) return fighterCache[def.id];
    var heads = {};
    ['idle', 'tell', 'hurt', 'dizzy', 'ko'].forEach(function (e) {
      heads[e] = Art.buildHead(def.head, e);
    });
    var f = {
      def: def, heads: heads, build: def.build,
      skin: def.skin, skinD: def.skinD, skinL: def.skinL,
      trunk: def.trunk, trunkD: def.trunkD, trunkL: def.trunkL, belt: def.belt,
      glove: def.glove, gloveD: def.gloveD, gloveL: def.gloveL,
      boot: def.boot, bootD: def.bootD, chestHair: def.chestHair
    };
    fighterCache[def.id] = f;
    return f;
  }
  F.makeFighter = makeFighter;

  /* Damage is a fraction of the opponent's own stamina bar, so every boxer
     needs roughly the same number of clean counters to drop — the difference
     between them is how hard they are to counter at all. `tough` stretches
     that for the later fights. */
  var DMG = { counter: 0.170, star: 0.250, whiff: 0.040, stun: 0.050, idle: 0.018, graze: 0.006 };

  /* openness: how much damage an idle opponent takes from a plain punch */
  var OPENNESS = {
    glassjoe: 0.90, vonkaiser: 0.40, pistonhonda: 0.30, pistonhonda2: 0.22,
    donflamenco: 0.28, donflamenco2: 0.20, kinghippo: 0.0, greattiger: 0.25,
    baldbull: 0.22, baldbull2: 0.16, sodapopinski: 0.20, mrsandman: 0.12,
    machoman: 0.10, tyson: 0.06, mrdream: 0.06
  };

  F.start = function (oppDef, entry, fightIndex) {
    var st = {
      def: oppDef, entry: entry, fightIndex: fightIndex,
      fighter: makeFighter(oppDef),
      phase: 'intro', phaseT: 0,
      round: 1, timeLeft: ROUND_SECONDS, tick: 0,
      points: 0, result: null, elapsed: 0,
      shake: 0, flash: 0, hitSpark: null, msg: null, msgT: 0,
      mac: {
        hp: MAC_MAX_HP, maxHp: MAC_MAX_HP,
        hearts: MAC_MAX_HEARTS, maxHearts: MAC_MAX_HEARTS,
        stars: 0, state: 'idle', t: 0, punch: null, x: 0,
        downs: 0, downsRound: 0, mash: 0, exhausted: false,
        regen: 0, heals: 3, invuln: 0
      },
      opp: {
        hp: oppDef.hp, maxHp: oppDef.hp,
        state: 'idle', t: 0, move: null, rep: 0, gap: 60,
        downs: 0, downsRound: 0, count: 0, countT: 0,
        offX: 0, offY: 0, expr: 'idle', exposed: false,
        teleports: 0, stunT: 0, guard: false, hidden: false, chargeHop: 0
      }
    };
    st.opp.gap = rnd(oppDef.gap[0], oppDef.gap[1]);
    return st;
  };

  function rnd(a, b) { return a + PO.randInt(b - a + 1); }

  function say(st, text, frames) { st.msg = text; st.msgT = frames || 90; }

  /* ===================================================================== */
  /* Update                                                                 */
  /* ===================================================================== */
  F.update = function (st) {
    st.tick++;
    if (st.msgT > 0) st.msgT--; else st.msg = null;
    if (st.shake > 0) st.shake--;
    if (st.flash > 0) st.flash--;
    if (st.hitSpark) { st.hitSpark.t--; if (st.hitSpark.t <= 0) st.hitSpark = null; }

    switch (st.phase) {
      case 'intro':      updateIntro(st); break;
      case 'active':     updateActive(st); break;
      case 'oppdown':    updateOppDown(st); break;
      case 'macdown':    updateMacDown(st); break;
      case 'roundend':   updateRoundEnd(st); break;
      case 'over':       st.phaseT++; break;
    }
    return st.result;
  };

  function updateIntro(st) {
    st.phaseT++;
    if (st.phaseT === 1) { Snd.sfx('bell'); Snd.crowdOn(); }
    if (st.phaseT === 40) Snd.playMusic('fight');
    if (st.phaseT > 110) { st.phase = 'active'; st.phaseT = 0; }
  }

  function updateRoundEnd(st) {
    st.phaseT++;
    if (st.phaseT === 1) Snd.sfx('bell');
    if (st.phaseT > 150) {
      if (st.round >= 3) { decide(st); return; }
      st.round++;
      st.timeLeft = ROUND_SECONDS;
      st.mac.hp = Math.min(st.mac.maxHp, st.mac.hp + 40);
      st.mac.hearts = st.mac.maxHearts;
      st.mac.exhausted = false;
      st.mac.downsRound = 0;
      st.opp.downsRound = 0;
      st.opp.hp = Math.min(st.opp.maxHp, st.opp.hp + Math.round(st.opp.maxHp * 0.18));
      st.opp.state = 'idle'; st.opp.t = 0; st.opp.gap = 90;
      st.mac.state = 'idle'; st.mac.t = 0;
      st.phase = 'intro'; st.phaseT = 0;
    }
  }

  function decide(st) {
    if (st.def.surviveToWin) finish(st, { win: true, type: 'DECISION', round: st.round, time: st.elapsed });
    else if (st.points >= st.def.decisionPoints) finish(st, { win: true, type: 'DECISION', round: st.round, time: st.elapsed });
    else finish(st, { win: false, type: 'DECISION', round: st.round, time: st.elapsed });
  }

  function finish(st, res) {
    st.result = res;
    st.phase = 'over'; st.phaseT = 0;
    Snd.stopMusic();
    Snd.crowdOff();
    Snd.playMusic(res.win ? 'ko' : 'lose');
  }

  /* --------------------------------------------------------------------- */
  function updateActive(st) {
    st.timeLeft -= 1 / 60;
    st.elapsed += 1 / 60;
    if (st.timeLeft <= 0) {
      st.timeLeft = 0;
      st.phase = 'roundend'; st.phaseT = 0;
      Snd.stopMusic();
      return;
    }
    updateMac(st);
    updateOpp(st);
  }

  /* ---------------- Little Mac ---------------- */
  function updateMac(st) {
    var m = st.mac, I = PO.Input;
    m.t++;
    if (m.invuln > 0) m.invuln--;

    /* heart regeneration */
    m.regen++;
    var regenRate = m.exhausted ? 20 : 72;
    if (m.regen >= regenRate) {
      m.regen = 0;
      if (m.hearts < m.maxHearts) m.hearts++;
      if (m.exhausted && m.hearts >= 8) m.exhausted = false;
    }

    switch (m.state) {
      case 'idle':
        if (I.pressed(BTN.SELECT) && m.heals > 0 && m.hp < m.maxHp) {
          m.heals--; m.hp = Math.min(m.maxHp, m.hp + 18); Snd.sfx('heal');
          say(st, 'SECOND WIND', 60);
        }
        /* consume() also picks up a button pressed a few frames early, so a
           punch queued during the tail of a dodge still comes out */
        if (I.consume(BTN.START) && m.stars > 0) { startPunch(st, 'star', 'head'); break; }
        if (I.held(BTN.LEFT))       { m.state = 'dodgeL'; m.t = 0; Snd.sfx('dodge'); }
        else if (I.held(BTN.RIGHT)) { m.state = 'dodgeR'; m.t = 0; Snd.sfx('dodge'); }
        else if (I.held(BTN.DOWN))  { m.state = 'duck'; m.t = 0; }
        else if (I.consume(BTN.A))  startPunch(st, 'R', I.held(BTN.UP) ? 'head' : 'body');
        else if (I.consume(BTN.B))  startPunch(st, 'L', I.held(BTN.UP) ? 'head' : 'body');
        break;

      case 'dodgeL': case 'dodgeR':
        if (m.t >= 20) { m.state = 'idle'; m.t = 0; }
        break;

      case 'duck':
        if (!PO.Input.held(BTN.DOWN) && m.t >= 10) { m.state = 'idle'; m.t = 0; }
        if (m.t > 150) { m.state = 'idle'; m.t = 0; }   /* can't camp forever */
        break;

      case 'punch':
        if (m.t === m.punch.active) resolveMacPunch(st);
        if (m.t >= m.punch.total) { m.state = 'idle'; m.t = 0; m.punch = null; }
        break;

      case 'hurt':
        if (m.t >= 26) { m.state = 'idle'; m.t = 0; }
        break;
    }
  }

  function startPunch(st, hand, target) {
    var m = st.mac;
    if (m.exhausted && hand !== 'star') { Snd.sfx('deny'); return; }
    if (m.hearts <= 0 && hand !== 'star') { m.exhausted = true; Snd.sfx('deny'); return; }
    var isStar = hand === 'star';
    m.state = 'punch'; m.t = 0;
    m.punch = {
      hand: isStar ? 'R' : hand, target: target, star: isStar,
      active: isStar ? 14 : (target === 'head' ? 8 : 6),
      total: isStar ? 46 : (target === 'head' ? 26 : 22)
    };
    if (isStar) { m.stars--; Snd.sfx('star'); }
    else {
      m.hearts = Math.max(0, m.hearts - 1);
      if (m.hearts === 0) m.exhausted = true;
      Snd.sfx('whiff');
    }
  }

  function resolveMacPunch(st) {
    var m = st.mac, o = st.opp, d = st.def, p = m.punch;
    if (o.state === 'down' || o.state === 'getup' || o.hidden) return;

    var mv = o.move;
    var tough = d.tough || 1;
    function frac(f) { return Math.max(1, Math.round(o.maxHp * f / tough)); }

    /* --- countered him on the tell --- */
    if (o.state === 'wind' && mv && mv.counter) {
      var c = mv.counter;
      var inWindow = o.t >= o.cFrom && o.t <= o.cTo;
      var targetOk = c.target === 'any' || c.target === p.target;
      if (inWindow && targetOk) {
        if (c.exposeMouth) {                    /* King Hippo's open mouth */
          o.exposed = true;
          o.state = 'stun'; o.t = 0; o.stunT = 110; o.expr = 'hurt';
          say(st, 'HIS GUARD IS DOWN', 100);
          Snd.sfx('starhit'); st.shake = 10;
          addPoints(st, 300);
          return;
        }
        if (c.knockdown) {                      /* the Bull Charge counter */
          damage(st, o.maxHp, true);
          Snd.sfx('starhit'); st.shake = 20; st.flash = 6;
          addPoints(st, 1000);
          return;
        }
        m.stars = Math.min(3, m.stars + 1);
        damage(st, frac(DMG.counter), false);
        Snd.sfx('starhit'); st.shake = 12; st.flash = 3;
        o.state = 'stun'; o.t = 0; o.stunT = 45; o.expr = 'hurt';
        addPoints(st, 200);
        spark(st, p.target, true);
        return;
      }
    }

    /* --- how open is he right now? --- */
    var pct;
    if (o.state === 'whiff') pct = DMG.whiff * ((mv && mv.openMul) || 1.5) / 1.5;
    else if (o.state === 'stun') pct = DMG.stun;
    else if (o.state === 'taunt' || o.state === 'drink') pct = DMG.whiff * 1.2;
    else if (o.state === 'guard') pct = 0;
    else if (o.state === 'wind' || o.state === 'strike' || o.state === 'recover') pct = DMG.graze;
    else pct = DMG.idle * (OPENNESS[d.id] === undefined ? 0.25 : OPENNESS[d.id]);

    /* King Hippo shrugs everything off until his belly is showing */
    if (d.invulnerable && !o.exposed) pct = 0;
    if (d.invulnerable && o.exposed && p.target !== 'body' && o.state !== 'stun') pct *= 0.2;

    if (p.star) {
      if (d.invulnerable && !o.exposed) { blocked(st); return; }
      damage(st, frac(DMG.star), false);
      Snd.sfx('hitbig'); st.shake = 14; st.flash = 4;
      o.state = 'stun'; o.t = 0; o.stunT = 55; o.expr = 'hurt';
      addPoints(st, 500);
      spark(st, p.target, true);
      return;
    }

    /* a punch that barely lands costs stamina, exactly like hitting the guard */
    if (pct <= DMG.graze + 0.0001) { blocked(st); return; }

    if (p.target === 'head') pct *= 1.25;
    damage(st, frac(pct), false);
    var solid = pct >= DMG.whiff;
    Snd.sfx(solid ? 'hitbig' : 'hit');
    if (solid) { st.shake = 5; o.expr = 'hurt'; o.hurtT = 12; }
    addPoints(st, p.target === 'head' ? 20 : 10);
    spark(st, p.target, false);
  }

  function blocked(st) {
    st.mac.hearts = Math.max(0, st.mac.hearts - 4);
    if (st.mac.hearts === 0) st.mac.exhausted = true;
    Snd.sfx('block');
    spark(st, st.mac.punch.target, false, true);
  }

  function spark(st, target, big, block) {
    st.hitSpark = { t: big ? 14 : 8, y: target === 'head' ? 82 : 116, big: big, block: block };
  }

  function addPoints(st, n) { st.points += n; }

  function damage(st, amount, instantDown) {
    var o = st.opp;
    o.hp -= amount;
    Snd.crowdCheer(amount / 40);
    if (o.hp <= 0 || instantDown) {
      o.hp = 0;
      knockDownOpp(st);
    }
  }

  function knockDownOpp(st) {
    var o = st.opp, d = st.def;
    o.downs++; o.downsRound++;
    o.state = 'down'; o.t = 0; o.count = 0; o.countT = 0; o.expr = 'ko';
    o.move = null;
    st.shake = 18;
    Snd.sfx('down'); Snd.crowdCheer(0.25);
    Snd.stopMusic();
    st.phase = 'oppdown'; st.phaseT = 0;
    addPoints(st, 1000);
  }

  /* ---------------- opponent ---------------- */
  function updateOpp(st) {
    var o = st.opp, d = st.def;
    o.t++;
    if (o.hurtT > 0) { o.hurtT--; if (o.hurtT === 0 && o.state !== 'stun') o.expr = 'idle'; }

    switch (o.state) {
      case 'idle':
        o.expr = 'idle'; o.offX = 0; o.offY = 0;
        if (o.t >= o.gap) chooseMove(st);
        break;

      case 'wind':
        if (!o.move) { o.state = 'idle'; o.t = 0; break; }
        o.expr = o.move.tell ? 'tell' : 'idle';
        windAnim(st);
        if (o.t >= o.windLen) { o.state = 'strike'; o.t = 0; }
        break;

      case 'strike':
        if (!o.move) { o.state = 'idle'; o.t = 0; break; }
        if (o.t === o.move.strike) resolveOppStrike(st);
        /* a knockdown during the strike clears the move out from under us */
        if (!o.move) { o.state = 'idle'; o.t = 0; break; }
        if (o.t >= o.move.strike + 10) {
          if (o.move.kind === 'combo' && o.rep < (o.move.reps - 1)) {
            o.rep++; o.state = 'wind'; o.t = 0;
            o.windLen = Math.max(5, Math.round(o.windLen * 0.5));
            o.cFrom = Math.round(o.cFrom * 0.5); o.cTo = Math.round(o.cTo * 0.5);
          } else if (o.move.special === 'express' && o.rep < (o.move.reps - 1)) {
            o.rep++; o.state = 'wind'; o.t = 0;
            o.windLen = Math.max(6, Math.round(o.windLen * 0.6));
            o.cFrom = Math.round(o.cFrom * 0.6); o.cTo = Math.round(o.cTo * 0.6);
          } else {
            o.state = 'recover'; o.t = 0;
          }
        }
        break;

      case 'whiff':
        o.expr = 'hurt';
        if (o.t >= (o.move && o.move.open ? o.move.open : 26)) { o.state = 'recover'; o.t = 0; }
        break;

      case 'stun':
        o.expr = 'dizzy';
        if (o.t >= o.stunT) { o.state = 'idle'; o.t = 0; o.gap = rnd(30, 50); o.expr = 'idle'; }
        break;

      case 'taunt': case 'drink': case 'guard':
        if (!o.move) { o.state = 'idle'; o.t = 0; break; }
        if (o.state === 'drink' && o.t === 40 && o.move.heal) {
          o.hp = Math.min(o.maxHp, o.hp + o.move.heal);
          Snd.sfx('drink');
        }
        if (o.t >= o.windLen) { o.state = 'recover'; o.t = 0; }
        break;

      case 'recover':
        o.expr = 'idle'; o.offX = 0; o.offY = 0; o.hidden = false;
        if (o.t >= (o.move && o.move.recover ? o.move.recover : 20)) {
          o.state = 'idle'; o.t = 0; o.rep = 0;
          var g = d.gap, adj = (d.gapR && d.gapR[st.round - 1]) || 0;
          o.gap = Math.max(10, rnd(g[0], g[1]) + adj);
        }
        break;
    }
  }

  function chooseMove(st) {
    var o = st.opp, d = st.def;
    var moves = d.moves, w = d.weights || moves.map(function () { return 1; });

    /* Tyson and Mr. Dream open with nothing but the one-punch uppercut */
    if (d.phase1Until && st.round === 1 && st.elapsed < (ROUND_SECONDS - d.phase1Until)) {
      pick(st, moves[0]); return;
    }
    /* King Hippo goes back to guarding his mouth once exposed */
    var total = 0, i;
    for (i = 0; i < moves.length; i++) total += w[i];
    var r = PO.rand() * total, acc = 0, chosen = moves[0];
    for (i = 0; i < moves.length; i++) { acc += w[i]; if (r <= acc) { chosen = moves[i]; break; } }
    pick(st, chosen);
  }

  function pick(st, mv) {
    var o = st.opp, d = st.def;
    o.move = mv; o.rep = 0; o.t = 0;
    /* stretch or squeeze this particular throw a little. The tougher the
       boxer, the less you can rely on having memorised his timing. */
    var jitter = d.jitter === undefined ? 0.06 + Math.max(0, (d.tough || 1) - 0.55) * 0.12 : d.jitter;
    o.ws = 1 + (PO.rand() - 0.5) * 2 * jitter;
    o.windLen = Math.max(6, Math.round((mv.wind || 20) * o.ws));
    if (mv.counter) {
      o.cFrom = Math.max(1, Math.round(mv.counter.from * o.ws));
      o.cTo = Math.max(o.cFrom + 2, Math.round(mv.counter.to * o.ws));
    } else { o.cFrom = 0; o.cTo = -1; }
    o.side = mv.glove === 'A' ? (PO.rand() < 0.5 ? 'L' : 'R') : mv.glove;
    if (mv.kind === 'taunt') { o.state = 'taunt'; say(st, 'HE IS SHOWING OFF', 70); return; }
    if (mv.kind === 'guard') { o.state = 'guard'; return; }
    if (mv.special === 'drink') { o.state = 'drink'; Snd.sfx('drink'); return; }
    o.state = 'wind';
    if (mv.special === 'charge') { Snd.sfx('charge'); say(st, 'BULL CHARGE!', 80); }
    if (mv.special === 'rush') say(st, 'HONDA RUSH!', 70);
    if (mv.special === 'express') say(st, 'DREAMLAND EXPRESS!', 70);
    if (mv.special === 'teleport') Snd.sfx('teleport');
  }

  /* per-special animation while winding up */
  function windAnim(st) {
    var o = st.opp, mv = o.move, t = o.t, w = o.windLen;
    switch (mv.special) {
      case 'shiver':
        o.offX = (t % 4 < 2 ? -2 : 2);
        break;
      case 'rush':
        o.offY = -Math.round(Math.min(14, t * 0.4));      /* backs toward the ropes */
        o.offX = (t % 8 < 4 ? -3 : 3);
        break;
      case 'charge': {
        var hop = Math.floor(t / (w / 4));
        o.chargeHop = hop;
        if (hop < 3) { o.offY = -Math.round(16 - hop * 2) + (t % 12 < 6 ? -3 : 0); o.offX = 0; }
        else { o.offY = -Math.round(10 * (1 - (t - w * 0.75) / (w * 0.25))); }
        break;
      }
      case 'teleport':
        if (t > w * 0.45 && t < w * 0.8) { o.hidden = true; }
        else if (t >= w * 0.8) {
          o.hidden = false;
          o.offX = (o.side === 'L' ? -26 : 26);
        }
        break;
      case 'spin':
        o.offX = Math.round(Math.sin(t * 0.5) * 3);
        break;
      case 'matador':
        o.offY = -Math.round(Math.sin(t / w * Math.PI) * 4);
        break;
      case 'mouth': case 'flop':
        o.offY = -Math.round(Math.sin(t / w * Math.PI) * 3);
        break;
      case 'dynamite':
        o.offX = (t % 6 < 3 ? -1 : 1);
        break;
    }
  }

  function resolveOppStrike(st) {
    var m = st.mac, o = st.opp, mv = o.move;
    var dodged = false, blockedIt = false;

    if (m.invuln > 0) dodged = true;
    else if (m.state === 'dodgeL' || m.state === 'dodgeR') {
      if (m.t >= 3 && m.t <= 13) dodged = true;
    } else if (m.state === 'duck') {
      if (mv.target === 'head') dodged = true;
      else blockedIt = true;
    } else if (PO.Input.held(BTN.DOWN)) blockedIt = true;

    if (dodged) {
      o.state = 'whiff'; o.t = 0;
      m.hearts = Math.min(m.maxHearts, m.hearts + 1);
      if (m.hearts >= 8) m.exhausted = false;
      Snd.sfx('whiff');
      if (mv.special === 'teleport') {
        o.teleports++;
        if (st.def.teleportDizzy && o.teleports >= st.def.teleportDizzy) {
          o.teleports = 0; o.state = 'stun'; o.stunT = 160; o.t = 0;
          say(st, 'HE IS DIZZY!', 90);
        }
      }
      return;
    }

    if (blockedIt) {
      var bd = Math.max(1, Math.round(mv.dmg * (mv.block === undefined ? 0.35 : mv.block)));
      hitMac(st, bd, true);
      return;
    }
    hitMac(st, mv.dmg, false, mv.instantDown);
  }

  function hitMac(st, dmg, wasBlock, instantDown) {
    var m = st.mac;
    if (wasBlock) {
      Snd.sfx('block');
      m.hp = Math.max(0, m.hp - dmg);
      m.hearts = Math.max(0, m.hearts - 1);
    } else {
      Snd.sfx('taken');
      m.hp = Math.max(0, m.hp - dmg);
      m.stars = 0;
      m.hearts = Math.max(0, m.hearts - 3);
      m.state = 'hurt'; m.t = 0;
      st.shake = 10;
    }
    if (m.hearts === 0) m.exhausted = true;
    if (m.hp <= 0 || instantDown) knockDownMac(st);
  }

  function knockDownMac(st) {
    var m = st.mac;
    m.hp = 0;
    m.downs++; m.downsRound++;
    m.state = 'down'; m.t = 0; m.mash = 0;
    st.opp.state = 'idle'; st.opp.t = 0; st.opp.gap = 200; st.opp.move = null;
    st.shake = 20;
    Snd.sfx('down');
    Snd.stopMusic();
    st.phase = 'macdown'; st.phaseT = 0;
    st.count = 0; st.countT = 0;
  }

  /* ---------------- knockdown sequences ---------------- */
  function updateOppDown(st) {
    var o = st.opp;
    st.phaseT++;
    if (st.phaseT < 60) return;                          /* he hits the canvas */
    o.countT++;
    if (o.countT >= 45) {
      o.countT = 0; o.count++;
      Snd.sfx('count');
      var getUpAt = st.def.getUp[Math.min(o.downs - 1, st.def.getUp.length - 1)];
      var tko = o.downsRound >= 3 || o.downs >= (st.def.maxDowns || 3);
      if (o.count >= 10) {
        finish(st, { win: true, type: 'KO', round: st.round, time: st.elapsed });
        return;
      }
      if (!tko && !st.def.neverGetsUp && o.count >= getUpAt) {
        o.state = 'getup'; o.t = 0;
        o.hp = Math.round(o.maxHp * (0.55 + 0.15 * PO.rand()));
        o.expr = 'idle';
        st.phase = 'active'; st.phaseT = 0;
        o.state = 'recover'; o.move = { recover: 60 }; o.t = 0;
        Snd.playMusic('fight');
        return;
      }
      if (tko && o.count >= 3) {
        finish(st, { win: true, type: 'TKO', round: st.round, time: st.elapsed });
        return;
      }
    }
  }

  function updateMacDown(st) {
    var m = st.mac;
    st.phaseT++;
    if (st.phaseT < 60) return;
    if (PO.Input.pressed(BTN.A) || PO.Input.pressed(BTN.B) || PO.Input.pressed(BTN.START)) m.mash += 6;
    if (m.mash > 0) m.mash -= 0.35;
    st.countT++;
    if (st.countT >= 45) {
      st.countT = 0; st.count++;
      Snd.sfx('count');
      if (m.downsRound >= 3) {
        finish(st, { win: false, type: 'TKO', round: st.round, time: st.elapsed });
        return;
      }
      if (st.count >= 10) {
        finish(st, { win: false, type: 'KO', round: st.round, time: st.elapsed });
        return;
      }
    }
    if (m.mash >= 100) {
      m.hp = Math.round(m.maxHp * 0.5);
      m.hearts = Math.round(m.maxHearts * 0.6);
      m.exhausted = false;
      m.state = 'idle'; m.t = 0; m.invuln = 90;
      st.phase = 'active'; st.phaseT = 0;
      Snd.playMusic('fight');
    }
  }

  /* ===================================================================== */
  /* Draw                                                                   */
  /* ===================================================================== */
  F.draw = function (st) {
    var sx = st.shake > 0 ? (st.tick % 2 ? 2 : -2) : 0;
    Art.drawRing(st.def.ring, st.tick);

    drawOpponent(st, sx);
    drawMacSprite(st, sx);

    if (st.hitSpark) drawSpark(st);
    Art.drawHUD(st);

    if (st.phase === 'oppdown' || st.phase === 'macdown') drawCount(st);
    if (st.phase === 'intro') drawRoundCard(st);
    if (st.phase === 'roundend') {
      PO.textCenter('END OF ROUND ' + st.round, 128, 100, C.white, { shadow: C.black });
    }
    if (st.msg) {
      var mw = PO.textWidth(st.msg, { spacing: 7 }) + 12, my = 172;
      PO.fillRect(128 - (mw >> 1), my - 4, mw, 16, C.black);
      PO.rect(128 - (mw >> 1), my - 4, mw, 16, C.yellow);
      PO.textCenter(st.msg, 128, my, C.yellow, { spacing: 7 });
    }
    if (st.mac.exhausted) {
      if ((st.tick >> 4) % 2 === 0) PO.textCenter('OUT OF STEAM!', 128, 196, C.blueL, { shadow: C.black });
    }
    if (st.flash > 0) {
      for (var y2 = 40; y2 < 224; y2++) for (var x = 0; x < 256; x++) {
        if (((x + y2) & 1) === 0) PO.px(x, y2, C.white);
      }
    }
  };

  function drawRoundCard(st) {
    if (st.phaseT > 95) return;
    PO.fillRect(78, 78, 100, 52, C.black);
    PO.rect(78, 78, 100, 52, C.white);
    PO.textCenter('ROUND', 128, 86, C.white);
    PO.textCenter(String(st.round), 128, 100, C.red, { scale: 3 });
  }

  function drawCount(st) {
    var down = st.phase === 'oppdown' ? st.opp : st.mac;
    var n = st.phase === 'oppdown' ? st.opp.count : st.count;
    if (st.phaseT < 60) return;
    Art.drawRef(40, 200, Math.floor(st.tick / 20));
    if (n > 0) {
      PO.fillRect(104, 74, 48, 44, C.black);
      PO.rect(104, 74, 48, 44, C.white);
      PO.textCenter(String(n), 128, 82, C.white, { scale: 4 });
    }
    if (st.phase === 'macdown') {
      PO.textCenter('MASH A AND B!', 128, 128, C.yellow, { shadow: C.black });
      Art.barMeter(88, 142, 80, st.mac.mash / 100, C.greenL, C.black);
    }
  }

  function drawSpark(st) {
    var s = st.hitSpark;
    var cx = 128, cy = s.y;
    var r = s.big ? 16 - s.t : 10 - s.t;
    if (r < 1) return;
    var col = s.block ? C.grey : (s.big ? C.white : C.yellowL);
    for (var a = 0; a < 8; a++) {
      var ang = a * Math.PI / 4;
      var x0 = cx + Math.cos(ang) * (r * 0.4), y0 = cy + Math.sin(ang) * (r * 0.4);
      var x1 = cx + Math.cos(ang) * r, y1 = cy + Math.sin(ang) * r;
      PO.line(x0, y0, x1, y1, col);
    }
    if (s.big) PO.ellipseOutline(cx, cy, r, r, C.orange);
  }

  /* ---------------- opponent pose ---------------- */
  function drawOpponent(st, sx) {
    var o = st.opp, f = st.fighter, b = f.build, d = st.def;
    if (o.hidden) {
      /* Great Tiger's vanishing act */
      for (var i = 0; i < 14; i++) {
        var ang = st.tick * 0.2 + i;
        PO.px(128 + Math.cos(ang) * (10 + i * 2), OPP_BASE - 44 + Math.sin(ang) * (8 + i), C.white);
      }
      return;
    }
    var cx = CENTER + o.offX + sx;
    var base = OPP_BASE + o.offY;

    if (o.state === 'down') { drawDownedOpponent(st, cx, base); return; }

    /* gloves rest tucked in front of the chest, elbows flared out */
    var guardY = b.guardY;
    var guardX = Math.max(9, Math.round(b.waistW * 0.42));
    var bob = Math.round(Math.sin(st.tick * 0.09) * 1.5);

    var pose = {
      cx: cx, base: base, crouch: 0, lean: 0,
      lgx: -guardX, lgy: guardY + bob, rgx: guardX, rgy: guardY + bob,
      headX: 0, headY: bob, expr: o.expr
    };

    var mv = o.move, side = o.side;
    if (o.state === 'wind' && mv) {
      var p = Math.min(1, o.t / Math.max(1, o.windLen || mv.wind));
      var pull = Math.round(11 * p);
      if (side === 'L') { pose.lgx = -guardX - pull; pose.lgy = guardY + (mv.target === 'body' ? -3 : 7) + pull; }
      else { pose.rgx = guardX + pull; pose.rgy = guardY + (mv.target === 'body' ? -3 : 7) + pull; }
      pose.lean = -Math.round(3 * p);
      if (mv.special === 'spin') {
        var ang = o.t * 0.35;
        pose.rgx = Math.round(Math.cos(ang) * 26) + 10;
        pose.rgy = guardY + Math.round(Math.sin(ang) * 22);
      }
      if (mv.special === 'matador') { pose.lgx = -8; pose.lgy = guardY + 14; pose.rgx = guardX + 6; pose.rgy = guardY - 6; }
      if (mv.special === 'drink') { pose.rgx = 4; pose.rgy = guardY + 20; }
    } else if (o.state === 'strike' && mv) {
      var k = Math.min(1, o.t / Math.max(1, mv.strike));
      var ty = Math.round(guardY - (mv.target === 'head' ? 20 : 30) * k);
      var tx = Math.round(guardX - (guardX - 5) * k);
      if (side === 'L') { pose.lgx = -tx; pose.lgy = ty; pose.lgr = b.gloveR + Math.round(3 * k); }
      else { pose.rgx = tx; pose.rgy = ty; pose.rgr = b.gloveR + Math.round(3 * k); }
      pose.lean = Math.round(4 * k);
      pose.expr = 'tell';
    } else if (o.state === 'whiff') {
      pose.lgy = guardY - 26; pose.rgy = guardY - 26;
      pose.lean = 4; pose.headY = 4;
    } else if (o.state === 'stun') {
      pose.lgx = -guardX - 6; pose.rgx = guardX + 6;
      pose.lgy = guardY - 16; pose.rgy = guardY - 16;
      pose.lean = Math.round(Math.sin(st.tick * 0.2) * 3);
      pose.headX = Math.round(Math.sin(st.tick * 0.2) * 2);
    } else if (o.state === 'taunt') {
      pose.lgx = -guardX - 10; pose.rgx = guardX + 10;
      pose.lgy = guardY + 22; pose.rgy = guardY + 22;
    } else if (o.state === 'drink') {
      pose.rgx = 2; pose.rgy = guardY + 22; pose.headY = -2;
    } else if (o.state === 'guard') {
      pose.lgx = -12; pose.rgx = 12; pose.lgy = guardY + 12; pose.rgy = guardY + 12;
    }

    /* King Hippo drops his trunks once his belly is open */
    var fighter = f;
    if (d.invulnerable && o.exposed) {
      fighter = Object.create(f);
      fighter.trunk = C.white; fighter.trunkD = C.grey; fighter.belt = C.red;
    }

    Art.drawFighter(fighter, pose);

    /* props */
    if (mv && mv.special === 'drink' && o.state === 'drink') {
      PO.fillRect(cx + 1, base - guardY - 24, 5, 12, C.greenL);
      PO.fillRect(cx + 2, base - guardY - 27, 3, 4, C.white);
    }
    if (d.id.indexOf('donflamenco') === 0 && (o.state === 'guard' || o.state === 'idle')) {
      PO.ellipse(cx - 2, base - guardY - 16, 3, 3, C.red);
      PO.vline(cx - 2, base - guardY - 13, 6, C.green);
    }
    if (d.invulnerable && o.exposed) {
      var by = base - b.hipY - Math.round((b.shY - b.hipY) * 0.34);
      PO.fillRect(cx - 10, by, 20, 6, C.white);
      PO.fillRect(cx - 10, by + 2, 20, 2, C.red);
    }
    if (mv && mv.special === 'teleport' && o.state === 'wind' && o.t < mv.wind * 0.45) {
      var jy = base - b.shY - 30;
      var on = (st.tick >> 2) % 2 === 0;
      PO.ellipse(cx, jy, 3, 3, on ? C.white : C.red);
    }
  }

  function drawDownedOpponent(st, cx, base) {
    var f = st.fighter, b = f.build, out = C.black;
    var y = base - 4;                       /* the canvas line he is lying on */
    var hx = cx - 26;                       /* head to the left, boots to the right */

    /* legs, sprawled */
    PO.limb(cx + 6, y - 3, cx + 26, y - 9, b.legW, b.legW - 4, f.skin, out);
    PO.limb(cx + 6, y + 2, cx + 24, y + 4, b.legW - 1, b.legW - 5, f.skin, out);
    PO.fillRect(cx + 24, y - 13, 10, 7, f.boot); PO.rect(cx + 24, y - 13, 10, 7, out);
    PO.fillRect(cx + 22, y + 1, 10, 7, f.boot); PO.rect(cx + 22, y + 1, 10, 7, out);

    /* trunks + torso lying flat */
    PO.fillRect(cx + 1, y - 9, 14, 17, f.trunk);
    PO.fillRect(cx + 1, y - 9, 14, 3, f.belt || C.white);
    PO.rect(cx + 1, y - 9, 14, 17, out);
    for (var i = -8; i <= 8; i++) {
      var half = Math.round(9 - Math.abs(i) * 0.18);
      PO.fillRect(cx - 16 + (i + 8), y - half, 1, half * 2, f.skin);
      PO.px(cx - 16 + (i + 8), y - half - 1, out);
      PO.px(cx - 16 + (i + 8), y + half, out);
    }
    PO.fillRect(cx - 16, y - 7, 16, 2, f.skinL);
    PO.fillRect(cx - 16, y + 4, 16, 2, f.skinD);

    /* arms flung out */
    PO.limb(cx - 12, y - 6, cx - 20, y - 16, b.armW - 1, b.armW - 4, f.skin, out);
    PO.limb(cx - 12, y + 5, cx - 18, y + 12, b.armW - 1, b.armW - 4, f.skin, out);
    Art.drawGlove(cx - 23, y - 20, b.gloveR, f.glove, f.gloveD, f.gloveL, false);
    Art.drawGlove(cx - 21, y + 15, b.gloveR, f.glove, f.gloveD, f.gloveL, true);

    /* head, on its side */
    var head = f.heads.ko;
    PO.blit(head, hx - (head.w >> 1), y - head.chin + 6);

    /* the ten-count stars circling above him */
    for (var k = 0; k < 4; k++) {
      var ang = st.tick * 0.09 + k * Math.PI / 2;
      PO.blit(Art.STAR, Math.round(hx + Math.cos(ang) * 13) - 3,
              Math.round(y - 22 + Math.sin(ang) * 4) - 3);
    }
  }

  /* ---------------- Little Mac pose ---------------- */
  function drawMacSprite(st, sx) {
    var m = st.mac;
    var cx = CENTER + sx, base = MAC_BASE;
    var pose = { cx: cx, base: base, crouch: 0, lean: 0 };
    var bob = Math.round(Math.sin(st.tick * 0.12) * 1.5);

    if (m.state === 'down') {
      drawDownedMac(st, cx, base);
      return;
    }

    pose.lgx = -14; pose.lgy = 36 + bob; pose.rgx = 14; pose.rgy = 36 + bob;

    switch (m.state) {
      case 'duck':
        pose.crouch = 15; pose.lgy = 32; pose.rgy = 32; pose.lgx = -10; pose.rgx = 10;
        break;
      case 'dodgeL': {
        var p = dodgeCurve(m.t);
        pose.cx = cx - Math.round(30 * p); pose.lean = -Math.round(6 * p);
        break;
      }
      case 'dodgeR': {
        var p2 = dodgeCurve(m.t);
        pose.cx = cx + Math.round(30 * p2); pose.lean = Math.round(6 * p2);
        break;
      }
      case 'punch': {
        var pu = m.punch;
        var k = m.t <= pu.active ? m.t / pu.active : Math.max(0, 1 - (m.t - pu.active) / (pu.total - pu.active));
        var reach = pu.star ? 78 : (pu.target === 'head' ? 62 : 46);
        var gx = pu.hand === 'L' ? -14 : 14;
        var tgx = pu.hand === 'L' ? -8 : 8;
        var nx = Math.round(gx + (tgx - gx) * k);
        var ny = Math.round(34 + (reach - 34) * k);
        if (pu.hand === 'L') { pose.lgx = nx; pose.lgy = ny; }
        else { pose.rgx = nx; pose.rgy = ny; }
        pose.crouch = pu.star ? -Math.round(6 * k) : 0;
        pose.lean = Math.round((pu.hand === 'L' ? -3 : 3) * k);
        break;
      }
      case 'hurt':
        pose.crouch = 4; pose.lean = (m.t % 4 < 2 ? -3 : 3);
        pose.lgy = 26; pose.rgy = 26;
        break;
    }

    /* exhausted Mac turns pale blue, just like the cartridge */
    if (m.exhausted) {
      var save = { skin: Art.MAC.skin, skinD: Art.MAC.skinD, skinL: Art.MAC.skinL };
      Art.MAC.skin = C.blueL; Art.MAC.skinD = C.blueD; Art.MAC.skinL = C.sky;
      Art.drawMac(pose);
      Art.MAC.skin = save.skin; Art.MAC.skinD = save.skinD; Art.MAC.skinL = save.skinL;
    } else {
      Art.drawMac(pose);
    }
  }

  function dodgeCurve(t) {
    if (t < 5) return t / 5;
    if (t < 14) return 1;
    return Math.max(0, 1 - (t - 14) / 6);
  }

  function drawDownedMac(st, cx, base) {
    var y = base - 6;
    PO.ellipse(cx, y, 20, 7, Art.MAC.skin);
    PO.ellipseOutline(cx, y, 20, 7, C.black);
    PO.fillRect(cx - 8, y - 5, 16, 10, Art.MAC.trunk);
    PO.rect(cx - 8, y - 5, 16, 10, C.black);
    PO.ellipse(cx - 24, y - 2, 8, 7, Art.MAC.skin);
    PO.ellipse(cx - 24, y - 5, 8, 5, Art.MAC.hair);
    PO.ellipseOutline(cx - 24, y - 2, 8, 7, C.black);
    Art.drawGlove(cx + 20, y - 2, 6, Art.MAC.glove, Art.MAC.gloveD, Art.MAC.gloveL, true);
  }

  F.OPP_BASE = OPP_BASE;
  F.MAC_BASE = MAC_BASE;
  F.CENTER = CENTER;
})();
