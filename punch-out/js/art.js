/* Punch-Out!! — art: fighter construction, ring, crowd, HUD.
   Heads are composed from an authored hair/headgear mask plus a parameterised
   skull, so every boxer keeps the chunky NES silhouette while staying editable. */
(function () {
  'use strict';
  var PO = window.PO, C = PO.C;
  var Art = (PO.Art = {});

  /* =======================================================================
     Hair / headgear masks. 32 columns wide, anchored so column 16 is the
     centre line of the face. Authored by hand, one per boxer.
     ======================================================================= */
  var HAIR = {
    glassjoe: [
      '........hhhhhh..........',
      '......hhHHHHHHhh........',
      '....hhHHHHHHHHHHhh......',
      '...hhHHHHHHHHHHHHHhh....',
      '..hhHHHHhhhhhhHHHHHhh...',
      '..hhHHhh........hhHHhh..',
      '..hhHh............hhhh..',
      '..hhh..............hhh..',
      '..hh.................h..',
      '..h.....................'
    ],
    vonkaiser: [
      '.......hhhhhhhhhh.......',
      '.....hhhHHHHHHHHhhh.....',
      '...hhhHHHHHHHHHHHHhhh...',
      '..hhhHHHHHHHHHHHHHHhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhh..........hhhhhh..',
      '..hhh............hhhhh..',
      '..hh..............hhhh..'
    ],
    pistonhonda: [
      '.......hhhhhhhhhh.......',
      '.....hhhhhhhhhhhhhh.....',
      '...hhhhhhhhhhhhhhhhhh...',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..aaaaaaaaaaaaaaaaaaaa..',
      '..abbaaaaaaaaaaaaaabba..',
      '..aaaaaaaaaaaaaaaaaaaa..',
      '..hhhh..........hhhhhh..'
    ],
    donflamenco: [
      '.......hhhhhhhhhh.......',
      '.....hhhHHHHHHHHhhh.....',
      '...hhhHHHHHHHHHHHHhhh...',
      '..hhhHHHHHHHHHHHHHHhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhh..........hhhhhh..',
      '..hhh.............hhhhh.',
      '..hh................hhh.'
    ],
    kinghippo: [
      '....a.......aa.......a..',
      '...aaa.....aaaa.....aaa.',
      '...aaaa...aaaaaa...aaaa.',
      '...aaaaa.aaaaaaaa.aaaaa.',
      '...aaaaaaaaaaaaaaaaaaaa.',
      '...abbbaaaabbbbaaaabbba.',
      '...aaaaaaaaaaaaaaaaaaaa.',
      '...cccccccccccccccccccc.',
      '....ssssssssssssssssss..',
      '....ssssssssssssssssss..'
    ],
    greattiger: [
      '.......oooooooooo.......',
      '.....ooaaaaaaaaaaoo.....',
      '....oaaaaaaaaaaaaaao....',
      '...oaaaaaaaaaaaaaaaao...',
      '..oaaaaaaaaaaaaaaaaaao..',
      '..oaaaaaaaaccaaaaaaaao..',
      '..occcccccbbbbccccccco..',
      '..occcccccbbbbccccccco..',
      '..oaaaaaaaaccaaaaaaaao..',
      '..oaaaaaaaaaaaaaaaaaao..',
      '...oaaaaaaaaaaaaaaaao...',
      '....oooooooooooooooo....'
    ],
    baldbull: [
      '.......oooooooooo.......',
      '.....oolllssssssdoo.....',
      '....ollssssssssssdddo...',
      '...olsssssssssssssddo...',
      '..olssssssssssssssssdo..',
      '..osssssssssssssssssso..',
      '..ossss..........ssssso.'
    ],
    sodapopinski: [
      '.......hhhhhhhhhh.......',
      '.....hhhhhhhhhhhhhh.....',
      '...hhhhhhhhhhhhhhhhhh...',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhhh........hhhhhhh..',
      '..hhhh..........hhhhhh..',
      '..hhh............hhhhh..'
    ],
    mrsandman: [
      '.......hhhhhhhhhh.......',
      '.....hhhhhhhhhhhhhh.....',
      '...hhhhhhhhhhhhhhhhhh...',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhh..........hhhhhh..'
    ],
    machoman: [
      '.......hhhhhhhhhh.......',
      '.....hhhHHHHHHHHhhh.....',
      '...hhhHHHHHHHHHHHHhhh...',
      '..hhhHHHHHHHHHHHHHHhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhhh........hhhhhhh..',
      '..hhhh..........hhhhhh..'
    ],
    tyson: [
      '.......hhhhhhhhhh.......',
      '.....hhhhhhhhhhhhhh.....',
      '...hhhhhhhhhhhhhhhhhh...',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhh............hhhhh..'
    ],
    mrdream: [
      '.......hhhhhhhhhh.......',
      '.....hhhhhhhhhhhhhh.....',
      '...hhhhhhhhhhhhhhhhhh...',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhh..........hhhhhh..'
    ],
    mac: [
      '.......hhhhhhhhhh.......',
      '.....hhhhhhhhhhhhhh.....',
      '...hhhhhhhhhhhhhhhhhh...',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhhhhhhh..',
      '..hhhh..........hhhhhh..'
    ]
  };

  /* facial hair masks, drawn over the lower face. anchored the same way */
  var FACIAL = {
    vonkaiser: { y: 20, rows: ['......hhhhhhhhhhhh......', '.....hhhhhhhhhhhhhh.....', '......hh.hhhhhh.hh......'] },
    baldbull:  { y: 19, rows: ['....hhhh........hhhh....', '...hhhhhh......hhhhhh...', '...hhhhhhh....hhhhhhh...', '....hhhhh......hhhhh....'] },
    mrsandman: { y: 20, rows: ['.....hhhhhhhhhhhhhh.....', '.....hhhhhhhhhhhhhh.....', '......hhhhhhhhhhhh......', '.......hhhhhhhhhh.......'] },
    greattiger:{ y: 21, rows: ['......hhhhhhhhhhhh......', '.......hhhhhhhhhh.......'] },
    machoman:  { y: 21, rows: ['.......hhhhhhhhhh.......'] },
    sodapopinski:{ y: 21, rows: ['......hhhhhhhhhhhh......'] }
  };

  /* =======================================================================
     Head builder
     ======================================================================= */
  function pxsafe(data, w, h, x, y, c) {
    if (x < 0 || y < 0 || x >= w || y >= h || !c) return;
    data[y * w + x] = c;
  }

  /* cfg: {skin,skinD,skinL,hair,hairD,hairL, hw,hh, jaw, brow, nose, eyes, mouth,
           hairKey, facialKey, acc:{a,b,c}} */
  function buildHead(cfg, expr) {
    var w = 24, h = 30;
    var data = new Uint32Array(w * h);
    var cx = 12;                        // centre column
    var skin = cfg.skin, skinD = cfg.skinD, skinL = cfg.skinL;
    var out = C.black;
    var hairRows = HAIR[cfg.hairKey] || [];
    var hairTop = 0;
    var faceTop = hairTop + Math.max(2, hairRows.length - 4);
    var hw = cfg.hw || 9;               // half width of skull
    var chin = cfg.chin || 26;

    /* --- skull + jaw --- */
    var faceH = chin - faceTop;
    for (var y = faceTop; y <= chin; y++) {
      var t = (y - faceTop) / faceH;
      var half;
      if (t < 0.58) half = hw * (0.80 + 0.20 * Math.sin((t / 0.58) * 2.2));
      else {
        var jt = (t - 0.58) / 0.42;
        half = hw * (1.0 - jt * jt * (cfg.jaw === 'square' ? 0.40 : 0.66));
      }
      half = Math.max(1, Math.round(half));
      for (var x = cx - half; x <= cx + half; x++) {
        var c = skin;
        if (x <= cx - half + 1) c = skinL;
        else if (x >= cx + half - 2) c = skinD;
        pxsafe(data, w, h, x, y, c);
      }
      pxsafe(data, w, h, cx - half - 1, y, out);
      pxsafe(data, w, h, cx + half + 1, y, out);
    }
    /* crown + chin outline */
    for (var x2 = cx - hw + 2; x2 <= cx + hw - 2; x2++) pxsafe(data, w, h, x2, faceTop - 1, out);
    var chinHalf = Math.max(1, Math.round(hw * (cfg.jaw === 'square' ? 0.55 : 0.28)));
    for (var x3 = cx - chinHalf; x3 <= cx + chinHalf; x3++) pxsafe(data, w, h, x3, chin + 1, out);

    /* --- ears --- */
    var earY = faceTop + Math.round(faceH * 0.42);
    for (var ey = 0; ey < 5; ey++) {
      pxsafe(data, w, h, cx - hw - 2, earY + ey, ey === 0 || ey === 4 ? out : skin);
      pxsafe(data, w, h, cx + hw + 2, earY + ey, ey === 0 || ey === 4 ? out : skinD);
    }

    /* --- brow --- */
    var browY = faceTop + Math.round(faceH * 0.30);
    if (cfg.brow) {
      for (var bx = -6; bx <= 6; bx++) {
        if (bx >= -1 && bx <= 1) continue;
        var by = browY + (cfg.brow === 'angry' ? (bx < 0 ? Math.round(bx / -4) : Math.round(bx / 4)) * -1 : 0);
        pxsafe(data, w, h, cx + bx, by, cfg.hairD || C.black);
        if (cfg.brow === 'heavy') pxsafe(data, w, h, cx + bx, by + 1, cfg.hairD || C.black);
      }
    }

    /* --- eyes --- */
    var eyeY = browY + 3;
    var eyeDX = cfg.eyeDX || 5;
    var closed = expr === 'ko' || expr === 'hurt';
    var wide = expr === 'tell';
    for (var s = -1; s <= 1; s += 2) {
      var ex = cx + s * eyeDX;
      if (expr === 'dizzy') {
        pxsafe(data, w, h, ex, eyeY, out); pxsafe(data, w, h, ex - 1, eyeY - 1, out);
        pxsafe(data, w, h, ex + 1, eyeY - 1, out); pxsafe(data, w, h, ex - 1, eyeY + 1, out);
        pxsafe(data, w, h, ex + 1, eyeY + 1, out);
      } else if (closed) {
        pxsafe(data, w, h, ex - 2, eyeY, out); pxsafe(data, w, h, ex - 1, eyeY, out);
        pxsafe(data, w, h, ex, eyeY, out); pxsafe(data, w, h, ex + 1, eyeY, out);
      } else {
        var ww = wide ? 2 : 1;
        for (var dx = -2; dx <= 1; dx++) for (var dy = -ww; dy <= ww; dy++) {
          pxsafe(data, w, h, ex + dx, eyeY + dy, C.white);
        }
        var pupil = (expr === 'tell') ? 0 : 0;
        pxsafe(data, w, h, ex + pupil, eyeY, out);
        pxsafe(data, w, h, ex + pupil, eyeY + (wide ? 1 : 0), out);
        pxsafe(data, w, h, ex - 1, eyeY - ww - 1, out);
        pxsafe(data, w, h, ex, eyeY - ww - 1, out);
      }
    }

    /* --- nose --- */
    var noseY = eyeY + 2, noseLen = cfg.nose || 4;
    for (var n = 0; n < noseLen; n++) pxsafe(data, w, h, cx, noseY + n, skinD);
    pxsafe(data, w, h, cx - 1, noseY + noseLen - 1, skinD);
    pxsafe(data, w, h, cx + 1, noseY + noseLen - 1, out);
    if (cfg.noseWide) {
      pxsafe(data, w, h, cx - 2, noseY + noseLen - 1, skinD);
      pxsafe(data, w, h, cx + 2, noseY + noseLen - 1, out);
      pxsafe(data, w, h, cx - 2, noseY + noseLen - 2, skinD);
    }

    /* --- mouth --- */
    var mouthY = noseY + noseLen + 2;
    var mw = cfg.mouthW || 3;
    if (expr === 'hurt' || expr === 'ko' || expr === 'tell') {
      for (var my = 0; my < 3; my++) for (var mx = -mw + 1; mx <= mw - 1; mx++) {
        pxsafe(data, w, h, cx + mx, mouthY + my, my === 0 ? out : C.maroon);
      }
      for (var tx = -mw + 1; tx <= mw - 1; tx++) pxsafe(data, w, h, cx + tx, mouthY, C.white);
    } else {
      for (var mx2 = -mw; mx2 <= mw; mx2++) pxsafe(data, w, h, cx + mx2, mouthY, out);
      if (cfg.mouth === 'grin') { pxsafe(data, w, h, cx - mw - 1, mouthY - 1, out); pxsafe(data, w, h, cx + mw + 1, mouthY - 1, out); }
      if (cfg.mouth === 'frown') { pxsafe(data, w, h, cx - mw - 1, mouthY + 1, out); pxsafe(data, w, h, cx + mw + 1, mouthY + 1, out); }
    }

    /* --- facial hair --- */
    var fh = FACIAL[cfg.facialKey];
    if (fh) {
      for (var fy = 0; fy < fh.rows.length; fy++) {
        var fr = fh.rows[fy];
        for (var fx = 0; fx < fr.length; fx++) {
          if (fr.charAt(fx) === 'h') pxsafe(data, w, h, fx, fh.y + fy, cfg.hair);
        }
      }
    }

    /* --- hair / headgear on top --- */
    var acc = cfg.acc || {};
    for (var hy = 0; hy < hairRows.length; hy++) {
      var hr = hairRows[hy];
      for (var hx = 0; hx < hr.length; hx++) {
        var ch = hr.charAt(hx);
        if (ch === '.') continue;
        var col = ch === 'h' ? cfg.hair : ch === 'H' ? (cfg.hairL || cfg.hair)
          : ch === 'g' ? (cfg.hairD || cfg.hair) : ch === 's' ? skin
          : ch === 'l' ? skinL : ch === 'd' ? skinD : ch === 'o' ? C.black
          : ch === 'a' ? acc.a : ch === 'b' ? acc.b : ch === 'c' ? acc.c : 0;
        pxsafe(data, w, h, hx, hairTop + hy, col);
      }
    }
    return { w: w, h: h, data: data, chin: chin, faceTop: faceTop };
  }
  Art.buildHead = buildHead;

  /* =======================================================================
     Body renderer
     ======================================================================= */

  /* a boxing mitt: rounded body, thumb nub, laced cuff */
  function drawGlove(x, y, r, col, colD, colL, flip) {
    x = Math.round(x); y = Math.round(y); r = Math.round(r);
    var s = flip ? -1 : 1;
    var tr = Math.max(2, Math.round(r * 0.5));
    var tx = x - s * (r - 1), ty = y + Math.round(r * 0.3);
    /* thumb first, so the mitt outline sits cleanly on top of it */
    PO.ellipse(tx, ty, tr, Math.max(2, tr - 1), col);
    PO.ellipseOutline(tx, ty, tr, Math.max(2, tr - 1), C.black);
    /* mitt */
    PO.ellipse(x, y, r, r - 1, col);
    PO.ellipse(x - s * Math.round(r * 0.3), y - Math.round(r * 0.35), Math.max(1, r - 3), Math.max(1, r - 4), colL);
    PO.ellipse(x + s * Math.round(r * 0.3), y + Math.round(r * 0.3), Math.max(1, r - 3), Math.max(1, r - 4), colD);
    PO.ellipseOutline(x, y, r, r - 1, C.black);
    /* laced cuff */
    var cw = Math.max(5, Math.round(r * 1.25));
    var cy = y + r - 2;
    PO.fillRect(x - (cw >> 1), cy, cw, 3, C.white);
    PO.fillRect(x - (cw >> 1), cy + 2, cw, 1, C.grey);
    PO.rect(x - (cw >> 1), cy, cw, 3, C.black);
  }
  Art.drawGlove = drawGlove;

  function drawBoot(x, y, w, h, col, colD) {
    var hw = w >> 1;
    PO.fillRect(x - hw, y - h, w, h - 2, col);
    PO.fillRect(x - hw, y - h, 2, h - 2, colD);
    PO.fillRect(x - hw - 1, y - 3, w + 3, 3, colD);       /* sole flares forward */
    PO.rect(x - hw - 1, y - 3, w + 3, 3, C.black);
    PO.rect(x - hw, y - h, w, h - 2, C.black);
    PO.fillRect(x - hw + 1, y - h, w - 2, 2, C.white);    /* cuff trim */
    PO.vline(x, y - h + 3, h - 6, C.white);               /* lace line */
  }

  /* f: fighter visual descriptor, pose: animation state
     pose = { cx, base, crouch, lean, lgx,lgy, rgx,rgy, headX, headY, expr,
              legSpread, armUp, flash } */
  Art.drawFighter = function (f, pose) {
    var cx = Math.round(pose.cx), base = Math.round(pose.base);
    var b = f.build;
    var crouch = pose.crouch || 0;
    var lean = pose.lean || 0;

    var hipY = base - b.legLen + crouch;
    var shoulderY = hipY - b.torsoH + Math.round(crouch * 0.3);
    var hipX = cx + Math.round(lean * 0.3);
    var shX = cx + lean;

    var skin = f.skin, skinD = f.skinD, skinL = f.skinL;
    var out = C.black;

    /* ---- legs ---- */
    var spread = b.spread || 10;
    var footY = base;
    for (var side = -1; side <= 1; side += 2) {
      var fx = cx + side * spread + (side > 0 ? Math.round(lean * 0.2) : 0);
      PO.limb(hipX + side * Math.round(b.waistW * 0.28), hipY + 2, fx, footY - b.bootH, b.legW, b.legW - 3, skin, out);
      /* shading down the outside of each leg */
      PO.limb(hipX + side * Math.round(b.waistW * 0.28) + side * 2, hipY + 3, fx + side * 2, footY - b.bootH, 2, 1, skinD, 0);
    }
    for (var side2 = -1; side2 <= 1; side2 += 2) {
      drawBoot(cx + side2 * spread, footY, b.bootW, b.bootH, f.boot, f.bootD);
    }

    /* ---- trunks ---- */
    var tw = b.waistW + 8, th = b.trunkH;
    PO.fillRect(hipX - (tw >> 1), hipY - 4, tw, th, f.trunk);
    PO.fillRect(hipX - (tw >> 1), hipY - 4, 3, th, f.trunkL || f.trunk);
    PO.fillRect(hipX + (tw >> 1) - 3, hipY - 4, 3, th, f.trunkD);
    /* leg openings */
    PO.fillRect(hipX - 2, hipY + th - 8, 4, 8, f.trunkD);
    PO.rect(hipX - (tw >> 1), hipY - 4, tw, th, out);
    /* waistband */
    PO.fillRect(hipX - (tw >> 1), hipY - 6, tw, 3, f.belt || C.white);
    PO.rect(hipX - (tw >> 1), hipY - 6, tw, 3, out);

    /* ---- torso ---- */
    var torsoTop = shoulderY, torsoBot = hipY - 3;
    var n = torsoBot - torsoTop;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var halfW;
      var sw = b.shoulderW / 2, ww = b.waistW / 2;
      if (t < 0.18) halfW = sw * (0.72 + 0.28 * (t / 0.18));   // neck flare into shoulders
      else halfW = sw + (ww - sw) * Math.pow((t - 0.18) / 0.82, 0.85);
      if (b.belly) halfW += b.belly * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.30) / 0.70)));
      halfW = Math.max(3, Math.round(halfW));
      var rowX = shX + Math.round((hipX - shX) * t);
      PO.fillRect(rowX - halfW, torsoTop + i, halfW * 2, 1, skin);
      PO.fillRect(rowX - halfW, torsoTop + i, 3, 1, skinL);
      PO.fillRect(rowX + halfW - 3, torsoTop + i, 3, 1, skinD);
      PO.px(rowX - halfW - 1, torsoTop + i, out);
      PO.px(rowX + halfW, torsoTop + i, out);
    }
    /* pectoral + abdominal definition */
    var pecY = torsoTop + Math.round(n * 0.32);
    PO.hline(shX - Math.round(b.shoulderW * 0.30), pecY, Math.round(b.shoulderW * 0.24), skinD);
    PO.hline(shX + Math.round(b.shoulderW * 0.06), pecY, Math.round(b.shoulderW * 0.24), skinD);
    PO.px(shX, pecY - 1, skinD); PO.px(shX, pecY - 2, skinD);
    if (!b.belly) {
      for (var a2 = 0; a2 < 2; a2++) {
        var ay = pecY + 6 + a2 * 5;
        if (ay > torsoBot - 4) break;
        PO.hline(shX - 3, ay, 7, skinD);
      }
    } else {
      PO.ellipseOutline(hipX, torsoBot - Math.round(b.belly * 0.9), Math.round(b.belly * 1.05), Math.round(b.belly * 0.75), skinD);
      PO.ellipse(hipX - 2, torsoBot - Math.round(b.belly * 1.2), 3, 2, skinL);
    }
    if (f.chestHair) {
      for (var chx = -5; chx <= 5; chx += 2) PO.px(shX + chx, pecY - 4 + (chx & 1), f.chestHair);
    }

    /* ---- head ---- */
    var headSp = f.heads[pose.expr || 'idle'] || f.heads.idle;
    var hx = shX + (pose.headX || 0) - (headSp.w >> 1);
    var hy = shoulderY - headSp.chin + (pose.headY || 0) - 1;
    /* neck */
    PO.fillRect(shX - 4, shoulderY - 5, 8, 6, skinD);
    PO.blit(headSp, hx, hy);

    /* ---- arms + gloves ---- */
    var gr = b.gloveR;
    var shoulderOff = Math.round(b.shoulderW * 0.46);
    var arms = [
      { sx: shX - shoulderOff, sy: shoulderY + 5, gx: cx + (pose.lgx || -18), gy: base - (pose.lgy || 46), dir: -1 },
      { sx: shX + shoulderOff, sy: shoulderY + 5, gx: cx + (pose.rgx || 18), gy: base - (pose.rgy || 46), dir: 1 }
    ];
    for (var ai = 0; ai < 2; ai++) {
      var A = arms[ai];
      /* elbow hangs below the line from shoulder to glove and swings outward,
         so the guard reads as a bent arm rather than a straight stick */
      var reach = Math.sqrt((A.gx - A.sx) * (A.gx - A.sx) + (A.gy - A.sy) * (A.gy - A.sy));
      var slack = Math.max(0, 1 - reach / (b.torsoH * 1.5));
      var ex = (A.sx + A.gx) / 2 + A.dir * b.elbow * slack;
      var ey = (A.sy + A.gy) / 2 + 5 * slack;
      PO.limb(A.sx, A.sy, ex, ey, b.armW, b.armW - 2, skin, out);
      PO.limb(ex, ey, A.gx, A.gy, b.armW - 2, b.armW - 4, skin, out);
      /* deltoid sits inside the torso silhouette */
      PO.ellipse(A.sx, A.sy - 1, Math.round(b.armW * 0.55), Math.round(b.armW * 0.5), skin);
      PO.ellipse(A.sx - A.dir, A.sy - 2, Math.max(1, Math.round(b.armW * 0.3)), 1, A.dir < 0 ? skinL : skinD);
      /* a touch of shading along the outside of each arm */
      PO.limb(A.sx + A.dir * 3, A.sy + 2, ex + A.dir * 2, ey, 2, 1, skinD, 0);
      drawGlove(A.gx, A.gy, gr, f.glove, f.gloveD, f.gloveL, A.dir > 0);
    }
  };

  /* =======================================================================
     Little Mac — drawn from behind, small, in the foreground
     ======================================================================= */
  var MAC = {
    skin: C.skin, skinD: C.skinD, skinL: C.skinL,
    hair: C.black, trunk: C.greenL, trunkD: C.green, boot: C.grey3, bootD: C.black,
    glove: C.greenL, gloveD: C.green, gloveL: C.white,
    top: C.maroon, topD: C.black, topL: C.redD
  };
  Art.MAC = MAC;

  /* pose: {cx, base, crouch, lean, lgx,lgy,rgx,rgy, twist, hidden} */
  Art.drawMac = function (pose) {
    var cx = Math.round(pose.cx), base = Math.round(pose.base);
    var crouch = pose.crouch || 0, lean = pose.lean || 0;
    var out = C.black;

    var hipY = base - 20 + crouch;
    var shY = hipY - 17 + Math.round(crouch * 0.25);
    var hipX = cx + Math.round(lean * 0.35);
    var shX = cx + lean;

    /* legs */
    for (var s = -1; s <= 1; s += 2) {
      var fx = cx + s * 7;
      PO.limb(hipX + s * 4, hipY + 4, fx, base - 6, 7, 5, MAC.skin, out);
      PO.limb(hipX + s * 4 + s, hipY + 5, fx + s, base - 6, 2, 1, MAC.skinD, 0);
    }
    /* boots */
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      PO.fillRect(cx + s2 * 7 - 4, base - 7, 8, 7, MAC.boot);
      PO.fillRect(cx + s2 * 7 - 4, base - 7, 8, 1, C.white);
      PO.rect(cx + s2 * 7 - 4, base - 7, 8, 7, out);
    }
    /* trunks */
    PO.fillRect(hipX - 11, hipY - 3, 22, 13, MAC.trunk);
    PO.fillRect(hipX + 6, hipY - 3, 5, 13, MAC.trunkD);
    PO.fillRect(hipX - 2, hipY + 6, 4, 4, MAC.trunkD);
    PO.rect(hipX - 11, hipY - 3, 22, 13, out);
    PO.fillRect(hipX - 11, hipY - 5, 22, 3, C.white);
    PO.rect(hipX - 11, hipY - 5, 22, 3, out);

    /* torso — singlet seen from behind */
    var n = (hipY - 4) - shY;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var halfW = Math.round(11 - 1.5 * t + 1.5 * Math.sin(t * 2.4));
      var rowX = shX + Math.round((hipX - shX) * t);
      PO.fillRect(rowX - halfW, shY + i, halfW * 2, 1, MAC.top);
      PO.fillRect(rowX - halfW, shY + i, 2, 1, MAC.topL);
      PO.fillRect(rowX + halfW - 2, shY + i, 2, 1, MAC.topD);
      PO.px(rowX - halfW - 1, shY + i, out);
      PO.px(rowX + halfW, shY + i, out);
      /* bare shoulders above the vest line */
      if (i < 3) {
        PO.fillRect(rowX - halfW - 1, shY + i, 3, 1, MAC.skin);
        PO.fillRect(rowX + halfW - 2, shY + i, 3, 1, MAC.skinD);
      }
    }
    /* vest straps */
    PO.vline(shX - 6, shY, 5, MAC.skin);
    PO.vline(shX + 5, shY, 5, MAC.skinD);

    /* head from behind: dark hair, ears */
    var headY = shY - 15;
    PO.ellipse(shX, headY + 7, 9, 9, MAC.skin);
    PO.ellipse(shX, headY + 4, 9, 7, MAC.hair);
    PO.ellipseOutline(shX, headY + 7, 9, 9, out);
    PO.fillRect(shX - 9, headY + 8, 19, 5, MAC.hair);
    PO.px(shX - 4, headY + 2, C.grey2); PO.px(shX - 3, headY + 1, C.grey2);
    PO.ellipse(shX - 10, headY + 9, 2, 3, MAC.skin);
    PO.ellipse(shX + 10, headY + 9, 2, 3, MAC.skinD);
    /* neck */
    PO.fillRect(shX - 4, headY + 14, 8, 4, MAC.skinD);

    /* arms + gloves */
    var glL = { x: cx + (pose.lgx === undefined ? -16 : pose.lgx), y: base - (pose.lgy === undefined ? 33 : pose.lgy) };
    var glR = { x: cx + (pose.rgx === undefined ? 16 : pose.rgx), y: base - (pose.rgy === undefined ? 33 : pose.rgy) };
    var shoulders = [{ sx: shX - 10, sy: shY + 3, g: glL, o: -5 }, { sx: shX + 10, sy: shY + 3, g: glR, o: 5 }];
    for (var ai = 0; ai < 2; ai++) {
      var A = shoulders[ai];
      var mx = (A.sx + A.g.x) / 2 + A.o, my = (A.sy + A.g.y) / 2 + 2;
      PO.limb(A.sx, A.sy, mx, my, 7, 6, MAC.skin, out);
      PO.limb(mx, my, A.g.x, A.g.y, 6, 5, MAC.skin, out);
      PO.ellipse(A.sx, A.sy, 4, 4, MAC.skin);
      PO.ellipseOutline(A.sx, A.sy, 4, 4, out);
      drawGlove(A.g.x, A.g.y, 6, MAC.glove, MAC.gloveD, MAC.gloveL, ai === 1);
    }
  };

  /* =======================================================================
     Ring, crowd, referee
     ======================================================================= */
  var crowdSeed = [];
  (function () { for (var i = 0; i < 600; i++) crowdSeed.push(PO.rand()); })();

  var LATTICE = PO.pack('#C8CC78'), LATTICE_D = PO.pack('#5C6828');
  var CROWD_BG = PO.pack('#401800');
  var CROWD_SKIN = ['#E0A078', '#F8C8A0', '#A86038', '#C88858', '#F0B088'].map(PO.pack);
  var CROWD_TOP = ['#901808', '#B83820', '#682000', '#A85830', '#782810', '#C04828'].map(PO.pack);

  Art.drawRing = function (floorCol, tick) {
    /* scaffold lattice the scoreboard hangs on */
    PO.fillRect(0, 0, PO.W, 34, LATTICE);
    for (var gx = 0; gx < PO.W; gx += 8) PO.vline(gx, 0, 34, LATTICE_D);
    for (var gy = 0; gy < 34; gy += 8) PO.hline(0, gy, PO.W, LATTICE_D);
    PO.hline(0, 33, PO.W, C.black);

    /* two packed tiers of spectators */
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

    /* canvas */
    PO.fillRect(0, 58, PO.W, PO.H - 58, floorCol);

    /* ropes, sagging slightly between the posts */
    var ropeCols = [C.red, C.white, C.blue];
    for (var r = 0; r < 3; r++) {
      var y0 = 60 + r * 7;
      for (var x2 = 8; x2 < PO.W - 8; x2++) {
        var sag = Math.round(Math.sin((x2 / PO.W) * Math.PI) * 2);
        PO.fillRect(x2, y0 + sag, 1, 2, ropeCols[r]);
        PO.px(x2, y0 + sag + 2, C.grey3);
      }
    }

    /* corner posts, drawn over the rope ends */
    for (var s2 = 0; s2 < 2; s2++) {
      var px2 = s2 ? PO.W - 12 : 4;
      PO.fillRect(px2, 56, 8, 30, C.grey);
      PO.fillRect(px2, 56, 3, 30, C.white);
      PO.fillRect(px2 + 6, 56, 2, 30, C.grey2);
      PO.rect(px2, 56, 8, 30, C.black);
      PO.fillRect(px2 - 1, 54, 10, 4, C.red);
      PO.rect(px2 - 1, 54, 10, 4, C.black);
    }
  };

  /* referee, seen from behind/side during counts */
  Art.drawRef = function (x, y, frame) {
    PO.fillRect(x - 7, y - 22, 14, 14, C.white);            // shirt
    PO.rect(x - 7, y - 22, 14, 14, C.black);
    for (var s = -5; s <= 4; s += 3) PO.vline(x + s, y - 22, 14, C.black); // stripes
    PO.fillRect(x - 6, y - 8, 12, 8, C.black);              // trousers
    PO.ellipse(x, y - 27, 5, 5, C.skin);                    // head
    PO.ellipseOutline(x, y - 27, 5, 5, C.black);
    PO.fillRect(x - 5, y - 31, 11, 3, C.brownD);            // hair
    var armUp = frame % 2 === 0;
    PO.limb(x - 6, y - 20, x - 12, armUp ? y - 30 : y - 14, 4, 3, C.skin, C.black);
    PO.limb(x + 6, y - 20, x + 12, armUp ? y - 30 : y - 14, 4, 3, C.skin, C.black);
  };

  /* =======================================================================
     HUD
     ======================================================================= */
  var STAR = PO.sprite({
    pal: { w: 'white', y: 'yellow' },
    rows: [
      '...w...',
      '..www..',
      'wwwwwww',
      '.wwwww.',
      '..www..',
      '..w.w..',
      '.w...w.'
    ]
  });
  var HEART = PO.sprite({
    pal: { r: 'red', o: 'black', l: 'redL' },
    rows: [
      '.oo.oo.',
      'olrrrlo',
      'orrrrro',
      'orrrrro',
      '.orrro.',
      '..oro..',
      '...o...'
    ]
  });
  Art.STAR = STAR; Art.HEART = HEART;

  function panel(x, y, w, h, fill, border) {
    PO.fillRect(x, y, w, h, fill);
    PO.rect(x, y, w, h, border);
  }

  /* st: fight state */
  Art.drawHUD = function (st) {
    /* stars */
    panel(6, 14, 34, 13, C.black, C.blueL);
    PO.blit(STAR, 9, 17);
    PO.text(String(st.mac.stars), 26, 17, st.mac.stars > 0 ? C.orange : C.grey2);
    /* hearts */
    panel(42, 14, 40, 13, C.black, C.blueL);
    PO.blit(HEART, 45, 17);
    var hcol = st.mac.hearts === 0 ? C.blueL : st.mac.hearts <= 5 ? C.red : C.white;
    var hs = String(st.mac.hearts);
    PO.text(hs, 62 - (hs.length - 1) * 4, 17, hcol);

    /* health bars + points */
    panel(88, 12, 108, 22, C.blueD, C.blueL);
    barMeter(91, 14, 50, st.mac.hp / st.mac.maxHp, C.white, C.black);
    barMeter(144, 14, 50, st.opp.hp / st.opp.maxHp, C.white, C.black);
    PO.text('POINTS:', 90, 24, C.white, { spacing: 8 });
    var p = String(st.points);
    PO.text(p, 192 - p.length * 8, 24, C.white);

    /* clock + round */
    panel(200, 12, 50, 22, C.blueD, C.blueL);
    var t = Math.max(0, Math.ceil(st.timeLeft));
    var mm = Math.floor(t / 60), ss = t % 60;
    PO.text(mm + ':' + (ss < 10 ? '0' : '') + ss, 204, 14, C.white);
    PO.text('ROUND' + st.round, 202, 24, C.white, { spacing: 8 });
  };

  function barMeter(x, y, w, frac, fill, empty) {
    frac = Math.max(0, Math.min(1, frac));
    PO.fillRect(x, y, w, 7, empty);
    PO.fillRect(x, y, Math.round(w * frac), 7, fill);
    PO.rect(x - 1, y - 1, w + 2, 9, C.black);
  }
  Art.barMeter = barMeter;
})();
