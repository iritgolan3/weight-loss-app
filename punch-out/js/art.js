/* Punch-Out!! — art: fighter construction, ring, crowd, HUD.
   Bodies are a rig (wide sloped shoulders, narrow waist, elbows flared out and
   gloves tucked in front of the chest) so they can animate; faces are built
   from per-boxer shape parameters plus hand-authored hair and headgear masks,
   which is where each boxer's identity lives. */
(function () {
  'use strict';
  var PO = window.PO, C = PO.C;
  var Art = (PO.Art = {});

  /* =======================================================================
     Hair / headgear masks — 32 columns, column 16 is the face centre line.
     ======================================================================= */
  var HAIR = {
    glassjoe: [
      '..........oooooooo..............',
      '.......ooooHHHHHHoooo...........',
      '.....ooHHHHHHHHHHHHHHoo.........',
      '....oHHHHHHHHHHHHHHHHHHo........',
      '...oHHHHHHHHHHHHHHHHHHHHo.......',
      '..oHHHHHHHHHHHHHHHHHHHHHHo......',
      '..oHHHHHHHHHHHHHHHHHHHHHHHo.....',
      '.oHHHHHHHHHHHHHHHHHHHHHHHHHo....',
      '.oHHHHHHHHHHHHHHHHHHHHHHHHHHo...',
      '.oHHHHHHhhhhhhhhhhhhHHHHHHHHHo..',
      '.oHHHHhh............hhhHHHHHHHo.',
      '.oHHhh.................hhHHHHHo.',
      '.ohh......................hHHHo.',
      '..o........................hhho.'
    ],
    vonkaiser: [
      '..........oooooooo..............',
      '.......oooHHHHHHHHooo...........',
      '.....ooHHHHHHHHHHHHHHoo.........',
      '....oHHHHHHHHHHHHHHHHHHo........',
      '...oHHHHHHHHHHHHHHHHHHHHo.......',
      '...oHHHHHHHHHHHHHHHHHHHHo.......',
      '..oHHHHHHHHHHHHHHHHHHHHHHo......',
      '..oHHHHhhhhhhhhhhhhhhHHHHHo.....',
      '..oHHhh..............hhHHHHo....',
      '..ohh...................hhHHo...',
      '...o......................hho...'
    ],
    pistonhonda: [
      '..........oooooooo..............',
      '.......ooohhhhhhhhooo...........',
      '.....oohhhhhhhhhhhhhhoo.........',
      '....ohhhhhhhhhhhhhhhhhho........',
      '...ohhhhhhhhhhhhhhhhhhhho.......',
      '...o11111111111111111111o.......',
      '...o11111111221111111111o.......',
      '...o11111111221111111111o.......',
      '...o11111111111111111111o.......',
      '...ohhhh............hhhho.......'
    ],
    donflamenco: [
      '..........oooooooo..............',
      '.......oooHHHHHHHHooo...........',
      '.....ooHHHHHHHHHHHHHHoo.........',
      '....oHHHHHHHHHHHHHHHHHHo........',
      '...oHHHHHHHHHHHHHHHHHHHHo.......',
      '...ohHHHHHHHHHHHHHHHHHHho.......',
      '..ohhhhhhhhhhhhhhhhhhhhhho......',
      '..ohhhhh............hhhhho......',
      '..ohhhh..............hhhho......',
      '..ohhh................hhho......',
      '..ohhh................hhho......',
      '..oo....................oo......'
    ],
    kinghippo: [
      '....o........o.o........o.......',
      '...o1o......o1o1o......o1o......',
      '...o11o....o11111o....o11o......',
      '...o111o..o1111111o..o111o......',
      '...o1111111111111111111o........',
      '...o1111111111111111111o........',
      '...o1122111111221111111o........',
      '...o1111111111111111111o........',
      '....o22222222222222222o.........',
      '....ooooooooooooooooooo.........',
      '....sssssssssssssssssss.........'
    ],
    greattiger: [
      '..........oooooooo..............',
      '.......ooo11111111ooo...........',
      '.....oo111111111111111oo........',
      '....o11111111111111111111o......',
      '...o1111111111111111111111o.....',
      '..o111111111111111111111111o....',
      '..o111111111133111111111111o....',
      '..o112222222233222222221111o....',
      '..o112222222233222222221111o....',
      '..o111111111133111111111111o....',
      '..o111111111111111111111111o....',
      '...o11111111111111111111111o....',
      '....oo11111111111111111oo.......',
      '......oooooooooooooooooo........'
    ],
    baldbull: [
      '..........oooooooo..............',
      '.......ooolllssssdooo...........',
      '.....oollllssssssssdoo..........',
      '....ollllsssssssssssddo.........',
      '...olllllsssssssssssssdo........',
      '...ollllssssssssssssssddo.......',
      '..olllssssssssssssssssssdo......',
      '..olsssssssssssssssssssssdo.....',
      '..oss.....................sdo...'
    ],
    sodapopinski: [
      '..........oooooooo..............',
      '.......oooHHHHHHHHooo...........',
      '.....oohhhhhhhhhhhhhhoo.........',
      '....ohhhhhhhhhhhhhhhhhho........',
      '...ohhhhhhhhhhhhhhhhhhhho.......',
      '...ohhhhhhhhhhhhhhhhhhhho.......',
      '..ohhhhhhhhhhhhhhhhhhhhhho......',
      '..ohhhhh............hhhhhho.....',
      '..ohhhh..............hhhhho.....',
      '..ohhh................hhhho.....',
      '..ohh..................hhho.....',
      '..oo.....................oo.....'
    ],
    mrsandman: [
      '..........oooooooo..............',
      '.......oooHHHHHHHHooo...........',
      '.....ooHHHHHHHHHHHHHHoo.........',
      '....oHHHHHHHHHHHHHHHHHHo........',
      '...oHHHHHHHHHHHHHHHHHHHHo.......',
      '...oHHHHHHHHHHHHHHHHHHHHo.......',
      '..oHHHHHHHHHHHHHHHHHHHHHHo......',
      '..oHHH................HHHHo.....',
      '..oo......................oo....'
    ],
    machoman: [
      '..........oooooooo..............',
      '.......oooHHHHHHHHooo...........',
      '.....ooHHHHHHHHHHHHHHoo.........',
      '....oHHHHHhhhhhhhhHHHHHo........',
      '...oHHHhhhhhhhhhhhhhhHHHo.......',
      '...oHHhhhhhhhhhhhhhhhhhHo.......',
      '..ohhhhhhhhhhhhhhhhhhhhhho......',
      '..ohhhhh............hhhhhho.....',
      '..ohhhh..............hhhhho.....',
      '..ohhh................hhhho.....',
      '..ohh..................hhho.....',
      '..oo.....................oo.....'
    ],
    tyson: [
      '..........oooooooo..............',
      '.......ooohhhhhhhhooo...........',
      '.....oohhhhhhhhhhhhhhoo.........',
      '....ohhhhhhhhhhhhhhhhhho........',
      '...ohhhhhhhhhhhhhhhhhhhho.......',
      '...ohhhhhhhhhhhhhhhhhhhho.......',
      '..ohhhhhhhhhhhhhhhhhhhhhho......',
      '..ohh....................hho....'
    ],
    mrdream: [
      '..........oooooooo..............',
      '.......oooHHHHHHHHooo...........',
      '.....ooHHHHHHHHHHHHHHoo.........',
      '....oHHHHHHHHHHHHHHHHHHo........',
      '...oHHHHHHHHHHHHHHHHHHHHo.......',
      '...oHHHHHHHHHHHHHHHHHHHHo.......',
      '..oHHHHHhhhhhhhhhhhhHHHHHo......',
      '..oHHhh..............hhHHHo.....',
      '..ohh...................hho.....',
      '...o......................o.....'
    ]
  };

  /* facial hair, painted over the lower face. `y` is the top row. */
  var FACIAL = {
    /* Von Kaiser's wide military moustache */
    vonkaiser: { y: 22, rows: [
      '.......ohhhhhhhhhhhhho..........',
      '......ohhhhhhhhhhhhhhho.........',
      '......ohhhho.....ohhhho.........'] },
    /* Bald Bull's handlebar */
    baldbull: { y: 21, rows: [
      '.....ohhhho.......ohhhho........',
      '....ohhhhhho.....ohhhhhho.......',
      '....ohhhhhhho...ohhhhhhho.......',
      '.....ohhhhho.....ohhhhho........',
      '......ohhho.......ohhho.........'] },
    /* Mr. Sandman's beard */
    mrsandman: { y: 22, rows: [
      '......ohhhhhhhhhhhhhho..........',
      '......ohhhhhhhhhhhhhho..........',
      '.......ohhhhhhhhhhhho...........',
      '........ohhhhhhhhhho............'] },
    sodapopinski: { y: 23, rows: [
      '.......ohhhhhhhhhhhho...........',
      '........ohhhhhhhhhho............'] },
    greattiger: { y: 24, rows: [
      '.......ohhhhhhhhhhhho...........'] },
    machoman: { y: 24, rows: [
      '........ohhhhhhhhhho............'] }
  };

  /* =======================================================================
     Head builder
     ======================================================================= */
  var HW = 32, HH = 44;

  function hp(data, x, y, c) {
    if (x < 0 || y < 0 || x >= HW || y >= HH || !c) return;
    data[y * HW + x] = c;
  }
  function hrow(data, x0, x1, y, c) { for (var x = x0; x <= x1; x++) hp(data, x, y, c); }

  /* jaw profile: 0..1 along the face, returns half-width multiplier */
  function jawProfile(kind, t) {
    if (t < 0.52) return 0.82 + 0.18 * Math.sin((t / 0.52) * 2.0);
    var j = (t - 0.52) / 0.48;
    switch (kind) {
      case 'square':  return 1.0 - j * j * 0.30;
      case 'jowly':   return 1.0 + 0.10 * Math.sin(j * Math.PI) - j * j * j * 0.55;
      case 'pointed': return 1.0 - j * 0.80;
      default:        return 1.0 - j * j * 0.60;   /* round */
    }
  }

  function buildHead(cfg, expr) {
    var data = new Uint32Array(HW * HH);
    var cx = 16;
    var skin = cfg.skin, skinD = cfg.skinD, skinL = cfg.skinL, out = C.black;
    var hairRows = HAIR[cfg.hairKey] || [];
    var faceTop = Math.max(2, hairRows.length - 5);
    var len = cfg.len || 25;
    var chin = faceTop + len;
    var hw = cfg.hw || 11;
    var acc = cfg.acc || {};

    /* --- skull, jaw, shading --- */
    for (var y = faceTop; y <= chin; y++) {
      var t = (y - faceTop) / len;
      var half = Math.max(1, Math.round(hw * jawProfile(cfg.jaw, t)));
      hrow(data, cx - half, cx + half, y, skin);
      hrow(data, cx - half, cx - half + 1, y, skinL);
      hrow(data, cx + half - 2, cx + half, y, skinD);
      hp(data, cx - half - 1, y, out);
      hp(data, cx + half + 1, y, out);
    }
    var crownHalf = Math.max(1, Math.round(hw * jawProfile(cfg.jaw, 0) * 0.94));
    hrow(data, cx - crownHalf, cx + crownHalf, faceTop - 1, out);
    var chinHalf = Math.max(1, Math.round(hw * jawProfile(cfg.jaw, 1.0)));
    hrow(data, cx - chinHalf, cx + chinHalf, chin + 1, out);

    /* --- ears --- */
    if (cfg.ears !== false) {
      var earY = faceTop + Math.round(len * 0.40);
      for (var e = 0; e < 5; e++) {
        var ehw = Math.max(1, Math.round(hw * jawProfile(cfg.jaw, (earY - faceTop + e) / len)));
        hp(data, cx - ehw - 2, earY + e, e === 0 || e === 4 ? out : skin);
        hp(data, cx - ehw - 3, earY + e, out);
        hp(data, cx + ehw + 2, earY + e, e === 0 || e === 4 ? out : skinD);
        hp(data, cx + ehw + 3, earY + e, out);
      }
    }

    /* --- brow --- */
    var browY = faceTop + Math.round(len * 0.28);
    var eyeDX = cfg.eyeDX || 6;
    var browCol = cfg.hairD || cfg.hair || out;
    if (cfg.brow && cfg.brow !== 'none') {
      for (var s = -1; s <= 1; s += 2) {
        for (var i = 0; i < 6; i++) {
          var bx = cx + s * (2 + i);
          var by = browY;
          if (cfg.brow === 'angry') by = browY + (i < 3 ? 1 : 0) - (i > 4 ? 1 : 0);
          hp(data, bx, by, browCol);
          if (cfg.brow === 'heavy') { hp(data, bx, by + 1, browCol); hp(data, bx, by - 1, browCol); }
        }
      }
    }

    /* --- eyes --- */
    var eyeY = browY + 3;
    var shut = expr === 'ko' || expr === 'hurt';
    var wide = expr === 'tell';
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var ex = cx + s2 * eyeDX;
      if (expr === 'dizzy') {
        hp(data, ex, eyeY, out);
        hp(data, ex - 1, eyeY - 1, out); hp(data, ex + 1, eyeY - 1, out);
        hp(data, ex - 1, eyeY + 1, out); hp(data, ex + 1, eyeY + 1, out);
        hp(data, ex - 2, eyeY, out); hp(data, ex + 2, eyeY, out);
        continue;
      }
      if (shut) { hrow(data, ex - 2, ex + 2, eyeY, out); hp(data, ex, eyeY + 1, out); continue; }
      var ht = wide ? 2 : (cfg.eyes === 'squint' ? 0 : 1);
      for (var dy = -ht; dy <= ht; dy++) hrow(data, ex - 2, ex + 2, eyeY + dy, C.white);
      hrow(data, ex - 3, ex + 3, eyeY - ht - 1, out);
      hrow(data, ex - 3, ex + 3, eyeY + ht + 1, out);
      hp(data, ex - 3, eyeY, out); hp(data, ex + 3, eyeY, out);
      /* pupil */
      var px2 = ex + (cfg.eyes === 'angry' ? -s2 : 0);
      hp(data, px2, eyeY, out); hp(data, px2 + 1, eyeY, out);
      if (ht > 0) { hp(data, px2, eyeY + 1, out); hp(data, px2 + 1, eyeY + 1, out); }
      /* droopy lids sit low over the eye, angry ones cut across the top */
      if (cfg.eyes === 'droopy') hrow(data, ex - 3, ex + 3, eyeY - ht, skinD);
      if (cfg.eyes === 'angry') hrow(data, ex - 3 + (s2 < 0 ? 0 : 1), ex + 2, eyeY - ht, skinD);
    }

    /* --- nose --- */
    var n = cfg.nose || {};
    var noseTop = eyeY + 2, noseLen = n.len || 5;
    for (var k = 0; k < noseLen; k++) {
      hp(data, cx - 1, noseTop + k, skinD);
      hp(data, cx, noseTop + k, k > noseLen - 3 ? skin : skinD);
      if (n.hook && k > noseLen - 3) hp(data, cx + 1, noseTop + k, skinD);
    }
    var nb = noseTop + noseLen - 1;
    var nwide = n.wide ? 3 : 2;
    hrow(data, cx - nwide, cx + nwide - 1, nb, skinD);
    hp(data, cx - nwide - 1, nb, out); hp(data, cx + nwide, nb, out);
    hp(data, cx - nwide + 1, nb + 1, out); hp(data, cx + nwide - 2, nb + 1, out);

    /* --- mouth --- */
    var mouthY = nb + (cfg.mouthGap || 4);
    var mw = cfg.mouthW || 4;
    if (expr === 'hurt' || expr === 'ko' || expr === 'tell' || cfg.mouth === 'teeth') {
      hrow(data, cx - mw, cx + mw, mouthY - 1, out);
      hrow(data, cx - mw, cx + mw, mouthY, C.white);
      hrow(data, cx - mw + 1, cx + mw - 1, mouthY + 1, C.maroon);
      hrow(data, cx - mw + 1, cx + mw - 1, mouthY + 2, out);
      for (var tx = cx - mw + 1; tx <= cx + mw - 1; tx += 2) hp(data, tx, mouthY, out);
      if (cfg.goldTooth) { hp(data, cx - 1, mouthY, C.tan); hp(data, cx, mouthY, C.tan); }
    } else {
      hrow(data, cx - mw, cx + mw, mouthY, out);
      if (cfg.mouth === 'grin') { hp(data, cx - mw - 1, mouthY - 1, out); hp(data, cx + mw + 1, mouthY - 1, out); }
      if (cfg.mouth === 'frown') { hp(data, cx - mw - 1, mouthY + 1, out); hp(data, cx + mw + 1, mouthY + 1, out); }
      if (cfg.mouth === 'wide') { hrow(data, cx - mw - 2, cx + mw + 2, mouthY, out); hrow(data, cx - mw, cx + mw, mouthY + 1, C.maroon); }
      hrow(data, cx - 2, cx + 2, mouthY - 2, skinD);
    }

    /* --- facial hair --- */
    var fh = FACIAL[cfg.facialKey];
    if (fh) paint(data, fh.rows, fh.y, cfg, acc, skin, skinL, skinD);

    /* --- hair / headgear last, over the crown --- */
    paint(data, hairRows, 0, cfg, acc, skin, skinL, skinD);

    return { w: HW, h: HH, data: data, chin: chin, faceTop: faceTop, hw: hw };
  }

  function paint(data, rows, y0, cfg, acc, skin, skinL, skinD) {
    for (var y = 0; y < rows.length; y++) {
      var r = rows[y];
      for (var x = 0; x < r.length; x++) {
        var ch = r.charAt(x), col = 0;
        switch (ch) {
          case '.': continue;
          case 'o': col = C.black; break;
          case 'h': col = cfg.hair; break;
          case 'H': col = cfg.hairL || cfg.hair; break;
          case 'g': col = cfg.hairD || cfg.hair; break;
          case 's': col = skin; break;
          case 'l': col = skinL; break;
          case 'd': col = skinD; break;
          case '1': col = acc.a; break;
          case '2': col = acc.b; break;
          case '3': col = acc.c; break;
          default: continue;
        }
        hp(data, x, y0 + y, col);
      }
    }
  }
  Art.buildHead = buildHead;

  /* =======================================================================
     Gloves and boots
     ======================================================================= */
  function drawGlove(x, y, r, col, colD, colL, flip) {
    x = Math.round(x); y = Math.round(y); r = Math.round(r);
    var s = flip ? -1 : 1;
    var tr = Math.max(2, Math.round(r * 0.52));
    var tx = x - s * (r - 1), ty = y + Math.round(r * 0.34);
    PO.ellipse(tx, ty, tr, Math.max(2, tr - 1), col);
    PO.ellipseOutline(tx, ty, tr, Math.max(2, tr - 1), C.black);
    PO.ellipse(x, y, r, r - 1, col);
    PO.ellipse(x - s * Math.round(r * 0.32), y - Math.round(r * 0.36), Math.max(1, r - 3), Math.max(1, r - 4), colL);
    PO.ellipse(x + s * Math.round(r * 0.34), y + Math.round(r * 0.30), Math.max(1, r - 3), Math.max(1, r - 4), colD);
    PO.ellipseOutline(x, y, r, r - 1, C.black);
    var cw = Math.max(5, Math.round(r * 1.2)), cy = y + r - 2;
    PO.fillRect(x - (cw >> 1), cy, cw, 3, C.white);
    PO.fillRect(x - (cw >> 1), cy + 2, cw, 1, C.grey);
    PO.rect(x - (cw >> 1), cy, cw, 3, C.black);
  }
  Art.drawGlove = drawGlove;

  function drawBoot(x, y, w, h, col, colD) {
    var hw = w >> 1;
    PO.fillRect(x - hw, y - h, w, h - 2, col);
    PO.fillRect(x - hw, y - h, 2, h - 2, colD);
    PO.fillRect(x - hw - 1, y - 3, w + 3, 3, colD);
    PO.rect(x - hw - 1, y - 3, w + 3, 3, C.black);
    PO.rect(x - hw, y - h, w, h - 2, C.black);
    PO.fillRect(x - hw + 1, y - h, w - 2, 2, C.white);
    PO.vline(x, y - h + 3, h - 6, C.white);
  }

  /* =======================================================================
     Body rig
     ======================================================================= */
  /* build fields, all measured up from the soles:
       h        total height
       bootH    boot height
       hipY     hips above the soles
       waistY   narrowest point
       shY      shoulder line
       shW      shoulder width (full)
       waistW   waist width (full)
       belly     extra bulge
       armW / elbowOut / gloveR / spread / legW / bootW  */
  Art.drawFighter = function (f, pose) {
    var cx = Math.round(pose.cx), base = Math.round(pose.base);
    var b = f.build;
    var crouch = pose.crouch || 0, lean = pose.lean || 0;
    var skin = f.skin, skinD = f.skinD, skinL = f.skinL, out = C.black;

    var hipY = base - b.hipY + crouch;
    var shY = base - b.shY + Math.round(crouch * 0.4);
    var hipX = cx + Math.round(lean * 0.35);
    var shX = cx + lean;

    /* ---- legs ---- */
    for (var s = -1; s <= 1; s += 2) {
      var footX = cx + s * b.spread;
      PO.limb(hipX + s * Math.round(b.waistW * 0.26), hipY, footX, base - b.bootH + 1, b.legW, b.legW - 4, skin, out);
      PO.limb(hipX + s * Math.round(b.waistW * 0.26) + s * 2, hipY + 2, footX + s * 2, base - b.bootH, 2, 1, skinD, 0);
    }
    for (var s1 = -1; s1 <= 1; s1 += 2) drawBoot(cx + s1 * b.spread, base, b.bootW, b.bootH, f.boot, f.bootD);

    /* ---- trunks ---- */
    var tw = b.waistW + 10, th = b.trunkH;
    var ty = hipY - th + 6;
    PO.fillRect(hipX - (tw >> 1), ty, tw, th, f.trunk);
    PO.fillRect(hipX - (tw >> 1), ty, 3, th, f.trunkL || f.trunk);
    PO.fillRect(hipX + (tw >> 1) - 3, ty, 3, th, f.trunkD);
    PO.fillRect(hipX - 3, ty + th - 7, 6, 7, f.trunkD);
    PO.rect(hipX - (tw >> 1), ty, tw, th, out);
    PO.fillRect(hipX - (tw >> 1) - 1, ty - 3, tw + 2, 4, f.belt || C.white);
    PO.rect(hipX - (tw >> 1) - 1, ty - 3, tw + 2, 4, out);

    /* ---- torso: wide sloped traps tapering to a narrow waist ---- */
    var torsoTop = shY - 4, torsoBot = ty + 2;
    var n = torsoBot - torsoTop;
    var halfAt = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var sw = b.shW / 2, ww = b.waistW / 2, half;
      if (t < 0.22) half = sw * (0.52 + 0.48 * Math.pow(t / 0.22, 0.55));  /* neck -> shoulders */
      else half = sw + (ww - sw) * Math.pow((t - 0.22) / 0.78, 0.75);
      if (b.belly) half += b.belly * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.25) / 0.75)));
      half = Math.max(3, Math.round(half));
      halfAt.push(half);
      var rowX = shX + Math.round((hipX - shX) * t);
      PO.fillRect(rowX - half, torsoTop + i, half * 2, 1, skin);
      PO.fillRect(rowX - half, torsoTop + i, 3, 1, skinL);
      PO.fillRect(rowX + half - 3, torsoTop + i, 3, 1, skinD);
      PO.px(rowX - half - 1, torsoTop + i, out);
      PO.px(rowX + half, torsoTop + i, out);
    }

    /* pecs and abs, or a gut */
    var pecY = torsoTop + Math.round(n * 0.34);
    if (b.belly) {
      PO.ellipseOutline(hipX, torsoBot - Math.round(b.belly * 1.1), Math.round(b.belly * 1.15), Math.round(b.belly * 0.85), skinD);
      PO.ellipse(hipX - 3, torsoBot - Math.round(b.belly * 1.6), 4, 2, skinL);
    } else {
      PO.hline(shX - Math.round(b.shW * 0.28), pecY, Math.round(b.shW * 0.23), skinD);
      PO.hline(shX + Math.round(b.shW * 0.05), pecY, Math.round(b.shW * 0.23), skinD);
      PO.vline(shX, pecY - 4, 5, skinD);
      for (var a = 0; a < 3; a++) {
        var ay = pecY + 5 + a * 4;
        if (ay > torsoBot - 3) break;
        PO.hline(shX - 4, ay, 9, skinD);
      }
    }
    if (f.chestHair) for (var chx = -6; chx <= 6; chx += 2) PO.px(shX + chx, pecY - 3 + (chx & 1), f.chestHair);

    /* ---- neck ---- */
    var headSp = f.heads[pose.expr || 'idle'] || f.heads.idle;
    PO.fillRect(shX - 5, shY - 8, 11, 9, skinD);
    PO.fillRect(shX - 5, shY - 8, 4, 9, skin);
    PO.px(shX - 6, shY - 7, out); PO.px(shX + 6, shY - 7, out);

    /* ---- head ---- */
    var hx = shX + (pose.headX || 0) - (headSp.w >> 1);
    var hy = shY - 6 - headSp.chin + (pose.headY || 0);
    PO.blit(headSp, hx, hy);

    /* ---- arms: shoulder -> elbow flared out at waist height -> glove ---- */
    var gr = b.gloveR;
    var shoulderOff = Math.round(b.shW * 0.40);
    var restElbowY = shY + Math.round((b.shY - b.hipY) * 0.70);
    var arms = [
      { sx: shX - shoulderOff, sy: shY + 3, gx: cx + (pose.lgx === undefined ? -11 : pose.lgx),
        gy: base - (pose.lgy === undefined ? b.guardY : pose.lgy), dir: -1, r: pose.lgr },
      { sx: shX + shoulderOff, sy: shY + 3, gx: cx + (pose.rgx === undefined ? 11 : pose.rgx),
        gy: base - (pose.rgy === undefined ? b.guardY : pose.rgy), dir: 1, r: pose.rgr }
    ];
    for (var ai = 0; ai < 2; ai++) {
      var A = arms[ai];
      var dx = A.gx - A.sx, dy = A.gy - A.sy;
      var reach = Math.sqrt(dx * dx + dy * dy);
      /* the further he reaches, the straighter the arm gets */
      var str = Math.min(1, reach / (b.shY * 0.52));
      var restX = A.sx + A.dir * b.elbowOut;
      var ex = Math.round(restX + ((A.sx + A.gx) / 2 + A.dir * 3 - restX) * str);
      var ey = Math.round(restElbowY + ((A.sy + A.gy) / 2 - restElbowY) * str);
      PO.limb(A.sx, A.sy, ex, ey, b.armW, b.armW - 2, skin, out);
      PO.limb(ex, ey, A.gx, A.gy, b.armW - 2, b.armW - 4, skin, out);
      /* highlight down the inside, shadow down the outside */
      PO.limb(A.sx - A.dir * 2, A.sy + 2, ex - A.dir * 2, ey - 2, 2, 1, A.dir < 0 ? skinL : skinD, 0);
      PO.limb(A.sx + A.dir * 3, A.sy + 2, ex + A.dir * 2, ey - 2, 2, 1, A.dir < 0 ? skinD : skinL, 0);
      drawGlove(A.gx, A.gy, A.r || gr, f.glove, f.gloveD, f.gloveL, A.dir > 0);
    }
  };

  /* =======================================================================
     Little Mac — from behind, foreground
     ======================================================================= */
  var MAC = {
    skin: C.skin, skinD: C.skinD, skinL: C.skinL,
    hair: C.black, hairL: C.grey3,
    trunk: C.greenM, trunkD: C.greenD, trunkL: C.greenL,
    boot: C.grey3, bootD: C.black, bootTrim: C.white,
    glove: C.white, gloveD: C.grey, gloveL: C.white,
    top: C.maroon, topD: C.black, topL: C.redD, trim: C.tan
  };
  Art.MAC = MAC;

  Art.drawMac = function (pose) {
    var cx = Math.round(pose.cx), base = Math.round(pose.base);
    var crouch = pose.crouch || 0, lean = pose.lean || 0, out = C.black;

    var hipY = base - 25 + crouch;
    var shY = hipY - 20 + Math.round(crouch * 0.25);
    var hipX = cx + Math.round(lean * 0.35);
    var shX = cx + lean;

    /* legs */
    for (var s = -1; s <= 1; s += 2) {
      var fx = cx + s * 8;
      PO.limb(hipX + s * 4, hipY + 5, fx, base - 7, 8, 6, MAC.skin, out);
      PO.limb(hipX + s * 4 + s, hipY + 6, fx + s, base - 7, 2, 1, MAC.skinD, 0);
    }
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      PO.fillRect(cx + s2 * 8 - 5, base - 8, 10, 8, MAC.boot);
      PO.fillRect(cx + s2 * 8 - 5, base - 8, 10, 2, MAC.bootTrim);
      PO.fillRect(cx + s2 * 8 - 6, base - 3, 12, 3, MAC.bootD);
      PO.rect(cx + s2 * 8 - 5, base - 8, 10, 8, out);
    }
    /* trunks */
    PO.fillRect(hipX - 10, hipY - 4, 20, 14, MAC.trunk);
    PO.fillRect(hipX - 10, hipY - 4, 3, 14, MAC.trunkL);
    PO.fillRect(hipX + 6, hipY - 4, 4, 14, MAC.trunkD);
    PO.fillRect(hipX - 2, hipY + 7, 5, 3, MAC.trunkD);
    PO.rect(hipX - 10, hipY - 4, 20, 14, out);
    PO.fillRect(hipX - 10, hipY - 7, 20, 4, C.white);
    PO.rect(hipX - 10, hipY - 7, 20, 4, out);

    /* singlet, seen from behind, with gold shoulder trim */
    var n = (hipY - 4) - shY;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var half = Math.round(10 - 2.0 * t + 1.2 * Math.sin(t * 2.2));
      var rowX = shX + Math.round((hipX - shX) * t);
      PO.fillRect(rowX - half, shY + i, half * 2, 1, MAC.top);
      PO.fillRect(rowX - half, shY + i, 2, 1, MAC.topL);
      PO.fillRect(rowX + half - 2, shY + i, 2, 1, MAC.topD);
      PO.px(rowX - half - 1, shY + i, out);
      PO.px(rowX + half, shY + i, out);
      if (i < 2) PO.fillRect(rowX - half, shY + i, half * 2, 1, MAC.trim);
    }
    /* bare shoulders either side of the vest */
    PO.ellipse(shX - 10, shY + 3, 4, 4, MAC.skin);
    PO.ellipse(shX + 10, shY + 3, 4, 4, MAC.skinD);
    PO.ellipseOutline(shX - 10, shY + 3, 4, 4, out);
    PO.ellipseOutline(shX + 10, shY + 3, 4, 4, out);
    PO.fillRect(shX - 7, shY - 1, 15, 2, MAC.trim);

    /* head from behind */
    var hy = shY - 16;
    PO.ellipse(shX, hy + 8, 8, 9, MAC.skin);
    PO.ellipseOutline(shX, hy + 8, 8, 9, out);
    PO.ellipse(shX, hy + 5, 8, 7, MAC.hair);
    PO.fillRect(shX - 8, hy + 8, 17, 5, MAC.hair);
    PO.ellipse(shX - 3, hy + 2, 3, 1, MAC.hairL);
    PO.ellipse(shX - 9, hy + 10, 2, 3, MAC.skin);
    PO.ellipse(shX + 9, hy + 10, 2, 3, MAC.skinD);
    PO.ellipseOutline(shX, hy + 8, 8, 9, out);
    PO.fillRect(shX - 4, hy + 15, 9, 4, MAC.skinD);

    /* arms + gloves */
    var glL = { x: cx + (pose.lgx === undefined ? -14 : pose.lgx), y: base - (pose.lgy === undefined ? 36 : pose.lgy) };
    var glR = { x: cx + (pose.rgx === undefined ? 14 : pose.rgx), y: base - (pose.rgy === undefined ? 36 : pose.rgy) };
    var sh = [{ sx: shX - 10, sy: shY + 4, g: glL, dir: -1 }, { sx: shX + 10, sy: shY + 4, g: glR, dir: 1 }];
    for (var ai = 0; ai < 2; ai++) {
      var A = sh[ai];
      var reach = Math.sqrt((A.g.x - A.sx) * (A.g.x - A.sx) + (A.g.y - A.sy) * (A.g.y - A.sy));
      var tuck = Math.max(0, 1 - reach / 28);
      var ex = A.sx + A.dir * 7 * tuck, ey = A.sy + 9 * tuck;
      PO.limb(A.sx, A.sy, ex, ey, 7, 6, MAC.skin, out);
      PO.limb(ex, ey, A.g.x, A.g.y, 6, 5, MAC.skin, out);
      PO.ellipse(A.sx, A.sy, 4, 4, MAC.skin);
      PO.ellipseOutline(A.sx, A.sy, 4, 4, out);
      drawGlove(A.g.x, A.g.y, 6, MAC.glove, MAC.gloveD, MAC.gloveL, ai === 1);
    }
  };

  /* =======================================================================
     Ring, crowd, referee
     ======================================================================= */
  var crowdSeed = [];
  (function () { for (var i = 0; i < 700; i++) crowdSeed.push(PO.rand()); })();

  var LATTICE = PO.pack('#C8CC78'), LATTICE_D = PO.pack('#5C6828');
  var CROWD_BG = PO.pack('#401800');
  var CROWD_SKIN = ['#E0A078', '#F8C8A0', '#A86038', '#C88858', '#F0B088'].map(PO.pack);
  var CROWD_TOP = ['#901808', '#B83820', '#682000', '#A85830', '#782810', '#C04828'].map(PO.pack);

  Art.drawRing = function (floorCol, tick) {
    PO.fillRect(0, 0, PO.W, 34, LATTICE);
    for (var gx = 0; gx < PO.W; gx += 8) PO.vline(gx, 0, 34, LATTICE_D);
    for (var gy = 0; gy < 34; gy += 8) PO.hline(0, gy, PO.W, LATTICE_D);
    PO.hline(0, 33, PO.W, C.black);

    PO.fillRect(0, 34, PO.W, 24, CROWD_BG);
    var idx = 0;
    for (var row = 0; row < 2; row++) {
      var ry = 34 + row * 12;
      for (var x = -2; x < PO.W; x += 5) {
        var r1 = crowdSeed[(idx++) % crowdSeed.length];
        var r2 = crowdSeed[(idx++) % crowdSeed.length];
        var bob = (((tick >> 5) + (x >> 2) + row) % 11 === 0) ? -1 : 0;
        PO.fillRect(x, ry + 6 + bob, 4, 6, CROWD_TOP[(r2 * CROWD_TOP.length) | 0]);
        PO.fillRect(x + 1, ry + 2 + bob, 3, 4, CROWD_SKIN[(r1 * CROWD_SKIN.length) | 0]);
        PO.px(x + 1, ry + 3 + bob, C.black);
        PO.px(x + 3, ry + 3 + bob, C.black);
        PO.vline(x + 4, ry + 1 + bob, 11, CROWD_BG);
      }
      PO.hline(0, ry + 11, PO.W, C.grey2);
    }
    PO.hline(0, 57, PO.W, C.black);

    PO.fillRect(0, 58, PO.W, PO.H - 58, floorCol);

    var ropeCols = [C.red, C.white, C.blue];
    for (var r = 0; r < 3; r++) {
      var y0 = 60 + r * 7;
      for (var x2 = 8; x2 < PO.W - 8; x2++) {
        var sag = Math.round(Math.sin((x2 / PO.W) * Math.PI) * 2);
        PO.fillRect(x2, y0 + sag, 1, 2, ropeCols[r]);
        PO.px(x2, y0 + sag + 2, C.grey3);
      }
    }
    for (var s = 0; s < 2; s++) {
      var px2 = s ? PO.W - 12 : 4;
      PO.fillRect(px2, 56, 8, 30, C.grey);
      PO.fillRect(px2, 56, 3, 30, C.white);
      PO.fillRect(px2 + 6, 56, 2, 30, C.grey2);
      PO.rect(px2, 56, 8, 30, C.black);
      PO.fillRect(px2 - 1, 54, 10, 4, C.red);
      PO.rect(px2 - 1, 54, 10, 4, C.black);
    }
  };

  Art.drawRef = function (x, y, frame) {
    PO.fillRect(x - 7, y - 22, 14, 14, C.white);
    PO.rect(x - 7, y - 22, 14, 14, C.black);
    for (var s = -5; s <= 4; s += 3) PO.vline(x + s, y - 22, 14, C.black);
    PO.fillRect(x - 6, y - 8, 12, 8, C.black);
    PO.ellipse(x, y - 27, 5, 5, C.skin);
    PO.ellipseOutline(x, y - 27, 5, 5, C.black);
    PO.fillRect(x - 5, y - 31, 11, 3, C.brownD);
    var up = frame % 2 === 0;
    PO.limb(x - 6, y - 20, x - 12, up ? y - 30 : y - 14, 4, 3, C.skin, C.black);
    PO.limb(x + 6, y - 20, x + 12, up ? y - 30 : y - 14, 4, 3, C.skin, C.black);
  };

  /* =======================================================================
     HUD
     ======================================================================= */
  var STAR = PO.sprite({
    pal: { w: 'white' },
    rows: ['...w...', '..www..', 'wwwwwww', '.wwwww.', '..www..', '..w.w..', '.w...w.']
  });
  var HEART = PO.sprite({
    pal: { r: 'red', o: 'black', l: 'redL' },
    rows: ['.oo.oo.', 'olrrrlo', 'orrrrro', 'orrrrro', '.orrro.', '..oro..', '...o...']
  });
  Art.STAR = STAR; Art.HEART = HEART;

  function panel(x, y, w, h, fill, border) {
    PO.fillRect(x, y, w, h, fill);
    PO.rect(x, y, w, h, border);
  }

  Art.drawHUD = function (st) {
    panel(6, 14, 34, 13, C.black, C.blueL);
    PO.blit(STAR, 9, 17);
    PO.text(String(st.mac.stars), 26, 17, st.mac.stars > 0 ? C.orange : C.grey2);
    panel(42, 14, 40, 13, C.black, C.blueL);
    PO.blit(HEART, 45, 17);
    var hcol = st.mac.hearts === 0 ? C.blueL : st.mac.hearts <= 5 ? C.red : C.white;
    var hs = String(st.mac.hearts);
    PO.text(hs, 62 - (hs.length - 1) * 4, 17, hcol);

    panel(88, 12, 108, 22, C.blueD, C.blueL);
    barMeter(91, 14, 50, st.mac.hp / st.mac.maxHp, C.white, C.black);
    barMeter(144, 14, 50, st.opp.hp / st.opp.maxHp, C.white, C.black);
    PO.text('POINTS:', 90, 24, C.white);
    var p = String(st.points);
    PO.text(p, 192 - p.length * 8, 24, C.white);

    panel(200, 12, 50, 22, C.blueD, C.blueL);
    var t = Math.max(0, Math.ceil(st.timeLeft));
    PO.text(Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2), 204, 14, C.white);
    PO.text('ROUND' + st.round, 202, 24, C.white);
  };

  function barMeter(x, y, w, frac, fill, empty) {
    frac = Math.max(0, Math.min(1, frac));
    PO.fillRect(x, y, w, 7, empty);
    PO.fillRect(x, y, Math.round(w * frac), 7, fill);
    PO.rect(x - 1, y - 1, w + 2, 9, C.black);
  }
  Art.barMeter = barMeter;
})();
