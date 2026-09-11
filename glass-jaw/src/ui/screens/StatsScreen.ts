import type { Game } from '../../core/Game';
import { MenuScreen, MenuItem } from './MenuBase';
import { ALL_BOXERS } from '../../data/boxers';
import type { Ctx } from '../../render/draw';
import { bar, displayText, label, PALETTE, panel } from '../ui';

/** Lifetime statistics and per-opponent records. */
export class StatsScreen extends MenuScreen {
  readonly name = 'stats';

  constructor(game: Game) {
    super(game);
    this.listTop = 250;
    this.listW = 700;
    this.rowH = 46;
    this.visibleRows = 12;
    this.rebuild();
  }

  title(): string { return 'STATISTICS'; }
  protected override subtitle(): string {
    const s = this.game.save.data.stats;
    const acc = s.punchesThrown ? (s.punchesLanded / s.punchesThrown) * 100 : 0;
    return `${s.totalFights} fights  ·  ${acc.toFixed(1)}% accuracy  ·  best streak ${s.longestWinStreak}`;
  }

  protected override rebuild(): void {
    const s = this.game.save.data.stats;
    const acc = s.punchesThrown ? (s.punchesLanded / s.punchesThrown) * 100 : 0;
    const mins = Math.floor(s.timeInRing / 60);

    const items: MenuItem[] = [
      { kind: 'header', label: 'Record' },
      { kind: 'info', label: 'FIGHTS', value: () => String(s.totalFights) },
      { kind: 'info', label: 'WINS — LOSSES', value: () => `${s.totalWins} — ${s.totalLosses}` },
      { kind: 'info', label: 'WINS INSIDE THE DISTANCE', value: () => String(s.koWins) },
      { kind: 'info', label: 'CURRENT WIN STREAK', value: () => String(s.currentWinStreak) },
      { kind: 'info', label: 'LONGEST WIN STREAK', value: () => String(s.longestWinStreak) },
      { kind: 'info', label: 'TIME IN THE RING', value: () => `${mins} min` },

      { kind: 'header', label: 'Offence' },
      { kind: 'info', label: 'PUNCHES THROWN', value: () => s.punchesThrown.toLocaleString() },
      { kind: 'info', label: 'PUNCHES LANDED', value: () => s.punchesLanded.toLocaleString() },
      { kind: 'info', label: 'ACCURACY', value: () => `${acc.toFixed(1)}%` },
      { kind: 'info', label: 'SPECIALS THROWN', value: () => String(s.specialsThrown) },
      { kind: 'info', label: 'KNOCKDOWNS DEALT', value: () => String(s.knockdownsDealt) },

      { kind: 'header', label: 'Defence and skill' },
      { kind: 'info', label: 'PERFECT DODGES', value: () => String(s.perfectDodges) },
      { kind: 'info', label: 'PARRIES', value: () => String(s.parries) },
      { kind: 'info', label: 'COUNTERS', value: () => String(s.counters) },
      { kind: 'info', label: 'WEAK POINTS HIT', value: () => String(s.weaknessHits) },
      { kind: 'info', label: 'KNOCKDOWNS TAKEN', value: () => String(s.knockdownsTaken) },

      { kind: 'header', label: 'Save data' },
      {
        kind: 'action', label: 'EXPORT SAVE TO CLIPBOARD',
        hint: 'Copies your progress as JSON so you can keep a backup.',
        run: () => {
          const text = this.game.save.export();
          void navigator.clipboard?.writeText(text)
            .then(() => this.game.audio.play('uiUnlock'))
            .catch(() => this.game.audio.play('uiDeny'));
        },
      },
      {
        kind: 'action', label: 'ERASE ALL PROGRESS', accent: PALETTE.red,
        hint: 'Deletes career progress, unlocks, records and statistics. This cannot be undone.',
        run: () => {
          if (!this.confirming) {
            this.confirming = true;
            this.game.audio.play('uiDeny');
            return;
          }
          this.confirming = false;
          this.game.save.reset();
          this.game.audio.play('uiDeny');
          this.rebuild();
        },
        value: () => (this.confirming ? 'PRESS AGAIN TO CONFIRM' : ''),
      },
      { kind: 'action', label: 'BACK', run: () => this.onBack() },
    ];
    this.items = items;
    this.ensureSelectable(1);
  }

  private confirming = false;

  protected override move(dir: number): void {
    this.confirming = false;
    super.move(dir);
  }

  protected override drawDetail(ctx: Ctx, x: number, y: number, w: number): void {
    const cy = this.drawHint(ctx, x, y, w);
    const save = this.game.save;
    const beaten = ALL_BOXERS.filter((b) => save.data.records[b.id]?.defeated);
    const h = 520;
    panel(ctx, x, cy, w, h, { radius: 14, fill: '#191430', border: PALETTE.line });
    displayText(ctx, 'BEST TIMES', x + w / 2, cy + 36, 24, PALETTE.gold, { outlineWidth: 5 });

    if (!beaten.length) {
      label(ctx, 'Beat somebody and their best time shows up here.',
        x + w / 2, cy + 90, 15, PALETTE.dim, { align: 'center', weight: 600 });
      return;
    }

    const rows = beaten.slice(0, 16);
    rows.forEach((b, i) => {
      const ry = cy + 70 + i * 27;
      const rec = save.data.records[b.id];
      label(ctx, b.name, x + 18, ry, 14, PALETTE.text, { weight: 700 });
      const t = rec.bestTime
        ? `${Math.floor(rec.bestTime / 60)}:${Math.floor(rec.bestTime % 60).toString().padStart(2, '0')}`
        : 'decision';
      label(ctx, t, x + w - 18, ry, 14, rec.bestTime ? PALETTE.gold : PALETTE.dim,
        { align: 'right', weight: 800 });
    });

    label(ctx, 'ROSTER DISCOVERED', x + 18, cy + h - 34, 12, PALETTE.dim, { weight: 900 });
    bar(ctx, x + 190, cy + h - 42, w - 210, 14,
      this.game.career.unlockedBoxers().length / ALL_BOXERS.length,
      { color: PALETTE.gold, radius: 7 });
  }
}
