import type { Game, Scene } from '../../core/Game';
import type { GameTime } from '../../core/Time';
import { Action } from '../../input/Actions';
import { clamp01, Ease } from '../../core/MathUtil';
import type { Ctx } from '../../render/draw';
import { displayText, label, PALETTE } from '../ui';
import { INK } from '../../render/Cel';
import { MainMenu } from './MainMenu';
import { RNG } from '../../core/RNG';

/** Attract screen. Flat wordmark over a hard-rayed arena, and "press anything". */
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

    // --- Backdrop -----------------------------------------------------------
    //
    // Flat bands and hard-edged rays. This screen used to be a radial gradient
    // under three soft spotlights and a glowing gradient wordmark, which is a
    // different game from the one behind it: everything past this screen is
    // drawn flat with a black contour, and the title has to promise that.
    ctx.fillStyle = '#160f22';
    ctx.fillRect(0, 0, dw, dh);
    ctx.fillStyle = '#1d1430';
    ctx.fillRect(0, 0, dw, dh * 0.7);

    // Hard rays from behind the logo. Two flat tones, alternating.
    const ry = dh * 0.34;
    ctx.save();
    ctx.translate(cx, ry);
    ctx.rotate(this.t * 0.08);
    const span = Math.hypot(dw, dh);
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2;
      const a1 = a0 + Math.PI / 16;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a0) * span, Math.sin(a0) * span);
      ctx.lineTo(Math.cos(a1) * span, Math.sin(a1) * span);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#20162f' : '#32204c';
      ctx.fill();
    }
    ctx.restore();

    // A flat ring apron along the bottom, so the title sits in a venue.
    ctx.fillStyle = '#120c1c';
    ctx.fillRect(0, dh * 0.7, dw, dh * 0.3);
    for (let i = 0; i < 3; i++) {
      const y = dh * 0.73 + i * dh * 0.05;
      ctx.fillStyle = INK;
      ctx.fillRect(0, y - 5, dw, 14);
      ctx.fillStyle = ['#d94f4f', '#e8e8e8', '#4a7fd4'][i];
      ctx.fillRect(0, y - 1, dw, 7);
    }

    // Confetti, flat squares. No embers, no glow.
    for (const s of this.sparks) {
      ctx.save();
      ctx.globalAlpha = clamp01(s.life);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.x * 0.01 + this.t * 2);
      ctx.fillStyle = ['#ffd166', '#ff6b6b', '#7ef9a2', '#8ecae6'][Math.floor(s.x) % 4];
      ctx.fillRect(-6, -4, 12, 8);
      ctx.restore();
    }

    // --- Wordmark -----------------------------------------------------------
    //
    // Two flat colours, one hard offset shadow, one heavy black contour. The
    // shadow is an offset copy rather than a blur, which is what makes a
    // wordmark read as printed instead of lit.
    const pop = Ease.backOut(clamp01(this.t * 1.5));
    ctx.save();
    ctx.translate(cx, ry);
    ctx.scale(pop, pop);

    const word = (text: string, y: number, size: number, fill: string) => {
      displayText(ctx, text, 9, y + 11, size, 'rgba(0,0,0,0.55)', { outlineWidth: 0 });
      displayText(ctx, text, 0, y, size, fill, { outline: INK, outlineWidth: size * 0.16 });
    };
    word('GLASS', -76, 172, '#ffd166');
    word('JAW', 100, 206, '#ff6b35');
    ctx.restore();

    // Flat plate behind the tagline, so it reads against the rays.
    const tw = 420, ty = dh * 0.615;
    ctx.fillStyle = INK;
    ctx.fillRect(cx - tw / 2, ty - 22, tw, 44);
    label(ctx, 'CHAMPIONSHIP BOXING', cx, ty + 8, 26, PALETTE.gold,
      { align: 'center', weight: 900 });

    if (this.t > 0.6) {
      // Fade the whole glyph, outline included — fading only the fill would
      // leave a black silhouette floating on screen.
      const blink = 0.45 + Math.sin(this.t * 3.4) * 0.55;
      ctx.save();
      ctx.globalAlpha = blink;
      displayText(ctx, 'PRESS ANY BUTTON', cx, dh * 0.855, 38, PALETTE.text, { outlineWidth: 8 });
      ctx.restore();
    }

    label(ctx, 'An original game. No assets, audio or code from any other title.',
      cx, dh - 62, 14, 'rgba(200,192,216,0.5)', { align: 'center', weight: 600 });
    label(ctx, '© Glass Jaw — all characters, music and art generated by this program.',
      cx, dh - 38, 13, 'rgba(200,192,216,0.35)', { align: 'center', weight: 600 });
  }
}
