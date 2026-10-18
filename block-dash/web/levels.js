/* Block Dash - hand-built levels.
   Cube parts are drawn as small ASCII "motifs" (top row first, bottom row = ground level);
   ship / ball / UFO / wave corridors come from seeded generators. Every level is checked by tools/validate.js.

   Motif legend:  # block   = half block   ^ spike   v hanging spike   , small spike   ' small hanging spike
                  o yellow orb   q pink orb   b blue (gravity) orb
                  p yellow pad   k pink pad   u blue pad   (P K U = same pads stuck to a ceiling)   c coin
   Script tokens: number = flat gap, 'name' = motif, 'm:name' = motif mirrored under the current ceiling,
                  'P:mode[:ceil]' mode portal, 'G:up:ceil' / 'G:down' gravity portal, 'S:slow|normal|fast|faster' speed portal,
                  'ship|ufo|wave:len:gap', 'ball:len', 'C:y' coin */
(function (root) {
  'use strict';

  var M = {
    s1: ['^'],
    s2: ['^^'],
    s3: ['^^^'],
    sm: [',,,'],
    sm2: ['^,,^'],
    step: ['###^^'],
    step3: ['####^^^'],
    stairs: ['....##', '..####', '######^^^'],
    hop: ['#..^..#..^..#'],
    plat: ['...#####', '^^^^^^^^^^^'],
    slabs: ['=..^..=..^..='],
    pillarsUp: ['......#', '...#..#', '#..#..#^^'],
    gapjump: ['###^^^###'],
    pad1: ['p..^^^^'],
    pad2: ['p...^^^^^'],
    padtower: ['.....###', '.....###', 'p..^^###^'],
    orb1: ['...o...', '.......', '^^^^^^^'],
    orb2: ['..o....o..', '..........', '^^^^^^^^^^^^'],
    orbp: ['...q....', '^^^^^^^'],
    bluepad: ['################', '......v......U..', '................', '................', 'u...............'],
    blueorb: ['##############', '..........U...', '..............', '....b.........', '^^^^^^^^......']
  };
  var SPEEDS = { slow: 0.8, normal: 1, fast: 1.25, faster: 1.55 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* adds the objects of an ASCII motif at x0; returns its width */
  function motif(rows, x0, out, mirrorCeil) {
    var h = rows.length, w = 0, start = out.length;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    function at(cx, y) { var r = rows[h - 1 - y]; return (r && r[cx]) || '.'; }
    var used = {};
    for (var y = 0; y < h; y++) {
      for (var cx = 0; cx < w; cx++) {
        var ch = at(cx, y);
        if (used[cx + ',' + y]) continue;
        if (ch === '#' || ch === '=') {
          var ww = 1; while (at(cx + ww, y) === ch && !used[(cx + ww) + ',' + y]) ww++;
          var hh = 1;
          if (ch === '#') {
            grow: while (y + hh < h) { for (var q = 0; q < ww; q++) if (at(cx + q, y + hh) !== '#' || used[(cx + q) + ',' + (y + hh)]) break grow; hh++; }
          }
          for (var a = 0; a < ww; a++) for (var bb = 0; bb < hh; bb++) used[(cx + a) + ',' + (y + bb)] = true;
          out.push({ t: 'b', x: x0 + cx, y: y, w: ww, h: ch === '=' ? 0.5 : hh });
        } else if (ch === '^' || ch === 'v' || ch === ',' || ch === "'") {
          out.push({ t: 's', x: x0 + cx, y: y, flip: ch === 'v' || ch === "'", sm: ch === ',' || ch === "'" });
        } else if (ch === 'o' || ch === 'q' || ch === 'b') {
          out.push({ t: 'o', x: x0 + cx, y: y, kind: ch === 'o' ? 'y' : ch === 'q' ? 'p' : 'b' });
        } else if ('pkuPKU'.indexOf(ch) >= 0) {
          var lc = ch.toLowerCase();
          out.push({ t: 'p', x: x0 + cx, y: y, flip: ch !== lc, kind: lc === 'p' ? 'y' : lc === 'k' ? 'p' : 'b' });
        } else if (ch === 'c') {
          out.push({ t: 'c', x: x0 + cx, y: y });
        }
      }
    }
    if (mirrorCeil != null) {
      for (var i = start; i < out.length; i++) {
        var o = out[i];
        if (o.t === 'b') o.y = mirrorCeil - o.y - o.h;
        else { o.y = mirrorCeil - 1 - o.y; if (o.t === 's' || o.t === 'p') o.flip = !o.flip; }
      }
    }
    return w;
  }

  function build(spec) {
    var rng = mulberry32(spec.seed);
    function r(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
    var objs = [], x = 0, mode = 'cube', grav = 1, ceil = null;

    function portalCy() {
      if (mode === 'cube' && ceil == null) return 1.6;
      if (mode === 'cube') return grav > 0 ? 1.6 : ceil - 1.6;
      return (ceil || 10) / 2;
    }
    function pillars(len, gapMin, step, spikes) {
      var fl = 0, ce = 0, top = ceil || 10;
      for (var px = x + 10; px < x + len - 4; px += step) {
        fl = Math.max(0, Math.min(5, fl + r(-2, 2)));
        ce = Math.max(0, Math.min(5, ce + r(-2, 2)));
        var need = gapMin + (spikes ? 0.6 : 0);
        while (top - fl - ce < need) { if (rng() < 0.5 && fl > 0) fl--; else if (ce > 0) ce--; else fl--; }
        if (fl > 0) { objs.push({ t: 'b', x: px, y: 0, w: 3, h: fl }); if (spikes && rng() < 0.5) objs.push({ t: 's', x: px + 1, y: fl }); }
        if (ce > 0) { objs.push({ t: 'b', x: px, y: top - ce, w: 3, h: ce }); if (spikes && rng() < 0.5) objs.push({ t: 's', x: px + 1, y: top - ce - 1, flip: true }); }
      }
      x += len;
    }
    function ballSection(len) {
      var top = ceil || 8, side = 0;
      for (var px = x + 9; px < x + len - 6; px += r(10, 12)) {
        var n = r(3, 5);
        if (rng() < 0.65) {
          for (var i = 0; i < n; i++) objs.push(side === 0 ? { t: 's', x: px + i, y: 0 } : { t: 's', x: px + i, y: top - 1, flip: true });
        } else {
          objs.push(side === 0 ? { t: 'b', x: px, y: 0, w: n, h: 2 } : { t: 'b', x: px, y: top - 2, w: n, h: 2 });
        }
        side = 1 - side;
      }
      x += len;
    }
    function waveSection(len, gap) {
      var top = ceil || 10, c = top / 2;
      for (var px = x + 10; px < x + len - 4; px += 6) {
        c = Math.max(gap / 2 + 0.5, Math.min(top - gap / 2 - 0.5, c + (rng() * 4 - 2)));
        var fl = Math.floor(c - gap / 2), ce = Math.floor(top - (c + gap / 2));
        if (fl > 0) objs.push({ t: 'b', x: px, y: 0, w: 2, h: fl });
        if (ce > 0) objs.push({ t: 'b', x: px, y: top - ce, w: 2, h: ce });
      }
      x += len;
    }

    spec.script.forEach(function (tok) {
      if (typeof tok === 'number') { x += tok; return; }
      var a = tok.split(':');
      switch (a[0]) {
        case 'P': {
          var cy = portalCy();
          mode = a[1];
          ceil = a[2] !== undefined ? +a[2] : (mode === 'cube' ? null : 10);
          var pg = { t: 'g', x: x, mode: mode, ceil: ceil, cy: cy, kind: mode };
          if (mode === 'cube') { grav = 1; pg.grav = 1; }
          objs.push(pg);
          x += 2; break;
        }
        case 'G': {
          var gy = portalCy();
          grav = a[1] === 'up' ? -1 : 1;
          ceil = grav < 0 ? +(a[2] || 8) : (mode === 'cube' ? null : ceil);
          objs.push({ t: 'g', x: x, grav: grav, ceil: ceil, cy: gy, kind: grav < 0 ? 'gup' : 'gdown' });
          x += 2; break;
        }
        case 'S':
          objs.push({ t: 'g', x: x, spd: SPEEDS[a[1]], cy: portalCy(), kind: 'spd-' + a[1] });
          x += 2; break;
        case 'C':
          objs.push({ t: 'c', x: x, y: +a[1] }); break;
        case 'ship': pillars(+a[1], +a[2], 8, a[3] === 'sp'); break;
        case 'ufo': pillars(+a[1], +a[2], 9, false); break;
        case 'ball': ballSection(+a[1]); break;
        case 'wave': waveSection(+a[1], +a[2]); break;
        case 'm': x += motif(M[a[1]], x, objs, ceil); break;
        default:
          if (!M[tok]) throw new Error('unknown token ' + tok);
          x += motif(M[tok], x, objs, null);
      }
    });
    return {
      id: spec.id, name: spec.name, diff: spec.diff, stars: spec.stars, speed: spec.speed || 10.4,
      len: x + 10, palette: spec.palette, bpm: spec.bpm, objects: objs
    };
  }

  var specs = [
    { id: 1, name: 'Base Camp', diff: 'Easy', stars: 1, seed: 11, bpm: 120, palette: ['#2a6cff', '#6a3cff', '#1446c8'],
      script: [14, 's1', 9, 's1', 8, 's2', 9, 'step', 9, 's2', 8, 's1', 9, 'hop', 9, 'C:1.8', 8, 's3', 9, 'stairs', 10, 'step3', 9,
        'P:ship', 'ship:72:5.5', 'P:cube', 14,
        's2', 8, 'plat', 10, 'C:2', 8, 's1', 6, 's1', 8, 'pillarsUp', 10, 's3', 9, 'step', 9, 'C:1.8', 8, 's2', 12] },
    { id: 2, name: 'Skyline Sprint', diff: 'Easy', stars: 2, seed: 23, bpm: 126, palette: ['#ff3fae', '#a83cff', '#9c1e78'],
      script: [14, 's1', 8, 'pad1', 10, 's2', 8, 'step', 9, 'pad2', 10, 'C:1.8', 8, 'padtower', 11, 's3', 9, 'hop', 9,
        'P:ship', 'ship:64:5.5', 'P:cube', 14,
        'pad1', 9, 's2', 8, 'gapjump', 9, 'C:2', 8, 'padtower', 11, 'stairs', 10, 'pad2', 10, 'C:1.8', 8, 's3', 12] },
    { id: 3, name: 'Pixel Rain', diff: 'Normal', stars: 3, seed: 37, bpm: 132, palette: ['#20c25a', '#12a6a0', '#0f7a3a'],
      script: [14, 's2', 8, 'orb1', 10, 'step', 8, 'orb2', 10, 'C:1.8', 8, 'orbp', 9, 's3', 8, 'pad1', 10,
        'P:ship', 'ship:72:5', 'P:cube', 14,
        'orb2', 10, 'plat', 10, 'C:2', 8, 'hop', 9, 'orb1', 10, 'padtower', 11, 'C:1.8', 8, 'stairs', 10, 'sm', 8, 's3', 12] },
    { id: 4, name: 'Flipside', diff: 'Normal', stars: 4, seed: 41, bpm: 136, palette: ['#ff8a1a', '#ff4a3a', '#b04800'],
      script: [14, 's2', 8, 'step', 9, 'bluepad', 8, 's2', 8, 'blueorb', 12, 'C:1.8', 8,
        'G:up:8', 12, 'm:s2', 8, 'm:s1', 8, 'm:step', 9, 'C:5.5', 8, 'm:s3', 9, 'G:down', 12, 's2', 8,
        'P:ship', 'ship:64:5', 'P:cube', 14,
        'bluepad', 8, 'hop', 9, 'C:2', 8, 'blueorb', 12, 'stairs', 10, 's3', 12] },
    { id: 5, name: 'Overdrive', diff: 'Hard', stars: 5, seed: 53, bpm: 140, palette: ['#ff3b3b', '#ff8a1f', '#951414'],
      script: [14, 'S:fast', 6, 's2', 10, 'step', 10, 'orb1', 11, 'pad1', 11, 'C:1.8', 10, 's3', 10, 'S:normal', 6, 'stairs', 10,
        'P:ship', 'ship:72:5', 'P:cube', 14,
        'S:faster', 8, 's1', 12, 's2', 12, 'C:2', 12, 'hop', 12, 'S:normal', 8, 'bluepad', 8, 'plat', 10, 'C:1.8', 8, 'padtower', 11, 'sm2', 8, 's3', 12] },
    { id: 6, name: 'Rolling Thunder', diff: 'Hard', stars: 6, seed: 67, bpm: 138, palette: ['#18b0ff', '#2a6cff', '#0a58a8'],
      script: [14, 's2', 8, 'step', 9, 'C:1.8', 8, 'pad1', 10,
        'P:ball:8', 'ball:80', 'P:cube', 14,
        's3', 8, 'orb1', 10, 'C:1.8', 8, 'slabs', 9, 'pad2', 10,
        'P:ball:8', 'ball:70', 'P:cube', 14,
        'stairs', 10, 'hop', 9, 'C:2', 8, 'blueorb', 12, 's3', 12] },
    { id: 7, name: 'Saucer Run', diff: 'Harder', stars: 7, seed: 79, bpm: 144, palette: ['#8a3cff', '#ff3fae', '#4a1aa8'],
      script: [14, 's2', 8, 'pad1', 10, 'C:1.8', 8, 'step3', 9,
        'P:ufo', 'ufo:80:5', 'P:cube', 14,
        'orb2', 10, 'C:1.8', 8, 'step3', 9, 'gapjump', 9,
        'P:ship', 'ship:56:4.6', 'P:ufo', 'ufo:56:4.6', 'P:cube', 14,
        'C:2', 8, 'stairs', 10, 'pillarsUp', 10, 's3', 12] },
    { id: 8, name: 'Zigzag', diff: 'Harder', stars: 8, seed: 83, bpm: 148, palette: ['#d9bc12', '#ff8a1a', '#857000'],
      script: [14, 's2', 8, 'step', 9, 'C:1.8', 8, 'orb1', 10,
        'P:wave', 'wave:70:4', 'P:cube', 14,
        'padtower', 11, 'C:1.8', 8, 'hop', 9, 'blueorb', 12,
        'P:wave', 'wave:64:3.5', 'P:cube', 14,
        'C:2', 8, 'orb2', 10, 'stairs', 10, 's3', 12] },
    { id: 9, name: 'Hyper Drift', diff: 'Insane', stars: 9, seed: 97, bpm: 154, palette: ['#ff2a6a', '#8a3cff', '#991040'],
      script: [14, 'S:fast', 6, 's3', 10, 'orb2', 11, 'C:1.8', 10, 'padtower', 12,
        'P:ship', 'ship:64:4.6:sp', 'P:ball:8', 'ball:60', 'P:cube', 14,
        'S:normal', 6, 'bluepad', 8, 'C:2', 8, 'G:up:8', 12, 'm:s3', 8, 'm:step3', 9, 'm:s2', 9, 'G:down', 12,
        'P:wave', 'wave:56:3.5', 'P:cube', 14,
        'S:fast', 6, 'pillarsUp', 11, 'C:1.8', 10, 'orb1', 11, 's3', 14] },
    { id: 10, name: 'Gravity Storm', diff: 'Insane', stars: 10, seed: 101, bpm: 150, palette: ['#12b8a0', '#2a6cff', '#0a6a5a'],
      script: [14, 'blueorb', 12, 'C:1.8', 8, 'bluepad', 8, 'G:up:8', 12, 'm:s2', 8, 'm:hop', 9, 'm:orb1', 10, 'G:down', 12,
        'P:ufo', 'ufo:64:4.6', 'P:ball:8', 'ball:60', 'P:cube', 14,
        'C:2', 8, 'blueorb', 12, 'stairs', 10, 'G:up:8', 12, 'm:step3', 9, 'C:6', 8, 'm:s3', 9, 'G:down', 12,
        'P:ship', 'ship:64:4.4:sp', 'P:cube', 14, 'padtower', 11, 's3', 12] },
    { id: 11, name: 'Clockwork', diff: 'Insane', stars: 11, seed: 113, bpm: 158, palette: ['#c46a2a', '#7a3cff', '#6a3008'],
      script: [14, 'S:fast', 6, 'hop', 11, 'orb2', 11, 'C:1.8', 10,
        'P:wave', 'wave:64:3.4', 'P:ship', 'ship:56:4.4:sp', 'P:cube', 14,
        'pad2', 11, 'padtower', 12, 'C:2', 10, 'S:normal', 6,
        'P:ufo', 'ufo:56:4.4', 'P:ball:8', 'ball:56', 'P:cube', 14,
        'blueorb', 12, 'C:1.8', 8, 'stairs', 10, 'S:faster', 8, 's2', 13, 's3', 16] },
    { id: 12, name: 'Infinite Void', diff: 'Demon', stars: 12, seed: 127, bpm: 164, palette: ['#3a3a4c', '#1c1c28', '#121219'],
      script: [14, 'S:fast', 6, 's3', 10, 'orb2', 11, 'padtower', 12, 'C:1.8', 10,
        'P:ship', 'ship:64:4.2:sp', 'P:wave', 'wave:64:3.2', 'P:cube', 14,
        'S:normal', 6, 'bluepad', 8, 'blueorb', 12, 'G:up:8', 12, 'm:s3', 8, 'm:orb2', 10, 'C:6', 8, 'm:step3', 9, 'G:down', 12,
        'P:ball:8', 'ball:64', 'P:ufo', 'ufo:64:4.2', 'P:cube', 14,
        'S:faster', 8, 's2', 13, 'C:2', 12, 'hop', 13, 's3', 16] }
  ];

  var levels = specs.map(build);
  levels.motifs = M; levels.build = build;
  if (typeof module !== 'undefined' && module.exports) module.exports = levels; else root.LEVELS = levels;
})(typeof window !== 'undefined' ? window : this);
