/* Neon Dash - level definitions. Levels are generated from hand-tuned patterns with a fixed seed. */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function build(spec) {
    var rng = mulberry32(spec.seed);
    var objs = [];
    var x = 16;
    function r(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
    function spike(px, py, flip) { objs.push({ t: 's', x: px, y: py || 0, flip: !!flip }); }
    function block(px, py, w, h) { objs.push({ t: 'b', x: px, y: py, w: w, h: h }); }
    function pad(px, py) { objs.push({ t: 'p', x: px, y: py || 0 }); }
    function orb(px, py) { objs.push({ t: 'o', x: px, y: py }); }
    function portal(px, mode) { objs.push({ t: 'g', x: px, mode: mode }); }
    function coin(px, py) { objs.push({ t: 'c', x: px, y: py }); }

    var P = {
      spikes: function () { var n = r(1, spec.maxSpikes || 3); for (var i = 0; i < n; i++) spike(x + i); return n; },
      single: function () { spike(x); return 1; },
      gapSpikes: function () { var n = r(1, 2); for (var i = 0; i < n; i++) { spike(x + i); spike(x + n + 3 + i); } return n * 2 + 3; },
      blockSpike: function () { var w = r(2, 4); block(x, 0, w, 1); var n = r(1, 2); for (var i = 0; i < n; i++) spike(x + w + i); return w + n; },
      hopBlocks: function () { block(x, 0, 2, 1); block(x + 5, 0, 2, 1); spike(x + 2); spike(x + 3); spike(x + 4); spike(x + 7); spike(x + 8); return 9; },
      stairs: function () { block(x, 0, 3, 1); block(x + 3, 0, 3, 2); block(x + 6, 0, 3, 1); spike(x + 9); return 10; },
      padJump: function () { var n = r(3, 5); pad(x, 0); for (var i = 0; i < n; i++) spike(x + 3 + i); return 3 + n; },
      padPlatform: function () { pad(x, 0); block(x + 5, 0, 4, 3); spike(x + 3); spike(x + 4); return 14; },
      orbField: function () {
        var w = 9; for (var i = 0; i < w; i++) spike(x + i);
        orb(x + 2.5, 1.4); orb(x + 7.5, 1.4); return w;
      },
      orbSpikes: function () { spike(x + 2); spike(x + 3); spike(x + 4); spike(x + 5); orb(x + 3.5, 1.2); return 6; },
      shipSection: function () {
        var len = spec.shipLen || 60;
        portal(x, 'ship');
        var base = x + 12, fl = 1, ce = 1, gapMin = spec.shipGap || 5;
        for (var px = base; px < x + len; px += 8) {
          fl = Math.max(0, Math.min(4, fl + r(-2, 2)));
          ce = Math.max(0, Math.min(4, ce + r(-2, 2)));
          while (10 - fl - ce < gapMin) { if (rng() < 0.5) fl = Math.max(0, fl - 1); else ce = Math.max(0, ce - 1); }
          if (fl > 0) block(px, 0, 3, fl);
          if (ce > 0) block(px, 10 - ce, 3, ce);
        }
        portal(x + len + 4, 'cube');
        return len + 8;
      }
    };

    var gapMin = spec.gap[0], gapMax = spec.gap[1];
    var pool = spec.patterns.slice();
    var coinsAt = [0.22, 0.5, 0.78];
    var coinIdx = 0;
    var shipsLeft = spec.ships || 0;
    var plan = [];
    var count = spec.count;
    for (var i = 0; i < count; i++) {
      plan.push(pool[Math.floor(rng() * pool.length)]);
    }
    for (var s = 0; s < shipsLeft; s++) plan[Math.floor(count * (s + 1) / (shipsLeft + 1))] = 'shipSection';

    for (i = 0; i < plan.length; i++) {
      var w = P[plan[i]]();
      var gapW = r(gapMin, gapMax);
      if (coinIdx < 3 && i / plan.length >= coinsAt[coinIdx] && plan[i] !== 'shipSection') {
        coin(x + w + Math.floor(gapW / 2), plan[i] === 'orbField' ? 1.2 : 1.8);
        coinIdx++;
      }
      x += w + gapW;
    }
    if (coinIdx < 3) coin(x - 6, 1.8);
    return {
      id: spec.id, name: spec.name, diff: spec.diff, stars: spec.stars, speed: spec.speed,
      len: x + 8, palette: spec.palette, bpm: spec.bpm, objects: objs
    };
  }

  var E = ['single', 'spikes', 'spikes', 'blockSpike'];
  var specs = [
    { id: 1, name: 'Neon Start', diff: 'Easy', stars: 1, speed: 9.0, seed: 11, count: 26, gap: [8, 11], maxSpikes: 2, patterns: E, palette: ['#1b2a6b', '#0a0f2e', '#37e0ff'], bpm: 120 },
    { id: 2, name: 'Skyline Sprint', diff: 'Easy', stars: 2, speed: 9.6, seed: 23, count: 30, gap: [7, 10], maxSpikes: 3, patterns: E.concat(['gapSpikes', 'stairs']), palette: ['#5a1b6b', '#1a0630', '#ff5fd2'], bpm: 126 },
    { id: 3, name: 'Pixel Rain', diff: 'Normal', stars: 3, speed: 10.2, seed: 37, count: 34, gap: [7, 10], maxSpikes: 3, patterns: E.concat(['gapSpikes', 'stairs', 'padJump', 'hopBlocks']), palette: ['#0b5b4d', '#021a1a', '#3dffb0'], bpm: 132 },
    { id: 4, name: 'Echo Chamber', diff: 'Normal', stars: 4, speed: 10.4, seed: 41, count: 36, gap: [6, 9], maxSpikes: 3, patterns: ['spikes', 'padJump', 'padPlatform', 'blockSpike', 'gapSpikes', 'hopBlocks'], palette: ['#6b4a1b', '#2a1204', '#ffb03d'], bpm: 136 },
    { id: 5, name: 'Solar Flare', diff: 'Hard', stars: 5, speed: 10.6, seed: 53, count: 36, gap: [6, 9], maxSpikes: 3, patterns: ['spikes', 'orbField', 'orbSpikes', 'padJump', 'stairs', 'gapSpikes'], palette: ['#7a1b1b', '#2a0606', '#ff6a3d'], bpm: 140 },
    { id: 6, name: 'Wave Cruiser', diff: 'Hard', stars: 6, speed: 10.6, seed: 67, count: 34, ships: 2, shipLen: 56, shipGap: 5, gap: [6, 9], maxSpikes: 3, patterns: ['spikes', 'blockSpike', 'padJump', 'hopBlocks', 'gapSpikes'], palette: ['#1b4f7a', '#04152a', '#3db4ff'], bpm: 138 },
    { id: 7, name: 'Midnight Circuit', diff: 'Harder', stars: 7, speed: 11.0, seed: 79, count: 38, ships: 2, shipLen: 64, shipGap: 4.5, gap: [5, 8], maxSpikes: 3, patterns: ['spikes', 'orbField', 'padPlatform', 'stairs', 'hopBlocks', 'gapSpikes', 'orbSpikes'], palette: ['#3a1b7a', '#0d0430', '#a07dff'], bpm: 144 },
    { id: 8, name: 'Voltage', diff: 'Harder', stars: 8, speed: 11.4, seed: 83, count: 42, ships: 2, shipLen: 64, shipGap: 4.5, gap: [5, 8], maxSpikes: 3, patterns: ['spikes', 'orbField', 'padJump', 'padPlatform', 'hopBlocks', 'gapSpikes', 'orbSpikes', 'stairs'], palette: ['#6b6b1b', '#222204', '#f2ff3d'], bpm: 148 },
    { id: 9, name: 'Hyper Drift', diff: 'Insane', stars: 9, speed: 11.8, seed: 97, count: 46, ships: 3, shipLen: 64, shipGap: 4, gap: [5, 7], maxSpikes: 3, patterns: ['spikes', 'orbField', 'padJump', 'padPlatform', 'hopBlocks', 'gapSpikes', 'orbSpikes', 'stairs', 'blockSpike'], palette: ['#7a1b4f', '#2a0418', '#ff3d8a'], bpm: 154 },
    { id: 10, name: 'Infinite Void', diff: 'Demon', stars: 10, speed: 12.2, seed: 101, count: 52, ships: 3, shipLen: 72, shipGap: 4, gap: [5, 7], maxSpikes: 3, patterns: ['spikes', 'orbField', 'padJump', 'padPlatform', 'hopBlocks', 'gapSpikes', 'orbSpikes', 'stairs', 'blockSpike'], palette: ['#2a2a2a', '#050505', '#ffffff'], bpm: 160 }
  ];

  var levels = specs.map(build);
  if (typeof module !== 'undefined' && module.exports) module.exports = levels; else root.LEVELS = levels;
})(typeof window !== 'undefined' ? window : this);
