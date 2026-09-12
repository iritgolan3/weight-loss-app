/* Punch-Out!! — WebAudio 2A03-style sound.
   Two pulse channels, a triangle bass and a noise channel, driven by a small
   step sequencer. The music is written in the NES march idiom rather than
   lifted from the cartridge. */
(function () {
  'use strict';
  var PO = window.PO;
  var A = (PO.Audio = {});

  var ac = null, master = null, musicGain = null, sfxGain = null, crowd = null, crowdGain = null;
  var waves = {};
  var noiseBuf = null;
  var enabled = true;

  A.ready = false;

  function dutyWave(duty) {
    var n = 32, real = new Float32Array(n), imag = new Float32Array(n);
    for (var i = 1; i < n; i++) {
      var t = Math.PI * i * duty;
      imag[i] = (2 / (Math.PI * i)) * Math.sin(t);
    }
    return ac.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  A.init = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { enabled = false; return; }
    ac = new Ctx();
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = 0.42; musicGain.connect(master);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);

    waves.p12 = dutyWave(0.125);
    waves.p25 = dutyWave(0.25);
    waves.p50 = dutyWave(0.5);

    var len = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    A.ready = true;
  };

  A.setEnabled = function (v) { enabled = v; if (master) master.gain.value = v ? 0.55 : 0; };
  A.isEnabled = function () { return enabled; };
  A.toggle = function () { A.setEnabled(!enabled); return enabled; };

  /* ---------- note helpers ---------- */
  var NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(name) {
    if (!name || name === '.') return 0;
    var m = /^([A-G]#?)(-?\d)$/.exec(name);
    if (!m) return 0;
    var midi = (parseInt(m[2], 10) + 1) * 12 + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function tone(wave, f, t, dur, vol, slide) {
    if (!ac || !f) return;
    var o = ac.createOscillator();
    if (wave === 'tri') o.type = 'triangle';
    else o.setPeriodicWave(waves[wave] || waves.p50);
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(arguments[6] || musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(t, dur, vol, filterFreq, q, dest, slideTo) {
    if (!ac) return;
    var s = ac.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    var f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(filterFreq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    f.Q.value = q || 1;
    var g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  }

  /* ---------- sequencer ---------- */
  /* track: { bpm, loop, lead:'A4:2 .:2 ...', harm:'', bass:'', drum:'x-x- ...' } */
  function parseLine(str) {
    if (!str) return [];
    var out = [], parts = str.trim().split(/\s+/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].split(':');
      out.push({ n: p[0], d: parseInt(p[1] || '4', 10) });
    }
    return out;
  }

  var current = null, timer = null, stepT = 0, nextTime = 0;

  function schedule() {
    if (!current || !ac) return;
    var lookahead = 0.25;
    while (nextTime < ac.currentTime + lookahead) {
      playStep(current, nextTime);
      nextTime += current.stepDur;
      current.step++;
      if (current.step >= current.len) {
        if (current.loop) current.step = 0;
        else { stopMusic(); return; }
      }
    }
  }

  function buildChannel(str, stepsOut) {
    var ev = parseLine(str), grid = [], t = 0;
    for (var i = 0; i < ev.length; i++) {
      grid[t] = ev[i];
      t += ev[i].d;
    }
    if (t > stepsOut.len) stepsOut.len = t;
    return grid;
  }

  function playStep(tr, when) {
    var s = tr.step;
    var e;
    if ((e = tr.lead[s]) && e.n !== '.') tone('p25', freq(e.n), when, e.d * tr.stepDur * 0.92, 0.20);
    if ((e = tr.harm[s]) && e.n !== '.') tone('p12', freq(e.n), when, e.d * tr.stepDur * 0.9, 0.12);
    if ((e = tr.bass[s]) && e.n !== '.') tone('tri', freq(e.n), when, e.d * tr.stepDur * 0.95, 0.30);
    if (tr.drum) {
      var c = tr.drum.charAt(s % tr.drum.length);
      if (c === 'x') noise(when, 0.06, 0.22, 1400, 1.2, musicGain);
      else if (c === 'o') noise(when, 0.13, 0.26, 500, 0.8, musicGain);
      else if (c === 'h') noise(when, 0.03, 0.10, 6000, 2.0, musicGain);
    }
  }

  function stopMusic() {
    current = null;
    if (timer) { clearInterval(timer); timer = null; }
  }
  A.stopMusic = stopMusic;

  A.playMusic = function (name) {
    if (!ac || !enabled) return;
    if (current && current.name === name) return;
    stopMusic();
    var def = TRACKS[name];
    if (!def) return;
    var holder = { len: 0 };
    var tr = {
      name: name, step: 0, loop: def.loop !== false,
      stepDur: 60 / def.bpm / 4,
      lead: buildChannel(def.lead, holder),
      harm: buildChannel(def.harm, holder),
      bass: buildChannel(def.bass, holder),
      drum: def.drum || '',
      len: 0
    };
    tr.len = def.len || holder.len;
    current = tr;
    nextTime = ac.currentTime + 0.06;
    timer = setInterval(schedule, 40);
    schedule();
  };

  A.nowPlaying = function () { return current ? current.name : null; };

  /* ---------- crowd ambience ---------- */
  A.crowdOn = function () {
    if (!ac || crowd) return;
    crowd = ac.createBufferSource();
    crowd.buffer = noiseBuf; crowd.loop = true;
    var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.6;
    crowdGain = ac.createGain(); crowdGain.gain.value = 0.05;
    crowd.connect(f); f.connect(crowdGain); crowdGain.connect(master);
    crowd.start();
  };
  A.crowdOff = function () {
    if (crowd) { try { crowd.stop(); } catch (e) {} crowd = null; crowdGain = null; }
  };
  A.crowdCheer = function (amount) {
    if (!crowdGain || !ac) return;
    var t = ac.currentTime;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(Math.min(0.30, 0.05 + amount), t + 0.05);
    crowdGain.gain.linearRampToValueAtTime(0.05, t + 0.9);
  };

  /* ---------- sound effects ---------- */
  A.sfx = function (name) {
    if (!ac || !enabled) return;
    var t = ac.currentTime;
    switch (name) {
      case 'whiff':   noise(t, 0.09, 0.16, 900, 0.7, sfxGain, 320); break;
      case 'hit':     noise(t, 0.09, 0.55, 260, 0.9, sfxGain);
                      tone('p50', 150, t, 0.07, 0.30, 0.4, sfxGain); break;
      case 'hitbig':  noise(t, 0.17, 0.75, 180, 0.8, sfxGain);
                      tone('p50', 110, t, 0.14, 0.40, 0.35, sfxGain); break;
      case 'block':   noise(t, 0.05, 0.30, 2600, 2.5, sfxGain); break;
      case 'taken':   noise(t, 0.12, 0.60, 200, 0.7, sfxGain);
                      tone('tri', 90, t, 0.16, 0.45, 0.5, sfxGain); break;
      case 'star':    tone('p25', 880, t, 0.06, 0.30, 1, sfxGain);
                      tone('p25', 1175, t + 0.06, 0.06, 0.30, 1, sfxGain);
                      tone('p25', 1760, t + 0.12, 0.14, 0.30, 1, sfxGain); break;
      case 'starhit': noise(t, 0.2, 0.7, 220, 0.7, sfxGain);
                      tone('p12', 300, t, 0.22, 0.35, 0.25, sfxGain); break;
      case 'dodge':   noise(t, 0.05, 0.10, 1800, 2.0, sfxGain); break;
      case 'bell':
        for (var i = 0; i < 3; i++) {
          var bt = t + i * 0.26;
          tone('tri', 1568, bt, 0.24, 0.34, 1, sfxGain);
          tone('p50', 2093, bt, 0.18, 0.10, 1, sfxGain);
        }
        break;
      case 'down':    noise(t, 0.4, 0.7, 120, 0.6, sfxGain);
                      tone('tri', 70, t, 0.45, 0.5, 0.4, sfxGain); break;
      case 'count':   tone('p50', 660, t, 0.11, 0.26, 1, sfxGain); break;
      case 'select':  tone('p50', 880, t, 0.05, 0.25, 1, sfxGain); break;
      case 'confirm': tone('p50', 660, t, 0.05, 0.25, 1, sfxGain);
                      tone('p50', 990, t + 0.05, 0.09, 0.25, 1, sfxGain); break;
      case 'deny':    tone('p50', 180, t, 0.14, 0.22, 0.7, sfxGain); break;
      case 'heal':    tone('p25', 523, t, 0.06, 0.2, 1, sfxGain);
                      tone('p25', 784, t + 0.06, 0.10, 0.2, 1, sfxGain); break;
      case 'drink':   tone('tri', 200, t, 0.3, 0.25, 1.6, sfxGain); break;
      case 'teleport':tone('p12', 300, t, 0.22, 0.22, 4, sfxGain); break;
      case 'charge':  noise(t, 0.5, 0.28, 300, 0.5, sfxGain, 900); break;
    }
  };

  /* ---------- music data ---------- */
  var TRACKS = {
    title: {
      bpm: 132, loop: true,
      lead: 'A4:4 .:4 C5:2 D5:2 E5:4 .:4 E5:2 F5:2 G5:4 E5:4 C5:4 A4:4 ' +
            'F4:4 .:4 A4:2 C5:2 E5:4 .:4 D5:2 C5:2 B4:4 .:4 A4:8 .:8',
      harm: 'E4:8 A4:8 C5:8 E4:8 C4:8 E4:8 G4:8 A4:8 .:16',
      bass: 'A2:4 A2:4 A2:4 A2:4 F2:4 F2:4 F2:4 F2:4 C3:4 C3:4 C3:4 C3:4 E2:4 E2:4 E2:4 E2:4 A2:8 .:8',
      drum: 'x..h o..h x..h o.hh'
    },
    fight: {
      bpm: 160, loop: true,
      lead: 'A4:2 A4:2 C5:2 A4:2 E5:4 D5:2 C5:2 ' +
            'A4:2 A4:2 C5:2 E5:2 G5:4 E5:4 ' +
            'F5:2 F5:2 E5:2 D5:2 C5:4 A4:4 ' +
            'E5:2 D5:2 C5:2 B4:2 A4:8',
      harm: 'A3:4 C4:4 E4:4 C4:4 A3:4 E4:4 G4:4 E4:4 F4:4 A4:4 C5:4 A4:4 E4:4 G4:4 C4:4 E4:4',
      bass: 'A2:2 A2:2 A2:2 E2:2 A2:2 A2:2 C3:2 E2:2 ' +
            'A2:2 A2:2 A2:2 E2:2 A2:2 A2:2 E2:2 G2:2 ' +
            'F2:2 F2:2 F2:2 C3:2 F2:2 F2:2 A2:2 C3:2 ' +
            'E2:2 E2:2 E2:2 B2:2 E2:2 E2:2 G2:2 E2:2',
      drum: 'x.h.o.h.x.h.o.hh'
    },
    card: {
      bpm: 108, loop: true,
      lead: 'E4:4 G4:4 C5:8 B4:4 G4:4 E4:8 F4:4 A4:4 D5:8 C5:4 A4:4 E4:8',
      harm: 'C4:8 E4:8 G4:8 E4:8 D4:8 F4:8 A4:8 C4:8',
      bass: 'C2:8 C2:8 G2:8 G2:8 D2:8 D2:8 A2:8 C3:8',
      drum: '................'
    },
    ko: {
      bpm: 150, loop: false,
      lead: 'C5:2 E5:2 G5:2 C6:6 .:2 G5:2 C6:10',
      harm: 'E4:2 G4:2 C5:2 E5:6 .:2 E5:2 G5:10',
      bass: 'C3:4 C3:4 C3:8 G2:4 C3:12',
      drum: 'xxxxo...x...o...'
    },
    lose: {
      bpm: 96, loop: false,
      lead: 'G4:4 F4:4 E4:4 D4:4 C4:12 .:4',
      harm: 'E4:4 D4:4 C4:4 B3:4 A3:12 .:4',
      bass: 'C3:4 B2:4 A2:4 G2:4 C2:16',
      drum: '................'
    },
    champion: {
      bpm: 140, loop: true,
      lead: 'C5:2 C5:2 C5:2 C5:6 G4:2 A4:2 C5:8 ' +
            'D5:2 D5:2 D5:2 D5:6 C5:2 D5:2 E5:8 ' +
            'F5:4 E5:4 D5:4 C5:4 G5:8 E5:8',
      harm: 'E4:8 G4:8 E4:8 G4:8 F4:8 A4:8 G4:8 C5:8 C5:8 E5:8',
      bass: 'C3:4 G2:4 C3:4 G2:4 F2:4 C3:4 F2:4 C3:4 G2:4 D3:4 G2:4 C3:4 C3:8 C3:8',
      drum: 'x.h.o.h.x.h.o.h.'
    },
    dream: {
      bpm: 116, loop: true,
      lead: 'A4:2 .:2 A4:2 .:2 C5:4 .:4 A4:2 .:2 A4:2 .:2 E5:4 D5:4 ' +
            'F5:2 .:2 E5:2 .:2 C5:4 .:4 A4:8 .:8',
      harm: 'A3:16 C4:16 E4:16 A3:16',
      bass: 'A1:2 A1:2 A1:2 A1:2 A1:2 A1:2 A1:2 A1:2 F1:2 F1:2 F1:2 F1:2 E1:2 E1:2 E1:2 E1:2',
      drum: 'o...x...o...x..h'
    },
    ending: {
      bpm: 128, loop: true,
      lead: 'G4:4 C5:4 E5:4 G5:4 F5:2 E5:2 D5:4 C5:8 ' +
            'A4:4 C5:4 F5:4 A5:4 G5:2 F5:2 E5:4 C5:8',
      harm: 'C4:8 E4:8 G4:8 E4:8 F4:8 A4:8 C5:8 E4:8',
      bass: 'C3:8 G2:8 C3:8 G2:8 F2:8 C3:8 G2:8 C3:8',
      drum: 'x.h.o.h.x.h.o.h.'
    }
  };
  A.TRACKS = TRACKS;
})();
