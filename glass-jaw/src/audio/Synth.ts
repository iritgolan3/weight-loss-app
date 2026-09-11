/**
 * Procedural sound design.
 *
 * Every sound in this game is synthesized from oscillators and shaped noise at
 * runtime. Nothing is sampled, which makes the entire audio track original by
 * construction and keeps the download to zero bytes of assets.
 */

export interface SynthBus {
  ctx: AudioContext;
  sfx: GainNode;
  music: GainNode;
  voice: GainNode;
  crowd: GainNode;
}

/** A cached white-noise buffer — the basis of impacts, whooshes and crowds. */
export function makeNoise(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    // A touch of brown noise makes impacts feel heavier than pure white.
    last = (last + 0.02 * white) / 1.02;
    d[i] = white * 0.7 + last * 3.2;
  }
  return buf;
}

function env(
  _ctx: AudioContext, param: AudioParam, peak: number,
  attack: number, decay: number, t0: number, sustain = 0, hold = 0,
): void {
  param.cancelScheduledValues(t0);
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
  if (hold > 0) param.setValueAtTime(Math.max(0.0001, peak), t0 + attack + hold);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain + 0.0001), t0 + attack + hold + decay);
}

function osc(
  ctx: AudioContext, type: OscillatorType, freq: number, t0: number, dur: number,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  return o;
}

function noiseSource(ctx: AudioContext, buf: AudioBuffer, t0: number, dur: number, rate = 1): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  s.loop = true;
  s.start(t0, Math.random() * 1.5);
  s.stop(t0 + dur + 0.05);
  return s;
}

// ---------------------------------------------------------------------------
// IMPACTS
// ---------------------------------------------------------------------------

/**
 * A punch: a noise transient through a bandpass (the "slap") stacked on a
 * pitched-down sine (the "thump"). Weight moves both the filter and the sine.
 */
export function punch(bus: SynthBus, noise: AudioBuffer, weight: number, body: boolean, t0: number): void {
  const { ctx, sfx } = bus;
  const dur = 0.1 + weight * 0.14;

  const g = ctx.createGain();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(body ? 420 - weight * 90 : 1500 - weight * 420, t0);
  bp.Q.value = 0.9;
  const n = noiseSource(ctx, noise, t0, dur, 1 + weight * 0.2);
  n.connect(bp).connect(g).connect(sfx);
  env(ctx, g.gain, 0.5 + weight * 0.32, 0.002, dur, t0);

  const thump = ctx.createGain();
  const o = osc(ctx, 'sine', body ? 96 - weight * 14 : 158 - weight * 30, t0, dur * 1.5);
  o.frequency.exponentialRampToValueAtTime(body ? 40 : 56, t0 + dur * 1.2);
  o.connect(thump).connect(sfx);
  env(ctx, thump.gain, 0.34 + weight * 0.3, 0.003, dur * 1.5, t0);

  if (weight >= 2) {
    // Heavy shots get a sub-bass drop you feel more than hear.
    const sub = ctx.createGain();
    const so = osc(ctx, 'sine', 72, t0, 0.5);
    so.frequency.exponentialRampToValueAtTime(28, t0 + 0.42);
    so.connect(sub).connect(sfx);
    env(ctx, sub.gain, 0.42, 0.006, 0.5, t0);
  }
}

/** A guard absorbing the shot: dull, damped, no ring. */
export function block(bus: SynthBus, noise: AudioBuffer, correct: boolean, t0: number): void {
  const { ctx, sfx } = bus;
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(correct ? 900 : 1800, t0);
  const n = noiseSource(ctx, noise, t0, 0.1);
  n.connect(lp).connect(g).connect(sfx);
  env(ctx, g.gain, correct ? 0.32 : 0.42, 0.002, 0.1, t0);

  const t = ctx.createGain();
  const o = osc(ctx, 'triangle', correct ? 180 : 250, t0, 0.12);
  o.connect(t).connect(sfx);
  env(ctx, t.gain, 0.16, 0.003, 0.12, t0);
}

/** A parry: a bright metallic ping via simple FM. */
export function parry(bus: SynthBus, t0: number): void {
  const { ctx, sfx } = bus;
  const carrier = osc(ctx, 'sine', 880, t0, 0.5);
  const mod = osc(ctx, 'sine', 1330, t0, 0.5);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(700, t0);
  modGain.gain.exponentialRampToValueAtTime(20, t0 + 0.35);
  mod.connect(modGain).connect(carrier.frequency);

  const g = ctx.createGain();
  carrier.connect(g).connect(sfx);
  env(ctx, g.gain, 0.34, 0.002, 0.5, t0);

  // A rising sparkle on top.
  const s = ctx.createGain();
  const so = osc(ctx, 'square', 1200, t0, 0.2);
  so.frequency.exponentialRampToValueAtTime(2600, t0 + 0.16);
  so.connect(s).connect(sfx);
  env(ctx, s.gain, 0.1, 0.002, 0.2, t0);
}

/** A slip: a filtered noise whoosh that sweeps across the stereo field. */
export function whoosh(bus: SynthBus, noise: AudioBuffer, dir: number, strong: boolean, t0: number): void {
  const { ctx, sfx } = bus;
  const dur = strong ? 0.4 : 0.24;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.4;
  bp.frequency.setValueAtTime(420, t0);
  bp.frequency.exponentialRampToValueAtTime(strong ? 2600 : 1500, t0 + dur * 0.55);
  bp.frequency.exponentialRampToValueAtTime(300, t0 + dur);

  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(0, t0);
  pan.pan.linearRampToValueAtTime(dir * 0.75, t0 + dur);

  const g = ctx.createGain();
  const n = noiseSource(ctx, noise, t0, dur);
  n.connect(bp).connect(pan).connect(g).connect(sfx);
  env(ctx, g.gain, strong ? 0.3 : 0.18, 0.02, dur, t0);
}

/** A counter landing: impact plus a rising confirmation sweep. */
export function counterHit(bus: SynthBus, noise: AudioBuffer, t0: number): void {
  punch(bus, noise, 2.4, false, t0);
  const { ctx, sfx } = bus;
  const g = ctx.createGain();
  const o = osc(ctx, 'sawtooth', 320, t0, 0.34);
  o.frequency.exponentialRampToValueAtTime(1250, t0 + 0.24);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t0);
  lp.frequency.exponentialRampToValueAtTime(5200, t0 + 0.24);
  o.connect(lp).connect(g).connect(sfx);
  env(ctx, g.gain, 0.22, 0.005, 0.34, t0);
}

/** A special punch: layered impact, sub drop and a shimmering tail. */
export function special(bus: SynthBus, noise: AudioBuffer, tier: number, t0: number): void {
  const { ctx, sfx } = bus;
  punch(bus, noise, 2.6 + tier * 0.3, false, t0);
  for (let i = 0; i < tier + 1; i++) {
    const g = ctx.createGain();
    const o = osc(ctx, 'square', 260 * Math.pow(1.5, i), t0 + i * 0.035, 0.5);
    o.frequency.exponentialRampToValueAtTime(80, t0 + i * 0.035 + 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    o.connect(lp).connect(g).connect(sfx);
    env(ctx, g.gain, 0.2, 0.004, 0.5, t0 + i * 0.035);
  }
}

/** The canvas: a heavy thud and a long low rumble. */
export function knockdown(bus: SynthBus, noise: AudioBuffer, t0: number): void {
  const { ctx, sfx } = bus;
  punch(bus, noise, 3, true, t0);
  const g = ctx.createGain();
  const o = osc(ctx, 'sine', 58, t0 + 0.1, 0.9);
  o.frequency.exponentialRampToValueAtTime(24, t0 + 0.85);
  o.connect(g).connect(sfx);
  env(ctx, g.gain, 0.5, 0.02, 0.9, t0 + 0.1);

  const rg = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(260, t0 + 0.1);
  lp.frequency.exponentialRampToValueAtTime(60, t0 + 1);
  const n = noiseSource(ctx, noise, t0 + 0.1, 1);
  n.connect(lp).connect(rg).connect(sfx);
  env(ctx, rg.gain, 0.34, 0.03, 1, t0 + 0.1);
}

/** Dizzy: a wobbling, detuned two-tone drone. */
export function stunLoop(bus: SynthBus, t0: number, dur: number): AudioNode {
  const { ctx, sfx } = bus;
  const g = ctx.createGain();
  const o1 = osc(ctx, 'triangle', 380, t0, dur);
  const o2 = osc(ctx, 'triangle', 392, t0, dur);
  const lfo = osc(ctx, 'sine', 5.5, t0, dur);
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 60;
  lfo.connect(lfoGain);
  lfoGain.connect(o1.frequency);
  lfoGain.connect(o2.frequency);
  o1.connect(g); o2.connect(g);
  g.connect(sfx);
  env(ctx, g.gain, 0.13, 0.08, dur, t0, 0.6, dur * 0.6);
  return g;
}

// ---------------------------------------------------------------------------
// RING SOUNDS
// ---------------------------------------------------------------------------

/** The bell: inharmonic partials with a long decay. */
export function bell(bus: SynthBus, t0: number, count = 1): void {
  const { ctx, sfx } = bus;
  for (let c = 0; c < count; c++) {
    const start = t0 + c * 0.55;
    const partials = [1, 2.02, 2.98, 4.16, 5.43, 6.79];
    const gains = [1, 0.6, 0.42, 0.3, 0.2, 0.14];
    for (let i = 0; i < partials.length; i++) {
      const g = ctx.createGain();
      const o = osc(ctx, 'sine', 660 * partials[i], start, 2.4);
      o.connect(g).connect(sfx);
      env(ctx, g.gain, 0.16 * gains[i], 0.004, 2.2, start);
    }
    // Strike transient.
    const cg = ctx.createGain();
    const co = osc(ctx, 'square', 2400, start, 0.05);
    co.connect(cg).connect(sfx);
    env(ctx, cg.gain, 0.1, 0.001, 0.05, start);
  }
}

/** Crowd: band-limited noise with a slow swell. */
export function crowd(bus: SynthBus, noise: AudioBuffer, intensity: number, dur: number, t0: number): void {
  const { ctx, crowd: out } = bus;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(700 + intensity * 700, t0);
  bp.Q.value = 0.55;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 260;
  const g = ctx.createGain();
  const n = noiseSource(ctx, noise, t0, dur, 0.85 + intensity * 0.3);
  n.connect(bp).connect(hp).connect(g).connect(out);
  env(ctx, g.gain, 0.16 + intensity * 0.4, dur * 0.18, dur * 0.82, t0);
}

/** A disappointed "ohhh" — lower, slower, falling. */
export function crowdGroan(bus: SynthBus, noise: AudioBuffer, t0: number): void {
  const { ctx, crowd: out } = bus;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(620, t0);
  bp.frequency.exponentialRampToValueAtTime(260, t0 + 1);
  bp.Q.value = 1.1;
  const g = ctx.createGain();
  const n = noiseSource(ctx, noise, t0, 1.2, 0.75);
  n.connect(bp).connect(g).connect(out);
  env(ctx, g.gain, 0.3, 0.14, 1.05, t0);
}

/**
 * Referee count. Real speech is out of scope, so this is a formant-ish tone:
 * a sawtooth through two resonant bandpasses reads as a shouted vowel.
 */
export function refCount(bus: SynthBus, n: number, t0: number): void {
  const { ctx, voice } = bus;
  const base = 150 + (n % 3) * 14;
  const o = osc(ctx, 'sawtooth', base, t0, 0.42);
  o.frequency.setValueAtTime(base * 1.18, t0);
  o.frequency.exponentialRampToValueAtTime(base, t0 + 0.2);

  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass'; f1.frequency.value = 620; f1.Q.value = 6;
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass'; f2.frequency.value = 1180; f2.Q.value = 7;
  const mix = ctx.createGain();
  o.connect(f1).connect(mix);
  o.connect(f2).connect(mix);

  const g = ctx.createGain();
  mix.connect(g).connect(voice);
  env(ctx, g.gain, 0.5, 0.02, 0.34, t0, 0, 0.07);
}

/**
 * A fighter's vocal reaction. `pitch` and `grit` come from the boxer's own
 * voice profile, so each of the sixteen sounds distinct.
 */
export function grunt(bus: SynthBus, noise: AudioBuffer, pitch: number, grit: number, hurt: number, t0: number): void {
  const { ctx, voice } = bus;
  const base = 130 * pitch;
  const dur = 0.16 + hurt * 0.2;

  const o = osc(ctx, grit > 0.5 ? 'sawtooth' : 'square', base * (1 + hurt * 0.35), t0, dur);
  o.frequency.exponentialRampToValueAtTime(base * 0.72, t0 + dur);

  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 480 + hurt * 340;
  f1.Q.value = 5;
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 1050 + hurt * 500;
  f2.Q.value = 6;

  const mix = ctx.createGain();
  o.connect(f1).connect(mix);
  o.connect(f2).connect(mix);

  // Grit adds a breathy noise layer.
  if (grit > 0.2) {
    const ng = ctx.createGain();
    const nbp = ctx.createBiquadFilter();
    nbp.type = 'bandpass';
    nbp.frequency.value = 1400;
    nbp.Q.value = 1.4;
    const n = noiseSource(ctx, noise, t0, dur);
    n.connect(nbp).connect(ng).connect(mix);
    env(ctx, ng.gain, 0.2 * grit, 0.005, dur, t0);
  }

  const g = ctx.createGain();
  mix.connect(g).connect(voice);
  env(ctx, g.gain, 0.28 + hurt * 0.22, 0.008, dur, t0);
}

// ---------------------------------------------------------------------------
// TELEGRAPH CUES AND UI
// ---------------------------------------------------------------------------

/** Distinct pitched motifs so a tell is audible as well as visible. */
export function tellCue(bus: SynthBus, kind: 'low' | 'big' | 'fast', t0: number): void {
  const { ctx, sfx } = bus;
  const notes = kind === 'big' ? [196, 147] : kind === 'fast' ? [880, 1174] : [392, 466];
  const dur = kind === 'big' ? 0.34 : 0.12;
  notes.forEach((f, i) => {
    const g = ctx.createGain();
    const o = osc(ctx, kind === 'big' ? 'sawtooth' : 'triangle', f, t0 + i * dur * 0.5, dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = kind === 'big' ? 1200 : 4000;
    o.connect(lp).connect(g).connect(sfx);
    env(ctx, g.gain, kind === 'big' ? 0.22 : 0.1, 0.006, dur, t0 + i * dur * 0.5);
  });
}

export function uiBlip(bus: SynthBus, kind: 'move' | 'confirm' | 'back' | 'deny' | 'unlock', t0: number): void {
  const { ctx, sfx } = bus;
  const spec: Record<string, { f: number[]; type: OscillatorType; dur: number; vol: number }> = {
    move: { f: [520], type: 'square', dur: 0.05, vol: 0.09 },
    confirm: { f: [523, 784], type: 'square', dur: 0.09, vol: 0.14 },
    back: { f: [392, 262], type: 'triangle', dur: 0.09, vol: 0.12 },
    deny: { f: [180, 140], type: 'sawtooth', dur: 0.13, vol: 0.12 },
    unlock: { f: [523, 659, 784, 1047], type: 'square', dur: 0.1, vol: 0.14 },
  };
  const s = spec[kind];
  s.f.forEach((f, i) => {
    const g = ctx.createGain();
    const o = osc(ctx, s.type, f, t0 + i * s.dur * 0.7, s.dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    o.connect(lp).connect(g).connect(sfx);
    env(ctx, g.gain, s.vol, 0.003, s.dur, t0 + i * s.dur * 0.7);
  });
}

/** Earning a token: a bright rising arpeggio. */
export function tokenChime(bus: SynthBus, tier: number, t0: number): void {
  const { ctx, sfx } = bus;
  const scale = [784, 988, 1175, 1568];
  for (let i = 0; i <= Math.min(3, tier); i++) {
    const g = ctx.createGain();
    const o = osc(ctx, 'triangle', scale[i], t0 + i * 0.05, 0.3);
    o.connect(g).connect(sfx);
    env(ctx, g.gain, 0.18, 0.004, 0.3, t0 + i * 0.05);
    const g2 = ctx.createGain();
    const o2 = osc(ctx, 'sine', scale[i] * 2, t0 + i * 0.05, 0.24);
    o2.connect(g2).connect(sfx);
    env(ctx, g2.gain, 0.07, 0.004, 0.24, t0 + i * 0.05);
  }
}

export { env, osc, noiseSource };
