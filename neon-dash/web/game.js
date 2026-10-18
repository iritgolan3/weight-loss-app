/* Neon Dash - rendering, UI, audio, save data and cheats. */
(function () {
  'use strict';
  var E = Engine, LEVELS = window.LEVELS;
  var $ = function (id) { return document.getElementById(id); };
  var PI2 = Math.PI * 2;

  /* ---------------------------------------------------------------- save data */
  var KEY = 'neondash.save.v1';
  var COLORS = ['#ffffff', '#c8c8c8', '#6b6b6b', '#111111', '#ff3d3d', '#ff8a3d', '#ffd23d', '#e6ff3d', '#7dff3d', '#3dffb0', '#37e0ff', '#3d8aff', '#6b4dff', '#b04dff', '#ff5fd2', '#ff3d8a', '#8a5a2b', '#ffb88a'];
  var CUBES = 12, SHIPS = 6;
  function defaults() {
    return {
      stars: 0, orbs: 0, diamonds: 0, coins: 0, levels: {},
      icon: { cube: 0, ship: 0, c1: 10, c2: 14 },
      cheats: { noclip: false, infJump: false, hitbox: false, auto: false, speed: 1, startPct: 0, music: true, sfx: true }
    };
  }
  var sv = defaults();
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw), b = defaults();
        sv = Object.assign(b, d);
        sv.icon = Object.assign(b.icon, d.icon || {});
        sv.cheats = Object.assign(defaults().cheats, d.cheats || {});
      }
    } catch (e) { /* storage unavailable */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* ignore */ } }
  function lv(id) { return sv.levels[id] || (sv.levels[id] = { best: 0, done: false, coins: [false, false, false] }); }
  load();

  /* ---------------------------------------------------------------- audio */
  var Snd = {
    ctx: null, master: null, timer: null, next: 0, idx: 0, lvl: null,
    init: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.45; this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    tone: function (f, t, d, type, v, f2) {
      var c = this.ctx; if (!c) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.02);
    },
    noise: function (t, d, v, hp) {
      var c = this.ctx; if (!c) return;
      var n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), a = buf.getChannelData(0);
      for (var i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = c.createBufferSource(); s.buffer = buf;
      var g = c.createGain(); g.gain.value = v;
      var f = c.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp ? 6000 : 900;
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
    },
    sfx: function (name) {
      if (!sv.cheats.sfx || !this.ctx) return;
      var t = this.ctx.currentTime;
      switch (name) {
        case 'jump': this.tone(380, t, 0.09, 'square', 0.05, 760); break;
        case 'pad': this.tone(300, t, 0.2, 'sawtooth', 0.07, 1200); break;
        case 'orb': this.tone(600, t, 0.12, 'triangle', 0.1, 1400); break;
        case 'coin': this.tone(988, t, 0.08, 'square', 0.07); this.tone(1319, t + 0.07, 0.18, 'square', 0.07); break;
        case 'portal': this.tone(200, t, 0.35, 'sawtooth', 0.08, 900); break;
        case 'die': this.noise(t, 0.35, 0.5, false); this.tone(220, t, 0.3, 'sawtooth', 0.12, 40); break;
        case 'win': [523, 659, 784, 1047].forEach(function (f, i) { Snd.tone(f, t + i * 0.12, 0.4, 'triangle', 0.12); }); break;
        case 'click': this.tone(700, t, 0.05, 'square', 0.04); break;
      }
    },
    startMusic: function (L) {
      this.stopMusic();
      if (!sv.cheats.music || !this.ctx) return;
      this.lvl = L; this.idx = 0; this.next = this.ctx.currentTime + 0.08;
      var self = this;
      this.timer = setInterval(function () { self.pump(); }, 40);
    },
    stopMusic: function () { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
    pump: function () {
      var c = this.ctx, L = this.lvl; if (!c || !L) return;
      var sd = 60 / L.bpm / 4;
      while (this.next < c.currentTime + 0.18) {
        var i = this.idx, t = this.next, bar = (i >> 4) & 3, st = i & 15;
        var base = 55 * Math.pow(2, ((L.id * 5) % 12) / 12);
        var root = base * Math.pow(2, [0, 8, 3, 10][bar] / 12);
        if (st % 4 === 0) { this.tone(140, t, 0.14, 'sine', 0.35, 40); }
        if (st % 4 === 2) this.noise(t, 0.04, 0.12, true);
        if (st % 2 === 0) this.tone(root, t, sd * 1.8, 'triangle', 0.22);
        var arp = [0, 3, 7, 12, 7, 3, 10, 15][(st + L.id) % 8];
        if (i >= 32 || st % 2 === 0) this.tone(root * 4 * Math.pow(2, arp / 12), t, sd * 0.9, 'square', 0.03);
        this.idx++; this.next += sd;
      }
    }
  };

  /* ---------------------------------------------------------------- icons */
  function cubeIcon(g, style, c1, c2, s) {
    g.save();
    g.fillStyle = c1; g.fillRect(-s / 2, -s / 2, s, s);
    g.fillStyle = c2; g.strokeStyle = c2; g.lineWidth = s * 0.1;
    var q = s / 8;
    switch (style) {
      case 0: g.fillRect(-2.6 * q, -2 * q, 1.8 * q, 1.8 * q); g.fillRect(0.8 * q, -2 * q, 1.8 * q, 1.8 * q); g.fillRect(-2 * q, 1.4 * q, 4 * q, 1.2 * q); break;
      case 1: g.fillRect(-2 * q, -2 * q, 4 * q, 4 * q); break;
      case 2: g.fillRect(-0.7 * q, -3.4 * q, 1.4 * q, 6.8 * q); g.fillRect(-3.4 * q, -0.7 * q, 6.8 * q, 1.4 * q); break;
      case 3: g.beginPath(); g.moveTo(-s / 2, s / 2); g.lineTo(s / 2, -s / 2); g.lineTo(s / 2, -s / 6); g.lineTo(-s / 6, s / 2); g.closePath(); g.fill(); break;
      case 4: g.fillRect(-3.4 * q, -2 * q, 6.8 * q, 1.8 * q); g.fillStyle = '#000'; g.fillRect(-2.4 * q, -1.7 * q, 1.2 * q, 1.2 * q); g.fillRect(1.2 * q, -1.7 * q, 1.2 * q, 1.2 * q); break;
      case 5: for (var a = -1; a <= 1; a += 2) for (var b = -1; b <= 1; b += 2) g.fillRect(a * 1.8 * q - q * 0.8, b * 1.8 * q - q * 0.8, 1.6 * q, 1.6 * q); break;
      case 6: g.beginPath(); g.moveTo(0, -3 * q); g.lineTo(3 * q, 2.6 * q); g.lineTo(-3 * q, 2.6 * q); g.closePath(); g.fill(); break;
      case 7: g.beginPath(); g.arc(0, 0, 2.6 * q, 0, PI2); g.stroke(); break;
      case 8: g.strokeRect(-2.8 * q, -2.8 * q, 5.6 * q, 5.6 * q); break;
      case 9: for (var r = -2; r <= 2; r += 2) g.fillRect(-3.4 * q, r * q - 0.5 * q, 6.8 * q, q); break;
      case 10: g.beginPath(); g.moveTo(-3 * q, -1 * q); g.lineTo(0, -3.4 * q); g.lineTo(3 * q, -1 * q); g.lineTo(3 * q, 1 * q); g.lineTo(0, -1.4 * q); g.lineTo(-3 * q, 1 * q); g.closePath(); g.fill(); break;
      default: g.beginPath(); g.moveTo(0, -3.4 * q); g.lineTo(2.4 * q, 0); g.lineTo(0, 3.4 * q); g.lineTo(-2.4 * q, 0); g.closePath(); g.fill();
    }
    g.strokeStyle = '#000'; g.lineWidth = s * 0.08; g.strokeRect(-s / 2, -s / 2, s, s);
    g.restore();
  }
  function shipIcon(g, style, c1, c2, s) {
    g.save();
    g.fillStyle = c2; g.strokeStyle = '#000'; g.lineWidth = s * 0.06;
    var cs = s * 0.48;
    g.fillRect(-cs / 2, -s * 0.46, cs, cs); g.strokeRect(-cs / 2, -s * 0.46, cs, cs);
    g.fillStyle = c1;
    g.beginPath();
    var tail = [0.55, 0.62, 0.5, 0.7, 0.58, 0.64][style % 6];
    g.moveTo(-s * 0.55, -s * 0.05); g.lineTo(s * 0.5, -s * 0.05);
    g.lineTo(s * 0.62, s * 0.05 + (style % 2) * s * 0.06); g.lineTo(s * 0.35, s * 0.3); g.lineTo(-s * 0.4, s * 0.3);
    g.lineTo(-s * tail, s * 0.06 - (style % 3) * s * 0.06); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c2; g.fillRect(-s * 0.2, s * 0.08, s * 0.4, s * 0.08);
    g.restore();
  }

  /* ---------------------------------------------------------------- canvas / renderer */
  var cv = $('c'), g = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1, T = 40, gY = 0;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    T = Math.min(H / 12.2, W / 16); gY = H - 1.4 * T;
  }
  window.addEventListener('resize', resize); resize();

  var G = {
    mode: 'menu', level: null, s: null, attempts: 1, practice: false, cps: [], particles: [], trail: [],
    camX: 0, camY: 0, vrot: 0, acc: 0, stepN: 0, hold: false, deadT: 0, auto: null, paused: false,
    shake: 0, last: 0, frame: 0, flash: 0, menuX: 16, cpT: 0, bgLevel: LEVELS[0], msg: ''
  };

  function X(wx) { return (wx - G.camX) * T; }
  function Y(wy) { return gY + G.camY * T - wy * T; }

  function pal() { return (G.level || G.bgLevel).palette; }
  function beat() {
    if (Snd.ctx && Snd.timer && G.level) return 1 - (((Snd.ctx.currentTime * G.level.bpm / 60) % 1 + 1) % 1);
    return 0.4 + 0.3 * Math.sin(performance.now() / 400);
  }

  function drawBackground() {
    var p = pal(), b = beat();
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, p[0]); gr.addColorStop(1, p[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = 0.08 + b * 0.1; g.fillStyle = p[2];
    var off = -(G.camX * 0.25 * T) % (T * 6);
    for (var i = -1; i < W / (T * 6) + 2; i++) {
      var bx = off + i * T * 6, hh = H * (0.35 + 0.25 * Math.sin((i + Math.floor(G.camX * 0.25 / 6)) * 1.7));
      g.fillRect(bx, gY + G.camY * T - hh, T * 2.2, hh);
    }
    g.restore();
    g.save(); g.globalAlpha = 0.07; g.strokeStyle = p[2]; g.lineWidth = 1; g.beginPath();
    var go = -(G.camX * 0.5 * T) % (T * 2);
    for (var x = go; x < W; x += T * 2) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (var y = (gY + G.camY * T) % (T * 2); y < H; y += T * 2) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke(); g.restore();
  }

  function drawGround(s) {
    var p = pal(), y0 = Y(0);
    g.fillStyle = p[1]; g.fillRect(0, y0, W, H - y0 + 2);
    g.save(); g.globalAlpha = 0.18; g.fillStyle = p[2];
    var off = -(G.camX * T) % (T * 2);
    for (var x = off; x < W; x += T * 2) g.fillRect(x, y0, T, H - y0);
    g.restore();
    g.fillStyle = p[2]; g.fillRect(0, y0 - 2, W, 4);
    g.save(); g.globalAlpha = 0.25; g.fillRect(0, y0 - 8, W, 8); g.restore();
    if (s && s.ceil != null) {
      var yc = Y(s.ceil);
      g.fillStyle = p[1]; g.fillRect(0, 0, W, Math.max(0, yc));
      g.fillStyle = p[2]; g.fillRect(0, yc - 2, W, 4);
    }
  }

  function drawObject(o, hb) {
    var p = pal(), x, y;
    if (o.t === 'b') {
      x = X(o.x); y = Y(o.y + o.h);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, y, o.w * T, o.h * T);
      g.strokeStyle = p[2]; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, o.w * T - 2, o.h * T - 2);
      g.globalAlpha = 0.28; g.lineWidth = 1;
      g.beginPath();
      for (var i = 1; i < o.w; i++) { g.moveTo(x + i * T, y); g.lineTo(x + i * T, y + o.h * T); }
      for (var j = 1; j < o.h; j++) { g.moveTo(x, y + j * T); g.lineTo(x + o.w * T, y + j * T); }
      g.stroke(); g.globalAlpha = 1;
      if (hb) { g.strokeStyle = '#3dffb0'; g.strokeRect(x, y, o.w * T, o.h * T); }
    } else if (o.t === 's') {
      x = X(o.x); y = Y(o.y + 1);
      g.beginPath();
      if (o.flip) { g.moveTo(x + 2, y + 1); g.lineTo(x + T - 2, y + 1); g.lineTo(x + T / 2, y + T - 1); }
      else { g.moveTo(x + 2, y + T - 1); g.lineTo(x + T - 2, y + T - 1); g.lineTo(x + T / 2, y + 1); }
      g.closePath(); g.fillStyle = 'rgba(0,0,0,0.7)'; g.fill();
      g.strokeStyle = '#ff4a6a'; g.lineWidth = 2.5; g.stroke();
      if (hb) { g.strokeStyle = '#ff3d3d'; g.lineWidth = 1; g.strokeRect(x + 0.3 * T, Y(o.y + (o.flip ? 1 : 0.55)), 0.4 * T, 0.55 * T); }
    } else if (o.t === 'p') {
      x = X(o.x); y = Y(o.y + 0.3);
      g.fillStyle = '#ffd23d'; g.fillRect(x + 0.1 * T, y, 0.8 * T, 0.3 * T);
      g.globalAlpha = 0.3; g.fillRect(x, y - 4, T, 0.3 * T + 8); g.globalAlpha = 1;
    } else if (o.t === 'o') {
      x = X(o.x + 0.5); y = Y(o.y + 0.5);
      var pu = 1 + 0.1 * Math.sin(performance.now() / 120 + o.x);
      g.fillStyle = '#ffd23d'; g.beginPath(); g.arc(x, y, 0.28 * T * pu, 0, PI2); g.fill();
      g.strokeStyle = '#fff6b0'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 0.42 * T * pu, 0, PI2); g.stroke();
    } else if (o.t === 'c') {
      if (G.s && G.s.coins.indexOf(o.id) >= 0) return;
      x = X(o.x + 0.5); y = Y(o.y + 0.5);
      var done = lv(G.level.id).coins[G.level.objects.filter(function (q) { return q.t === 'c'; }).indexOf(o)];
      g.globalAlpha = done ? 0.4 : 1;
      g.fillStyle = '#ffd23d'; g.beginPath(); g.arc(x, y, 0.36 * T, 0, PI2); g.fill();
      g.strokeStyle = '#8a6a00'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#8a6a00'; g.font = 'bold ' + (0.45 * T) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C', x, y + 1);
      g.globalAlpha = 1;
    } else if (o.t === 'g') {
      x = X(o.x + 0.5);
      var ship = o.mode === 'ship', col = ship ? '#ff5fd2' : '#37e0ff';
      var cy = ship ? Y(2.5) : Y(5), hh = (ship ? 2.6 : 5.2) * T;
      g.save(); g.globalAlpha = 0.14; g.fillStyle = col; g.fillRect(x - 3, 0, 6, H); g.restore();
      g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.ellipse(x, cy, 0.5 * T, hh, 0, 0, PI2); g.stroke();
      g.globalAlpha = 0.25; g.fillStyle = col; g.fill(); g.globalAlpha = 1;
    }
  }

  function drawFinish(L) {
    var x = X(L.len);
    g.save(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, 0, W, H);
    g.fillStyle = '#fff';
    for (var i = 0; i < 14; i++) if (i % 2 === 0) g.fillRect(x, Y(0) - (i + 1) * T, 8, T); else g.fillRect(x + 8, Y(0) - (i + 1) * T, 8, T);
    g.restore();
  }

  function drawPlayer(s) {
    var ic = sv.icon, c1 = COLORS[ic.c1], c2 = COLORS[ic.c2];
    var cx = X(s.x + 0.5), cy = Y(s.y + 0.5);
    g.save(); g.translate(cx, cy);
    g.shadowColor = c1; g.shadowBlur = 12;
    if (s.mode === 'cube') {
      g.rotate(G.vrot);
      cubeIcon(g, ic.cube, c1, c2, T);
    } else {
      g.rotate(-Math.atan2(s.vy, 14));
      shipIcon(g, ic.ship, c1, c2, T * 1.15);
    }
    g.restore();
    if (sv.cheats.hitbox) {
      g.strokeStyle = '#3dffb0'; g.lineWidth = 1.5; g.strokeRect(X(s.x), Y(s.y + 1), T, T);
      g.strokeStyle = '#ff3d3d'; g.strokeRect(X(s.x + 0.12), Y(s.y + 0.88), 0.76 * T, 0.76 * T);
    }
  }

  function render(dt) {
    var s = G.s, play = G.mode === 'play' && s;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (play) {
      G.camX = s.x - 5.5;
      var target = s.mode === 'ship' ? 0 : Math.max(0, s.y - 6);
      G.camY += (target - G.camY) * Math.min(1, dt * 6);
      var tgt = s.grounded ? Math.round(s.rot / (Math.PI / 2)) * (Math.PI / 2) : s.rot;
      G.vrot = s.grounded ? G.vrot + (tgt - G.vrot) * Math.min(1, dt * 22) : s.rot;
    } else {
      G.menuX += dt * 7; if (G.menuX > 180) G.menuX = 16;
      G.camX = G.menuX; G.camY = 0;
    }
    g.save();
    if (G.shake > 0) { g.translate((Math.random() - 0.5) * G.shake * 40, (Math.random() - 0.5) * G.shake * 40); G.shake = Math.max(0, G.shake - dt); }
    drawBackground();
    drawGround(play ? s : null);
    var L = G.level || G.bgLevel, P = E.prepare(L), hb = sv.cheats.hitbox && play;
    G.frame++;
    var k0 = Math.floor(G.camX) - 2, k1 = Math.floor(G.camX + W / T) + 2;
    for (var k = k0; k <= k1; k++) {
      var list = P.cols[k]; if (!list) continue;
      for (var i = 0; i < list.length; i++) {
        var o = list[i]; if (o._f === G.frame) continue; o._f = G.frame;
        if (play || o.t !== 'c') drawObject(o, hb);
      }
    }
    for (var q = 0; q < P.portals.length; q++) { var pp = P.portals[q]; if (pp.x > k0 && pp.x < k1) drawObject(pp, false); }
    if (play) {
      drawFinish(L);
      g.fillStyle = 'rgba(255,255,255,' + Math.max(0, 1 - Math.abs(s.x - 2) / 8).toFixed(2) + ')';
      g.font = 'bold ' + Math.round(T * 1.1) + 'px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText('Attempt ' + G.attempts, X(3), Y(5));
    }
    // trail
    for (var t = G.trail.length - 1; t >= 0; t--) {
      var tr = G.trail[t]; tr.life -= dt;
      if (tr.life <= 0) { G.trail.splice(t, 1); continue; }
      g.globalAlpha = tr.life / 0.35 * 0.5; g.fillStyle = COLORS[sv.icon.c1];
      var sz = T * 0.3 * (tr.life / 0.35);
      g.fillRect(X(tr.x) - sz / 2, Y(tr.y) - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
    if (play && !s.dead) {
      if (!G.paused && G.frame % 2 === 0) G.trail.push({ x: s.x + 0.1, y: s.y + 0.15, life: 0.35 });
      drawPlayer(s);
    }
    // particles
    for (var n = G.particles.length - 1; n >= 0; n--) {
      var a = G.particles[n]; a.life -= dt;
      if (a.life <= 0) { G.particles.splice(n, 1); continue; }
      a.vy -= 30 * dt; a.x += a.vx * dt; a.y += a.vy * dt;
      g.globalAlpha = Math.min(1, a.life / a.max * 1.5); g.fillStyle = a.c;
      g.fillRect(X(a.x) - a.s * T / 2, Y(a.y) - a.s * T / 2, a.s * T, a.s * T);
    }
    g.globalAlpha = 1;
    g.restore();
    if (G.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + G.flash.toFixed(2) + ')'; g.fillRect(0, 0, W, H); G.flash = Math.max(0, G.flash - dt * 3); }
  }

  function explode(s) {
    for (var i = 0; i < 28; i++) {
      var a = Math.random() * PI2, v = 4 + Math.random() * 9;
      G.particles.push({ x: s.x + 0.5, y: s.y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 3, life: 0.7 + Math.random() * 0.4, max: 1, s: 0.12 + Math.random() * 0.2, c: Math.random() < 0.5 ? COLORS[sv.icon.c1] : COLORS[sv.icon.c2] });
    }
    G.shake = 0.18; G.flash = 0.5;
  }

  /* ---------------------------------------------------------------- game flow */
  function simOpts() {
    var c = sv.cheats;
    return { noclip: c.noclip, infJump: c.infJump, speed: c.speed };
  }
  function lvCoinIds(L) { return L.objects.filter(function (o) { return o.t === 'c'; }).map(function (o) { return o.id; }); }

  function resetRun() {
    var L = G.level, opts = simOpts(), cp = G.practice && G.cps.length ? G.cps[G.cps.length - 1] : null, s;
    if (cp) { s = E.cloneState(cp); s.opts = opts; s.dead = false; s.won = false; }
    else {
      var sx = G.practice || !sv.cheats.startPct ? 0 : E.safeStart(L, sv.cheats.startPct / 100 * (L.len - 20));
      s = E.createState(L, opts, sx);
    }
    s.prevHold = false;
    G.s = s; G.acc = 0; G.stepN = 0; G.deadT = 0; G.auto = null; G.cpT = s.t;
    G.particles.length = 0; G.trail.length = 0;
    if (sv.cheats.auto) {
      var t0 = performance.now();
      G.auto = E.solve(L, opts, 4000000, s);
      if (!G.auto) toast('Auto-play found no route (try speed 1.0x)');
      else if (performance.now() - t0 > 1500) toast('Auto-play ready');
    }
    Snd.startMusic(L);
    cheatTag();
    var p0 = Math.min(100, Math.floor(100 * s.x / L.len));
    $('progress').firstElementChild.style.width = p0 + '%'; $('pct').textContent = p0 + '%';
  }

  function startLevel(L) {
    clearTimeout(G.endT);
    Snd.init(); Snd.sfx('click');
    G.level = L; G.attempts = 1; G.cps = []; G.mode = 'play'; G.paused = false; G.camY = 0; G.vrot = 0;
    show(null); $('hud').classList.add('on');
    $('practiceBtns').classList.toggle('on', G.practice);
    resetRun();
  }

  function cheatTag() {
    var c = sv.cheats, t = [];
    if (c.noclip) t.push('GOD MODE'); if (c.infJump) t.push('INF JUMP'); if (c.auto) t.push('AUTO');
    if (c.speed !== 1) t.push('SPEED ' + c.speed + 'x'); if (c.startPct > 0) t.push('START ' + c.startPct + '%');
    if (G.practice) t.push('PRACTICE');
    $('cheatTag').textContent = t.join('  ·  ');
  }

  function update(dt) {
    var s = G.s; if (!s) return;
    if (s.won) return;
    if (s.dead) {
      G.deadT += dt;
      if (G.deadT > 0.85) { G.attempts++; resetRun(); }
      return;
    }
    G.acc += dt;
    var n = 0;
    while (G.acc >= E.DT && n++ < 20) {
      G.acc -= E.DT;
      var hold = G.auto ? !!G.auto[(G.stepN / E.SUB) | 0] : G.hold;
      E.step(s, hold); G.stepN++;
      for (var i = 0; i < s.events.length; i++) handleEvent(s.events[i]);
      s.events.length = 0;
      if (s.dead || s.won) break;
    }
    if (s.dead || s.won) return;
    var pct = Math.min(100, Math.floor(100 * s.x / G.level.len));
    $('progress').firstElementChild.style.width = pct + '%'; $('pct').textContent = pct + '%';
    if (G.practice && s.t - G.cpT >= 2.5 && (s.grounded || s.mode === 'ship')) { G.cps.push(E.cloneState(s)); G.cpT = s.t; }
  }

  function handleEvent(ev) {
    var s = G.s;
    if (ev === 'jump' || ev === 'pad' || ev === 'orb' || ev === 'coin' || ev === 'portal') {
      Snd.sfx(ev);
      if (ev === 'portal') G.flash = 0.25;
      if (ev === 'pad' || ev === 'orb') for (var i = 0; i < 8; i++) G.particles.push({ x: s.x + 0.5, y: s.y + 0.2, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, life: 0.4, max: 0.4, s: 0.12, c: '#ffd23d' });
    } else if (ev === 'die') {
      Snd.sfx('die'); Snd.stopMusic(); explode(s);
      if (!G.practice) { var rec = lv(G.level.id), pct = Math.floor(100 * s.x / G.level.len); if (pct > rec.best) { rec.best = pct; save(); } }
    } else if (ev === 'win') { onWin(); }
  }

  function onWin() {
    var L = G.level, rec = lv(L.id), s = G.s;
    Snd.stopMusic(); Snd.sfx('win'); G.flash = 0.6;
    $('progress').firstElementChild.style.width = '100%'; $('pct').textContent = '100%';
    var info = '';
    if (G.practice) {
      info = 'Practice run complete - switch practice off to earn rewards.';
    } else {
      var first = !rec.done, ids = lvCoinIds(L), newCoins = 0;
      rec.done = true; rec.best = 100;
      s.coins.forEach(function (id) { var idx = ids.indexOf(id); if (idx >= 0 && !rec.coins[idx]) { rec.coins[idx] = true; newCoins++; } });
      if (first) { sv.stars += L.stars; sv.diamonds += L.stars * 2; sv.orbs += L.stars * 15; }
      sv.coins += newCoins;
      info = (first ? '+' + L.stars + ' stars  +' + (L.stars * 2) + ' diamonds  +' + (L.stars * 15) + ' orbs   ' : '') + 'Coins ' + rec.coins.filter(Boolean).length + '/3   Attempts ' + G.attempts;
      save();
    }
    clearTimeout(G.endT);
    G.endT = setTimeout(function () {
      $('endTitle').textContent = 'Level complete!'; $('endInfo').textContent = info;
      $('eNext').style.display = L.id < LEVELS.length ? '' : 'none';
      show('end');
    }, 700);
  }

  function exitToMenu(screen) {
    clearTimeout(G.endT);
    Snd.stopMusic(); G.mode = 'menu'; G.s = null; G.level = null; G.paused = false; G.hold = false;
    $('hud').classList.remove('on'); show(screen || 'levels'); refresh();
  }
  function pause(on) {
    if (G.mode !== 'play' || (G.s && G.s.won)) return;
    G.paused = on; G.hold = false;
    if (on) { Snd.stopMusic(); show('pause'); $('pPractice').textContent = 'Practice: ' + (G.practice ? 'on' : 'off'); }
    else { show(null); if (G.s && !G.s.dead) Snd.startMusic(G.level); }
  }

  /* ---------------------------------------------------------------- input */
  function inputDown(e) {
    if (G.mode !== 'play' || G.paused) return;
    if (e.target && e.target.closest && e.target.closest('button,.screen.on')) return;
    G.hold = true; if (e.cancelable) e.preventDefault();
  }
  function inputUp() { G.hold = false; }
  window.addEventListener('pointerdown', inputDown, { passive: false });
  window.addEventListener('pointerup', inputUp); window.addEventListener('pointercancel', inputUp);
  window.addEventListener('blur', function () { inputUp(); if (G.mode === 'play' && !G.paused) pause(true); });
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { if (G.mode === 'play' && !G.paused) { G.hold = true; e.preventDefault(); } }
    else if (e.code === 'Escape') { window.__back(); }
  });
  window.addEventListener('keyup', function (e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') G.hold = false; });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------------------------------------------------------------- UI */
  var cur = 'main';
  function show(name) {
    ['main', 'levels', 'garage', 'cheats', 'pause', 'end'].forEach(function (n) { $(n).classList.toggle('on', n === name); });
    cur = name;
    if (name === 'levels') buildCards();
    if (name === 'garage') buildGarage();
    if (name === 'cheats') buildCheats();
    if (name === 'main') refresh();
  }
  function refresh() {
    $('stStar').textContent = sv.stars; $('stOrb').textContent = sv.orbs; $('stDia').textContent = sv.diamonds; $('stCoin').textContent = sv.coins;
    document.querySelectorAll('[data-st=star]').forEach(function (e) { e.textContent = sv.stars; });
    document.querySelectorAll('[data-st=coin]').forEach(function (e) { e.textContent = sv.coins; });
  }
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { Snd.init(); Snd.sfx('click'); show(b.getAttribute('data-go')); });
  });

  function buildCards() {
    var box = $('cards'); box.innerHTML = '';
    LEVELS.forEach(function (L) {
      var r = lv(L.id), d = document.createElement('div');
      d.className = 'card' + (r.done ? ' done' : '');
      var coins = r.coins.map(function (c) { return c ? '<b>◎</b>' : '◎'; }).join('');
      d.innerHTML = '<div class="swatch" style="background:linear-gradient(135deg,' + L.palette[0] + ',' + L.palette[2] + ')"></div>' +
        '<div class="nm">' + L.id + '. ' + L.name + '</div><div class="df" style="color:' + L.palette[2] + '">' + L.diff + ' · ' + L.stars + ' ★</div>' +
        '<div class="bar"><i style="width:' + (r.done ? 100 : r.best) + '%"></i></div><div class="sub" style="margin:0">' + (r.done ? 'Completed' : r.best + '%') + '</div>' +
        '<div class="coins">' + coins + '</div><button class="btn small">Play</button>';
      d.querySelector('button').addEventListener('click', function () { startLevel(L); });
      box.appendChild(d);
    });
  }

  function iconCanvas(kind, idx, parent, onPick, selected) {
    var c = document.createElement('canvas'); c.width = c.height = 96;
    var x = c.getContext('2d'); x.translate(48, 48);
    var c1 = COLORS[sv.icon.c1], c2 = COLORS[sv.icon.c2];
    if (kind === 'cube') cubeIcon(x, idx, c1, c2, 56); else shipIcon(x, idx, c1, c2, 64);
    if (selected) c.className = 'sel';
    c.addEventListener('click', function () { Snd.sfx('click'); onPick(idx); });
    parent.appendChild(c);
  }
  function buildGarage() {
    var pc = $('pickCube'), ps = $('pickShip'), p1 = $('pickC1'), p2 = $('pickC2');
    [pc, ps, p1, p2].forEach(function (e) { e.innerHTML = ''; });
    for (var i = 0; i < CUBES; i++) iconCanvas('cube', i, pc, function (k) { sv.icon.cube = k; save(); buildGarage(); }, sv.icon.cube === i);
    for (i = 0; i < SHIPS; i++) iconCanvas('ship', i, ps, function (k) { sv.icon.ship = k; save(); buildGarage(); }, sv.icon.ship === i);
    COLORS.forEach(function (col, idx) {
      [[p1, 'c1'], [p2, 'c2']].forEach(function (pr) {
        var d = document.createElement('div'); d.className = 'col' + (sv.icon[pr[1]] === idx ? ' sel' : ''); d.style.background = col;
        d.addEventListener('click', function () { sv.icon[pr[1]] = idx; save(); buildGarage(); });
        pr[0].appendChild(d);
      });
    });
    var pv = $('preview').getContext('2d'); pv.setTransform(1, 0, 0, 1, 0, 0); pv.clearRect(0, 0, 220, 220);
    pv.save(); pv.translate(60, 110); cubeIcon(pv, sv.icon.cube, COLORS[sv.icon.c1], COLORS[sv.icon.c2], 70); pv.restore();
    pv.save(); pv.translate(150, 110); shipIcon(pv, sv.icon.ship, COLORS[sv.icon.c1], COLORS[sv.icon.c2], 80); pv.restore();
  }

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.style.display = 'none'; }, 2200);
  }

  function buildCheats() {
    var p = $('cheatPanel'), c = sv.cheats;
    var keep = p.scrollTop;
    p.innerHTML = '';
    function h3(t) { var e = document.createElement('h3'); e.textContent = t; p.appendChild(e); }
    function line(label, desc) {
      var d = document.createElement('div'); d.className = 'line';
      var l = document.createElement('div'); l.innerHTML = label + (desc ? '<small>' + desc + '</small>' : ''); d.appendChild(l); p.appendChild(d); return d;
    }
    function toggle(label, desc, key) {
      var d = line(label, desc), b = document.createElement('button'); b.className = 'tog' + (c[key] ? ' on' : '');
      b.addEventListener('click', function () { c[key] = !c[key]; b.classList.toggle('on', c[key]); save(); if (key === 'music' && !c[key]) Snd.stopMusic(); });
      d.appendChild(b);
    }
    function slider(label, desc, key, min, max, stepv, fmt) {
      var d = line(label + ' <b id="v_' + key + '">' + fmt(c[key]) + '</b>', desc), r = document.createElement('input');
      r.type = 'range'; r.min = min; r.max = max; r.step = stepv; r.value = c[key];
      r.addEventListener('input', function () { c[key] = parseFloat(r.value); $('v_' + key).textContent = fmt(c[key]); save(); });
      d.appendChild(r);
    }
    function num(label, key) {
      var d = line(label), i = document.createElement('input'); i.type = 'number'; i.min = 0; i.max = 999999; i.value = sv[key];
      i.addEventListener('change', function () { sv[key] = Math.max(0, Math.min(999999, parseInt(i.value, 10) || 0)); i.value = sv[key]; save(); });
      d.appendChild(i);
    }
    function btn(label, desc, text, fn, cls) {
      var d = line(label, desc), b = document.createElement('button'); b.className = 'btn small ' + (cls || ''); b.textContent = text;
      b.addEventListener('click', function () { fn(); save(); buildCheats(); }); d.appendChild(b);
    }

    h3('Gameplay cheats');
    toggle('God mode', 'Pass through spikes and blocks (no-clip)', 'noclip');
    toggle('Infinite jump', 'Jump again in mid-air with every tap', 'infJump');
    toggle('Auto-play', 'The game plays the level for you', 'auto');
    toggle('Show hitboxes', 'Debug view of player and hazards', 'hitbox');
    slider('Game speed', 'Scales the whole run', 'speed', 0.25, 2, 0.05, function (v) { return v.toFixed(2) + 'x'; });
    slider('Start position', 'Begin every attempt part-way through the level', 'startPct', 0, 95, 1, function (v) { return v + '%'; });

    h3('Progress');
    btn('Complete every level', 'Marks all levels 100% with all coins and awards the rewards', 'Do it', function () {
      LEVELS.forEach(function (L) {
        var r = lv(L.id);
        if (!r.done) { sv.stars += L.stars; sv.diamonds += L.stars * 2; sv.orbs += L.stars * 15; }
        r.done = true; r.best = 100;
        r.coins.forEach(function (x, i) { if (!x) { r.coins[i] = true; sv.coins++; } });
      });
      toast('All levels completed');
    });
    btn('Max out stats', 'Stars, orbs, diamonds and coins to 99999', 'Max', function () { sv.stars = sv.orbs = sv.diamonds = sv.coins = 99999; toast('Stats maxed'); });
    num('Stars', 'stars'); num('Orbs', 'orbs'); num('Diamonds', 'diamonds'); num('Coins', 'coins');
    btn('Reset all progress', 'Clears levels and stats (keeps icons)', 'Reset', function () {
      var ic = sv.icon, ch = sv.cheats; sv = defaults(); sv.icon = ic; sv.cheats = ch; c = sv.cheats; toast('Progress reset');
    }, 'pink');

    h3('Per-level editor');
    LEVELS.forEach(function (L) {
      var r = lv(L.id), d = document.createElement('div'); d.className = 'lvrow';
      var name = document.createElement('div'); name.innerHTML = L.id + '. ' + L.name + ' <small style="color:#8a93c8">' + (r.done ? '100' : r.best) + '%</small>'; d.appendChild(name);
      var cw = document.createElement('div'); cw.className = 'row'; cw.style.gap = '4px';
      r.coins.forEach(function (on, i) {
        var b = document.createElement('button'); b.className = 'cbtn' + (on ? ' on' : ''); b.textContent = '◎';
        b.addEventListener('click', function () { r.coins[i] = !r.coins[i]; sv.coins += r.coins[i] ? 1 : -1; if (sv.coins < 0) sv.coins = 0; save(); buildCheats(); });
        cw.appendChild(b);
      });
      d.appendChild(cw);
      var cb = document.createElement('button'); cb.className = 'tog' + (r.done ? ' on' : '');
      cb.addEventListener('click', function () { r.done = !r.done; r.best = r.done ? 100 : 0; save(); buildCheats(); });
      d.appendChild(cb); p.appendChild(d);
    });

    h3('Sound');
    toggle('Music', '', 'music'); toggle('Sound effects', '', 'sfx');
    p.scrollTop = keep;
  }

  $('btnPause').addEventListener('click', function () { pause(true); });
  $('pResume').addEventListener('click', function () { pause(false); });
  $('pRestart').addEventListener('click', function () { G.paused = false; G.attempts = 1; G.cps = []; show(null); resetRun(); });
  $('pPractice').addEventListener('click', function () {
    G.practice = !G.practice; G.cps = []; $('practiceBtns').classList.toggle('on', G.practice);
    G.paused = false; show(null); resetRun();
  });
  $('pExit').addEventListener('click', function () { exitToMenu('levels'); });
  $('btnCp').addEventListener('click', function () { if (G.s && !G.s.dead) { G.cps.push(E.cloneState(G.s)); toast('Checkpoint placed'); } });
  $('btnCpDel').addEventListener('click', function () { G.cps.pop(); toast('Checkpoint removed'); });
  $('eAgain').addEventListener('click', function () { startLevel(G.level); });
  $('eNext').addEventListener('click', function () { startLevel(LEVELS[Math.min(LEVELS.length - 1, G.level.id)]); });
  $('eMenu').addEventListener('click', function () { exitToMenu('levels'); });

  window.__pause = function () { if (G.mode === 'play' && !G.paused) pause(true); };
  document.addEventListener('visibilitychange', function () { if (document.hidden) window.__pause(); });

  window.__back = function () {
    if (G.mode === 'play') {
      if (cur === 'end') exitToMenu('levels'); else pause(!G.paused);
      return true;
    }
    if (cur && cur !== 'main') { show(cur === 'levels' || cur === 'garage' || cur === 'cheats' ? 'main' : 'levels'); return true; }
    return false;
  };

  /* ---------------------------------------------------------------- main loop */
  function frame(ts) {
    var dt = Math.min(0.05, G.last ? (ts - G.last) / 1000 : 0.016); G.last = ts;
    if (G.mode === 'play' && !G.paused) update(dt);
    render(G.paused ? 0 : dt);
    requestAnimationFrame(frame);
  }
  window.__NEON = { G: G, sv: function () { return sv; }, startLevel: startLevel, LEVELS: LEVELS };
  refresh(); show('main');
  requestAnimationFrame(frame);
})();
