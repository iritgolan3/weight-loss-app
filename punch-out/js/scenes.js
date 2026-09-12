/* Punch-Out!! — scene flow: title, VS cards, results, circuit championships,
   the Dream Fight intro, the ending, and the password system. */
(function () {
  'use strict';
  var PO = window.PO, C = PO.C, Art = PO.Art, Snd = PO.Audio, BTN = PO.BTN;
  var S = (PO.Scenes = {});

  var G = (PO.Game = {
    progress: 0,        /* index into PO.CAREER */
    losses: 0,
    tysonBeaten: false,
    scene: null,
    fight: null,
    sound: true
  });

  var scene = null, sceneT = 0;
  function go(name, data) {
    scene = { name: name, data: data || {} };
    sceneT = 0;
    G.scene = name;
    if (SCENES[name] && SCENES[name].enter) SCENES[name].enter(scene.data);
  }
  S.go = go;
  S.current = function () { return scene; };

  /* ===================================================================== */
  /* helpers                                                                */
  /* ===================================================================== */
  function circuitTitle(entry) {
    return entry.circuit === 'DREAM' ? 'THE DREAM FIGHT' : entry.circuit + ' CIRCUIT';
  }

  /* draw a boxer portrait: head sprite at 2x over a flat background */
  function portrait(x, y, w, h, def, bg) {
    PO.fillRect(x, y, w, h, bg);
    PO.rect(x, y, w, h, C.white);
    /* ring ropes behind the shoulders */
    PO.fillRect(x + 1, y + Math.round(h * 0.42), w - 2, 2, C.white);
    var f = PO.Fight.makeFighter(def);
    var head = f.heads.idle;
    var hx = x + ((w - head.w * 2) >> 1);
    var hy = y + h - head.chin * 2 - 8;
    /* shoulders */
    PO.fillRect(x + 6, y + h - 12, w - 12, 12, def.skin);
    PO.fillRect(x + 6, y + h - 12, 4, 12, def.skinL);
    PO.fillRect(x + w - 10, y + h - 12, 4, 12, def.skinD);
    PO.blitScaled(head, hx, hy, 2);
    PO.rect(x, y, w, h, C.white);
  }

  /* Little Mac's own portrait card — Mac with Doc Louis behind him */
  function macPortrait(x, y, w, h) {
    PO.fillRect(x, y, w, h, C.greenM);
    PO.fillRect(x + 1, y + 10, w - 2, 2, C.white);
    /* Doc, on the left */
    PO.ellipse(x + 18, y + 26, 11, 12, C.darkSkin);
    PO.ellipse(x + 18, y + 18, 11, 7, C.black);
    PO.ellipseOutline(x + 18, y + 26, 11, 12, C.black);
    PO.fillRect(x + 10, y + 22, 4, 3, C.white); PO.px(x + 12, y + 23, C.black);
    PO.fillRect(x + 20, y + 22, 4, 3, C.white); PO.px(x + 22, y + 23, C.black);
    PO.hline(x + 14, y + 32, 8, C.black);
    PO.fillRect(x + 4, y + 38, 30, h - 38 - 1, C.white);          /* towel */
    /* Mac, on the right */
    PO.ellipse(x + 46, y + 30, 12, 13, C.skin);
    PO.ellipse(x + 46, y + 21, 12, 8, C.black);
    PO.ellipseOutline(x + 46, y + 30, 12, 13, C.black);
    PO.fillRect(x + 39, y + 27, 4, 3, C.white); PO.px(x + 41, y + 28, C.black);
    PO.fillRect(x + 49, y + 27, 4, 3, C.white); PO.px(x + 51, y + 28, C.black);
    PO.hline(x + 41, y + 36, 10, C.black);
    PO.fillRect(x + 36, y + 43, 22, h - 43 - 1, C.grey3);         /* singlet */
    PO.rect(x, y, w, h, C.white);
  }

  function multiline(text, x, y, col, lh) {
    var lines = String(text).split('\n');
    for (var i = 0; i < lines.length; i++) PO.text(lines[i], x, y + i * (lh || 10), col);
    return lines.length;
  }

  function blink(period) { return (Math.floor(sceneT / period) % 2) === 0; }

  /* ===================================================================== */
  /* password                                                               */
  /* ===================================================================== */
  function encodePassword(progress, tysonBeaten) {
    var v = (progress & 15) | (tysonBeaten ? 16 : 0);
    var raw = v * 4099 + 10007;
    var s = ('000000' + raw).slice(-6);
    var sum = 0;
    for (var i = 0; i < 6; i++) sum += parseInt(s.charAt(i), 10);
    return s + (sum % 10);
  }
  function decodePassword(code) {
    if (!/^\d{7}$/.test(code)) return null;
    var s = code.substr(0, 6), sum = 0;
    for (var i = 0; i < 6; i++) sum += parseInt(s.charAt(i), 10);
    if ((sum % 10) !== parseInt(code.charAt(6), 10)) return null;
    var raw = parseInt(s, 10);
    if ((raw - 10007) % 4099 !== 0) return null;
    var v = (raw - 10007) / 4099;
    var progress = v & 15, tyson = !!(v & 16);
    if (progress < 0 || progress >= PO.CAREER.length) return null;
    return { progress: progress, tysonBeaten: tyson };
  }
  S.encodePassword = encodePassword;
  S.decodePassword = decodePassword;

  /* ===================================================================== */
  /* scenes                                                                 */
  /* ===================================================================== */
  var SCENES = {};

  /* ---------------- title ---------------- */
  SCENES.title = {
    enter: function (d) { d.sel = 0; Snd.playMusic('title'); },
    update: function (d) {
      var I = PO.Input;
      if (I.pressed(BTN.UP) || I.pressed(BTN.DOWN)) { d.sel = (d.sel + 1) % 3; Snd.sfx('select'); }
      if (I.pressed(BTN.START) || I.pressed(BTN.A)) {
        Snd.sfx('confirm');
        if (d.sel === 0) { Snd.stopMusic(); go('vs', { index: G.progress }); }
        else if (d.sel === 1) go('password');
        else { G.sound = Snd.toggle(); }
      }
    },
    draw: function (d) {
      PO.clear(C.black);
      /* backdrop: spotlight over a dark ring */
      for (var y = 0; y < 224; y++) {
        var t = y / 224;
        PO.fillRect(0, y, 256, 1, PO.mix(C.navy, C.black, t));
      }
      for (var i = 0; i < 40; i++) {
        var x = (i * 37 + 11) % 256, yy = (i * 53 + 7) % 60;
        if (((sceneT >> 3) + i) % 5 === 0) PO.px(x, yy, C.yellowL);
      }
      /* logo */
      PO.textCenter('PUNCH', 128, 26, C.red, { scale: 3, shadow: C.black });
      PO.textCenter('OUT!!', 128, 52, C.white, { scale: 3, shadow: C.black });
      PO.hline(40, 78, 176, C.red);
      PO.textCenter('W.V.B.A. WORLD CIRCUIT', 128, 84, C.yellow);

      /* two gloves squaring off */
      Art.drawGlove(76, 118, 13, C.red, C.redD, C.redL, false);
      Art.drawGlove(180, 118, 13, C.blueL, C.blueD, C.sky, true);

      var items = ['START GAME', 'PASSWORD', 'SOUND  ' + (Snd.isEnabled() ? 'ON' : 'OFF')];
      for (var m = 0; m < items.length; m++) {
        var yv = 146 + m * 14;
        var on = d.sel === m;
        PO.textCenter(items[m], 128, yv, on ? C.white : C.grey2);
        if (on && blink(16)) PO.text('>', 128 - PO.textWidth(items[m]) / 2 - 14, yv, C.red);
      }
      if (blink(24)) PO.textCenter('PUSH START', 128, 198, C.orange);
      PO.textCenter('A/X PUNCH   ARROWS DODGE', 128, 212, C.grey2, { spacing: 7 });
    }
  };

  /* ---------------- password entry ---------------- */
  SCENES.password = {
    enter: function (d) { d.digits = [0, 0, 0, 0, 0, 0, 0]; d.pos = 0; d.err = 0; },
    update: function (d) {
      var I = PO.Input;
      if (I.pressed(BTN.LEFT)) { d.pos = (d.pos + 6) % 7; Snd.sfx('select'); }
      if (I.pressed(BTN.RIGHT)) { d.pos = (d.pos + 1) % 7; Snd.sfx('select'); }
      if (I.pressed(BTN.UP)) { d.digits[d.pos] = (d.digits[d.pos] + 1) % 10; Snd.sfx('select'); }
      if (I.pressed(BTN.DOWN)) { d.digits[d.pos] = (d.digits[d.pos] + 9) % 10; Snd.sfx('select'); }
      if (I.pressed(BTN.A) || I.pressed(BTN.START)) {
        var res = decodePassword(d.digits.join(''));
        if (res) {
          G.progress = res.progress; G.tysonBeaten = res.tysonBeaten;
          Snd.sfx('confirm'); Snd.stopMusic();
          go('vs', { index: G.progress });
        } else { d.err = 90; Snd.sfx('deny'); }
      }
      if (I.pressed(BTN.B) || I.pressed(BTN.SELECT)) { Snd.sfx('select'); go('title'); }
      if (d.err > 0) d.err--;
    },
    draw: function (d) {
      PO.clear(C.navy);
      PO.textCenter('PASSWORD', 128, 30, C.white, { scale: 2, shadow: C.black });
      PO.hline(40, 50, 176, C.blueL);
      for (var i = 0; i < 7; i++) {
        var x = 60 + i * 20;
        var on = d.pos === i;
        PO.fillRect(x - 2, 84, 16, 18, on ? C.blueD : C.black);
        PO.rect(x - 2, 84, 16, 18, on ? C.white : C.grey2);
        PO.text(String(d.digits[i]), x + 2, 88, C.white, { scale: 1 });
        if (on && blink(15)) { PO.text('^', x + 2, 74, C.yellow); PO.text('~', x + 2, 104, C.yellow); }
      }
      PO.textCenter('UP/DOWN  CHANGE DIGIT', 128, 130, C.grey);
      PO.textCenter('LEFT/RIGHT  MOVE', 128, 142, C.grey);
      PO.textCenter('A  CONFIRM      B  BACK', 128, 154, C.grey);
      if (d.err > 0 && blink(8)) PO.textCenter('WRONG PASSWORD', 128, 176, C.red);
    }
  };

  /* ---------------- VS title card ---------------- */
  SCENES.vs = {
    enter: function (d) {
      d.entry = PO.CAREER[d.index];
      d.def = PO.Roster[d.entry.opp];
      Snd.playMusic(d.entry.dream ? 'dream' : 'card');
    },
    update: function (d) {
      if (PO.Input.pressed(BTN.START) || PO.Input.pressed(BTN.A)) {
        Snd.sfx('confirm'); Snd.stopMusic();
        go('fight', { index: d.index });
      }
    },
    draw: function (d) {
      var e = d.entry, def = d.def;
      PO.clear(C.black);

      if (e.dream) {
        PO.text('THE DREAM FIGHT', 8, 16, C.orange);
        PO.text('"KEEP YOUR', 6, 36, C.white);
        PO.text('  GUARD UP!"', 6, 46, C.white);
        PO.textCenter(def.nick || '', 178, 8, C.greenL, { spacing: 7 });
      } else {
        PO.text(circuitTitle(e), 8, 18, C.orange);
        multiline('FROM BRONX\n  N.Y.', 6, 36, C.white);
        PO.text('AGE: 17', 6, 58, C.white);
        PO.text('WEIGHT:107', 6, 68, C.white);
        PO.text('RANKED: #' + (e.oppRank === 0 ? '1' : e.oppRank), 136, 10, C.greenL, { spacing: 7 });
      }

      /* Mac's side */
      PO.text(PO.macRecord(d.index), 6, 84, C.white, { spacing: 7 });
      macPortrait(6, 98, 72, 56);
      PO.text(e.title || e.dream ? 'CHAMPION' : 'RANKED: #' + (e.rankFrom || 3), 6, 160, C.greenL, { spacing: 7 });
      PO.text('LITTLE MAC', 6, 172, C.white, { spacing: 8 });

      /* opponent's side */
      PO.text(def.name, 136, 22, C.white, { spacing: def.name.length > 13 ? 7 : 8 });
      portrait(150, 34, 72, 56, def, def.portraitBg);
      PO.text(def.record, 136, 96, C.white, { spacing: 7 });
      PO.text('"PROFILE"', 150, 110, C.orange, { spacing: 7 });
      multiline(def.home, 136, 124, C.white, 10);
      PO.text('AGE: ' + def.age, 136, 150, C.white, { spacing: 7 });
      PO.text('WEIGHT:' + def.weight, 136, 162, C.white, { spacing: 7 });

      /* centre */
      PO.text('VS.', 104, 100, C.orange);
      if (blink(20)) {
        PO.text('PUSH', 100, 132, C.orange);
        PO.text('START!', 96, 146, C.orange);
      }
      /* profile quote scrolls under the portrait on the dream cards */
      if (e.dream) multiline(def.quote, 136, 180, C.white, 10);
      else if (sceneT > 60) multiline(def.quote, 6, 190, C.grey, 10);
    }
  };

  /* ---------------- the fight ---------------- */
  SCENES.fight = {
    enter: function (d) {
      var e = PO.CAREER[d.index];
      G.fight = PO.Fight.start(PO.Roster[e.opp], e, d.index);
    },
    update: function (d) {
      var res = PO.Fight.update(G.fight);
      if (res && G.fight.phaseT > 90 && PO.Input.anyPressed()) {
        go('result', { index: d.index, res: res });
      }
    },
    draw: function () { PO.Fight.draw(G.fight); }
  };

  /* ---------------- result ---------------- */
  SCENES.result = {
    enter: function (d) {
      d.entry = PO.CAREER[d.index];
      if (d.res.win) {
        if (d.entry.opp === 'tyson') G.tysonBeaten = true;
        if (d.index >= G.progress) G.progress = Math.min(PO.CAREER.length - 1, d.index + 1);
        Snd.playMusic(d.entry.title || d.entry.dream ? 'champion' : 'ko');
      } else {
        G.losses++;
        Snd.playMusic('lose');
      }
      d.password = encodePassword(G.progress, G.tysonBeaten);
    },
    update: function (d) {
      if (sceneT < 60) return;
      if (PO.Input.pressed(BTN.START) || PO.Input.pressed(BTN.A)) {
        Snd.stopMusic();
        if (!d.res.win) { go('vs', { index: d.index }); return; }
        if (d.entry.opp === 'tyson') { go('ending', {}); return; }
        if (d.entry.opp === 'mrdream') { go('ending', { dream: true }); return; }
        go('vs', { index: Math.min(PO.CAREER.length - 1, d.index + 1) });
      }
    },
    draw: function (d) {
      var e = d.entry, res = d.res;
      PO.clear(res.win ? C.blueD : C.black);
      PO.textCenter('THE W.V.B.A.', 128, 14, C.blueL);
      if (e.circuit === 'DREAM') PO.textCenter('DREAM FIGHT', 128, 28, C.blueL);
      else {
        PO.textCenter(e.circuit, 128, 24, C.blueL);
        PO.textCenter('CIRCUIT', 128, 34, C.blueL);
      }
      for (var x = 8; x < 248; x += 6) PO.hline(x, 44, 3, C.blueL);

      var t = res.time, mm = Math.floor(t / 60), ss = Math.floor(t % 60), hh = Math.floor((t * 100) % 100);
      var timeStr = mm + ':' + ('0' + ss).slice(-2) + '.' + ('0' + hh).slice(-2) + ',R' + res.round;

      if (res.win) {
        PO.textCenter('"GREAT FIGHTING"', 128, 58, C.white);
        PO.textCenter('YOU WON BY ' + res.type + '!', 128, 72, C.white);
        PO.textCenter('TIME ' + timeStr, 128, 86, C.white);
        Art.drawGlove(128, 104, 14, C.red, C.redD, C.redL, false);
        if (e.title) {
          PO.textCenter('"LADIES AND', 128, 128, C.white);
          PO.textCenter('    GENTLEMEN!"', 128, 140, C.white);
          PO.textCenter('"WE HAVE A NEW', 128, 154, C.white);
          PO.textCenter('   CHAMPION!!"', 128, 166, C.white);
          drawTrophy(222, 196);
          Art.drawMac({ cx: 34, base: 214 });
        } else if (e.dream) {
          PO.textCenter('YOU BEAT ' + PO.Roster[e.opp].name, 128, 132, C.yellow, { spacing: 7 });
          PO.textCenter('PUSH START', 128, 156, C.orange);
        } else {
          PO.textCenter("YOU'LL BE RANKED UP TO #" + (e.rankTo || 1), 128, 128, C.white, { spacing: 7 });
          PO.textCenter('ARE YOU READY', 128, 150, C.white);
          PO.textCenter('FOR THE', 128, 162, C.white);
          PO.textCenter('NEXT CHALLENGE ?', 128, 174, C.white);
          if (blink(20)) PO.textCenter('PUSH START!', 128, 190, C.orange);
        }
      } else {
        PO.textCenter('YOU LOST BY ' + res.type, 128, 62, C.red);
        PO.textCenter('TIME ' + timeStr, 128, 78, C.white);
        PO.textCenter('"DONT GIVE UP,', 128, 100, C.white);
        PO.textCenter('   YOU CAN DO IT!"', 128, 112, C.white);
        PO.textCenter('- DOC LOUIS', 128, 128, C.grey);
        if (blink(20)) PO.textCenter('PUSH START TO TRY AGAIN', 128, 156, C.orange, { spacing: 7 });
      }
      PO.textCenter('PASSWORD  ' + d.password, 128, 208, C.greenL, { spacing: 7 });
    }
  };

  function drawTrophy(x, y) {
    PO.fillRect(x - 8, y - 4, 16, 4, C.brown);
    PO.fillRect(x - 6, y - 8, 12, 4, C.tan);
    PO.fillRect(x - 2, y - 18, 4, 10, C.tan);
    PO.ellipse(x, y - 24, 8, 8, C.tan);
    PO.ellipse(x, y - 26, 5, 5, C.gold);
    PO.fillRect(x - 11, y - 26, 3, 6, C.tan);
    PO.fillRect(x + 8, y - 26, 3, 6, C.tan);
  }

  /* ---------------- ending ---------------- */
  SCENES.ending = {
    enter: function (d) { Snd.playMusic('ending'); d.scroll = 0; },
    update: function (d) {
      d.scroll += 0.35;
      if (PO.Input.pressed(BTN.START) && sceneT > 120) { Snd.stopMusic(); go('title'); }
    },
    draw: function (d) {
      PO.clear(C.navy);
      for (var i = 0; i < 60; i++) {
        var x = (i * 71 + 13) % 256, y = (i * 41 + 5) % 224;
        if (((sceneT >> 2) + i) % 7 === 0) PO.px(x, y, C.yellowL);
      }
      PO.textCenter(d.dream ? 'MR. DREAM IS BEATEN' : 'YOU BEAT MIKE TYSON', 128, 20, C.yellow, { spacing: 7 });
      PO.textCenter('W.V.B.A. CHAMPION', 128, 36, C.white);
      PO.textCenter('LITTLE MAC', 128, 48, C.orange, { scale: 2 });
      Art.drawMac({ cx: 128, base: 150 });
      drawTrophy(196, 148);
      drawTrophy(60, 148);
      var lines = [
        'THE KID FROM THE BRONX',
        'IS THE CHAMPION OF',
        'THE WORLD.',
        '',
        'DOC LOUIS SAYS:',
        '"I TOLD YOU, MAC!"',
        '',
        G.tysonBeaten && !d.dream ? 'MR. DREAM AWAITS...' : 'THANKS FOR PLAYING'
      ];
      for (var l = 0; l < lines.length; l++) {
        var yy = 168 + l * 10 - (d.scroll % (lines.length * 10 + 60));
        if (yy > 156 && yy < 220) PO.textCenter(lines[l], 128, yy, C.white, { spacing: 7 });
      }
      if (blink(24)) PO.textCenter('PUSH START', 128, 214, C.grey);
    }
  };

  /* ===================================================================== */
  S.update = function () {
    sceneT++;
    if (scene && SCENES[scene.name]) SCENES[scene.name].update(scene.data);
  };
  S.draw = function () {
    if (scene && SCENES[scene.name]) SCENES[scene.name].draw(scene.data);
  };
  S.SCENES = SCENES;
  S.boot = function () { go('title'); };
})();
