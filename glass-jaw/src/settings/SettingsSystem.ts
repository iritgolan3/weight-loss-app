import { Action, DEFAULT_KEYS, DEFAULT_PAD, KeyBindings, PadBindings } from '../input/Actions';
import type { Difficulty } from '../data/difficulty';
import type { Quality } from '../render/Renderer';

export type ColorMode = 'normal' | 'protan' | 'deutan' | 'tritan' | 'highContrast';

export interface Settings {
  // Audio
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  crowdVolume: number;

  // Graphics
  quality: Quality;
  /** Extra render-scale multiplier on top of quality, 0.5..2. */
  resolutionScale: number;
  fullscreen: boolean;
  /** Caps the frame rate. 0 = uncapped (follow the display). */
  frameCap: number;
  vsync: boolean;

  // Feel / accessibility
  cameraShake: number;      // 0..1
  screenEffects: number;    // 0..1  (particles, bursts, speed lines)
  flashIntensity: number;   // 0..1  (full-screen flashes)
  hitStop: number;          // 0..1
  slowMotion: number;       // 0..1
  /** Draws an explicit label + arrow over every incoming attack. */
  attackIndicators: boolean;
  /** Shows the current opponent's weak point on the HUD. */
  weaknessHints: boolean;
  /** Larger, higher-contrast HUD text. */
  largeText: boolean;
  colorMode: ColorMode;
  /** Extra input-buffer window in ms. */
  inputBuffer: number;
  showFps: boolean;
  screenShakeOnHitOnly: boolean;

  // Gameplay
  difficulty: Difficulty;

  // Controls
  keys: KeyBindings;
  pad: PadBindings;
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.85,
  musicVolume: 0.5,
  sfxVolume: 0.9,
  voiceVolume: 0.8,
  crowdVolume: 0.6,

  quality: 'high',
  resolutionScale: 1,
  fullscreen: false,
  frameCap: 0,
  vsync: true,

  cameraShake: 1,
  screenEffects: 1,
  flashIntensity: 1,
  hitStop: 1,
  slowMotion: 1,
  attackIndicators: false,
  weaknessHints: false,
  largeText: false,
  colorMode: 'normal',
  inputBuffer: 133,
  showFps: false,
  screenShakeOnHitOnly: false,

  difficulty: 'normal',

  keys: structuredClone(DEFAULT_KEYS),
  pad: structuredClone(DEFAULT_PAD),
};

const STORAGE_KEY = 'glassjaw.settings.v1';

/**
 * Settings store. Everything is applied through `onChange` subscribers so a
 * change takes effect immediately rather than on the next fight.
 */
export class SettingsSystem {
  current: Settings = structuredClone(DEFAULT_SETTINGS);
  private listeners = new Set<(s: Settings) => void>();

  constructor() { this.load(); }

  onChange(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.current);
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.current[key] = value;
    this.save();
    this.notify();
  }

  patch(partial: Partial<Settings>): void {
    Object.assign(this.current, partial);
    this.save();
    this.notify();
  }

  rebindKey(action: Action, code: string): void {
    this.current.keys[action] = [code];
    this.save();
    this.notify();
  }

  rebindPad(action: Action, button: number): void {
    this.current.pad[action] = [button];
    this.save();
    this.notify();
  }

  resetControls(): void {
    this.current.keys = structuredClone(DEFAULT_KEYS);
    this.current.pad = structuredClone(DEFAULT_PAD);
    this.save();
    this.notify();
  }

  resetAll(): void {
    const keep = this.current.difficulty;
    this.current = structuredClone(DEFAULT_SETTINGS);
    this.current.difficulty = keep;
    this.save();
    this.notify();
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // Private browsing or a full quota: settings simply do not persist.
    }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Settings>;
      // Merge rather than replace, so a new setting gets its default.
      this.current = { ...structuredClone(DEFAULT_SETTINGS), ...parsed };
      this.current.keys = { ...structuredClone(DEFAULT_KEYS), ...(parsed.keys ?? {}) };
      this.current.pad = { ...structuredClone(DEFAULT_PAD), ...(parsed.pad ?? {}) };
    } catch {
      this.current = structuredClone(DEFAULT_SETTINGS);
    }
  }

  /** Applies the notify callback once at startup. */
  applyNow(): void { this.notify(); }
}

/**
 * Colour-blind safe accent palettes. Gameplay never depends on colour alone —
 * every tell also has a distinct silhouette and a text label — but making the
 * accents distinguishable still matters.
 */
export const COLOR_MODES: Record<ColorMode, { name: string; danger: string; safe: string; warn: string; special: string }> = {
  normal: { name: 'Standard', danger: '#ff4d4d', safe: '#7ef9a2', warn: '#ffd166', special: '#4cc9f0' },
  protan: { name: 'Protanopia', danger: '#0a84ff', safe: '#ffd60a', warn: '#ffffff', special: '#bf5af2' },
  deutan: { name: 'Deuteranopia', danger: '#0a84ff', safe: '#ffd60a', warn: '#ffffff', special: '#bf5af2' },
  tritan: { name: 'Tritanopia', danger: '#ff375f', safe: '#32d74b', warn: '#ffffff', special: '#ff9f0a' },
  highContrast: { name: 'High Contrast', danger: '#ff0033', safe: '#00ff88', warn: '#ffffff', special: '#00ccff' },
};
