import { clamp01, Ease } from './MathUtil';

export type TransitionKind = 'fade' | 'wipe' | 'ring' | 'ko';

type Ctx = CanvasRenderingContext2D;

/**
 * The curtain between screens.
 *
 * Every screen change in the game goes through this. Cutting straight from a
 * menu to a ring reads as a bug, not a transition — the eye has nothing to
 * follow and the new screen arrives already in progress. Four curtains, each
 * matched to what it is covering:
 *
 *   fade  — neutral, for menu-to-menu.
 *   wipe  — a hard diagonal bar, for entering or leaving a fight.
 *   ring  — an iris closing on the middle of the ring, for round breaks.
 *   ko    — a slam to white then a hard drop to black, for a knockout.
 *
 * Drawn as flat shapes with hard edges, like everything else in the game. No
 * blurred vignettes.
 */
export class Transition {
  private phase: 'idle' | 'out' | 'in' = 'idle';
  private t = 0;
  private kind: TransitionKind = 'fade';
  private outSeconds = 0.26;
  private inSeconds = 0.3;
  private action: (() => void) | null = null;

  get busy(): boolean { return this.phase !== 'idle'; }

  /**
   * Whether input should be held while this curtain runs.
   *
   * True for a real screen change, so a held button cannot fire again on the
   * screen behind. FALSE for a plain reveal: the boot fade has no screen
   * change to protect, and swallowing input during it means the first button
   * a player presses does nothing — which on a slow machine is most of a
   * second of an apparently dead title screen.
   */
  get blocksInput(): boolean { return this.phase !== 'idle' && this.blocking; }
  private blocking = false;
  /** True while the screen is fully covered — safe to swap scenes behind it. */
  get covered(): boolean { return this.phase === 'in' && this.t < 0.06; }

  /**
   * Runs `action` behind a closed curtain.
   *
   * A second call while one is already running is ignored rather than queued:
   * a double-tapped menu button should not open two screens.
   */
  start(kind: TransitionKind, action: () => void): void {
    if (this.phase !== 'idle') return;
    this.kind = kind;
    this.action = action;
    this.blocking = true;
    this.phase = 'out';
    this.t = 0;
    this.outSeconds = kind === 'ko' ? 0.62 : kind === 'ring' ? 0.4 : 0.26;
    this.inSeconds = kind === 'ko' ? 0.7 : kind === 'ring' ? 0.46 : 0.3;
  }

  /** Opens the curtain without running an action — used on first boot. */
  reveal(kind: TransitionKind = 'fade'): void {
    this.kind = kind;
    this.action = null;
    this.blocking = false;
    this.phase = 'in';
    this.t = 0;
    this.inSeconds = 0.36;
  }

  update(rawDt: number): void {
    if (this.phase === 'idle') return;
    this.t += rawDt;
    if (this.phase === 'out' && this.t >= this.outSeconds) {
      this.action?.();
      this.action = null;
      this.phase = 'in';
      this.t = 0;
    } else if (this.phase === 'in' && this.t >= this.inSeconds) {
      this.phase = 'idle';
      this.blocking = false;
      this.t = 0;
    }
  }

  /** 0 = screen clear, 1 = screen fully covered. */
  private coverage(): number {
    if (this.phase === 'out') return clamp01(this.t / this.outSeconds);
    if (this.phase === 'in') return 1 - clamp01(this.t / this.inSeconds);
    return 0;
  }

  draw(ctx: Ctx, dw: number, dh: number): void {
    if (this.phase === 'idle') return;
    const c = this.coverage();
    if (c <= 0.001) return;

    switch (this.kind) {
      case 'wipe': {
        // A hard diagonal bar sweeping across. Leaving and arriving sweep the
        // same way, so the motion carries through the swap.
        const span = dw + dh * 0.6;
        const edge = Ease.quartOut(c) * span;
        ctx.save();
        ctx.fillStyle = '#0a0713';
        ctx.beginPath();
        ctx.moveTo(-dh * 0.6, 0);
        ctx.lineTo(-dh * 0.6 + edge, 0);
        ctx.lineTo(edge, dh);
        ctx.lineTo(0, dh);
        ctx.closePath();
        ctx.fill();
        // A bright leading edge so the bar reads as a swipe, not a growing box.
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-dh * 0.6 + edge, 0);
        ctx.lineTo(edge, dh);
        ctx.stroke();
        ctx.restore();
        return;
      }
      case 'ring': {
        // An iris closing on the centre of the ring.
        const maxR = Math.hypot(dw, dh) * 0.56;
        const r = maxR * (1 - Ease.cubicInOut(c));
        ctx.save();
        ctx.fillStyle = '#0a0713';
        ctx.beginPath();
        ctx.rect(0, 0, dw, dh);
        ctx.moveTo(dw / 2 + r, dh * 0.48);
        ctx.arc(dw / 2, dh * 0.48, r, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.restore();
        return;
      }
      case 'ko': {
        // White slam, then black. The white half is short and violent.
        ctx.save();
        if (c < 0.45) {
          ctx.globalAlpha = clamp01(c / 0.45);
          ctx.fillStyle = '#fff6e8';
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#0a0713';
          ctx.fillRect(0, 0, dw, dh);
          ctx.globalAlpha = clamp01(1 - (c - 0.45) / 0.35);
          ctx.fillStyle = '#fff6e8';
        }
        ctx.fillRect(0, 0, dw, dh);
        ctx.restore();
        return;
      }
      default: {
        ctx.save();
        ctx.globalAlpha = Ease.cubicInOut(c);
        ctx.fillStyle = '#0a0713';
        ctx.fillRect(0, 0, dw, dh);
        ctx.restore();
      }
    }
  }
}
