/* Neon Dash - deterministic physics engine (no DOM). Shared by the game and the level validator. */
(function (root) {
  'use strict';

  var DT = 1 / 120; // fixed physics step
  var SUB = 2;      // physics steps per input decision (60 Hz)
  var C = {
    G: 36, JUMP: 12.6, PAD: 17.5, ORB: 12.2, FALL: 24,
    SHIP_UP: 40, SHIP_DN: 34, SHIP_VMAX: 9, SHIP_VMIN: -10, SHIP_CEIL: 10,
    STEP_UP: 0.12
  };

  function prepare(level) {
    if (level._p) return level._p;
    var P = { cols: {}, portals: [], coins: [] };
    function addCol(o, w) {
      var a = Math.floor(o.x), b = Math.floor(o.x + w - 1e-6);
      for (var k = a; k <= b; k++) (P.cols[k] = P.cols[k] || []).push(o);
    }
    level.objects.forEach(function (o, i) {
      o.id = i;
      if (o.t === 'g') P.portals.push(o);
      else if (o.t === 'c') { P.coins.push(o); addCol(o, 1); }
      else addCol(o, o.t === 'b' ? o.w : 1);
    });
    P.portals.sort(function (a, b) { return a.x - b.x; });
    level._p = P;
    return P;
  }

  function modeAt(level, x) {
    var P = prepare(level), mode = 'cube';
    for (var i = 0; i < P.portals.length; i++) {
      if (P.portals[i].x + 0.5 <= x) mode = P.portals[i].mode; else break;
    }
    return mode;
  }

  /* Nearest start position at or before `target` that is not inside an obstacle. */
  function safeStart(level, target) {
    var P = prepare(level);
    function clear(x0, x1) {
      for (var k = Math.floor(x0); k <= Math.floor(x1); k++) {
        var l = P.cols[k]; if (!l) continue;
        for (var i = 0; i < l.length; i++) if (l[i].t === 'b' || l[i].t === 's' || l[i].t === 'p' || l[i].t === 'o') return false;
      }
      return true;
    }
    var x = Math.floor(target);
    if (modeAt(level, x) === 'ship') {
      for (var i = P.portals.length - 1; i >= 0; i--) if (P.portals[i].mode === 'ship' && P.portals[i].x <= x) { x = Math.floor(P.portals[i].x) - 1; break; }
    }
    for (; x > 4; x--) {
      if (clear(x - 1, x + 7) && modeAt(level, x) === 'cube') return x;
    }
    return 0;
  }

  function createState(level, opts, startX) {
    var P = prepare(level);
    startX = startX || 0;
    var s = {
      level: level, P: P, opts: opts || {}, x: startX, y: 0, vy: 0, mode: 'cube', ceil: null,
      grounded: true, prevHold: false, dead: false, won: false, t: 0, portalIdx: 0,
      lastOrb: -1, coins: [], rot: 0, events: []
    };
    while (s.portalIdx < P.portals.length && P.portals[s.portalIdx].x + 0.5 <= startX) {
      applyPortal(s, P.portals[s.portalIdx]); s.portalIdx++;
    }
    return s;
  }

  function applyPortal(s, p) {
    s.mode = p.mode;
    if (p.mode === 'ship') { s.ceil = C.SHIP_CEIL; s.vy *= 0.5; } else { s.ceil = null; }
  }

  function cloneState(s) {
    var c = {};
    for (var k in s) c[k] = s[k];
    c.coins = s.coins.slice();
    c.events = [];
    return c;
  }

  function ev(s, type) { if (!s.opts.noEvents) s.events.push(type); }
  function kill(s) { if (!s.dead) { s.dead = true; ev(s, 'die'); } }

  function step(s, hold) {
    if (s.dead || s.won) return;
    var o = s.opts, L = s.level, P = s.P;
    var press = hold && !s.prevHold;
    var vx = L.speed * (o.speed || 1);
    var noclip = !!o.noclip;

    if (s.mode === 'cube') {
      if (hold && (s.grounded || (o.infJump && press))) { s.vy = C.JUMP; s.grounded = false; ev(s, 'jump'); }
      s.vy -= C.G * DT;
      if (s.vy < -C.FALL) s.vy = -C.FALL;
    } else {
      s.vy += (hold ? C.SHIP_UP : -C.SHIP_DN) * DT;
      if (s.vy > C.SHIP_VMAX) s.vy = C.SHIP_VMAX;
      if (s.vy < C.SHIP_VMIN) s.vy = C.SHIP_VMIN;
    }
    s.grounded = false;
    s.x += vx * DT;
    s.t += DT;

    var i, k, list, b, top, py = s.y;
    var k0 = Math.floor(s.x), k1 = Math.floor(s.x + 1 - 1e-6);

    // horizontal collisions
    if (!noclip) {
      for (k = k0; k <= k1; k++) {
        list = P.cols[k]; if (!list) continue;
        for (i = 0; i < list.length; i++) {
          b = list[i]; if (b.t !== 'b') continue;
          top = b.y + b.h;
          if (s.x < b.x + b.w - 1e-9 && s.x + 1 > b.x + 1e-9 && s.y < top - 1e-9 && s.y + 1 > b.y + 1e-9) {
            if (s.y >= top - C.STEP_UP) { s.y = top; if (s.vy < 0) s.vy = 0; s.grounded = true; }
            else { kill(s); return; }
          }
        }
      }
    }
    py = s.y;

    // vertical movement + collisions
    s.y += s.vy * DT;
    if (!noclip) {
      for (k = k0; k <= k1; k++) {
        list = P.cols[k]; if (!list) continue;
        for (i = 0; i < list.length; i++) {
          b = list[i]; if (b.t !== 'b') continue;
          top = b.y + b.h;
          if (s.x < b.x + b.w - 1e-9 && s.x + 1 > b.x + 1e-9 && s.y < top - 1e-9 && s.y + 1 > b.y + 1e-9) {
            if (s.vy <= 0 && py >= top - 1e-6) { s.y = top; s.vy = 0; s.grounded = true; }
            else if (s.vy > 0 && py + 1 <= b.y + 1e-6) {
              if (s.mode === 'ship') { s.y = b.y - 1; s.vy = 0; } else { kill(s); return; }
            } else { kill(s); return; }
          }
        }
      }
    }
    if (s.y <= 0) { s.y = 0; if (s.vy < 0) s.vy = 0; s.grounded = true; }
    if (s.ceil != null && s.y + 1 > s.ceil) { s.y = s.ceil - 1; if (s.vy > 0) s.vy = 0; }

    // spikes, pads, orbs, coins
    var hx0 = s.x + 0.12, hx1 = s.x + 0.88, hy0 = s.y + 0.12, hy1 = s.y + 0.88;
    for (k = k0; k <= k1; k++) {
      list = P.cols[k]; if (!list) continue;
      for (i = 0; i < list.length; i++) {
        b = list[i];
        if (b.t === 's') {
          if (noclip) continue;
          var sy0 = b.flip ? b.y + 0.45 : b.y;
          if (hx1 > b.x + 0.3 && hx0 < b.x + 0.7 && hy1 > sy0 && hy0 < sy0 + 0.55) { kill(s); return; }
        } else if (b.t === 'p') {
          if (s.x + 1 > b.x + 0.1 && s.x < b.x + 0.9 && s.y < b.y + 0.3 && s.y + 1 > b.y && s.vy <= 0) {
            s.vy = C.PAD; s.grounded = false; ev(s, 'pad');
          }
        } else if (b.t === 'o') {
          if (press && s.lastOrb !== b.id && s.x + 1 > b.x + 0.15 && s.x < b.x + 0.85 && s.y + 1 > b.y + 0.15 && s.y < b.y + 0.85) {
            s.vy = C.ORB; s.lastOrb = b.id; s.grounded = false; ev(s, 'orb');
          }
        } else if (b.t === 'c') {
          if (s.coins.indexOf(b.id) < 0 && s.x + 1 > b.x + 0.1 && s.x < b.x + 0.9 && s.y + 1 > b.y + 0.1 && s.y < b.y + 0.9) {
            s.coins.push(b.id); ev(s, 'coin');
          }
        }
      }
    }
    while (s.portalIdx < P.portals.length && P.portals[s.portalIdx].x + 0.5 <= s.x + 0.5) {
      applyPortal(s, P.portals[s.portalIdx]); s.portalIdx++; ev(s, 'portal');
    }

    if (s.mode === 'cube') { if (!s.grounded) s.rot += 4.5 * DT; }
    s.prevHold = hold;
    if (s.x >= L.len) { s.won = true; ev(s, 'win'); }
  }

  /* Depth-first search for an input sequence (one boolean per 60 Hz frame) that finishes the level. */
  function solve(level, opts, maxNodes, from) {
    maxNodes = maxNodes || 3000000;
    var so = {}; for (var k in (opts || {})) so[k] = opts[k];
    so.noEvents = true; so.noclip = false; so.infJump = false;
    var root;
    if (from) { root = cloneState(from); root.opts = so; root.prevHold = false; root.events = []; } else root = createState(level, so, 0);
    var seen = new Set();
    var stack = [{ s: root, i: 0 }];
    var inputs = [];
    var nodes = 0;
    solve.deepest = 0;
    function key(s, f) {
      return f + '|' + Math.round(s.y * 16) + '|' + Math.round(s.vy * 3) + '|' + (s.grounded ? 1 : 0) + '|' + (s.prevHold ? 1 : 0) + '|' + s.lastOrb + '|' + s.portalIdx;
    }
    while (stack.length) {
      var n = stack[stack.length - 1];
      if (n.i >= 2) { stack.pop(); inputs.pop(); continue; }
      var hold = n.i === 1; n.i++;
      var c = cloneState(n.s);
      for (var j = 0; j < SUB && !c.dead && !c.won; j++) step(c, hold);
      if (c.dead) continue;
      if (c.won) { inputs.push(hold); return inputs.slice(); }
      var f = stack.length;
      if (f > solve.deepest) solve.deepest = f;
      var kk = key(c, f);
      if (seen.has(kk)) continue;
      seen.add(kk);
      if (++nodes > maxNodes) return null;
      stack.push({ s: c, i: 0 });
      inputs.push(hold);
    }
    return null;
  }

  var api = { safeStart: safeStart, DT: DT, SUB: SUB, C: C, prepare: prepare, modeAt: modeAt, createState: createState, cloneState: cloneState, step: step, solve: solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : this);
