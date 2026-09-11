import * as S from './Synth';
import type { SynthBus } from './Synth';
import { MusicEngine, TrackId } from './MusicEngine';
import type { Settings } from '../settings/SettingsSystem';

export type SfxId =
  | 'punchLight' | 'punchMed' | 'punchHeavy' | 'punchBody'
  | 'block' | 'blockWrong' | 'parry' | 'dodge' | 'perfectDodge'
  | 'counter' | 'special1' | 'special2' | 'special3'
  | 'knockdown' | 'stun' | 'guardBreak'
  | 'bell' | 'bell3' | 'tellLow' | 'tellBig' | 'tellFast'
  | 'token' | 'tokenMax' | 'crowdCheer' | 'crowdBig' | 'crowdGroan'
  | 'uiMove' | 'uiConfirm' | 'uiBack' | 'uiDeny' | 'uiUnlock';

/**
 * Audio front end.
 *
 * The AudioContext cannot be created before a user gesture, so everything here
 * is safe to call at any time: before unlock, calls are silently dropped rather
 * than throwing. That keeps callers free of "is audio ready" checks.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private bus: SynthBus | null = null;
  private noise: AudioBuffer | null = null;
  music: MusicEngine | null = null;

  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  /** True once the context exists and is running. */
  unlocked = false;
  /** True when the browser refused audio entirely. */
  failed = false;

  private volumes = { master: 0.85, music: 0.5, sfx: 0.9, voice: 0.8, crowd: 0.6 };
  /** Throttles identical rapid sounds so a combo does not clip. */
  private lastPlayed = new Map<string, number>();

  /** Attempts to create the context. Safe to call repeatedly. */
  unlock(): boolean {
    if (this.unlocked) return true;
    if (this.failed) return false;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) { this.failed = true; return false; }
      const ctx = new Ctor();
      this.ctx = ctx;

      const master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      // Gentle glue so a knockdown plus crowd plus music never clips.
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      master.connect(comp).connect(ctx.destination);

      const mk = () => { const g = ctx.createGain(); g.connect(master); return g; };
      this.bus = { ctx, sfx: mk(), music: mk(), voice: mk(), crowd: mk() };
      this.masterGain = master;
      this.compressor = comp;
      this.noise = S.makeNoise(ctx, 2);
      this.music = new MusicEngine(this.bus);

      this.applyVolumes();
      void ctx.resume();
      this.unlocked = ctx.state === 'running' || ctx.state === 'suspended';
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  applySettings(s: Settings): void {
    this.volumes = {
      master: s.masterVolume,
      music: s.musicVolume,
      sfx: s.sfxVolume,
      voice: s.voiceVolume,
      crowd: s.crowdVolume,
    };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.bus || !this.masterGain) return;
    const v = this.volumes;
    const t = this.bus.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(v.master, t, 0.02);
    this.bus.music.gain.setTargetAtTime(v.music, t, 0.02);
    this.bus.sfx.gain.setTargetAtTime(v.sfx, t, 0.02);
    this.bus.voice.gain.setTargetAtTime(v.voice, t, 0.02);
    this.bus.crowd.gain.setTargetAtTime(v.crowd, t, 0.02);
  }

  private now(): number { return this.ctx ? this.ctx.currentTime : 0; }

  /** Rejects a repeat of the same id inside `ms`. */
  private throttle(id: string, ms: number): boolean {
    const t = performance.now();
    const last = this.lastPlayed.get(id) ?? -1e9;
    if (t - last < ms) return false;
    this.lastPlayed.set(id, t);
    return true;
  }

  // -- Public API ------------------------------------------------------------

  play(id: SfxId, opts: { weight?: number; dir?: number; tier?: number } = {}): void {
    if (!this.bus || !this.noise) return;
    const t = this.now() + 0.001;
    const b = this.bus, n = this.noise;

    switch (id) {
      case 'punchLight': S.punch(b, n, 1, false, t); break;
      case 'punchMed': S.punch(b, n, opts.weight ?? 1.6, false, t); break;
      case 'punchHeavy': S.punch(b, n, opts.weight ?? 2.6, false, t); break;
      case 'punchBody': S.punch(b, n, opts.weight ?? 1.4, true, t); break;
      case 'block': S.block(b, n, true, t); break;
      case 'blockWrong': S.block(b, n, false, t); break;
      case 'parry': S.parry(b, t); break;
      case 'dodge': S.whoosh(b, n, opts.dir ?? 1, false, t); break;
      case 'perfectDodge': S.whoosh(b, n, opts.dir ?? 1, true, t); break;
      case 'counter': S.counterHit(b, n, t); break;
      case 'special1': S.special(b, n, 1, t); break;
      case 'special2': S.special(b, n, 2, t); break;
      case 'special3': S.special(b, n, 3, t); break;
      case 'knockdown': S.knockdown(b, n, t); this.music?.duck(1.6, 0.22); break;
      case 'stun': S.stunLoop(b, t, 2.2); break;
      case 'guardBreak': S.special(b, n, 1, t); S.parry(b, t + 0.04); break;
      case 'bell': S.bell(b, t, 1); break;
      case 'bell3': S.bell(b, t, 3); break;
      case 'tellLow': if (this.throttle('tellLow', 120)) S.tellCue(b, 'low', t); break;
      case 'tellBig': if (this.throttle('tellBig', 120)) S.tellCue(b, 'big', t); break;
      case 'tellFast': if (this.throttle('tellFast', 100)) S.tellCue(b, 'fast', t); break;
      case 'token': S.tokenChime(b, opts.tier ?? 1, t); break;
      case 'tokenMax': S.tokenChime(b, 3, t); break;
      case 'crowdCheer': S.crowd(b, n, 0.55, 1.4, t); break;
      case 'crowdBig': S.crowd(b, n, 1, 2.4, t); break;
      case 'crowdGroan': S.crowdGroan(b, n, t); break;
      case 'uiMove': S.uiBlip(b, 'move', t); break;
      case 'uiConfirm': S.uiBlip(b, 'confirm', t); break;
      case 'uiBack': S.uiBlip(b, 'back', t); break;
      case 'uiDeny': S.uiBlip(b, 'deny', t); break;
      case 'uiUnlock': S.uiBlip(b, 'unlock', t); break;
    }
  }

  /** A fighter's vocal reaction. `hurt` 0..1 shapes it from grunt to cry out. */
  voice(pitch: number, grit: number, hurt: number): void {
    if (!this.bus || !this.noise) return;
    if (!this.throttle(`v${pitch.toFixed(2)}`, 110)) return;
    S.grunt(this.bus, this.noise, pitch, grit, hurt, this.now() + 0.001);
  }

  /** The referee's count. */
  count(n: number): void {
    if (!this.bus) return;
    S.refCount(this.bus, n, this.now() + 0.001);
  }

  /** Ambient crowd murmur, kept quiet and looping under everything. */
  ambience(intensity: number, seconds = 2): void {
    if (!this.bus || !this.noise) return;
    if (!this.throttle('amb', seconds * 900)) return;
    S.crowd(this.bus, this.noise, intensity * 0.5, seconds, this.now());
  }

  playMusic(id: TrackId, fadeIn = 0.6): void {
    this.music?.play(id, fadeIn);
  }

  stopMusic(fadeOut = 0.5): void {
    this.music?.stop(fadeOut);
  }

  setMusicIntensity(v: number): void {
    if (this.music) this.music.intensity = v;
  }

  dispose(): void {
    this.music?.stop(0.05);
    try { this.compressor?.disconnect(); } catch { /* ignore */ }
    try { void this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
    this.bus = null;
    this.unlocked = false;
  }
}
