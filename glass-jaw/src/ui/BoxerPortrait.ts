import type { Appearance } from '../data/types';
import { AnimationSystem } from '../anim/AnimationSystem';
import { FighterRenderer } from '../render/FighterRenderer';
import { Fighter, FState } from '../combat/Fighter';
import { metrics } from '../anim/Pose';
import type { Ctx } from '../render/draw';

/**
 * Renders a live, animated portrait of a boxer for menus.
 *
 * It reuses the exact fighter renderer and animation system the fight uses, so
 * a profile portrait is genuinely the same character you will face — not a
 * separate illustration that can drift out of sync.
 */
export class BoxerPortrait {
  private anim: AnimationSystem;
  private art: FighterRenderer;
  private dummy = new Fighter('preview', false);
  private t = Math.random() * 10;
  private app: Appearance;

  constructor(app: Appearance) {
    this.app = app;
    this.anim = new AnimationSystem(app, true);
    this.art = new FighterRenderer(app);
    this.dummy.setState(FState.Idle, 0);
  }

  setAppearance(app: Appearance): void {
    if (app === this.app) return;
    this.app = app;
    this.anim = new AnimationSystem(app, true);
    this.art = new FighterRenderer(app);
    this.dummy = new Fighter('preview', false);
    this.dummy.setState(FState.Idle, 0);
  }

  /** Plays a one-off pose, e.g. a victory flex when selected. */
  pose(state: FState, frames = 0): void {
    this.dummy.setState(state, frames);
  }

  update(rawDt: number): void {
    this.t += rawDt;
    this.dummy.update(rawDt);
    if (this.dummy.state !== FState.Idle && this.dummy.stateDuration === 0 &&
      this.dummy.state !== FState.Victory) {
      this.dummy.setState(FState.Idle, 0);
    }
    this.anim.update(rawDt, this.dummy, this.t);
  }

  /**
   * Draws the boxer to fit a box. `crop` of 'head' frames the face, 'full'
   * shows the whole fighter.
   */
  draw(
    ctx: Ctx, x: number, y: number, w: number, h: number,
    opts: { crop?: 'head' | 'full'; light?: string; rim?: string; glow?: boolean } = {},
  ): void {
    const m = metrics(this.app);
    const crop = opts.crop ?? 'full';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    let unit: number;
    let feetY: number;
    if (crop === 'head') {
      // Frame the head: scale so the skull fills most of the box.
      unit = (h * 0.62) / (m.headRadius * 2.6);
      feetY = y + h * 0.5 - (this.anim.pose.head.y) * unit;
    } else {
      unit = (h * 0.92) / m.height;
      feetY = y + h * 0.97;
    }

    this.art.draw(ctx, this.anim.pose, {
      x: x + w / 2, y: feetY, unit, facing: -1, showFace: true, flash: 0, tell: 0, tellColor: '#ffffff',
      rage: 0, stun: 0, gassed: 0, hurt: 0, alpha: 1, time: this.t,
    });
    ctx.restore();
  }
}
