import type { Game } from '../../core/Game';
import { MenuScreen, MenuItem } from './MenuBase';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/difficulty';
import { ALL_BOXERS, LEAGUE_INFO } from '../../data/boxers';
import type { BoxerDef } from '../../data/types';
import { startFight } from '../../scenes/launch';
import { BoxerPortrait } from '../BoxerPortrait';
import type { Ctx } from '../../render/draw';
import { rgba } from '../../render/draw';
import { displayText, flagChip, label, PALETTE, panel } from '../ui';
import { FState } from '../../combat/Fighter';

/** Arcade mode: any unlocked opponent, any difficulty, for a score. */
export class ArcadeScreen extends MenuScreen {
  readonly name = 'arcade';
  private portrait = new BoxerPortrait(ALL_BOXERS[0].appearance);
  private selected: BoxerDef = ALL_BOXERS[0];
  private rounds = 3;

  constructor(game: Game) {
    super(game);
    this.listTop = 258;
    this.listW = 640;
    this.rowH = 58;
    this.visibleRows = 9;
    this.rebuild();
  }

  title(): string { return 'ARCADE'; }
  protected override subtitle(): string {
    return 'Pick a fight. Beat them once anywhere and they show up here forever.';
  }

  override enter(): void { super.enter(); this.rebuild(); }

  protected override rebuild(): void {
    const g = this.game;
    const items: MenuItem[] = [];
    const unlocked = g.career.unlockedBoxers();

    items.push({
      kind: 'choice', label: 'DIFFICULTY',
      hint: DIFFICULTIES[g.settings.current.difficulty].blurb,
      options: DIFFICULTY_ORDER.map((d) => ({
        label: DIFFICULTIES[d].name, value: d, color: DIFFICULTIES[d].color,
      })),
      get: () => g.settings.current.difficulty,
      set: (v) => { g.settings.set('difficulty', v as never); this.rebuild(); },
    });
    items.push({
      kind: 'choice', label: 'ROUNDS',
      hint: 'Shorter fights are faster to score; longer ones give you room to come back.',
      options: [{ label: '1', value: '1' }, { label: '3', value: '3' }, { label: '5', value: '5' }],
      get: () => String(this.rounds),
      set: (v) => { this.rounds = Number(v); },
    });

    let league = '';
    for (const b of ALL_BOXERS) {
      const open = unlocked.includes(b);
      if (b.league !== league) {
        league = b.league;
        items.push({ kind: 'header', label: LEAGUE_INFO[b.league].name });
      }
      const rec = g.save.data.records[b.id];
      items.push({
        kind: 'action',
        label: open ? `${b.name.toUpperCase()}  "${b.nickname}"` : '??? — LOCKED',
        accent: b.appearance.glow,
        value: () => (open
          ? rec?.bestScore ? `BEST ${rec.bestScore.toLocaleString()}` : 'NEW'
          : 'LOCKED'),
        disabled: () => !open,
        hint: open ? b.bio : 'Reach this opponent in Career mode to unlock them here.',
        run: () => {
          startFight(g, {
            opponent: b,
            difficulty: g.settings.current.difficulty,
            mode: 'arcade',
            rounds: this.rounds,
            playerStats: g.career.playerStats(),
          });
        },
      });
    }

    items.push({ kind: 'header', label: '' });
    items.push({ kind: 'action', label: 'BACK', run: () => this.onBack() });
    this.items = items;
    this.ensureSelectable(1);
    this.syncPortrait();
  }

  protected override move(dir: number): void {
    super.move(dir);
    this.syncPortrait();
  }

  private syncPortrait(): void {
    const item = this.items[this.index];
    if (item?.kind !== 'action') return;
    const found = ALL_BOXERS.find(
      (b) => item.label.startsWith(b.name.toUpperCase()),
    );
    if (found) {
      this.selected = found;
      this.portrait.setAppearance(found.appearance);
    }
  }

  override updateRaw(rawDt: number): void {
    super.updateRaw(rawDt);
    this.portrait.update(rawDt);
  }

  protected override drawDetail(ctx: Ctx, x: number, y: number, w: number): void {
    const b = this.selected;
    const unlocked = this.game.save.isUnlocked(b.id);
    const h = 620;
    panel(ctx, x, y, w, h, { radius: 16, fill: '#191430', border: rgba(b.appearance.glow, 0.6) });

    if (unlocked) {
      this.portrait.draw(ctx, x + 6, y + 6, w - 12, 300, { crop: 'full', rim: b.appearance.glow });
    } else {
      ctx.save();
      ctx.globalAlpha = 0.25;
      this.portrait.draw(ctx, x + 6, y + 6, w - 12, 300, { crop: 'full' });
      ctx.restore();
      displayText(ctx, '?', x + w / 2, y + 150, 150, PALETTE.dim, { outlineWidth: 14 });
    }

    const name = unlocked ? b.name.toUpperCase() : '???';
    displayText(ctx, name, x + w / 2, y + 336, 32, PALETTE.text, { outlineWidth: 6 });
    if (unlocked) {
      label(ctx, `"${b.nickname}"`, x + w / 2, y + 368, 19, b.appearance.glow,
        { align: 'center', weight: 800 });
      flagChip(ctx, x + w / 2 - 26, y + 386, 52, 34, b.flag);
      label(ctx, b.archetype, x + w / 2, y + 442, 15, PALETTE.gold, { align: 'center', weight: 900 });

      const rows: [string, string][] = [
        ['AGE', String(b.age)],
        ['HEIGHT', `${b.height} cm`],
        ['WEIGHT', `${b.weight} kg`],
        ['RECORD', `${b.record.w}-${b.record.l} (${b.record.ko} KO)`],
        ['STYLE', b.style],
      ];
      rows.forEach((r, i) => {
        const ry = y + 476 + i * 25;
        label(ctx, r[0], x + 20, ry, 13, PALETTE.dim, { weight: 700 });
        label(ctx, r[1], x + w - 20, ry, 13, PALETTE.text, { align: 'right', weight: 700 });
      });

      const rec = this.game.save.data.records[b.id];
      if (rec?.weaknessFound) {
        label(ctx, 'WEAK POINT KNOWN', x + w / 2, y + h - 22, 14, PALETTE.gold,
          { align: 'center', weight: 900 });
      }
    }
    void FState;
  }
}
