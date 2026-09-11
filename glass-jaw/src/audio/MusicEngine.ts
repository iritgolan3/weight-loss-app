import type { SynthBus } from './Synth';

export type TrackId =
  | 'menu' | 'career' | 'training' | 'rookie' | 'pro' | 'world'
  | 'boss' | 'final' | 'victory' | 'defeat' | 'versus';

interface TrackDef {
  bpm: number;
  /** Root note as a MIDI number. */
  root: number;
  /** Semitone offsets forming the scale. */
  scale: number[];
  /** Scale degrees per sixteenth. -1 rests, values may be negative (octave down). */
  bass: number[];
  lead: number[];
  /** Chord voicings as scale degrees, one per bar. */
  chords: number[][];
  kick: number[];
  snare: number[];
  hat: number[];
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  /** Repeat the lead an octave up for a brighter feel. */
  doubleLead: boolean;
  loop: boolean;
  /** Master gain for this track. */
  gain: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];

const R = -1; // rest

/**
 * Original chiptune-adjacent arcade tracks.
 *
 * These are written as patterns rather than recordings: an eight-bar loop of
 * bass, lead, chord stabs and drums, scheduled against the audio clock. The
 * style is deliberately "retro arcade energy" without quoting any existing
 * melody — every note sequence here is composed for this game.
 */
const TRACKS: Record<TrackId, TrackDef> = {
  menu: {
    bpm: 126, root: 57, scale: MINOR, leadWave: 'square', bassWave: 'sawtooth',
    bass: [0, R, 0, R, 4, R, 0, R, 2, R, 2, R, 5, R, 4, R],
    lead: [7, R, 6, 7, R, 4, R, 2, 4, R, R, 0, 2, R, R, R],
    chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    doubleLead: true, loop: true, gain: 0.5,
  },
  career: {
    bpm: 112, root: 55, scale: MAJOR, leadWave: 'triangle', bassWave: 'sawtooth',
    bass: [0, R, R, 0, R, 4, R, R, 5, R, R, 5, R, 2, R, R],
    lead: [4, R, 2, R, 0, R, 2, 4, R, 5, R, 4, 2, R, R, R],
    chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
    doubleLead: false, loop: true, gain: 0.42,
  },
  training: {
    bpm: 104, root: 53, scale: MAJOR, leadWave: 'triangle', bassWave: 'triangle',
    bass: [0, R, R, R, 4, R, R, R, 2, R, R, R, 5, R, R, R],
    lead: [2, R, 4, R, R, 2, R, 0, R, R, 4, R, 2, R, R, R],
    chords: [[0, 2, 4], [4, 6, 1], [1, 3, 5], [5, 0, 2]],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    doubleLead: false, loop: true, gain: 0.34,
  },
  rookie: {
    bpm: 142, root: 60, scale: MAJOR, leadWave: 'square', bassWave: 'square',
    bass: [0, 0, R, 0, 4, R, 0, R, 5, 5, R, 5, 2, R, 4, R],
    lead: [0, 2, 4, R, 4, 2, 0, R, 5, 4, 2, R, 2, R, R, R],
    chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [4, 6, 1]],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    doubleLead: true, loop: true, gain: 0.46,
  },
  pro: {
    bpm: 152, root: 57, scale: MINOR, leadWave: 'square', bassWave: 'sawtooth',
    bass: [0, R, 0, 0, R, 3, R, 0, 5, R, 5, 5, R, 4, R, 2],
    lead: [4, R, 3, 4, 6, R, 4, R, 2, R, 0, 2, 3, R, R, R],
    chords: [[0, 2, 4], [3, 5, 0], [5, 0, 2], [4, 6, 1]],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    doubleLead: true, loop: true, gain: 0.48,
  },
  world: {
    bpm: 158, root: 55, scale: MINOR, leadWave: 'sawtooth', bassWave: 'sawtooth',
    bass: [0, 0, R, 0, 6, R, 0, R, 3, 3, R, 3, 2, R, 1, R],
    lead: [0, R, 3, R, 4, 3, 2, R, 6, R, 4, R, 3, 2, R, R],
    chords: [[0, 3, 5], [6, 1, 3], [4, 6, 1], [2, 4, 6]],
    kick: [1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1],
    hat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
    doubleLead: false, loop: true, gain: 0.5,
  },
  boss: {
    bpm: 148, root: 50, scale: PHRYG, leadWave: 'sawtooth', bassWave: 'sawtooth',
    bass: [0, 0, 0, R, 1, R, 0, R, 0, 0, 0, R, 6, R, 5, R],
    lead: [0, R, 1, R, 0, R, 6, 5, R, 4, R, 3, 1, R, 0, R],
    chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]],
    kick: [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    doubleLead: true, loop: true, gain: 0.54,
  },
  final: {
    bpm: 172, root: 48, scale: PHRYG, leadWave: 'sawtooth', bassWave: 'square',
    bass: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 4, 3, 1],
    lead: [0, 1, 0, 6, 0, 1, 3, 1, 0, 1, 0, 6, 5, 4, 3, 1],
    chords: [[0, 1, 4], [0, 3, 5], [6, 1, 4], [0, 1, 4]],
    kick: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    doubleLead: true, loop: true, gain: 0.56,
  },
  versus: {
    bpm: 132, root: 52, scale: MINOR, leadWave: 'sawtooth', bassWave: 'sawtooth',
    bass: [0, R, R, R, 0, R, R, R, 5, R, R, R, 4, R, R, R],
    lead: [0, R, R, R, R, R, R, R, 4, R, R, R, R, R, R, R],
    chords: [[0, 2, 4], [0, 2, 4], [5, 0, 2], [4, 6, 1]],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    hat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    doubleLead: false, loop: true, gain: 0.5,
  },
  victory: {
    bpm: 136, root: 60, scale: MAJOR, leadWave: 'square', bassWave: 'square',
    bass: [0, R, 0, R, 4, R, 4, R, 5, R, 5, R, 0, R, R, R],
    lead: [0, 2, 4, 7, R, 7, R, 6, 7, R, R, R, R, R, R, R],
    chords: [[0, 2, 4], [4, 6, 1], [3, 5, 0], [0, 2, 4]],
    kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    doubleLead: true, loop: false, gain: 0.52,
  },
  defeat: {
    bpm: 84, root: 53, scale: MINOR, leadWave: 'triangle', bassWave: 'triangle',
    bass: [0, R, R, R, R, R, R, R, 6, R, R, R, R, R, R, R],
    lead: [4, R, R, 3, R, R, 2, R, R, 1, R, R, 0, R, R, R],
    chords: [[0, 2, 4], [6, 1, 3], [5, 0, 2], [0, 2, 4]],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    doubleLead: false, loop: false, gain: 0.4,
  },
};

function midiToHz(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/**
 * Lookahead step sequencer. Notes are scheduled against the audio clock a
 * fraction of a second ahead of time, so timing is sample-accurate and does not
 * drift when the render thread hitches.
 */
export class MusicEngine {
  private current: TrackId | null = null;
  private def: TrackDef | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private out: GainNode | null = null;
  private bar = 0;
  /** 0..1 — raises the mix as a fight gets desperate. */
  intensity = 0;
  private stopping = false;

  private static readonly LOOKAHEAD = 0.14;
  private static readonly TICK_MS = 25;

  constructor(private readonly bus: SynthBus) {}

  get playing(): TrackId | null { return this.current; }

  play(id: TrackId, fadeIn = 0.6): void {
    if (this.current === id && !this.stopping) return;
    this.stop(0.25);
    const def = TRACKS[id];
    if (!def) return;

    this.def = def;
    this.current = id;
    this.step = 0;
    this.bar = 0;
    this.stopping = false;

    const ctx = this.bus.ctx;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out.gain.exponentialRampToValueAtTime(def.gain, ctx.currentTime + fadeIn);
    this.out.connect(this.bus.music);

    this.nextNoteTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), MusicEngine.TICK_MS);
  }

  stop(fadeOut = 0.5): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const out = this.out;
    if (out) {
      const ctx = this.bus.ctx;
      const now = ctx.currentTime;
      try {
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now);
        out.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fadeOut));
      } catch { /* context may be closing */ }
      setTimeout(() => { try { out.disconnect(); } catch { /* already gone */ } }, fadeOut * 1000 + 80);
    }
    this.out = null;
    this.current = null;
    this.def = null;
  }

  /** Ducks the music briefly, e.g. under a knockdown. */
  duck(seconds = 1.2, amount = 0.28): void {
    if (!this.out || !this.def) return;
    const ctx = this.bus.ctx;
    const now = ctx.currentTime;
    const g = this.out.gain;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(0.0001, g.value), now);
      g.exponentialRampToValueAtTime(Math.max(0.0001, this.def.gain * amount), now + 0.1);
      g.exponentialRampToValueAtTime(this.def.gain, now + seconds);
    } catch { /* ignore */ }
  }

  private schedule(): void {
    const def = this.def;
    if (!def || !this.out) return;
    const ctx = this.bus.ctx;
    const stepDur = 60 / def.bpm / 4;

    while (this.nextNoteTime < ctx.currentTime + MusicEngine.LOOKAHEAD) {
      this.playStep(def, this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar++;
        if (!def.loop && this.bar >= 4) { this.stop(1.2); return; }
      }
    }
  }

  private playStep(def: TrackDef, step: number, t: number, stepDur: number): void {
    const ctx = this.bus.ctx;
    const out = this.out!;
    const deg = (d: number): number => {
      const oct = Math.floor(d / def.scale.length);
      const idx = ((d % def.scale.length) + def.scale.length) % def.scale.length;
      return def.root + def.scale[idx] + oct * 12;
    };
    const boost = 1 + this.intensity * 0.35;

    // --- Bass ---
    const b = def.bass[step];
    if (b !== R) {
      this.note(def.bassWave, midiToHz(deg(b) - 12), t, stepDur * 1.7, 0.2 * boost, out, 700);
    }

    // --- Lead ---
    const l = def.lead[step];
    if (l !== R) {
      this.note(def.leadWave, midiToHz(deg(l) + 12), t, stepDur * 1.6, 0.11 * boost, out, 5200);
      if (def.doubleLead) {
        this.note(def.leadWave, midiToHz(deg(l) + 24), t, stepDur * 1.3, 0.045 * boost, out, 6500);
      }
    }

    // --- Chord stab on the downbeat of each half-bar ---
    if (step === 0 || step === 8) {
      const chord = def.chords[this.bar % def.chords.length];
      for (const c of chord) {
        this.note('triangle', midiToHz(deg(c)), t, stepDur * 5, 0.05 * boost, out, 2600);
      }
    }

    // --- Drums ---
    if (def.kick[step]) this.kick(t, out);
    if (def.snare[step]) this.snare(t, out, stepDur);
    if (def.hat[step]) this.hat(t, out, stepDur);
    void ctx;
  }

  private note(
    type: OscillatorType, freq: number, t: number, dur: number,
    vol: number, dest: AudioNode, cutoff: number,
  ): void {
    const ctx = this.bus.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.4), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number, dest: AudioNode): void {
    const ctx = this.bus.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.34, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + 0.22);
  }

  private snare(t: number, dest: AudioNode, stepDur: number): void {
    const ctx = this.bus.ctx;
    const len = Math.max(0.05, stepDur * 1.4);
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.19, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(hp).connect(g).connect(dest);
    s.start(t);
  }

  private hat(t: number, dest: AudioNode, stepDur: number): void {
    const ctx = this.bus.ctx;
    const len = Math.min(0.05, stepDur * 0.6);
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(hp).connect(g).connect(dest);
    s.start(t);
  }
}

export const TRACK_NAMES: Record<TrackId, string> = {
  menu: 'Ring Entrance',
  career: 'The Long Road',
  training: 'Roadwork',
  rookie: 'Local Hero',
  pro: 'Card Night',
  world: 'No Home Crowd',
  boss: 'Belt Holder',
  final: 'Sixty-Five',
  versus: 'Tale Of The Tape',
  victory: "Hand Raised",
  defeat: 'The Long Walk',
};
