/* Block Dash - deterministic physics engine (no DOM). Shared by the game and the level validator.
   Modes: cube, ship, ball, ufo, wave. Gravity can be flipped (grav = -1). */
(function (root) {
  'use strict';

  var DT = 1 / 120; // fixed physics step
  var SUB = 2;      // physics steps per input decision (60 Hz)
  var C = {
    G: 36, JUMP: 12.6, FALL: 24,
    PAD: 17.5, PAD_P: 10.5, PAD_B: 6,
    ORB: 12.2, ORB_P: 9.4, ORB_B: 5,
    SHIP_UP: 40, SHIP_DN: 34, SHIP_VMAX: 9, SHIP_VMIN: -10,
    BALL_G: 30, BALL_FLIP: 4,
    UFO_G: 30, UFO_V: 10, UFO_FALL: 14,
    WAVE_SIZE: 0.5, CEIL: 10, STEP_UP: 0.12
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
      else {
        if (o.t === 'c') P.coins.push(o);
        addCol(o, o.t === 'b' ? o.w : 1);
      }
    });
    P.portals.sort(function (a, b) { return a.x - b.x; });
    level._p = P;
    return P;
  }

  function applyPortal(s, p) {
    if (p.mode) {
      var old = s.sz;
      s.mode = p.mode;
      s.sz = p.mode === 'wave' ? C.WAVE_SIZE : 1;
      s.y = Math.max(0, s.y + (old - s.sz) / 2);
      s.ceil = p.ceil !== undefined ? p.ceil : (p.mode === 'cube' ? null : C.CEIL);
      if (s.ceil != null && s.y + s.sz > s.ceil) s.y = s.ceil - s.sz;
      if (p.mode === 'ship' || p.mode === 'ufo') s.vy *= 0.5;
    }
    if (p.grav && p.grav !== s.grav) { s.grav = p.grav; s.vy *= 0.5; }
    if (p.grav && p.ceil !== undefined) s.ceil = p.ceil;
    if (p.spd) s.spd = p.spd;
  }

  function createState(level, opts, startX) {
    var P = prepare(level);
    startX = startX || 0;
    var s = {
      level: level, P: P, opts: opts || {}, x: startX, y: 0, vy: 0, mode: 'cube', grav: 1, spd: 1, sz: 1, ceil: null,
      grounded: true, prevHold: false, dead: false, won: false, t: 0, portalIdx: 0,
      lastOrb: -1, lastPad: -1, coins: [], rot: 0, events: []
    };
    while (s.portalIdx < P.portals.length && P.portals[s.portalIdx].x + 0.5 <= startX) {
      applyPortal(s, P.portals[s.portalIdx]); s.portalIdx++;
    }
    if (s.grav < 0) s.y = (s.ceil != null ? s.ceil : 1) - s.sz;
    return s;
  }

  /* physics state just after crossing every portal up to x (used for "start position") */
  function stateAt(level, x) {
    var s = createState(level, { noEvents: true }, x);
    return { mode: s.mode, grav: s.grav, ceil: s.ceil };
  }

  /* Nearest start position at or before `target` that is plain ground cube and not inside an obstacle. */
  function safeStart(level, target) {
    var P = prepare(level);
    function clear(x0, x1) {
      for (var k = Math.floor(x0); k <= Math.floor(x1); k++) {
        var l = P.cols[k]; if (!l) continue;
        for (var i = 0; i < l.length; i++) if (l[i].t !== 'c') return false;
      }
      for (var j = 0; j < P.portals.length; j++) if (P.portals[j].x >= x0 && P.portals[j].x <= x1) return false;
      return true;
    }
    function plain(x) { var st = stateAt(level, x); return st.mode === 'cube' && st.grav === 1 && st.ceil == null; }
    var x = Math.floor(target);
    while (x > 4) {
      if (!plain(x)) {
        var px = null;
        for (var i = P.portals.length - 1; i >= 0; i--) if (P.portals[i].x <= x) { px = P.portals[i].x; break; }
        if (px == null) return 0;
        x = Math.floor(px) - 1;
        continue;
      }
      if (clear(x - 1, x + 7)) return x;
      x--;
    }
    return 0;
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
  function clampFall(s, f) { if (s.grav > 0) { if (s.vy < -f) s.vy = -f; } else if (s.vy > f) s.vy = f; }

  function step(s, hold) {
    if (s.dead || s.won) return;
    var o = s.opts, L = s.level, P = s.P, m = s.mode, gv = s.grav;
    var press = hold && !s.prevHold;
    var vx = L.speed * s.spd * (o.speed || 1);
    var noclip = !!o.noclip;

    if (m === 'cube') {
      if (hold && (s.grounded || (o.infJump && press))) { s.vy = C.JUMP * gv; s.grounded = false; ev(s, 'jump'); }
      s.vy -= C.G * gv * DT; clampFall(s, C.FALL);
    } else if (m === 'ship') {
      s.vy += (hold ? C.SHIP_UP : -C.SHIP_DN) * gv * DT;
      var hi = gv > 0 ? C.SHIP_VMAX : -C.SHIP_VMIN, lo = gv > 0 ? C.SHIP_VMIN : -C.SHIP_VMAX;
      if (s.vy > hi) s.vy = hi; if (s.vy < lo) s.vy = lo;
    } else if (m === 'ball') {
      if (hold && (s.grounded || (o.infJump && press)) && !(s.ballLock && !press)) {
        s.grav = gv = -gv; s.vy = -gv * C.BALL_FLIP; s.grounded = false; s.ballLock = true; ev(s, 'jump');
      }
      if (!hold) s.ballLock = false;
      s.vy -= C.BALL_G * gv * DT; clampFall(s, C.FALL);
    } else if (m === 'ufo') {
      if (press) { s.vy = C.UFO_V * gv; s.grounded = false; ev(s, 'jump'); }
      s.vy -= C.UFO_G * gv * DT; clampFall(s, C.UFO_FALL);
    } else { // wave
      s.vy = (hold ? 1 : -1) * gv * vx;
    }
    s.grounded = false;
    s.x += vx * DT;
    s.t += DT;

    var i, k, list, b, top, sz = s.sz;
    var k0 = Math.floor(s.x), k1 = Math.floor(s.x + sz - 1e-6);

    // horizontal collisions
    if (!noclip) {
      for (k = k0; k <= k1; k++) {
        list = P.cols[k]; if (!list) continue;
        for (i = 0; i < list.length; i++) {
          b = list[i]; if (b.t !== 'b') continue;
          top = b.y + b.h;
          if (s.x < b.x + b.w - 1e-9 && s.x + sz > b.x + 1e-9 && s.y < top - 1e-9 && s.y + sz > b.y + 1e-9) {
            if (gv > 0 && s.y >= top - C.STEP_UP) { s.y = top; if (s.vy < 0) s.vy = 0; s.grounded = true; }
            else if (gv < 0 && s.y + sz <= b.y + C.STEP_UP) { s.y = b.y - sz; if (s.vy > 0) s.vy = 0; s.grounded = true; }
            else { kill(s); return; }
          }
        }
      }
    }
    var py = s.y;

    // vertical movement + collisions
    s.y += s.vy * DT;
    if (!noclip) {
      for (k = k0; k <= k1; k++) {
        list = P.cols[k]; if (!list) continue;
        for (i = 0; i < list.length; i++) {
          b = list[i]; if (b.t !== 'b') continue;
          top = b.y + b.h;
          if (s.x < b.x + b.w - 1e-9 && s.x + sz > b.x + 1e-9 && s.y < top - 1e-9 && s.y + sz > b.y + 1e-9) {
            if (s.vy <= 0 && py >= top - 1e-6) {
              s.y = top; s.vy = 0;
              if (gv > 0) s.grounded = true; else if (m === 'cube') { kill(s); return; }
            } else if (s.vy >= 0 && py + sz <= b.y + 1e-6) {
              s.y = b.y - sz; s.vy = 0;
              if (gv < 0) s.grounded = true; else if (m === 'cube') { kill(s); return; }
            } else { kill(s); return; }
          }
        }
      }
    }
    if (s.y <= 0) { s.y = 0; if (s.vy < 0) s.vy = 0; if (gv > 0) s.grounded = true; }
    if (s.ceil != null && s.y + sz > s.ceil) { s.y = s.ceil - sz; if (s.vy > 0) s.vy = 0; if (gv < 0) s.grounded = true; }
    if (s.y > (s.ceil != null ? s.ceil + 1 : 16)) { kill(s); return; }

    // spikes, pads, orbs, coins
    var sh = sz * (m === 'wave' ? 0.2 : 0.12);
    var hx0 = s.x + sh, hx1 = s.x + sz - sh, hy0 = s.y + sh, hy1 = s.y + sz - sh;
    var padHit = false;
    for (k = k0; k <= k1; k++) {
      list = P.cols[k]; if (!list) continue;
      for (i = 0; i < list.length; i++) {
        b = list[i];
        if (b.t === 's') {
          if (noclip) continue;
          var hgt = b.sm ? 0.3 : 0.55, sy0 = b.flip ? b.y + 1 - hgt : b.y, wx = b.sm ? 0.25 : 0.3;
          if (hx1 > b.x + wx && hx0 < b.x + 1 - wx && hy1 > sy0 && hy0 < sy0 + hgt) { kill(s); return; }
        } else if (b.t === 'p') {
          if (m === 'wave') continue;
          var p0 = b.flip ? b.y + 0.7 : b.y;
          if (s.x + sz > b.x + 0.1 && s.x < b.x + 0.9 && s.y < p0 + 0.3 && s.y + sz > p0) {
            padHit = true;
            if (s.lastPad !== b.id && s.vy * gv <= 0.01) {
              s.lastPad = b.id; s.grounded = false;
              if (b.kind === 'b') { s.grav = gv = -gv; s.vy = -gv * C.PAD_B; }
              else s.vy = (b.kind === 'p' ? C.PAD_P : C.PAD) * gv;
              ev(s, 'pad');
            }
          }
        } else if (b.t === 'o') {
          if (m === 'wave') continue;
          if (press && s.lastOrb !== b.id && s.x + sz > b.x + 0.15 && s.x < b.x + 0.85 && s.y + sz > b.y + 0.15 && s.y < b.y + 0.85) {
            s.lastOrb = b.id; s.grounded = false;
            if (b.kind === 'b') { s.grav = gv = -gv; s.vy = -gv * C.ORB_B; }
            else s.vy = (b.kind === 'p' ? C.ORB_P : C.ORB) * gv;
            if (m === 'ball') s.ballLock = true;
            ev(s, 'orb');
          }
        } else if (b.t === 'c') {
          if (s.coins.indexOf(b.id) < 0 && s.x + sz > b.x + 0.1 && s.x < b.x + 0.9 && s.y + sz > b.y + 0.1 && s.y < b.y + 0.9) {
            s.coins.push(b.id); ev(s, 'coin');
          }
        }
      }
    }
    if (!padHit) s.lastPad = -1;
    while (s.portalIdx < P.portals.length && P.portals[s.portalIdx].x + 0.5 <= s.x + 0.5) {
      applyPortal(s, P.portals[s.portalIdx]); s.portalIdx++; ev(s, 'portal');
    }

    if (s.mode === 'cube') { if (!s.grounded) s.rot += 4.5 * DT * s.grav; }
    else if (s.mode === 'ball') s.rot += vx * 2 * DT * s.grav;
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
      return f + '|' + Math.round(s.y * 16) + '|' + Math.round(s.vy * 3) + '|' + (s.grounded ? 1 : 0) + '|' + (s.prevHold ? 1 : 0) + '|' +
        s.lastOrb + '|' + s.lastPad + '|' + s.portalIdx + '|' + s.grav + '|' + (s.ballLock ? 1 : 0);
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
      if (f > solve.deepest) { solve.deepest = f; solve.deepestX = c.x; solve.deepestState = c; }
      var kk = key(c, f);
      if (seen.has(kk)) continue;
      seen.add(kk);
      if (++nodes > maxNodes) return null;
      stack.push({ s: c, i: 0 });
      inputs.push(hold);
    }
    return null;
  }

  var api = { DT: DT, SUB: SUB, C: C, prepare: prepare, stateAt: stateAt, safeStart: safeStart, createState: createState, cloneState: cloneState, step: step, solve: solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : this);
