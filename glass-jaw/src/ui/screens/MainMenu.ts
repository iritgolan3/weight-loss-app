import type { Game } from '../../core/Game';
import { MenuScreen, MenuItem } from './MenuBase';
import type { Ctx } from '../../render/draw';
import { rgba } from '../../render/draw';
import { displayText, label, PALETTE, panel, bar } from '../ui';
import { SettingsScreen } from './SettingsScreen';
import { CareerScreen } from './CareerScreen';
import { ArcadeScreen } from './ArcadeScreen';
import { TrainingScreen } from './TrainingScreen';
import { RosterScreen } from './RosterScreen';
import { StatsScreen } from './StatsScreen';
import { CreditsScreen } from './CreditsScreen';
import { startFight } from '../../scenes/launch';
import { TitleScreen } from './TitleScreen';
import { ALL_BOXERS } from '../../data/boxers';

/** The hub. Everything in the game is one hop from here. */
export class MainMenu extends MenuScreen {
  readonly name = 'mainmenu';

  constructor(game: Game) {
    super(game);
    this.listTop = 268;
    this.listW = 620;
    this.rowH = 68;
    this.visibleRows = 11;
    this.rebuild();
  }

  title(): string { return 'GLASS JAW'; }
  protected override subtitle(): string {
    const c = this.game.career;
    return c.state.active
      ? `${this.game.career.title} — ${c.state.cleared.length}/${ALL_BOXERS.length} opponents beaten`
      : 'Read the tell. Slip the punch. Make them pay.';
  }

  override enter(): void {
    super.enter();
    this.rebuild();
    this.game.audio.playMusic('menu', 0.8);
    this.game.onAudioReady = () => this.game.audio.playMusic('menu', 0.4);
  }

  override exit(): void {
    super.exit();
    this.game.onAudioReady = null;
  }

  protected override rebuild(): void {
    const g = this.game;
    const career = g.career;
    const items: MenuItem[] = [];

    const next = career.nextOpponent;
    items.push({
      kind: 'action',
      label: career.state.active ? 'CONTINUE CAREER' : 'START CAREER',
      accent: PALETTE.gold,
      value: () => (next ? `vs ${next.name}` : career.complete ? 'CHAMPION' : ''),
      hint: career.state.active
        ? `Pick the ladder back up. Next up: ${next?.name ?? 'nobody — you hold the belt'}.`
        : 'Four leagues, sixteen opponents, one belt. Earn money between fights and spend it on your own attributes.',
      run: () => { career.start(); g.push(new CareerScreen(g)); },
    });

    items.push({
      kind: 'action', label: 'QUICK FIGHT',
      value: () => 'Instant',
      hint: 'Straight into the ring against the first opponent you have unlocked. No progress, no bookkeeping.',
      run: () => {
        const list = career.unlockedBoxers();
        const opp = list[list.length - 1] ?? ALL_BOXERS[0];
        startFight(g, {
          opponent: opp,
          difficulty: g.settings.current.difficulty,
          mode: 'arcade',
          playerStats: career.playerStats(),
        });
      },
    });

    items.push({ kind: 'header', label: 'Modes' });

    items.push({
      kind: 'action', label: 'ARCADE',
      value: () => `${career.unlockedBoxers().length} unlocked`,
      hint: 'Any opponent you have unlocked, at any difficulty, for a score.',
      run: () => g.push(new ArcadeScreen(g)),
    });
    items.push({
      kind: 'action', label: 'TRAINING',
      hint: 'Seven drills against any unlocked opponent. This is where you actually learn somebody.',
      run: () => g.push(new TrainingScreen(g)),
    });
    items.push({
      kind: 'action', label: 'BOXER PROFILES',
      hint: 'Tale of the tape for all sixteen, plus the weak point of everyone you have found one on.',
      run: () => g.push(new RosterScreen(g)),
    });

    items.push({ kind: 'header', label: 'Other' });
    items.push({
      kind: 'action', label: 'STATISTICS',
      hint: 'Lifetime record, accuracy, knockdowns and your best time against every opponent.',
      run: () => g.push(new StatsScreen(g)),
    });
    items.push({
      kind: 'action', label: 'SETTINGS',
      hint: 'Difficulty, audio, graphics, accessibility and fully remappable controls.',
      run: () => g.push(new SettingsScreen(g)),
    });
    items.push({
      kind: 'action', label: 'CREDITS',
      hint: 'Who made this, and what it is and is not built from.',
      run: () => g.push(new CreditsScreen(g)),
    });

    this.items = items;
    this.index = Math.min(this.index, this.items.length - 1);
    this.ensureSelectable(1);
  }

  protected override onBack(): void {
    // Nothing above the main menu; bounce back to the title.
    //
    // This MUST be synchronous. It used to load TitleScreen with a dynamic
    // import, which meant the stack replacement landed several frames later —
    // often after the player had already opened another screen, wiping it.
    this.game.audio.play('uiBack');
    this.game.replace(new TitleScreen(this.game));
  }

  protected override footerHint(): string {
    return 'W/S move    ENTER select    ESC back to title';
  }

  protected override drawDetail(ctx: Ctx, x: number, y: number, w: number): void {
    let cy = this.drawHint(ctx, x, y, w);
    const c = this.game.career;

    panel(ctx, x, cy, w, 260, { radius: 14, fill: '#191430', border: PALETTE.line });
    label(ctx, 'YOUR FIGHTER', x + 20, cy + 28, 14, PALETTE.gold, { weight: 900 });
    displayText(ctx, 'RUSTY KOVAC', x + 20, cy + 66, 34, PALETTE.text, { align: 'left', outlineWidth: 7 });
    label(ctx, '"KID COMET"', x + 20, cy + 98, 18, PALETTE.orange, { weight: 800 });

    const rows: [string, string][] = [
      ['Rank', c.title],
      ['Record', `${this.game.save.data.stats.totalWins}-${this.game.save.data.stats.totalLosses}`],
      ['Purse', `$${c.state.money.toLocaleString()}`],
      ['Ranking points', String(c.state.rank)],
    ];
    rows.forEach((r, i) => {
      const ry = cy + 136 + i * 26;
      label(ctx, r[0], x + 20, ry, 15, PALETTE.dim, { weight: 600 });
      label(ctx, r[1], x + w - 20, ry, 15, PALETTE.text, { align: 'right', weight: 800 });
    });

    label(ctx, 'CAREER PROGRESS', x + 20, cy + 246 - 6, 12, PALETTE.dim, { weight: 800 });
    bar(ctx, x + 150, cy + 232, w - 172, 16, c.progress, { color: PALETTE.gold, radius: 8 });
    cy += 278;

    if (!this.game.save.persistent) {
      panel(ctx, x, cy, w, 64, { radius: 10, fill: '#2a1414', border: PALETTE.red });
      label(ctx, 'Progress cannot be saved in this browser', x + 18, cy + 24, 14, PALETTE.red, { weight: 800 });
      label(ctx, 'Storage is unavailable (private window?).', x + 18, cy + 46, 13, PALETTE.dim, { weight: 600 });
    }
  }

  protected override drawBackdrop(ctx: Ctx): void {
    const { dw, dh } = this.game.renderer;
    this.defaultBackdrop(ctx, dw, dh);
    // A faint wordmark watermark, kept low and clear of the panels.
    ctx.save();
    ctx.globalAlpha = 0.04;
    displayText(ctx, 'GLASS JAW', dw * 0.5, dh * 0.9, 190, rgba(PALETTE.gold, 1), { outlineWidth: 0 });
    ctx.restore();
  }
}
