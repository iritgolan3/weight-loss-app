import type { Game, Scene } from '../../core/Game';
import type { GameTime } from '../../core/Time';
import { Action, prettyKey, PAD_BUTTON_NAMES } from '../../input/Actions';
import { clamp, clamp01, damp, Ease } from '../../core/MathUtil';
import type { Ctx } from '../../render/draw';
import { rgba } from '../../render/draw';
import { bar, displayText, FONT_UI, label, PALETTE, panel, wrapText } from '../ui';

export type MenuItem =
  | { kind: 'action'; label: string; hint?: string; accent?: string; run: () => void; disabled?: () => boolean; value?: () => string }
  | { kind: 'toggle'; label: string; hint?: string; get: () => boolean; set: (v: boolean) => void }
  | {
      kind: 'slider'; label: string; hint?: string; min: number; max: number; step: number;
      get: () => number; set: (v: number) => void; format?: (v: number) => string;
    }
  | {
      kind: 'choice'; label: string; hint?: string;
      options: { label: string; value: string; color?: string }[];
      get: () => string; set: (v: string) => void;
    }
  | { kind: 'binding'; label: string; hint?: string; action: Action }
  | { kind: 'header'; label: string }
  | { kind: 'info'; label: string; value: () => string; hint?: string };

function selectable(i: MenuItem): boolean { return i.kind !== 'header' && i.kind !== 'info'; }

/**
 * Shared list-menu behaviour and styling.
 *
 * Every screen in the game is built on this, which is what keeps navigation
 * identical everywhere: up/down moves, left/right adjusts, confirm activates,
 * cancel backs out — on both keyboard and gamepad, with held-key repeat.
 */
export abstract class MenuScreen implements Scene {
  abstract readonly name: string;
  readonly transparent: boolean = false;

  protected index = 0;
  protected items: MenuItem[] = [];
  protected scroll = 0;
  protected scrollTarget = 0;
  protected t = 0;
  /** The action currently awaiting a new binding. */
  protected capturing: Action | null = null;

  /** Layout knobs subclasses may override. */
  protected listX = 0;
  protected listW = 720;
  protected listTop = 250;
  protected rowH = 62;
  protected visibleRows = 9;

  private repeatTimer = 0;
  private repeatAction: Action | null = null;

  constructor(protected readonly game: Game) {}

  abstract title(): string;
  protected subtitle(): string { return ''; }
  /** Optional right-hand detail panel. */
  protected drawDetail?(ctx: Ctx, x: number, y: number, w: number, h: number): void;
  /** Drawn behind the list. */
  protected drawBackdrop?(ctx: Ctx): void;
  protected onBack(): void { this.game.goPop(); }
  protected footerHint(): string {
    return 'W/S or ↑↓ move    A/D or ←→ adjust    ENTER select    ESC back';
  }

  enter(): void {
    this.ensureSelectable(1);
    this.game.audio.resume();
  }

  exit(): void { this.game.input.captureNext = null; }

  protected rebuild(): void { /* subclasses may regenerate items */ }

  protected ensureSelectable(dir: number): void {
    if (!this.items.length) return;
    let guard = 0;
    while (guard++ < this.items.length && !selectable(this.items[this.index])) {
      this.index = (this.index + dir + this.items.length) % this.items.length;
    }
  }

  protected move(dir: number): void {
    if (!this.items.length) return;
    const start = this.index;
    do {
      this.index = (this.index + dir + this.items.length) % this.items.length;
    } while (!selectable(this.items[this.index]) && this.index !== start);
    this.game.audio.play('uiMove');
    this.updateScroll();
  }

  private updateScroll(): void {
    const first = Math.max(0, this.index - this.visibleRows + 2);
    const last = Math.max(0, this.index - 1);
    this.scrollTarget = clamp(this.scrollTarget, first, last);
    this.scrollTarget = clamp(this.scrollTarget, 0, Math.max(0, this.items.length - this.visibleRows));
  }

  protected adjust(dir: number): void {
    const item = this.items[this.index];
    if (!item) return;
    switch (item.kind) {
      case 'toggle':
        item.set(!item.get());
        this.game.audio.play('uiConfirm');
        break;
      case 'slider': {
        const v = clamp(item.get() + dir * item.step, item.min, item.max);
        item.set(Number(v.toFixed(4)));
        this.game.audio.play('uiMove');
        break;
      }
      case 'choice': {
        const idx = item.options.findIndex((o) => o.value === item.get());
        const next = (idx + dir + item.options.length) % item.options.length;
        item.set(item.options[next].value);
        this.game.audio.play('uiConfirm');
        break;
      }
      default:
        break;
    }
  }

  protected activate(): void {
    const item = this.items[this.index];
    if (!item) return;
    switch (item.kind) {
      case 'action':
        if (item.disabled?.()) { this.game.audio.play('uiDeny'); return; }
        this.game.audio.play('uiConfirm');
        item.run();
        break;
      case 'toggle':
      case 'choice':
        this.adjust(1);
        break;
      case 'slider':
        this.adjust(1);
        break;
      case 'binding':
        this.beginCapture(item.action);
        break;
      default:
        break;
    }
  }

  protected beginCapture(action: Action): void {
    this.capturing = action;
    this.game.audio.play('uiConfirm');
    this.game.input.captureNext = (b) => {
      this.capturing = null;
      if (b.code) this.game.settings.rebindKey(action, b.code);
      else if (b.button !== undefined) this.game.settings.rebindPad(action, b.button);
      this.game.audio.play('uiUnlock');
      this.rebuild();
    };
  }

  update(dt: number, _time: GameTime): void {
    if (this.capturing) {
      // Swallow all navigation while listening for a new binding.
      if (this.game.input.justPressed(Action.Cancel)) {
        this.game.input.captureNext = null;
        this.capturing = null;
      }
      return;
    }

    const input = this.game.input;
    if (input.justPressed(Action.Cancel)) {
      this.game.audio.play('uiBack');
      this.onBack();
      return;
    }
    if (input.justPressed(Action.Confirm)) { this.activate(); return; }

    // Held-key repeat so long lists and sliders are not a chore.
    const held: [Action, () => void][] = [
      [Action.MenuUp, () => this.move(-1)],
      [Action.MenuDown, () => this.move(1)],
      [Action.MenuLeft, () => this.adjust(-1)],
      [Action.MenuRight, () => this.adjust(1)],
    ];
    for (const [a, fn] of held) {
      if (input.justPressed(a)) { fn(); this.repeatAction = a; this.repeatTimer = 0.42; }
    }
    if (this.repeatAction) {
      if (!input.isDown(this.repeatAction)) { this.repeatAction = null; }
      else {
        this.repeatTimer -= dt;
        if (this.repeatTimer <= 0) {
          this.repeatTimer = 0.075;
          const fn = held.find(([a]) => a === this.repeatAction)?.[1];
          fn?.();
        }
      }
    }
  }

  updateRaw(rawDt: number): void {
    this.t += rawDt;
    this.scroll = damp(this.scroll, this.scrollTarget, 16, rawDt);
  }

  // -- Rendering -------------------------------------------------------------

  render(ctx: Ctx, _alpha: number, _time: GameTime): void {
    const { dw, dh } = this.game.renderer;
    this.drawBackdrop ? this.drawBackdrop(ctx) : this.defaultBackdrop(ctx, dw, dh);

    displayText(ctx, this.title(), this.titleX(dw), 118, this.titleSize(), PALETTE.gold, {
      align: 'left', outlineWidth: 12, shadow: PALETTE.orange,
    });
    const sub = this.subtitle();
    if (sub) label(ctx, sub, this.titleX(dw), 172, 19, PALETTE.dim, { weight: 700 });

    const lx = this.listX || this.titleX(dw);
    this.drawList(ctx, lx, this.listTop, this.listW);

    if (this.drawDetail) {
      const dx = lx + this.listW + 46;
      this.drawDetail(ctx, dx, this.listTop - 10, Math.max(260, dw - dx - 70), 620);
    }

    label(ctx, this.footerHint(), dw / 2, dh - 40, 15, PALETTE.dim,
      { align: 'center', weight: 700, font: FONT_UI });

    if (this.capturing) this.drawCapture(ctx, dw, dh);
  }

  protected titleX(dw: number): number { return Math.max(64, dw * 0.07); }
  protected titleSize(): number { return 72; }

  protected defaultBackdrop(ctx: Ctx, dw: number, dh: number): void {
    const g = ctx.createLinearGradient(0, 0, dw * 0.6, dh);
    g.addColorStop(0, '#13101f');
    g.addColorStop(0.55, '#0c0a16');
    g.addColorStop(1, '#06040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dw, dh);

    // Slow diagonal sweep — keeps static menus from feeling dead.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 9; i++) {
      const x = ((this.t * 24 + i * 260) % (dw + 700)) - 350;
      const g2 = ctx.createLinearGradient(x, 0, x + 220, dh);
      g2.addColorStop(0, 'rgba(255,209,102,0)');
      g2.addColorStop(0.5, 'rgba(255,209,102,0.8)');
      g2.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 150, 0);
      ctx.lineTo(x + 340, dh);
      ctx.lineTo(x + 190, dh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const vg = ctx.createRadialGradient(dw / 2, dh / 2, dh * 0.3, dw / 2, dh / 2, dh);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, dw, dh);
  }

  protected drawList(ctx: Ctx, x: number, y: number, w: number): void {
    const start = Math.floor(this.scroll);
    const offset = (this.scroll - start) * this.rowH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 30, y - 20, w + 60, this.visibleRows * this.rowH + 30);
    ctx.clip();

    for (let i = start; i < Math.min(this.items.length, start + this.visibleRows + 1); i++) {
      const item = this.items[i];
      const ry = y + (i - start) * this.rowH - offset;
      this.drawRow(ctx, item, x, ry, w, i === this.index);
    }
    ctx.restore();

    // Scroll indicator.
    if (this.items.length > this.visibleRows) {
      const trackH = this.visibleRows * this.rowH;
      const th = Math.max(40, (this.visibleRows / this.items.length) * trackH);
      const ty = y + (this.scroll / Math.max(1, this.items.length - this.visibleRows)) * (trackH - th);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + w + 14, y, 5, trackH);
      ctx.fillStyle = rgba(PALETTE.gold, 0.7);
      ctx.fillRect(x + w + 14, ty, 5, th);
    }
  }

  protected drawRow(ctx: Ctx, item: MenuItem, x: number, y: number, w: number, sel: boolean): void {
    const h = this.rowH - 10;
    const disabled = item.kind === 'action' && item.disabled?.();

    if (item.kind === 'header') {
      label(ctx, item.label.toUpperCase(), x + 4, y + h / 2 + 6, 15, PALETTE.gold,
        { weight: 900, baseline: 'middle' });
      ctx.strokeStyle = rgba(PALETTE.gold, 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h - 4);
      ctx.lineTo(x + w, y + h - 4);
      ctx.stroke();
      return;
    }

    if (sel) {
      const pulse = 0.82 + Math.sin(this.t * 5) * 0.18;
      panel(ctx, x - 14, y, w + 28, h, {
        radius: 10, fill: '#2b2140',
        border: rgba(item.kind === 'action' && item.accent ? item.accent : PALETTE.gold, pulse),
        borderWidth: 3,
      });
      // Selection chevron.
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(x - 34, y + h / 2 - 9);
      ctx.lineTo(x - 20, y + h / 2);
      ctx.lineTo(x - 34, y + h / 2 + 9);
      ctx.closePath();
      ctx.fill();
    }

    const textColor = disabled ? 'rgba(160,150,180,0.45)'
      : sel ? PALETTE.text
      : item.kind === 'info' ? PALETTE.dim : 'rgba(230,224,240,0.82)';
    const size = sel ? 25 : 23;
    label(ctx, item.label, x + 8, y + h / 2, size, textColor, { weight: sel ? 800 : 700 });

    const rx = x + w - 10;
    switch (item.kind) {
      case 'action': {
        const v = item.value?.();
        if (v) label(ctx, v, rx, y + h / 2, 19, sel ? PALETTE.gold : PALETTE.dim,
          { align: 'right', weight: 700 });
        break;
      }
      case 'toggle': {
        const on = item.get();
        const tw = 74, th = 30;
        const tx = rx - tw, ty = y + h / 2 - th / 2;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect?.(tx, ty, tw, th, th / 2);
        if (!ctx.roundRect) { ctx.rect(tx, ty, tw, th); }
        ctx.fillStyle = on ? rgba(PALETTE.green, 0.85) : 'rgba(255,255,255,0.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(on ? tx + tw - th / 2 : tx + th / 2, ty + th / 2, th / 2 - 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'slider': {
        const v = item.get();
        const frac = (v - item.min) / (item.max - item.min);
        const sw = 220;
        bar(ctx, rx - sw, y + h / 2 - 9, sw, 18, frac, {
          color: sel ? PALETTE.gold : '#7f7396', radius: 9,
        });
        const txt = item.format ? item.format(v) : `${Math.round(frac * 100)}%`;
        label(ctx, txt, rx - sw - 16, y + h / 2, 18, sel ? PALETTE.gold : PALETTE.dim,
          { align: 'right', weight: 700 });
        break;
      }
      case 'choice': {
        const cur = item.options.find((o) => o.value === item.get());
        const txt = cur?.label ?? '—';
        const col = cur?.color ?? (sel ? PALETTE.gold : PALETTE.dim);
        label(ctx, `‹  ${txt}  ›`, rx, y + h / 2, 20, col, { align: 'right', weight: 800 });
        break;
      }
      case 'binding': {
        const s = this.game.settings.current;
        const key = s.keys[item.action]?.[0];
        const padBtn = s.pad[item.action]?.[0];
        const txt = `${key ? prettyKey(key) : '—'}   /   ${padBtn !== undefined ? PAD_BUTTON_NAMES[padBtn] ?? `Btn ${padBtn}` : '—'}`;
        label(ctx, txt, rx, y + h / 2, 18, sel ? PALETTE.gold : PALETTE.dim,
          { align: 'right', weight: 700 });
        break;
      }
      case 'info':
        label(ctx, item.value(), rx, y + h / 2, 20, PALETTE.text, { align: 'right', weight: 800 });
        break;
    }
  }

  /** Draws the hint for the highlighted row into a panel. */
  protected drawHint(ctx: Ctx, x: number, y: number, w: number): number {
    const item = this.items[this.index];
    const hint = item && 'hint' in item ? item.hint : undefined;
    if (!hint) return y;
    const font = `600 17px ${FONT_UI}`;
    const lines = wrapText(ctx, hint, w - 36, font);
    const h = 34 + lines.length * 24;
    panel(ctx, x, y, w, h, { radius: 12, fill: '#191430', border: PALETTE.line, alpha: 0.95 });
    lines.forEach((ln, i) => label(ctx, ln, x + 18, y + 26 + i * 24, 17, PALETTE.dim, { weight: 600 }));
    return y + h + 18;
  }

  private drawCapture(ctx: Ctx, dw: number, dh: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,10,0.8)';
    ctx.fillRect(0, 0, dw, dh);
    const pop = Ease.backOut(clamp01(this.t * 6));
    ctx.translate(dw / 2, dh / 2);
    ctx.scale(pop, pop);
    displayText(ctx, 'PRESS A KEY OR BUTTON', 0, -30, 46, PALETTE.gold, { outlineWidth: 9 });
    label(ctx, 'ESC to cancel', 0, 34, 18, PALETTE.dim, { align: 'center', weight: 700 });
    ctx.restore();
  }
}
