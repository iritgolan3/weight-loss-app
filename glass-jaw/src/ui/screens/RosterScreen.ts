import type { Game } from '../../core/Game';
import { MenuScreen, MenuItem } from './MenuBase';
import { ALL_BOXERS, LEAGUE_INFO } from '../../data/boxers';
import type { BoxerDef } from '../../data/types';
import { BoxerPortrait } from '../BoxerPortrait';
import type { Ctx } from '../../render/draw';
import { rgba } from '../../render/draw';
import { bar, displayText, flagChip, label, PALETTE, panel, wrapText, FONT_UI } from '../ui';
import { FState } from '../../combat/Fighter';

/**
 * Boxer profiles — the tale of the tape for all sixteen.
 *
 * Weak points are hidden until you have actually landed one in a fight. That
 * discovery is the best moment the game has, so it is not spoiled here.
 */
export class RosterScreen extends MenuScreen {
  readonly name = 'roster';
  private selected: BoxerDef = ALL_BOXERS[0];
  private portrait = new BoxerPortrait(ALL_BOXERS[0].appearance);

  constructor(game: Game) {
    super(game);
    this.listTop = 246;
    this.listW = 560;
    this.rowH = 54;
    this.visibleRows = 11;
    this.rebuild();
  }

  title(): string { return 'BOXERS'; }
  protected override subtitle(): string {
    const known = ALL_BOXERS.filter((b) => this.game.save.data.records[b.id]?.weaknessFound).length;
    return `${this.game.career.unlockedBoxers().length}/${ALL_BOXERS.length} met  ·  ${known} weak points found`;
  }

  protected override rebuild(): void {
    const items: MenuItem[] = [];
    let league = '';
    for (const b of ALL_BOXERS) {
      if (b.league !== league) {
        league = b.league;
        items.push({ kind: 'header', label: LEAGUE_INFO[b.league].name });
      }
      const open = this.game.save.isUnlocked(b.id);
      items.push({
        kind: 'action',
        label: open ? b.name.toUpperCase() : '???',
        accent: b.appearance.glow,
        value: () => (open ? b.archetype.replace('THE ', '') : 'LOCKED'),
        run: () => {
          this.portrait.pose(FState.Victory, 0);
          this.game.audio.play('uiConfirm');
        },
      });
    }
    items.push({ kind: 'header', label: '' });
    items.push({ kind: 'action', label: 'BACK', run: () => this.onBack() });
    this.items = items;
    this.ensureSelectable(1);
    this.sync();
  }

  protected override move(dir: number): void {
    super.move(dir);
    this.sync();
  }

  private sync(): void {
    const item = this.items[this.index];
    if (item?.kind !== 'action') return;
    const b = ALL_BOXERS.find((x) => x.name.toUpperCase() === item.label);
    if (b) {
      this.selected = b;
      this.portrait.setAppearance(b.appearance);
    }
  }

  override updateRaw(rawDt: number): void {
    super.updateRaw(rawDt);
    this.portrait.update(rawDt);
  }

  protected override drawDetail(ctx: Ctx, x: number, y: number, w: number): void {
    const b = this.selected;
    const open = this.game.save.isUnlocked(b.id);
    const rec = this.game.save.data.records[b.id];
    const h = 660;
    panel(ctx, x, y, w, h, { radius: 16, fill: '#191430', border: rgba(b.appearance.glow, 0.6) });

    ctx.save();
    if (!open) ctx.globalAlpha = 0.2;
    this.portrait.draw(ctx, x + 6, y + 6, w * 0.44, 300, { crop: 'full', rim: b.appearance.glow });
    ctx.restore();

    const tx = x + w * 0.46;
    const tw = w - (w * 0.46) - 20;

    if (!open) {
      displayText(ctx, '?', x + w * 0.22, y + 150, 130, PALETTE.dim, { outlineWidth: 12 });
      label(ctx, 'NOT YET MET', tx, y + 40, 18, PALETTE.dim, { weight: 900 });
      const l = wrapText(ctx, 'Work up the career ladder to meet this fighter.', tw, `600 15px ${FONT_UI}`);
      l.forEach((ln, i) => label(ctx, ln, tx, y + 72 + i * 22, 15, PALETTE.dim, { weight: 600 }));
      return;
    }

    displayText(ctx, b.name.toUpperCase(), tx, y + 36, 28, PALETTE.text, { align: 'left', outlineWidth: 6 });
    label(ctx, `"${b.nickname}"`, tx, y + 68, 19, b.appearance.glow, { weight: 800 });
    flagChip(ctx, tx, y + 84, 46, 30, b.flag);
    label(ctx, b.country, tx + 56, y + 100, 14, PALETTE.dim, { weight: 700 });
    label(ctx, b.archetype, tx, y + 134, 15, PALETTE.gold, { weight: 900 });

    const tape: [string, string][] = [
      ['AGE', String(b.age)],
      ['HEIGHT', `${b.height} cm`],
      ['WEIGHT', `${b.weight} kg`],
      ['RECORD', `${b.record.w}-${b.record.l}`],
      ['KNOCKOUTS', String(b.record.ko)],
    ];
    tape.forEach((r, i) => {
      const ry = y + 166 + i * 22;
      label(ctx, r[0], tx, ry, 13, PALETTE.dim, { weight: 700 });
      label(ctx, r[1], tx + tw, ry, 13, PALETTE.text, { align: 'right', weight: 800 });
    });

    // Bio and personality.
    let cy = y + 316;
    label(ctx, 'PROFILE', x + 20, cy, 13, PALETTE.gold, { weight: 900 });
    cy += 22;
    const bio = wrapText(ctx, b.bio, w - 40, `600 15px ${FONT_UI}`);
    bio.forEach((ln, i) => label(ctx, ln, x + 20, cy + i * 21, 15, PALETTE.dim, { weight: 600 }));
    cy += bio.length * 21 + 16;

    // Strengths and flaws.
    label(ctx, 'STRENGTHS', x + 20, cy, 12, PALETTE.green, { weight: 900 });
    label(ctx, 'FLAWS', x + w / 2 + 10, cy, 12, PALETTE.red, { weight: 900 });
    cy += 20;
    const n = Math.max(b.strengths.length, b.flaws.length);
    for (let i = 0; i < n; i++) {
      if (b.strengths[i]) label(ctx, `+ ${b.strengths[i]}`, x + 20, cy + i * 20, 13, PALETTE.text, { weight: 600 });
      if (b.flaws[i]) label(ctx, `− ${b.flaws[i]}`, x + w / 2 + 10, cy + i * 20, 13, PALETTE.text, { weight: 600 });
    }
    cy += n * 20 + 16;

    // Weak point — hidden until discovered.
    const known = rec?.weaknessFound;
    const wh = 112;
    panel(ctx, x + 16, cy, w - 32, wh, {
      radius: 12, fill: known ? '#241a08' : '#141020',
      border: known ? PALETTE.gold : PALETTE.line,
    });
    label(ctx, known ? 'WEAK POINT' : 'WEAK POINT — UNDISCOVERED', x + 32, cy + 22, 12,
      known ? PALETTE.gold : PALETTE.dim, { weight: 900 });
    const hintText = known ? b.weakness.hint
      : 'Land the right punch during the right tell and it will announce itself.';
    const hl = wrapText(ctx, hintText, w - 64, `600 14px ${FONT_UI}`);
    hl.forEach((ln, i) => label(ctx, ln, x + 32, cy + 48 + i * 19, 14,
      known ? PALETTE.text : PALETTE.dim, { weight: 600 }));
    cy += wh + 14;

    // Your record against them.
    if (rec && (rec.wins || rec.losses)) {
      label(ctx, 'YOUR RECORD', x + 20, cy, 12, PALETTE.dim, { weight: 900 });
      label(ctx, `${rec.wins}W — ${rec.losses}L`, x + w - 20, cy, 14, PALETTE.text,
        { align: 'right', weight: 800 });
      cy += 20;
      if (rec.bestTime) {
        label(ctx, 'FASTEST FINISH', x + 20, cy, 12, PALETTE.dim, { weight: 900 });
        label(ctx, `${Math.floor(rec.bestTime / 60)}:${Math.floor(rec.bestTime % 60).toString().padStart(2, '0')}`,
          x + w - 20, cy, 14, PALETTE.gold, { align: 'right', weight: 800 });
      }
    }

    // Threat meter.
    const threat = ((b.stats.maxHealth ?? 100) / 140) * 0.4 + ((b.stats.power ?? 1) / 1.4) * 0.35
      + ((b.stats.speed ?? 1) / 1.4) * 0.25;
    label(ctx, 'THREAT', x + 20, y + h - 26, 12, PALETTE.dim, { weight: 900 });
    bar(ctx, x + 100, y + h - 34, w - 120, 14, Math.min(1, threat), {
      color: b.appearance.glow, radius: 7,
    });
  }
}
