/* Block Dash - rendering, UI, audio, save data and cheats. */
(function () {
  'use strict';
  var E = Engine, LEVELS = window.LEVELS;
  var $ = function (id) { return document.getElementById(id); };
  var PI2 = Math.PI * 2;

  /* ---------------------------------------------------------------- colours */
  var _rgb = {};
  function rgb(hex) {
    if (_rgb[hex]) return _rgb[hex];
    var n = parseInt(hex.slice(1), 16);
    return (_rgb[hex] = [n >> 16 & 255, n >> 8 & 255, n & 255]);
  }
  function mixRgb(a, b, t) { a = rgb(a); b = rgb(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, k) { k = k || 1; return 'rgb(' + Math.round(Math.min(255, c[0] * k)) + ',' + Math.round(Math.min(255, c[1] * k)) + ',' + Math.round(Math.min(255, c[2] * k)) + ')'; }
  function shade(hex, k) { return css(rgb(hex), k); }

  /* ---------------------------------------------------------------- save data */
  var KEY = 'neondash.save.v1';
  var COLORS = ['#7dff00', '#00ff00', '#00ff7d', '#00ffff', '#00c8ff', '#0064ff', '#3c3cff', '#7d00ff', '#ff00ff', '#ff007d', '#ff0000', '#ff7d00', '#ffff00', '#ffffff', '#afafaf', '#5a5a5a', '#000000', '#a0522d'];
  var CUBES = 12, SHIPS = 6;
  function defaults() {
    return {
      v: 2, stars: 0, orbs: 0, diamonds: 0, coins: 0, levels: {},
      icon: { cube: 0, ship: 0, c1: 0, c2: 3 },
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
        sv.icon = d.v === 2 ? Object.assign(b.icon, d.icon || {}) : defaults().icon;
        sv.cheats = Object.assign(defaults().cheats, d.cheats || {});
        sv.v = 2;
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

  /* ---------------------------------------------------------------- svg icons */
  function starPath(cx, cy, r1, r2) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r2 : r1;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1);
    }
    return d + 'Z';
  }
  function gearPath() {
    var d = '';
    for (var i = 0; i < 16; i++) {
      var a0 = i * PI2 / 16, r = i % 2 ? 30 : 42;
      d += (i ? 'L' : 'M') + (50 + Math.cos(a0 - 0.18) * r).toFixed(1) + ' ' + (50 + Math.sin(a0 - 0.18) * r).toFixed(1);
      d += 'L' + (50 + Math.cos(a0 + 0.18) * r).toFixed(1) + ' ' + (50 + Math.sin(a0 + 0.18) * r).toFixed(1);
    }
    return d + 'Z';
  }
  var SW = 'stroke="#000" stroke-linejoin="round"';
  var IC = {
    play: '<svg viewBox="0 0 100 100"><path d="M36 22 L80 50 L36 78 Z" fill="#fff" ' + SW + ' stroke-width="7"/></svg>',
    gear: '<svg viewBox="0 0 100 100"><path d="' + gearPath() + '" fill="#fff" ' + SW + ' stroke-width="6"/><circle cx="50" cy="50" r="13" fill="#d4339f" stroke="#000" stroke-width="6"/></svg>',
    cube: '<svg viewBox="0 0 100 100"><rect x="16" y="16" width="68" height="68" fill="#7dff00" ' + SW + ' stroke-width="7"/><rect x="30" y="32" width="14" height="14" fill="#0ff" ' + SW + ' stroke-width="4"/><rect x="56" y="32" width="14" height="14" fill="#0ff" ' + SW + ' stroke-width="4"/><rect x="32" y="58" width="36" height="10" fill="#0ff" ' + SW + ' stroke-width="4"/></svg>',
    back: '<svg viewBox="0 0 100 100"><path d="M60 20 L30 50 L60 80" fill="none" stroke="#000" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 20 L30 50 L60 80" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrowL: '<svg viewBox="0 0 60 100"><path d="M52 8 L8 50 L52 92 Z" fill="#7ee03a" ' + SW + ' stroke-width="7"/><path d="M42 28 L20 50" stroke="rgba(255,255,255,.55)" stroke-width="6" stroke-linecap="round"/></svg>',
    arrowR: '<svg viewBox="0 0 60 100"><path d="M8 8 L52 50 L8 92 Z" fill="#7ee03a" ' + SW + ' stroke-width="7"/><path d="M18 28 L40 50" stroke="rgba(255,255,255,.55)" stroke-width="6" stroke-linecap="round"/></svg>',
    pause: '<svg viewBox="0 0 100 100"><rect x="26" y="22" width="16" height="56" rx="3" fill="#fff" ' + SW + ' stroke-width="6"/><rect x="58" y="22" width="16" height="56" rx="3" fill="#fff" ' + SW + ' stroke-width="6"/></svg>',
    restart: '<svg viewBox="0 0 100 100"><path d="M74 50 A24 24 0 1 1 64 30" fill="none" stroke="#000" stroke-width="20" stroke-linecap="round"/><path d="M74 50 A24 24 0 1 1 64 30" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M52 14 L82 22 L64 44 Z" fill="#fff" ' + SW + ' stroke-width="6"/></svg>',
    menu: '<svg viewBox="0 0 100 100"><g fill="#fff" ' + SW + ' stroke-width="6"><rect x="20" y="22" width="60" height="13" rx="5"/><rect x="20" y="44" width="60" height="13" rx="5"/><rect x="20" y="66" width="60" height="13" rx="5"/></g></svg>',
    diamond: '<svg viewBox="0 0 100 100"><path d="M50 12 L82 46 L50 88 L18 46 Z" fill="#7ff3ff" ' + SW + ' stroke-width="7"/><path d="M18 46 L82 46 M50 12 L38 46 L50 88 L62 46 Z" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="3"/></svg>',
    flag: '<svg viewBox="0 0 100 100"><path d="M50 14 L80 50 L50 86 L20 50 Z" fill="#7dff00" ' + SW + ' stroke-width="7"/><path d="M50 30 L64 50 L50 70 L36 50 Z" fill="#fff"/></svg>',
    x: '<svg viewBox="0 0 100 100"><path d="M28 28 L72 72 M72 28 L28 72" stroke="#000" stroke-width="24" stroke-linecap="round"/><path d="M28 28 L72 72 M72 28 L28 72" stroke="#fff" stroke-width="12" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 100 100"><path d="' + starPath(50, 54, 44, 19) + '" fill="#ffd400" ' + SW + ' stroke-width="8"/></svg>',
    orb: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="#3aa8ff" stroke="#000" stroke-width="8"/><circle cx="40" cy="38" r="10" fill="#bfe6ff"/></svg>',
    dia: '<svg viewBox="0 0 100 100"><path d="M50 10 L86 44 L50 90 L14 44 Z" fill="#7ff3ff" ' + SW + ' stroke-width="8"/></svg>',
    coin: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#ffc400" stroke="#000" stroke-width="7"/><circle cx="50" cy="50" r="28" fill="none" stroke="#a87400" stroke-width="5"/><path d="' + starPath(50, 52, 17, 7) + '" fill="#fff3a0"/></svg>',
    check: '<svg viewBox="0 0 100 100"><path d="M18 52 L42 76 L84 26" fill="none" stroke="#000" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 52 L42 76 L84 26" fill="none" stroke="#6fe82a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function applyIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) { el.innerHTML = IC[el.getAttribute('data-icon')]; });
  }
  applyIcons();

  /* ---------------------------------------------------------------- player icons & difficulty faces */
  function cubeIcon(g, style, c1, c2, s) {
    var q = s / 8, lw = Math.max(1.5, s * 0.05);
    g.save();
    g.lineJoin = 'miter';
    g.fillStyle = c1; g.fillRect(-s / 2, -s / 2, s, s);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-s / 2, -s / 2, s, s * 0.18);
    g.fillStyle = c2; g.strokeStyle = '#000'; g.lineWidth = lw;
    function R(x, y, w, h) { g.fillRect(x * q, y * q, w * q, h * q); g.strokeRect(x * q, y * q, w * q, h * q); }
    function P(pts) { g.beginPath(); for (var i = 0; i < pts.length; i += 2) g[i ? 'lineTo' : 'moveTo'](pts[i] * q, pts[i + 1] * q); g.closePath(); g.fill(); g.stroke(); }
    switch (style) {
      case 0: R(-2.6, -2, 1.8, 1.8); R(0.8, -2, 1.8, 1.8); R(-2.2, 1.2, 4.4, 1.2); break;
      case 1: R(-2, -2, 4, 4); break;
      case 2: P([-0.7, -3, 0.7, -3, 0.7, -0.7, 3, -0.7, 3, 0.7, 0.7, 0.7, 0.7, 3, -0.7, 3, -0.7, 0.7, -3, 0.7, -3, -0.7, -0.7, -0.7]); break;
      case 3: P([-4, 4, 4, -4, 4, -1.3, -1.3, 4]); break;
      case 4: R(-3, -2.2, 6, 2); g.fillStyle = '#000'; g.fillRect(-2 * q, -1.8 * q, 1.1 * q, 1.2 * q); g.fillRect(0.9 * q, -1.8 * q, 1.1 * q, 1.2 * q); g.fillStyle = c2; R(-1.5, 1.4, 3, 1); break;
      case 5: R(-3, -3, 2.2, 2.2); R(0.8, -3, 2.2, 2.2); R(-3, 0.8, 2.2, 2.2); R(0.8, 0.8, 2.2, 2.2); break;
      case 6: P([0, -3, 3, 2.6, -3, 2.6]); break;
      case 7: g.beginPath(); g.arc(0, 0, 2.6 * q, 0, PI2); g.fill(); g.stroke(); g.fillStyle = c1; g.beginPath(); g.arc(0, 0, 1.2 * q, 0, PI2); g.fill(); g.stroke(); break;
      case 8: R(-3, -3, 6, 1.3); R(-3, 1.7, 6, 1.3); R(-3, -1.7, 1.3, 3.4); R(1.7, -1.7, 1.3, 3.4); break;
      case 9: R(-4, -2.6, 8, 1.2); R(-4, -0.6, 8, 1.2); R(-4, 1.4, 8, 1.2); break;
      case 10: P([-3, -0.6, 0, -3.4, 3, -0.6, 3, 1.4, 0, -1.2, -3, 1.4]); P([-3, 2.2, 0, -0.4, 3, 2.2, 3, 3.4, 0, 1.2, -3, 3.4]); break;
      default: P([0, -3.4, 2.4, 0, 0, 3.4, -2.4, 0]); g.fillStyle = c1; P([0, -1.4, 1, 0, 0, 1.4, -1, 0]);
    }
    g.strokeStyle = '#000'; g.lineWidth = Math.max(2, s * 0.08); g.strokeRect(-s / 2, -s / 2, s, s);
    g.restore();
  }
  function shipIcon(g, style, c1, c2, s) {
    g.save();
    g.lineJoin = 'round'; g.strokeStyle = '#000'; g.lineWidth = Math.max(2, s * 0.06);
    var cs = s * 0.46;
    g.save(); g.translate(-s * 0.02, -s * 0.24); cubeIcon(g, sv.icon.cube, c1, c2, cs); g.restore();
    var tail = [0.55, 0.64, 0.5, 0.7, 0.58, 0.66][style % 6], dip = (style % 3) * 0.07;
    g.fillStyle = c1;
    g.beginPath();
    g.moveTo(-s * tail, -s * 0.02 - dip * s); g.lineTo(-s * 0.32, -s * 0.02); g.lineTo(s * 0.48, -s * 0.02);
    g.lineTo(s * 0.62, s * 0.1); g.lineTo(s * 0.36, s * 0.3); g.lineTo(-s * 0.38, s * 0.3); g.lineTo(-s * tail, s * 0.12);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c2;
    g.beginPath(); g.moveTo(-s * 0.3, s * 0.1); g.lineTo(s * 0.4, s * 0.1); g.lineTo(s * 0.3, s * 0.2); g.lineTo(-s * 0.3, s * 0.2); g.closePath(); g.fill(); g.stroke();
    if (style >= 3) { g.beginPath(); g.moveTo(-s * 0.1, s * 0.3); g.lineTo(s * 0.06, s * 0.44); g.lineTo(s * 0.2, s * 0.3); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
  var FACE = { Easy: '#45b5ff', Normal: '#5ad11e', Hard: '#ffc21a', Harder: '#ff7a1a', Insane: '#ff4fd8', Demon: '#e0201a' };
  function drawFace(g, diff, S) {
    var r = S * 0.36, cx = S / 2, cy = S * 0.54;
    g.clearRect(0, 0, S, S);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#000'; g.lineWidth = S * 0.045;
    if (diff === 'Demon') {
      g.fillStyle = '#ffcf6a';
      [[-1], [1]].forEach(function (d) { g.beginPath(); g.moveTo(cx + d[0] * r * 0.45, cy - r * 0.75); g.lineTo(cx + d[0] * r * 1.05, cy - r * 1.45); g.lineTo(cx + d[0] * r * 0.9, cy - r * 0.45); g.closePath(); g.fill(); g.stroke(); });
    }
    g.fillStyle = FACE[diff] || '#888'; g.beginPath(); g.arc(cx, cy, r, 0, PI2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(cx - r * 0.3, cy - r * 0.45, r * 0.35, r * 0.2, -0.5, 0, PI2); g.fill();
    var angry = diff === 'Harder' || diff === 'Insane' || diff === 'Demon';
    [-1, 1].forEach(function (d) {
      var ex = cx + d * r * 0.36, ey = cy - r * 0.1;
      g.fillStyle = diff === 'Demon' ? '#ffd23d' : '#fff';
      g.beginPath(); g.ellipse(ex, ey, r * 0.2, r * 0.26, 0, 0, PI2); g.fill(); g.stroke();
      g.fillStyle = '#000'; g.beginPath(); g.arc(ex + d * r * 0.03, ey + r * 0.04, r * 0.09, 0, PI2); g.fill();
      if (angry || diff === 'Hard') {
        g.lineWidth = S * 0.05; g.beginPath();
        var tilt = angry ? 0.22 : 0;
        g.moveTo(ex - r * 0.26, ey - r * 0.34 - d * tilt * r); g.lineTo(ex + r * 0.26, ey - r * 0.34 + d * tilt * r); g.stroke();
        g.lineWidth = S * 0.045;
      }
    });
    g.beginPath();
    var my = cy + r * 0.42;
    if (diff === 'Easy' || diff === 'Normal') { g.arc(cx, my - r * 0.22, r * 0.32, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
    else if (diff === 'Hard') { g.moveTo(cx - r * 0.28, my); g.lineTo(cx + r * 0.28, my); g.stroke(); }
    else { g.arc(cx, my + r * 0.2, r * 0.3, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); }
    if (diff === 'Demon') {
      g.fillStyle = '#fff';
      [-1, 1].forEach(function (d) { g.beginPath(); g.moveTo(cx + d * r * 0.2, my - r * 0.02); g.lineTo(cx + d * r * 0.1, my + r * 0.2); g.lineTo(cx + d * r * 0.02, my + r * 0.0); g.closePath(); g.fill(); g.stroke(); });
    }
  }

  /* ---------------------------------------------------------------- canvas / renderer */
  var cv = $('c'), g = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1, T = 40, gY = 0;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    T = Math.min(H / 12.9, W / 16); gY = H - 1.6 * T;
  }
  window.addEventListener('resize', resize); resize();

  var G = {
    mode: 'menu', level: null, s: null, attempts: 1, jumps: 0, practice: false, cps: [], particles: [],
    camX: 0, camY: 0, acc: 0, stepN: 0, hold: false, deadT: 0, auto: null, paused: false,
    shake: 0, last: 0, frame: 0, flash: 0, cpT: 0, sel: 0, demo: { L: LEVELS[0], s: null, inputs: null, acc: 0, n: 0 }
  };

  function X(wx) { return (wx - G.camX) * T; }
  function Y(wy) { return gY + G.camY * T - wy * T; }

  function curLevel() { return G.mode === 'play' ? G.level : G.demo.L; }
  function curState() { return G.mode === 'play' ? G.s : G.demo.s; }
  function colors() {
    var L = curLevel(), p = cur === 'levels' ? LEVELS[G.sel].palette : L.palette, t = Math.max(0, Math.min(1, (G.camX + 5) / L.len));
    var k = 0.5 - 0.5 * Math.cos(t * PI2);
    var bg = mixRgb(p[0], p[1], k);
    var gr = mixRgb(p[2], p[1], k * 0.35);
    return { bg: bg, ground: [gr[0] * 0.92, gr[1] * 0.92, gr[2] * 0.92] };
  }

  function drawBackground(col) {
    g.fillStyle = css(col.bg); g.fillRect(0, 0, W, H);
    var S = T * 4.4, px = G.camX * 0.12 * T, baseY = gY + G.camY * 0.12 * T;
    var i0 = Math.floor(px / S);
    g.lineWidth = 2;
    for (var i = i0; i < i0 + W / S + 2; i++) {
      for (var j = -2; ; j++) {
        var x = i * S - px, y = baseY - (j + 1) * S;
        if (y + S < 0) break;
        var odd = ((i + j) & 1) === 0;
        g.fillStyle = odd ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.035)';
        g.fillRect(x, y, S, S);
        g.strokeStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(x + 1, y + S - 1); g.lineTo(x + 1, y + 1); g.lineTo(x + S - 1, y + 1); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.14)'; g.beginPath(); g.moveTo(x + S - 1, y + 1); g.lineTo(x + S - 1, y + S - 1); g.lineTo(x + 1, y + S - 1); g.stroke();
        if (odd) { g.strokeStyle = 'rgba(255,255,255,0.05)'; g.strokeRect(x + S * 0.2, y + S * 0.2, S * 0.6, S * 0.6); }
      }
    }
    var sh = g.createLinearGradient(0, 0, 0, H);
    sh.addColorStop(0, 'rgba(0,0,0,0.28)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
  }

  function groundStrip(col, yLine, down) {
    var S = T * 2.4, ox = -((G.camX * T) % S + S) % S;
    var top = down ? yLine : 0, h = down ? H - yLine + 2 : Math.max(0, yLine);
    if (h <= 0) return;
    g.fillStyle = css(col.ground); g.fillRect(0, top, W, h);
    for (var x = ox; x < W; x += S) {
      var k = Math.round((x + G.camX * T) / S) & 1;
      var ty = down ? yLine : yLine - S;
      g.fillStyle = k ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(x, ty, S, S);
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2; g.strokeRect(x + 1, ty + 1, S - 2, S - 2);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(x + 3, ty + S - 3); g.lineTo(x + 3, ty + 3); g.lineTo(x + S - 3, ty + 3); g.stroke();
    }
    var sh = g.createLinearGradient(0, down ? yLine : yLine, 0, down ? H : 0);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = sh; g.fillRect(0, top, W, h);
    var ln = g.createLinearGradient(0, 0, W, 0);
    ln.addColorStop(0, 'rgba(255,255,255,0)'); ln.addColorStop(0.5, 'rgba(255,255,255,1)'); ln.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ln; g.fillRect(0, yLine - 1, W, 2);
  }

  function drawGround(s, col) {
    groundStrip(col, Y(0), true);
    if (s && s.ceil != null) groundStrip(col, Y(s.ceil), false);
  }

  function blockPath(o) {
    var x = X(o.x), y = Y(o.y + o.h), w = o.w * T, h = o.h * T;
    g.fillStyle = '#000'; g.fillRect(x, y, w, h);
    for (var i = 0; i < o.w; i++) for (var j = 0; j < o.h; j++) {
      var tx = x + i * T, ty = y + j * T;
      var gr = g.createLinearGradient(0, ty, 0, ty + T);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(255,255,255,0.12)');
      g.fillStyle = gr; g.fillRect(tx + T * 0.1, ty + T * 0.1, T * 0.8, T * 0.8);
      g.fillStyle = '#000'; g.fillRect(tx + T * 0.18, ty + T * 0.18, T * 0.64, T * 0.64);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.strokeRect(tx + T * 0.18, ty + T * 0.18, T * 0.64, T * 0.64);
    }
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, T * 0.07); g.lineJoin = 'miter';
    g.strokeRect(x + g.lineWidth / 2, y + g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  }

  function drawObject(o, hb, L) {
    var x, y;
    if (o.t === 'b') {
      blockPath(o);
      if (hb) { g.strokeStyle = '#00ff3c'; g.lineWidth = 2; g.strokeRect(X(o.x), Y(o.y + o.h), o.w * T, o.h * T); }
    } else if (o.t === 's') {
      x = X(o.x); y = Y(o.y + 1);
      var tip = o.flip ? y + T * 0.98 : y + T * 0.04, base = o.flip ? y + T * 0.02 : y + T;
      g.beginPath(); g.moveTo(x + T * 0.04, base); g.lineTo(x + T * 0.96, base); g.lineTo(x + T / 2, tip); g.closePath();
      var gr = g.createLinearGradient(0, base, 0, tip);
      gr.addColorStop(0, '#3a3a3a'); gr.addColorStop(0.55, '#000'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, T * 0.065); g.lineJoin = 'miter'; g.stroke();
      if (hb) { g.strokeStyle = '#ff2020'; g.lineWidth = 2; g.strokeRect(x + 0.3 * T, Y(o.y + (o.flip ? 1 : 0.55)), 0.4 * T, 0.55 * T); }
    } else if (o.t === 'p') {
      x = X(o.x + 0.5); y = Y(o.y);
      g.fillStyle = '#ffe13a'; g.strokeStyle = '#000'; g.lineWidth = Math.max(1.5, T * 0.05);
      g.beginPath(); g.ellipse(x, y, T * 0.44, T * 0.26, 0, Math.PI, PI2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(x - T * 0.1, y - T * 0.12, T * 0.16, T * 0.05, 0, 0, PI2); g.fill();
      var ph = (performance.now() / 500 + o.x) % 1;
      g.fillStyle = 'rgba(255,225,58,' + (0.7 * (1 - ph)).toFixed(2) + ')';
      g.fillRect(x - T * 0.25, y - T * (0.35 + ph * 0.8), T * 0.07, T * 0.07); g.fillRect(x + T * 0.18, y - T * (0.3 + ((ph + 0.5) % 1) * 0.8), T * 0.07, T * 0.07);
    } else if (o.t === 'o') {
      x = X(o.x + 0.5); y = Y(o.y + 0.5);
      var t = performance.now() / 1000;
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = Math.max(1.5, T * 0.04);
      g.setLineDash([T * 0.12, T * 0.1]); g.lineDashOffset = -t * T; g.beginPath(); g.arc(x, y, T * 0.48, 0, PI2); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffe13a'; g.strokeStyle = '#000'; g.lineWidth = Math.max(2, T * 0.06);
      g.beginPath(); g.arc(x, y, T * 0.32, 0, PI2); g.fill(); g.stroke();
      g.fillStyle = '#fff6b8'; g.beginPath(); g.arc(x - T * 0.08, y - T * 0.08, T * 0.11, 0, PI2); g.fill();
    } else if (o.t === 'c') {
      if (G.s && G.s.coins.indexOf(o.id) >= 0) return;
      x = X(o.x + 0.5); y = Y(o.y + 0.5 + 0.08 * Math.sin(performance.now() / 300 + o.x));
      var ids = L.objects.filter(function (q) { return q.t === 'c'; });
      var had = lv(L.id).coins[ids.indexOf(o)];
      var sq = Math.abs(Math.cos(performance.now() / 500 + o.x));
      g.save(); g.translate(x, y); g.scale(0.35 + 0.65 * sq, 1);
      g.fillStyle = had ? '#c8c8d0' : '#ffc400'; g.strokeStyle = '#000'; g.lineWidth = Math.max(2, T * 0.06);
      g.beginPath(); g.arc(0, 0, T * 0.4, 0, PI2); g.fill(); g.stroke();
      g.strokeStyle = had ? '#8a8a96' : '#a87400'; g.lineWidth = Math.max(1.5, T * 0.05); g.beginPath(); g.arc(0, 0, T * 0.27, 0, PI2); g.stroke();
      g.fillStyle = '#fff8c0'; g.beginPath();
      for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = (k % 2 ? 0.07 : 0.17) * T; g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.restore();
    } else if (o.t === 'g') {
      x = X(o.x + 0.5);
      var ship = o.mode === 'ship', c = ship ? '#ff4fd8' : '#4fff3a', dark = ship ? '#8a0f6e' : '#1c7a0a';
      var cy = ship ? Y(2.4) : Y(5), hh = (ship ? 2.4 : 4.8) * T;
      g.save();
      g.lineWidth = T * 0.34; g.strokeStyle = '#000';
      g.beginPath(); g.ellipse(x, cy, T * 0.6, hh, 0, 0, PI2); g.stroke();
      g.lineWidth = T * 0.22; g.strokeStyle = c; g.stroke();
      g.lineWidth = T * 0.07; g.strokeStyle = dark; g.beginPath(); g.ellipse(x, cy, T * 0.45, hh * 0.93, 0, 0, PI2); g.stroke();
      g.fillStyle = ship ? 'rgba(255,79,216,0.22)' : 'rgba(79,255,58,0.22)'; g.beginPath(); g.ellipse(x, cy, T * 0.45, hh * 0.93, 0, 0, PI2); g.fill();
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
      var bob = Math.sin(performance.now() / 250) * T * 0.1;
      g.beginPath(); g.moveTo(x + T * 0.9, cy - hh - T * 0.5 + bob); g.lineTo(x + T * 1.3, cy - hh - T * 0.5 + bob); g.lineTo(x + T * 1.1, cy - hh - T * 0.15 + bob); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }

  function drawFinish(L) {
    var x = X(L.len);
    if (x > W + 10) return;
    var gr = g.createLinearGradient(x, 0, x + T * 3, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)');
    g.fillStyle = gr; g.fillRect(x, 0, T * 3, H);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(x + T * 3, 0, W, H);
  }

  function drawPlayer(s) {
    var ic = sv.icon, c1 = COLORS[ic.c1], c2 = COLORS[ic.c2];
    var cx = X(s.x + 0.5), cy = Y(s.y + 0.5);
    g.save(); g.translate(cx, cy);
    if (s.mode === 'cube') { g.rotate(s._vr || 0); cubeIcon(g, ic.cube, c1, c2, T); }
    else { g.rotate(-Math.atan2(s.vy, 14)); shipIcon(g, ic.ship, c1, c2, T * 1.4); }
    g.restore();
    if (sv.cheats.hitbox && G.mode === 'play') {
      g.strokeStyle = '#00ff3c'; g.lineWidth = 2; g.strokeRect(X(s.x), Y(s.y + 1), T, T);
      g.strokeStyle = '#ff2020'; g.strokeRect(X(s.x + 0.12), Y(s.y + 0.88), 0.76 * T, 0.76 * T);
    }
  }

  function spawnFx(s, dt) {
    if (!s || s.dead || s.won || G.paused) return;
    G.fxT = (G.fxT || 0) + dt;
    if (G.fxT < 0.03) return;
    G.fxT = 0;
    if (s.mode === 'ship') {
      var a = -Math.atan2(s.vy, 14);
      G.particles.push({ x: s.x + 0.05 - Math.cos(a) * 0.1, y: s.y + 0.45 + Math.sin(a) * 0.2, vx: -6 - Math.random() * 3, vy: (Math.random() - 0.5) * 2, life: 0.3, max: 0.3, s: 0.16, c: Math.random() < 0.5 ? '#ffb000' : '#ff5a00', ng: true });
    } else if (s.grounded) {
      G.particles.push({ x: s.x + 0.1, y: s.y + 0.08, vx: -3 - Math.random() * 2, vy: 1 + Math.random() * 2, life: 0.35, max: 0.35, s: 0.09, c: COLORS[sv.icon.c1] });
    }
  }

  function render(dt) {
    var s = curState(), L = curLevel(), play = G.mode === 'play';
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (s) {
      G.camX = s.x - 5.5;
      var target = s.mode === 'ship' ? 0 : Math.max(0, s.y - 6);
      G.camY += (target - G.camY) * Math.min(1, dt * 6);
      var snap = Math.round(s.rot / (Math.PI / 2)) * (Math.PI / 2);
      s._vr = s.grounded ? (s._vr == null ? snap : s._vr + (snap - s._vr) * Math.min(1, dt * 22)) : s.rot;
    }
    var col = colors();
    g.save();
    if (G.shake > 0) { g.translate((Math.random() - 0.5) * G.shake * 40, (Math.random() - 0.5) * G.shake * 40); G.shake = Math.max(0, G.shake - dt); }
    drawBackground(col);
    drawGround(s, col);
    var P = E.prepare(L), hb = sv.cheats.hitbox && play;
    G.frame++;
    var k0 = Math.floor(G.camX) - 2, k1 = Math.floor(G.camX + W / T) + 2;
    for (var q = 0; q < P.portals.length; q++) { var pp = P.portals[q]; if (pp.x > k0 - 2 && pp.x < k1) drawObject(pp, false, L); }
    for (var k = k0; k <= k1; k++) {
      var list = P.cols[k]; if (!list) continue;
      for (var i = 0; i < list.length; i++) {
        var o = list[i]; if (o._f === G.frame) continue; o._f = G.frame;
        if (play || o.t !== 'c') drawObject(o, hb, L);
      }
    }
    if (play) {
      drawFinish(L);
      var al = Math.max(0, 1 - Math.abs(s.x - 2) / 9);
      if (al > 0) {
        g.globalAlpha = al; g.font = Math.round(T * 1.15) + 'px "Lilita One",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.lineJoin = 'round'; g.lineWidth = T * 0.16; g.strokeStyle = '#000'; g.strokeText('Attempt ' + G.attempts, X(3), Y(5));
        g.fillStyle = '#fff'; g.fillText('Attempt ' + G.attempts, X(3), Y(5)); g.globalAlpha = 1;
      }
    }
    spawnFx(s, dt);
    for (var n = G.particles.length - 1; n >= 0; n--) {
      var a = G.particles[n]; a.life -= dt;
      if (a.life <= 0) { G.particles.splice(n, 1); continue; }
      var f = a.life / a.max;
      if (a.ring) {
        a.r += a.vr * dt;
        g.strokeStyle = 'rgba(255,255,255,' + f.toFixed(2) + ')'; g.lineWidth = T * 0.2 * f + 1;
        g.beginPath(); g.arc(X(a.x), Y(a.y), a.r * T, 0, PI2); g.stroke();
        continue;
      }
      if (!a.ng) a.vy -= 30 * dt;
      a.x += a.vx * dt; a.y += a.vy * dt;
      g.globalAlpha = Math.min(1, f * 1.4); g.fillStyle = a.c;
      var sz = a.s * T * (a.ng ? f : 1);
      g.fillRect(X(a.x) - sz / 2, Y(a.y) - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
    if (s && !s.dead) drawPlayer(s);
    g.restore();
    if (G.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, G.flash).toFixed(2) + ')'; g.fillRect(0, 0, W, H); G.flash = Math.max(0, G.flash - dt * 3); }
  }

  function explode(s) {
    G.particles.push({ ring: true, x: s.x + 0.5, y: s.y + 0.5, r: 0.3, vr: 7, life: 0.45, max: 0.45 });
    for (var i = 0; i < 24; i++) {
      var a = Math.random() * PI2, v = 4 + Math.random() * 9;
      G.particles.push({ x: s.x + 0.5, y: s.y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 3, life: 0.6 + Math.random() * 0.4, max: 1, s: 0.14 + Math.random() * 0.2, c: Math.random() < 0.5 ? COLORS[sv.icon.c1] : COLORS[sv.icon.c2] });
    }
    G.shake = 0.15;
  }
  function fireworks() {
    var cols = ['#ffd400', '#ff4fd8', '#4fff3a', '#3aa8ff', '#ffffff'];
    for (var b = 0; b < 4; b++) {
      var cx = G.camX + 4 + Math.random() * 10, cy = 3 + Math.random() * 5;
      for (var i = 0; i < 18; i++) {
        var a = i / 18 * PI2, v = 5 + Math.random() * 3;
        G.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.1, max: 1.1, s: 0.16, c: cols[b % cols.length] });
      }
    }
  }

  /* ---------------------------------------------------------------- game flow */
  function simOpts() {
    var c = sv.cheats;
    return { noclip: c.noclip, infJump: c.infJump, speed: c.speed };
  }
  function lvCoinIds(L) { return L.objects.filter(function (o) { return o.t === 'c'; }).map(function (o) { return o.id; }); }
  function setProgress(pct) { $('progress').firstElementChild.style.width = pct + '%'; $('pct').textContent = pct + '%'; }

  function resetRun() {
    var L = G.level, opts = simOpts(), cp = G.practice && G.cps.length ? G.cps[G.cps.length - 1] : null, s;
    if (cp) { s = E.cloneState(cp); s.opts = opts; s.dead = false; s.won = false; }
    else {
      var sx = G.practice || !sv.cheats.startPct ? 0 : E.safeStart(L, sv.cheats.startPct / 100 * (L.len - 20));
      s = E.createState(L, opts, sx);
    }
    s.prevHold = false; s._vr = null;
    G.s = s; G.acc = 0; G.stepN = 0; G.deadT = 0; G.auto = null; G.cpT = s.t;
    G.particles.length = 0;
    if (sv.cheats.auto) {
      G.auto = E.solve(L, opts, 4000000, s);
      if (!G.auto) toast('Auto-play found no route - try speed 1.00x');
    }
    Snd.startMusic(L);
    cheatTag();
    setProgress(Math.min(100, Math.floor(100 * s.x / L.len)));
  }

  function startLevel(L) {
    clearTimeout(G.endT);
    Snd.init(); Snd.sfx('click');
    G.level = L; G.attempts = 1; G.jumps = 0; G.cps = []; G.mode = 'play'; G.paused = false; G.camY = 0;
    show(null); $('hud').classList.add('on');
    $('practiceBtns').classList.toggle('on', G.practice);
    resetRun();
  }

  function cheatTag() {
    var c = sv.cheats, t = [];
    if (c.noclip) t.push('God mode'); if (c.infJump) t.push('Inf jump'); if (c.auto) t.push('Auto');
    if (c.speed !== 1) t.push('Speed ' + c.speed + 'x'); if (c.startPct > 0) t.push('Start ' + c.startPct + '%');
    if (G.practice) t.push('Practice');
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
    setProgress(Math.min(100, Math.floor(100 * s.x / G.level.len)));
    if (G.practice && s.t - G.cpT >= 2.5 && (s.grounded || s.mode === 'ship')) { G.cps.push(E.cloneState(s)); G.cpT = s.t; }
  }

  function updateDemo(dt) {
    var d = G.demo;
    if (!d.inputs) { d.inputs = E.solve(d.L, {}) || []; }
    if (!d.s || d.s.won || d.s.dead) { d.s = E.createState(d.L, { noEvents: true }, 0); d.n = 0; d.acc = 0; G.particles.length = 0; }
    d.acc += dt;
    while (d.acc >= E.DT) { d.acc -= E.DT; E.step(d.s, !!d.inputs[(d.n / E.SUB) | 0]); d.n++; }
  }

  function handleEvent(ev) {
    var s = G.s;
    if (ev === 'jump' || ev === 'pad' || ev === 'orb' || ev === 'coin' || ev === 'portal') {
      Snd.sfx(ev);
      if (ev === 'jump' || ev === 'orb') G.jumps++;
      if (ev === 'portal') G.flash = 0.2;
      if (ev === 'orb') G.particles.push({ ring: true, x: s.x + 0.5, y: s.y + 0.5, r: 0.2, vr: 4, life: 0.3, max: 0.3 });
      if (ev === 'pad') for (var i = 0; i < 8; i++) G.particles.push({ x: s.x + 0.5, y: s.y + 0.2, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, life: 0.4, max: 0.4, s: 0.12, c: '#ffe13a' });
      if (ev === 'coin') for (var j = 0; j < 10; j++) G.particles.push({ x: s.x + 0.5, y: s.y + 0.5, vx: (Math.random() - 0.5) * 8, vy: Math.random() * 6, life: 0.5, max: 0.5, s: 0.12, c: '#ffc400' });
    } else if (ev === 'die') {
      Snd.sfx('die'); Snd.stopMusic(); explode(s);
      if (!G.practice) { var rec = lv(G.level.id), pct = Math.floor(100 * s.x / G.level.len); if (pct > rec.best) { rec.best = pct; save(); } }
    } else if (ev === 'win') { onWin(); }
  }

  function onWin() {
    var L = G.level, rec = lv(L.id), s = G.s;
    Snd.stopMusic(); Snd.sfx('win'); fireworks();
    setProgress(100);
    var parts = [], ids = lvCoinIds(L), got = 0;
    s.coins.forEach(function (id) { if (ids.indexOf(id) >= 0) got++; });
    if (!G.practice) {
      var first = !rec.done, newCoins = 0;
      rec.done = true; rec.best = 100;
      s.coins.forEach(function (id) { var idx = ids.indexOf(id); if (idx >= 0 && !rec.coins[idx]) { rec.coins[idx] = true; newCoins++; } });
      if (first) { sv.stars += L.stars; sv.diamonds += L.stars * 2; sv.orbs += L.stars * 15; }
      sv.coins += newCoins;
      if (first) parts.push('<span>' + IC.star + '+' + L.stars + '</span><span>' + IC.orb + '+' + (L.stars * 15) + '</span><span>' + IC.dia + '+' + (L.stars * 2) + '</span>');
      save();
    }
    parts.push('<span>Attempts: ' + G.attempts + '</span><span>Jumps: ' + G.jumps + '</span><span>Time: ' + s.t.toFixed(1) + 's</span><span>' + IC.coin + got + '/3</span>');
    clearTimeout(G.endT);
    G.endT = setTimeout(function () {
      $('endTitle').textContent = G.practice ? 'PRACTICE COMPLETE!' : 'LEVEL COMPLETE!';
      $('endInfo').innerHTML = parts.join('');
      $('eNextCol').style.display = L.id < LEVELS.length ? '' : 'none';
      show('end');
    }, 900);
  }

  function exitToMenu(screen) {
    clearTimeout(G.endT);
    Snd.stopMusic(); G.mode = 'menu'; G.s = null; G.level = null; G.paused = false; G.hold = false; G.particles.length = 0;
    $('hud').classList.remove('on'); show(screen || 'levels'); refresh();
  }
  function pause(on) {
    if (G.mode !== 'play' || (G.s && G.s.won)) return;
    G.paused = on; G.hold = false;
    if (on) {
      Snd.stopMusic(); show('pause');
      var pct = Math.min(100, Math.floor(100 * G.s.x / G.level.len));
      $('pName').textContent = G.level.name; $('pBar').style.width = pct + '%'; $('pPct').textContent = pct + '%';
      $('pPracticeLbl').textContent = G.practice ? 'Practice: On' : 'Practice: Off';
    } else { show(null); if (G.s && !G.s.dead) Snd.startMusic(G.level); }
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
    else if (cur === 'levels' && e.code === 'ArrowLeft') selLevel(-1);
    else if (cur === 'levels' && e.code === 'ArrowRight') selLevel(1);
  });
  window.addEventListener('keyup', function (e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') G.hold = false; });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------------------------------------------------------------- UI */
  var cur = 'main';
  function show(name) {
    ['main', 'levels', 'garage', 'cheats', 'pause', 'end'].forEach(function (n) { $(n).classList.toggle('on', n === name); });
    cur = name;
    if (name === 'levels') buildLevelSel();
    if (name === 'garage') buildGarage();
    if (name === 'cheats') buildCheats();
    refresh();
  }
  function refresh() {
    var html = '<span>' + IC.star + sv.stars + '</span><span>' + IC.orb + sv.orbs + '</span><span>' + IC.dia + sv.diamonds + '</span><span>' + IC.coin + sv.coins + '</span>';
    document.querySelectorAll('[data-stats]').forEach(function (e) { e.innerHTML = html; });
  }
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { Snd.init(); Snd.sfx('click'); show(b.getAttribute('data-go')); });
  });

  function selLevel(d) {
    G.sel = (G.sel + d + LEVELS.length) % LEVELS.length;
    Snd.sfx('click'); buildLevelSel();
  }
  function buildLevelSel() {
    var L = LEVELS[G.sel], r = lv(L.id), p = $('lvPanel'), pct = r.done ? 100 : r.best;
    p.style.background = 'linear-gradient(' + L.palette[0] + ',' + shade(L.palette[0], 0.72) + ')';
    p.innerHTML = '<div class="lvcoins">' + r.coins.map(function (c) { return '<span class="' + (c ? '' : 'off') + '">' + IC.coin + '</span>'; }).join('') + '</div>' +
      '<div class="lvhead"><canvas width="172" height="172"></canvas><div><div class="lvname ol">' + L.name + '</div>' +
      '<div class="lvsub ol">' + L.diff + ' &nbsp;' + IC.star + L.stars + '</div></div></div>' +
      '<div class="mode ol">Normal Mode</div><div class="pbar"><i style="width:' + pct + '%"></i><span class="ol">' + pct + '%</span></div>';
    drawFace(p.querySelector('canvas').getContext('2d'), L.diff, 172);
    $('lvDots').innerHTML = LEVELS.map(function (_, i) { return '<i class="' + (i === G.sel ? 'on' : '') + '"></i>'; }).join('');
  }
  (function () {
    var p = $('lvPanel'), sx = null, swiped = false;
    p.addEventListener('pointerdown', function (e) { sx = e.clientX; swiped = false; });
    p.addEventListener('pointerup', function (e) {
      if (sx != null && Math.abs(e.clientX - sx) > 40) { swiped = true; selLevel(e.clientX < sx ? 1 : -1); }
      sx = null;
    });
    p.addEventListener('click', function () { if (!swiped) startLevel(LEVELS[G.sel]); });
    $('lvPrev').addEventListener('click', function () { selLevel(-1); });
    $('lvNext').addEventListener('click', function () { selLevel(1); });
  })();

  function iconCanvas(kind, idx, parent, onPick, selected) {
    var c = document.createElement('canvas'); c.width = c.height = 96;
    var x = c.getContext('2d'); x.translate(48, 48);
    var c1 = COLORS[sv.icon.c1], c2 = COLORS[sv.icon.c2];
    if (kind === 'cube') cubeIcon(x, idx, c1, c2, 60); else shipIcon(x, idx, c1, c2, 70);
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
        var d = document.createElement('div'); d.className = 'sw' + (sv.icon[pr[1]] === idx ? ' sel' : ''); d.style.background = col;
        d.addEventListener('click', function () { Snd.sfx('click'); sv.icon[pr[1]] = idx; save(); buildGarage(); });
        pr[0].appendChild(d);
      });
    });
    var pv = $('preview').getContext('2d'); pv.setTransform(1, 0, 0, 1, 0, 0); pv.clearRect(0, 0, 300, 150);
    pv.save(); pv.translate(80, 75); cubeIcon(pv, sv.icon.cube, COLORS[sv.icon.c1], COLORS[sv.icon.c2], 84); pv.restore();
    pv.save(); pv.translate(210, 80); shipIcon(pv, sv.icon.ship, COLORS[sv.icon.c1], COLORS[sv.icon.c2], 100); pv.restore();
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
    function checkBtn(on, fn) {
      var b = document.createElement('button'); b.className = 'check' + (on ? ' on' : ''); b.innerHTML = IC.check;
      b.addEventListener('click', function () { Snd.sfx('click'); fn(b); }); return b;
    }
    function toggle(label, desc, key) {
      line(label, desc).appendChild(checkBtn(c[key], function (b) {
        c[key] = !c[key]; b.classList.toggle('on', c[key]); save();
        if (key === 'music' && !c[key]) Snd.stopMusic();
      }));
    }
    function slider(label, desc, key, min, max, stepv, fmt) {
      var d = line(label + ' <span id="v_' + key + '" style="color:#ffd400">' + fmt(c[key]) + '</span>', desc), r = document.createElement('input');
      r.type = 'range'; r.min = min; r.max = max; r.step = stepv; r.value = c[key];
      r.addEventListener('input', function () { c[key] = parseFloat(r.value); $('v_' + key).textContent = fmt(c[key]); save(); });
      d.appendChild(r);
    }
    function num(label, key, icon) {
      var d = line('<span style="display:inline-flex;align-items:center;gap:8px"><span style="width:26px;display:inline-block">' + IC[icon] + '</span>' + label + '</span>'), i = document.createElement('input');
      i.type = 'number'; i.min = 0; i.max = 999999; i.value = sv[key];
      i.addEventListener('change', function () { sv[key] = Math.max(0, Math.min(999999, parseInt(i.value, 10) || 0)); i.value = sv[key]; save(); refresh(); });
      d.appendChild(i);
    }
    function btn(label, desc, text, fn, cls) {
      var d = line(label, desc), b = document.createElement('button'); b.className = 'btn small ' + (cls || ''); b.textContent = text;
      b.addEventListener('click', function () { Snd.sfx('click'); fn(); save(); buildCheats(); refresh(); }); d.appendChild(b);
    }

    h3('Gameplay');
    toggle('God mode', 'Pass through spikes and blocks (no-clip)', 'noclip');
    toggle('Infinite jump', 'Jump again in mid-air with every tap', 'infJump');
    toggle('Auto-play', 'The game plays the level for you', 'auto');
    toggle('Show hitboxes', 'Shows the player and hazard hitboxes', 'hitbox');
    slider('Game speed', 'Scales the whole run', 'speed', 0.25, 2, 0.05, function (v) { return v.toFixed(2) + 'x'; });
    slider('Start position', 'Begin every attempt part-way through the level', 'startPct', 0, 95, 1, function (v) { return v + '%'; });

    h3('Progress');
    btn('Complete every level', 'All levels 100% with all coins, rewards included', 'Do it', function () {
      LEVELS.forEach(function (L) {
        var r = lv(L.id);
        if (!r.done) { sv.stars += L.stars; sv.diamonds += L.stars * 2; sv.orbs += L.stars * 15; }
        r.done = true; r.best = 100;
        r.coins.forEach(function (x, i) { if (!x) { r.coins[i] = true; sv.coins++; } });
      });
      toast('All levels completed!');
    });
    btn('Max out stats', 'Stars, orbs, diamonds and coins to 99999', 'Max', function () { sv.stars = sv.orbs = sv.diamonds = sv.coins = 99999; toast('Stats maxed!'); }, 'blue');
    num('Stars', 'stars', 'star'); num('Orbs', 'orbs', 'orb'); num('Diamonds', 'diamonds', 'dia'); num('Coins', 'coins', 'coin');
    btn('Reset all progress', 'Clears levels and stats (keeps icons)', 'Reset', function () {
      var ic = sv.icon, ch = sv.cheats; sv = defaults(); sv.icon = ic; sv.cheats = ch; c = sv.cheats; toast('Progress reset');
    }, 'pink');

    h3('Level editor');
    LEVELS.forEach(function (L) {
      var r = lv(L.id), d = document.createElement('div'); d.className = 'lvrow';
      var name = document.createElement('div'); name.innerHTML = L.id + '. ' + L.name + ' <small>' + (r.done ? '100' : r.best) + '%</small>'; d.appendChild(name);
      var cw = document.createElement('div'); cw.className = 'row'; cw.style.gap = '2px';
      r.coins.forEach(function (on, i) {
        var b = document.createElement('button'); b.className = 'cbtn' + (on ? ' on' : ''); b.innerHTML = IC.coin;
        b.addEventListener('click', function () { r.coins[i] = !r.coins[i]; sv.coins += r.coins[i] ? 1 : -1; if (sv.coins < 0) sv.coins = 0; save(); buildCheats(); refresh(); });
        cw.appendChild(b);
      });
      d.appendChild(cw);
      d.appendChild(checkBtn(r.done, function () { r.done = !r.done; r.best = r.done ? 100 : 0; save(); buildCheats(); }));
      p.appendChild(d);
    });

    h3('Sound');
    toggle('Music', '', 'music'); toggle('Sound effects', '', 'sfx');
    p.scrollTop = keep;
  }

  $('btnPause').addEventListener('click', function () { pause(true); });
  $('pResume').addEventListener('click', function () { pause(false); });
  $('pRestart').addEventListener('click', function () { G.paused = false; G.attempts = 1; G.jumps = 0; G.cps = []; show(null); resetRun(); });
  $('pPractice').addEventListener('click', function () {
    G.practice = !G.practice; G.cps = []; $('practiceBtns').classList.toggle('on', G.practice);
    G.paused = false; show(null); resetRun();
  });
  $('pExit').addEventListener('click', function () { exitToMenu('levels'); });
  $('btnCp').addEventListener('click', function () { if (G.s && !G.s.dead) { G.cps.push(E.cloneState(G.s)); toast('Checkpoint placed'); } });
  $('btnCpDel').addEventListener('click', function () { G.cps.pop(); toast('Checkpoint removed'); });
  $('eAgain').addEventListener('click', function () { startLevel(G.level); });
  $('eNext').addEventListener('click', function () { G.sel = Math.min(LEVELS.length - 1, G.level.id); startLevel(LEVELS[G.sel]); });
  $('eMenu').addEventListener('click', function () { exitToMenu('levels'); });

  window.__pause = function () { if (G.mode === 'play' && !G.paused) pause(true); };
  document.addEventListener('visibilitychange', function () { if (document.hidden) window.__pause(); });

  window.__back = function () {
    if (G.mode === 'play') {
      if (cur === 'end') exitToMenu('levels'); else pause(!G.paused);
      return true;
    }
    if (cur && cur !== 'main') { show('main'); return true; }
    return false;
  };

  /* ---------------------------------------------------------------- main loop */
  function frame(ts) {
    var dt = Math.min(0.05, G.last ? (ts - G.last) / 1000 : 0.016); G.last = ts;
    if (G.mode === 'play') { if (!G.paused) update(dt); }
    else updateDemo(dt);
    render(G.paused ? 0 : dt);
    requestAnimationFrame(frame);
  }
  window.__GAME = { G: G, sv: function () { return sv; }, startLevel: startLevel, LEVELS: LEVELS };
  show('main');
  requestAnimationFrame(frame);
})();
