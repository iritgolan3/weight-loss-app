import type { Game } from '../../core/Game';
import { MenuScreen, MenuItem } from './MenuBase';
import { ALL_BOXERS } from '../../data/boxers';
import type { BoxerDef } from '../../data/types';
import { TRAINING_DRILLS, type TrainingConfig } from '../../scenes/TrainingConfig';
import { startFight } from '../../scenes/launch';
import { BoxerPortrait } from '../BoxerPortrait';
import type { Ctx } from '../../render/draw';
import { rgba } from '../../render/draw';
import { displayText, label, PALETTE, panel, wrapText, FONT_UI } from '../ui';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/difficulty';

/**
 * Training. The drill list and the opponent list are both here so you can
 * decide "who do I need to learn" and "what exactly do I need to practise"
 * in one place.
 */
export class TrainingScreen extends MenuScreen {
  readonly name = 'training';
  private drill: TrainingConfig = TRAINING_DRILLS[0];
  private opponent: BoxerDef;
  private portrait: BoxerPortrait;

  constructor(game: Game) {
    super(game);
    const unlocked = game.career.unlockedBoxers();
    this.opponent = unlocked[0] ?? ALL_BOXERS[0];
    this.portrait = new BoxerPortrait(this.opponent.appearance);
    this.listTop = 258;
    this.listW = 640;
    this.rowH = 56;
    this.visibleRows = 9;
    this.rebuild();
  }

  title(): string { return 'TRAINING'; }
  protected override subtitle(): string {
    return 'You cannot be knocked out in here. Take as long as you need.';
  }

  override enter(): void { super.enter(); this.rebuild(); }

  protected override rebuild(): void {
    const g = this.game;
    const items: MenuItem[] = [];
    const unlocked = g.career.unlockedBoxers();

    items.push({ kind: 'header', label: 'Drill' });
    for (const d of TRAINING_DRILLS) {
      items.push({
        kind: 'action',
        label: d.name,
        accent: PALETTE.green,
        value: () => (d.id === this.drill.id ? 'SELECTED' : ''),
        hint: d.description,
        run: () => { this.drill = d; this.game.audio.play('uiConfirm'); },
      });
    }

    items.push({ kind: 'header', label: 'Sparring partner' });
    for (const b of unlocked) {
      items.push({
        kind: 'action',
        label: `${b.name.toUpperCase()}  "${b.nickname}"`,
        accent: b.appearance.glow,
        value: () => (b.id === this.opponent.id ? 'SELECTED' : ''),
        hint: `${b.archetype} — ${b.style}`,
        run: () => {
          this.opponent = b;
          this.portrait.setAppearance(b.appearance);
          this.game.audio.play('uiConfirm');
        },
      });
    }
    if (unlocked.length === 0) {
      items.push({ kind: 'info', label: 'No sparring partners yet', value: () => 'Play a fight first' });
    }

    items.push({ kind: 'header', label: '' });
    items.push({
      kind: 'choice', label: 'THEIR DIFFICULTY',
      hint: 'Practising a pattern on CHAMPION is the fastest way to learn it, if you can stand it.',
      options: DIFFICULTY_ORDER.map((d) => ({
        label: DIFFICULTIES[d].name, value: d, color: DIFFICULTIES[d].color,
      })),
      get: () => this.game.settings.current.difficulty,
      set: (v) => this.game.settings.set('difficulty', v as never),
    });
    items.push({
      kind: 'action', label: 'START DRILL', accent: PALETTE.gold,
      hint: `${this.drill.name} against ${this.opponent.name}.`,
      disabled: () => unlocked.length === 0,
      run: () => this.start(),
    });
    items.push({ kind: 'action', label: 'BACK', run: () => this.onBack() });

    this.items = items;
    this.ensureSelectable(1);
  }

  private start(): void {
    const g = this.game;
    // Boss practice starts them at a sliver of health, which puts a
    // multi-phase opponent straight into their final phase.
    startFight(g, {
      opponent: this.opponent,
      difficulty: g.settings.current.difficulty,
      mode: 'training',
      training: this.drill,
      rounds: this.drill.rounds,
      roundSeconds: this.drill.roundSeconds,
      playerStats: g.career.playerStats(),
    });
  }

  override updateRaw(rawDt: number): void {
    super.updateRaw(rawDt);
    this.portrait.update(rawDt);
  }

  protected override drawDetail(ctx: Ctx, x: number, y: number, w: number): void {
    const h = 620;
    panel(ctx, x, y, w, h, { radius: 16, fill: '#191430', border: rgba(this.opponent.appearance.glow, 0.55) });
    this.portrait.draw(ctx, x + 6, y + 6, w - 12, 260, { crop: 'full', rim: this.opponent.appearance.glow });

    displayText(ctx, this.drill.name, x + w / 2, y + 300, 26, PALETTE.green, { outlineWidth: 5 });
    const lines = wrapText(ctx, this.drill.description, w - 40, `600 16px ${FONT_UI}`);
    lines.forEach((ln, i) => label(ctx, ln, x + 20, y + 336 + i * 22, 16, PALETTE.dim, { weight: 600 }));

    let cy = y + 348 + lines.length * 22;
    label(ctx, 'AGAINST', x + 20, cy, 13, PALETTE.dim, { weight: 800 });
    displayText(ctx, this.opponent.name.toUpperCase(), x + w / 2, cy + 32, 26, PALETTE.text, { outlineWidth: 5 });
    cy += 62;

    // The weak point, if it has been discovered.
    const rec = this.game.save.data.records[this.opponent.id];
    const known = rec?.weaknessFound;
    panel(ctx, x + 14, cy, w - 28, 132, {
      radius: 12, fill: known ? '#241a08' : '#141020',
      border: known ? PALETTE.gold : PALETTE.line,
    });
    label(ctx, known ? 'WEAK POINT' : 'WEAK POINT — UNDISCOVERED', x + 30, cy + 24, 13,
      known ? PALETTE.gold : PALETTE.dim, { weight: 900 });
    const hintText = known
      ? this.opponent.weakness.hint
      : 'Find it in a fight. Hit the right target during the right tell and you will know.';
    const hl = wrapText(ctx, hintText, w - 60, `600 15px ${FONT_UI}`);
    hl.forEach((ln, i) => label(ctx, ln, x + 30, cy + 52 + i * 21, 15,
      known ? PALETTE.text : PALETTE.dim, { weight: 600 }));
  }
}
