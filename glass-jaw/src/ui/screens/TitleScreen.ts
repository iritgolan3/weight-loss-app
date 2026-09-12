import type { Game, Scene } from '../../core/Game';
import type { GameTime } from '../../core/Time';
import { Action } from '../../input/Actions';
import { clamp01, Ease } from '../../core/MathUtil';
import type { Ctx } from '../../render/draw';
import { rgba, starPath } from '../../render/draw';
import { displayText, label, PALETTE } from '../ui';
import { MainMenu } from './MainMenu';
import { RNG } from '../../core/RNG';

/** Attract screen. Big logo, a slow spotlight sweep, and "press anything". */
export class TitleScreen implements Scene {
  readonly name = 'title';
  private t = 0;
  /** Wall-clock time the screen appeared, for the input gate. */
  private shownAt = 0;
  private rng = new RNG(7);
  private sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  constructor(private readonly game: Game) {}

  enter(): void {
    this.shownAt = performance.now();
    this.game.audio.playMusic('menu', 1.2);
    this.game.onAudioReady = () => this.game.audio.playMusic('menu', 0.6);
  }

  exit(): void { this.game.onAudioReady = null; }

  update(_dt: number, _time: GameTime): void {
    const i = this.game.input;
    const any = i.justPressed(Action.Confirm) || i.justPressed(Action.PunchLeft) ||
      i.justPressed(Action.PunchRight) || i.justPressed(Action.Special) ||
      i.justPressed(Action.Block) || i.justPressed(Action.Pause);
    // Gate on real elapsed time, not accumulated frame time: frame deltas are
    // clamped, so on a slow machine the latter lags far behind the wall clock
    // and the player is left unable to start for seconds.
    if (any && performance.now() - this.shownAt > 350) {
      this.game.audio.play('uiConfirm');
      this.game.goReplace(new MainMenu(this.game), 'wipe');
    }
  }

  updateRaw(rawDt: number): void {
    this.t += rawDt;
    if (this.rng.chance(rawDt * 14)) {
      this.sparks.push({
        x: this.rng.range(0, this.game.renderer.dw),
        y: this.game.renderer.dh + 20,
        vx: this.rng.range(-30, 30),
        vy: this.rng.range(-180, -70),
        life: 1,
      });
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= rawDt * 0.35;
      s.x += s.vx * rawDt;
      s.y += s.vy * rawDt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
  }

  render(ctx: Ctx, _alpha: number, _time: GameTime): void {
    const { dw, dh } = this.game.renderer;
    const cx = dw / 2;

    // Backdrop.
    const g = ctx.createRadialGradient(cx, dh * 0.4, 80, cx, dh * 0.5, dh * 1.1);
    g.addColorStop(0, '#2a1834');
    g.addColorStop(0.45, '#140d20');
    g.addColorStop(1, '#050308');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dw, dh);

    // Sweeping spotlights.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(this.t * 0.35 + i * 2.1) * 0.5;
      ctx.save();
      ctx.translate(cx, -140);
      ctx.rotate(a);
      const lg = ctx.createLinearGradient(0, 0, 0, dh * 1.3);
      lg.addColorStop(0, rgba(['#ffd166', '#ff6b35', '#4cc9f0'][i], 0.2));
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(-50, 0);
      ctx.lineTo(50, 0);
      ctx.lineTo(400, dh * 1.3);
      ctx.lineTo(-400, dh * 1.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Floating embers.
    for (const s of this.sparks) {
      ctx.globalAlpha = clamp01(s.life) * 0.7;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Logo.
    const pop = Ease.backOut(clamp01(this.t * 1.5));
    ctx.save();
    ctx.translate(cx, dh * 0.36);
    ctx.scale(pop, pop);
    ctx.rotate(Math.sin(this.t * 0.8) * 0.006);

    // Impact starburst behind the wordmark.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 + Math.sin(this.t * 2) * 0.06;
    starPath(ctx, 0, 10, 430, 150, 12, this.t * 0.12);
    const sg = ctx.createRadialGradient(0, 10, 30, 0, 10, 430);
    sg.addColorStop(0, 'rgba(255,209,102,0.55)');
    sg.addColorStop(1, 'rgba(255,107,53,0)');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();

    const grad = ctx.createLinearGradient(0, -110, 0, 70);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.42, '#ffd166');
    grad.addColorStop(0.75, '#ff8c2b');
    grad.addColorStop(1, '#c93b1f');
    displayText(ctx, 'GLASS', 0, -58, 176, grad, { outlineWidth: 26, shadow: 'rgba(255,120,40,0.55)' });
    displayText(ctx, 'JAW', 0, 92, 208, grad, { outlineWidth: 30, shadow: 'rgba(255,120,40,0.55)' });
    ctx.restore();

    label(ctx, 'CHAMPIONSHIP BOXING', cx, dh * 0.62, 26, PALETTE.gold,
      { align: 'center', weight: 900 });

    if (this.t > 0.6) {
      // Fade the whole glyph, outline included — fading only the fill would
      // leave a black silhouette floating on screen.
      const blink = 0.45 + Math.sin(this.t * 3.4) * 0.55;
      ctx.save();
      ctx.globalAlpha = blink;
      displayText(ctx, 'PRESS ANY BUTTON', cx, dh * 0.78, 40, PALETTE.text, { outlineWidth: 8 });
      ctx.restore();
    }

    label(ctx, 'An original game. No assets, audio or code from any other title.',
      cx, dh - 62, 14, 'rgba(200,192,216,0.5)', { align: 'center', weight: 600 });
    label(ctx, '© Glass Jaw — all characters, music and art generated by this program.',
      cx, dh - 38, 13, 'rgba(200,192,216,0.35)', { align: 'center', weight: 600 });
  }
}
