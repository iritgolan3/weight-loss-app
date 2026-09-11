import type { Game, Scene } from '../../core/Game';
import type { GameTime } from '../../core/Time';
import type { FightScene } from '../../scenes/FightScene';
import { Action } from '../../input/Actions';
import type { Ctx } from '../../render/draw';
import { clamp01, Ease } from '../../core/MathUtil';
import { displayText, label, PALETTE, panel } from '../ui';
import { SettingsScreen } from './SettingsScreen';

/**
 * Pause menu. Renders over a frozen fight, so it deliberately keeps the
 * backdrop visible — the player usually pauses to look at something.
 */
export class PauseOverlay implements Scene {
  readonly name = 'pause';
  readonly transparent = true;

  private index = 0;
  private items: { label: string; run: () => void }[] = [];
  private t = 0;
  private confirmQuit = false;

  constructor(private readonly game: Game, private readonly fight: FightScene) {
    this.build();
  }

  private build(): void {
    this.items = [
      { label: 'RESUME', run: () => { this.game.audio.play('uiBack'); this.game.pop(); } },
      { label: 'SETTINGS', run: () => this.game.push(new SettingsScreen(this.game, true)) },
      {
        label: this.confirmQuit ? 'REALLY QUIT? PRESS AGAIN' : 'QUIT FIGHT',
        run: () => {
          if (!this.confirmQuit) {
            this.confirmQuit = true;
            this.build();
            this.game.audio.play('uiDeny');
            return;
          }
          this.game.audio.play('uiBack');
          this.game.audio.stopMusic(0.3);
          this.game.pop();
          this.fight.quit();
        },
      },
    ];
  }

  enter(): void { this.game.audio.resume(); }
  exit(): void { /* nothing to release */ }

  update(_dt: number, _time: GameTime): void {
    const input = this.game.input;
    if (input.justPressed(Action.Pause) || input.justPressed(Action.Cancel)) {
      this.game.audio.play('uiBack');
      this.game.pop();
      return;
    }
    if (input.justPressed(Action.MenuDown)) { this.move(1); }
    if (input.justPressed(Action.MenuUp)) { this.move(-1); }
    if (input.justPressed(Action.Confirm)) this.items[this.index].run();
  }

  private move(d: number): void {
    this.index = (this.index + d + this.items.length) % this.items.length;
    this.confirmQuit = false;
    this.build();
    this.game.audio.play('uiMove');
  }

  updateRaw(rawDt: number): void { this.t += rawDt; }

  render(ctx: Ctx, _alpha: number, _time: GameTime): void {
    const { dw, dh } = this.game.renderer;
    const pop = Ease.backOut(clamp01(this.t * 5));

    ctx.save();
    ctx.fillStyle = 'rgba(6,4,10,0.74)';
    ctx.fillRect(0, 0, dw, dh);

    ctx.translate(dw / 2, dh / 2);
    ctx.scale(pop, pop);
    ctx.translate(-dw / 2, -dh / 2);

    const w = 620, h = 420;
    const x = dw / 2 - w / 2, y = dh / 2 - h / 2;
    panel(ctx, x, y, w, h, { radius: 22, fill: '#14101f', border: PALETTE.gold, glow: PALETTE.gold });
    displayText(ctx, 'PAUSED', dw / 2, y + 68, 62, PALETTE.gold, { outlineWidth: 11 });
    label(ctx, `ROUND ${this.fight.ref.round} — ${this.fight.def.name.toUpperCase()}`,
      dw / 2, y + 116, 16, PALETTE.dim, { align: 'center', weight: 700 });

    this.items.forEach((item, i) => {
      const iy = y + 190 + i * 66;
      const sel = i === this.index;
      if (sel) {
        panel(ctx, x + 50, iy - 26, w - 100, 52, {
          radius: 10, fill: '#2a2140', border: PALETTE.gold, alpha: 0.95,
        });
      }
      displayText(ctx, item.label, dw / 2, iy, sel ? 30 : 26,
        sel ? PALETTE.gold : PALETTE.text, { outlineWidth: 6 });
    });

    label(ctx, 'W / S to move   ENTER to select   ESC to resume',
      dw / 2, y + h - 34, 14, PALETTE.dim, { align: 'center', weight: 700 });
    ctx.restore();
  }
}
