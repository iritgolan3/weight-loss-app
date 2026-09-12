import { Loop } from './Loop';
import { GameTime } from './Time';
import { InputManager } from '../input/InputManager';
import { Renderer, type Quality } from '../render/Renderer';
import { AudioManager } from '../audio/AudioManager';
import { SettingsSystem, Settings } from '../settings/SettingsSystem';
import { SaveSystem } from '../save/SaveSystem';
import { CareerSystem } from '../career/CareerSystem';
import type { Ctx } from '../render/draw';
import { TitleScreen } from '../ui/screens/TitleScreen';
import { PoseLab } from '../scenes/PoseLab';
import { Transition, type TransitionKind } from './Transition';

export interface Scene {
  readonly name: string;
  enter(): void;
  exit(): void;
  /** Simulation update on scaled time. */
  update(dt: number, time: GameTime): void;
  /** Presentation update on unscaled time (UI, VFX, camera). */
  updateRaw?(rawDt: number): void;
  render(ctx: Ctx, alpha: number, time: GameTime): void;
  /** Called when the window is resized. */
  resize?(): void;
  /** True to keep the scene below this one rendering (overlays / pause). */
  readonly transparent?: boolean;
}

export type SceneFactory = (game: Game) => Scene;

/**
 * Application shell. Owns the canvas, the loop, and a stack of scenes.
 *
 * A stack (rather than a single current scene) lets the pause menu, results
 * screens and confirmation dialogs render over a live fight without the fight
 * having to know anything about them.
 */
export class Game {
  readonly renderer: Renderer;
  readonly input = new InputManager();
  readonly audio = new AudioManager();
  readonly settings = new SettingsSystem();
  readonly save = new SaveSystem();
  readonly career: CareerSystem;
  readonly loop: Loop;

  private stack: Scene[] = [];
  private pendingPush: Scene[] = [];
  private pendingPop = 0;
  private pendingReplace: Scene | null = null;

  /** Set once the player has interacted, which is when audio may start. */
  private audioArmed = false;
  /** Seconds since the app started, unscaled. */
  clock = 0;

  constructor(mount: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.tabIndex = 0;
    mount.appendChild(canvas);

    this.renderer = new Renderer(canvas);
    this.career = new CareerSystem(this.save);
    this.loop = new Loop(
      (dt, time) => this.update(dt, time),
      (alpha, time) => this.render(alpha, time),
      120,
    );

    this.applySettings(this.settings.current);
    this.settings.onChange((s) => this.applySettings(s));

    // If the browser drops the canvas, step the quality down rather than
    // sitting on a dead context and rendering nothing.
    this.renderer.onContextLost = () => this.degradeQuality();

    this.input.attach(window);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    // Any interaction is our chance to start audio.
    const arm = () => this.armAudio();
    window.addEventListener('pointerdown', arm, { passive: true });
    window.addEventListener('keydown', arm);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', () => this.save.flush());
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      this.audio.suspend();
      this.save.flush();
    } else {
      this.audio.resume();
    }
  };

  /** Drops one graphics tier after a lost rendering context. */
  private degradeQuality(): void {
    const order: Quality[] = ['low', 'medium', 'high', 'ultra'];
    const i = order.indexOf(this.settings.current.quality);
    if (i > 0) this.settings.set('quality', order[i - 1]);
  }

  private armAudio(): void {
    if (this.audioArmed) return;
    this.audioArmed = true;
    if (this.audio.unlock()) {
      this.audio.applySettings(this.settings.current);
      this.onAudioReady?.();
    }
  }

  /** Set by the boot scene so it can start music the moment audio unlocks. */
  onAudioReady: (() => void) | null = null;

  private onResize = (): void => {
    this.renderer.resize();
    for (const s of this.stack) s.resize?.();
  };

  applySettings(s: Settings): void {
    this.renderer.setQuality(s.quality);
    this.renderer.setResolutionScale(s.resolutionScale);
    this.loop.frameCap = s.frameCap;
    this.input.keys = s.keys;
    this.input.pad = s.pad;
    this.input.bufferMs = s.inputBuffer;
    this.audio.applySettings(s);
  }

  // -- Scene stack -----------------------------------------------------------

  get current(): Scene | null { return this.stack[this.stack.length - 1] ?? null; }

  /** The curtain every screen change goes behind. */
  readonly transition = new Transition();

  push(scene: Scene): void { this.pendingPush.push(scene); }
  pop(): void { this.pendingPop++; }
  replace(scene: Scene): void { this.pendingReplace = scene; }

  /**
   * A screen change with a curtain over it.
   *
   * Use this for anything the player initiated — opening a menu, starting a
   * fight, backing out of a screen. `push`/`pop`/`replace` still exist for
   * changes that happen behind an effect that is already covering the screen.
   */
  go(kind: TransitionKind, action: () => void): void {
    this.transition.start(kind, action);
  }

  goPush(scene: Scene, kind: TransitionKind = 'fade'): void {
    this.go(kind, () => this.push(scene));
  }

  goPop(kind: TransitionKind = 'fade'): void {
    this.go(kind, () => this.pop());
  }

  goReplace(scene: Scene, kind: TransitionKind = 'fade'): void {
    this.go(kind, () => this.replace(scene));
  }

  /** Clears the stack down to a single scene. */
  reset(scene: Scene): void {
    this.pendingReplace = scene;
    this.pendingPop = this.stack.length;
  }

  private flushStack(): void {
    if (this.pendingPop > 0) {
      for (let i = 0; i < this.pendingPop && this.stack.length; i++) {
        this.stack.pop()!.exit();
      }
      this.pendingPop = 0;
      this.input.flush();
    }
    if (this.pendingReplace) {
      while (this.stack.length) this.stack.pop()!.exit();
      const s = this.pendingReplace;
      this.pendingReplace = null;
      this.stack.push(s);
      s.enter();
      this.input.flush();
    }
    while (this.pendingPush.length) {
      const s = this.pendingPush.shift()!;
      this.stack.push(s);
      s.enter();
      this.input.flush();
    }
  }

  // -- Frame -----------------------------------------------------------------

  private update(dt: number, time: GameTime): void {
    this.flushStack();
    // A scene must not read input through a closed curtain, or a held button
    // fires again on the screen that comes up behind it.
    if (this.transition.blocksInput) this.input.flush();
    this.input.pollPads();
    const top = this.current;
    if (top) top.update(dt, time);
    this.input.endFrame();
  }

  private render(alpha: number, time: GameTime): void {
    this.clock += time.rawDt;
    if (this.renderer.contextLost) return;
    // Presentation systems advance on unscaled time so effects survive hit-stop.
    for (const s of this.stack) s.updateRaw?.(time.rawDt);
    this.transition.update(time.rawDt);

    const ctx = this.renderer.begin();
    ctx.fillStyle = '#06040a';
    ctx.fillRect(0, 0, this.renderer.dw, this.renderer.dh);

    // A render can land before the first fixed update has run, so the stack
    // may legitimately be empty on frame one.
    if (!this.stack.length) return;

    // Draw from the lowest opaque scene upward.
    let first = this.stack.length - 1;
    while (first > 0 && this.stack[first].transparent) first--;
    for (let i = first; i < this.stack.length; i++) {
      this.stack[i].render(ctx, alpha, time);
    }

    this.transition.draw(ctx, this.renderer.dw, this.renderer.dh);

    if (this.settings.current.showFps) this.drawFps(ctx);
  }

  private drawFps(ctx: Ctx): void {
    const s = this.loop.stats;
    ctx.save();
    ctx.font = '600 20px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = s.fps < 50 ? '#ff6b6b' : '#7ef9a2';
    const txt = `${s.fps.toFixed(0)} fps  u${s.updateMs.toFixed(1)} r${s.renderMs.toFixed(1)}`;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 4;
    ctx.strokeText(txt, this.renderer.dw - 18, 14);
    ctx.fillText(txt, this.renderer.dw - 18, 14);
    ctx.restore();
  }

  start(): void {
    this.settings.applyNow();
    if (!this.stack.length && !this.pendingReplace && !this.pendingPush.length) {
      // ?lab opens the pose-debug harness instead of the game.
      const lab = new URLSearchParams(location.search).has('lab');
      this.replace(lab ? new PoseLab(this) : new TitleScreen(this));
    }
    // Bring the first scene up before the loop starts so frame one has content.
    this.flushStack();
    // The game fades up rather than snapping on.
    this.transition.reveal();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.save.flush();
  }

  destroy(): void {
    this.stop();
    while (this.stack.length) this.stack.pop()!.exit();
    this.input.detach(window);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.dispose();
    this.audio.dispose();
  }
}
