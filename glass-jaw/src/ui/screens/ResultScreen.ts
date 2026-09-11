import type { Game, Scene } from '../../core/Game';
import type { GameTime } from '../../core/Time';
import type { FightResult } from '../../combat/Referee';
import type { FightStats } from '../../scenes/FightScene';
import type { BoxerDef } from '../../data/types';
import type { Difficulty } from '../../data/difficulty';
import { Action } from '../../input/Actions';
import { clamp01, Ease, lerp } from '../../core/MathUtil';
import type { Ctx } from '../../render/draw';
import { rgba, starPath } from '../../render/draw';
import { bar, displayText, label, PALETTE, panel } from '../ui';
import type { FightReward } from '../../career/CareerSystem';

export interface ResultSetup {
  result: FightResult;
  stats: FightStats;
  opponent: BoxerDef;
  mode: 'career' | 'arcade' | 'training';
  difficulty: Difficulty;
  onDone: () => void;
  onRematch: () => void;
  /** Career rewards, if any, to show as a payout. */
  reward?: FightReward;
}

/**
 * Post-fight results.
 *
 * Rows count up one at a time rather than appearing all at once — it gives the
 * player a beat to actually read their own performance, and it is where the
 * "one more try" feeling gets reinforced.
 */
export class ResultScreen implements Scene {
  readonly name = 'result';
  readonly transparent = true;

  private t = 0;
  private index = 0;
  private items: { label: string; run: () => void }[] = [];
  private rows: { label: string; value: string; highlight?: boolean }[] = [];

  constructor(private readonly game: Game, private readonly setup: ResultSetup) {
    this.buildRows();
    this.buildItems();
  }

  private get won(): boolean { return this.setup.result.winner?.isPlayer === true; }

  private buildRows(): void {
    const s = this.setup.stats;
    const r = this.setup.result;
    const acc = s.punchesThrown ? (s.punchesLanded / s.punchesThrown) * 100 : 0;
    this.rows = [
      { label: 'PUNCHES LANDED', value: `${s.punchesLanded} / ${s.punchesThrown}` },
      { label: 'ACCURACY', value: `${acc.toFixed(0)}%`, highlight: acc >= 60 },
      { label: 'PERFECT DODGES', value: String(s.perfectDodges), highlight: s.perfectDodges >= 5 },
      { label: 'PARRIES', value: String(s.parries), highlight: s.parries >= 3 },
      { label: 'COUNTERS', value: String(s.counters), highlight: s.counters >= 5 },
      { label: 'WEAK POINT HITS', value: String(s.weaknessHits), highlight: s.weaknessHits > 0 },
      { label: 'BEST COMBO', value: `${s.maxCombo} hits` },
      { label: 'KNOCKDOWNS', value: `${s.knockdownsDealt} — ${s.knockdownsTaken}` },
      { label: 'TIME', value: `${Math.floor(r.seconds / 60)}:${Math.floor(r.seconds % 60).toString().padStart(2, '0')}` },
      { label: 'SCORE', value: r.playerScore.toLocaleString(), highlight: true },
    ];
    const rw = this.setup.reward;
    if (rw && this.won) {
      this.rows.push({ label: 'PURSE', value: `$${rw.money.toLocaleString()}`, highlight: true });
      this.rows.push({ label: 'RANKING POINTS', value: `+${rw.rank}`, highlight: true });
    }
  }

  private buildItems(): void {
    this.items = [
      { label: this.won ? 'CONTINUE' : 'TRY AGAIN', run: () => (this.won ? this.setup.onDone() : this.setup.onRematch()) },
      { label: this.won ? 'REMATCH' : 'GIVE UP FOR NOW', run: () => (this.won ? this.setup.onRematch() : this.setup.onDone()) },
    ];
  }

  enter(): void {
    this.game.audio.playMusic(this.won ? 'victory' : 'defeat', 0.3);
    if (this.won) this.game.audio.play('crowdBig');
  }

  exit(): void { this.game.audio.stopMusic(0.4); }

  update(_dt: number, _time: GameTime): void {
    const i = this.game.input;
    if (this.t < 0.5) return;
    if (i.justPressed(Action.MenuDown)) { this.index = (this.index + 1) % this.items.length; this.game.audio.play('uiMove'); }
    if (i.justPressed(Action.MenuUp)) { this.index = (this.index + this.items.length - 1) % this.items.length; this.game.audio.play('uiMove'); }
    if (i.justPressed(Action.Confirm)) { this.game.audio.play('uiConfirm'); this.items[this.index].run(); }
    if (i.justPressed(Action.Cancel)) { this.game.audio.play('uiBack'); this.setup.onDone(); }
  }

  updateRaw(rawDt: number): void { this.t += rawDt; }

  render(ctx: Ctx, _alpha: number, _time: GameTime): void {
    const { dw, dh } = this.game.renderer;
    const won = this.won;
    const accent = won ? PALETTE.gold : PALETTE.red;

    ctx.fillStyle = 'rgba(5,3,9,0.9)';
    ctx.fillRect(0, 0, dw, dh);

    // Radiating backdrop.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.14;
    starPath(ctx, dw / 2, dh * 0.3, dh * 0.9, dh * 0.28, 16, this.t * 0.1);
    const g = ctx.createRadialGradient(dw / 2, dh * 0.3, 40, dw / 2, dh * 0.3, dh * 0.9);
    g.addColorStop(0, rgba(accent, 0.6));
    g.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    const pop = Ease.backOut(clamp01(this.t * 2.2));
    ctx.save();
    ctx.translate(dw / 2, 150);
    ctx.scale(pop, pop);
    displayText(ctx, won ? 'VICTORY' : 'DEFEAT', 0, 0, 118, accent, {
      outlineWidth: 20, shadow: accent,
    });
    ctx.restore();

    const method = this.setup.result.method;
    const line = won
      ? method === 'KO' ? `${this.setup.opponent.name.toUpperCase()} COULD NOT BEAT THE COUNT`
        : method === 'TKO' ? 'STOPPED — THE CORNER THREW IT IN'
        : 'YOU TOOK THE CARDS'
      : method === 'KO' ? 'YOU COULD NOT BEAT THE COUNT'
        : method === 'TKO' ? 'THE REFEREE STOPPED IT' : 'THE JUDGES SAW IT HIS WAY';
    label(ctx, line, dw / 2, 218, 20, PALETTE.dim, { align: 'center', weight: 700 });

    // Quote from the opponent.
    const quotes = won ? this.setup.opponent.quotes.lose : this.setup.opponent.quotes.win;
    const quote = quotes[Math.floor(this.t / 4) % quotes.length];
    label(ctx, `${this.setup.opponent.name}: "${quote}"`, dw / 2, 252, 17,
      rgba(this.setup.opponent.appearance.glow, 0.9), { align: 'center', weight: 600 });

    // Scorecard.
    const pw = Math.min(740, dw * 0.5);
    const px = dw / 2 - pw / 2;
    const py = 294;
    const rowH = 34;
    const ph = 42 + this.rows.length * rowH;
    panel(ctx, px, py, pw, ph, { radius: 16, fill: '#14101f', border: rgba(accent, 0.55) });

    this.rows.forEach((r, i) => {
      // Stagger the reveal so the card reads line by line.
      const appear = clamp01((this.t - 0.5 - i * 0.09) * 5);
      if (appear <= 0) return;
      const ry = py + 34 + i * rowH;
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.translate(lerp(-24, 0, appear), 0);
      label(ctx, r.label, px + 26, ry, 16, PALETTE.dim, { weight: 700 });
      label(ctx, r.value, px + pw - 26, ry, r.highlight ? 21 : 18,
        r.highlight ? accent : PALETTE.text, { align: 'right', weight: 900 });
      ctx.restore();
    });

    // Rating stamp.
    const grade = this.grade();
    const gAppear = clamp01((this.t - 0.5 - this.rows.length * 0.09) * 3);
    if (gAppear > 0) {
      ctx.save();
      ctx.globalAlpha = gAppear;
      ctx.translate(px + pw + 90, py + 110);
      ctx.rotate(-0.16);
      ctx.scale(lerp(2.4, 1, Ease.quartOut(gAppear)), lerp(2.4, 1, Ease.quartOut(gAppear)));
      displayText(ctx, grade.letter, 0, 0, 120, grade.color, { outlineWidth: 18, shadow: grade.color });
      label(ctx, grade.text, 0, 78, 16, PALETTE.dim, { align: 'center', weight: 800 });
      ctx.restore();
    }

    // Options.
    const oy = py + ph + 44;
    this.items.forEach((item, i) => {
      const sel = i === this.index;
      const bw = 340, bh = 56;
      const bx = dw / 2 - bw / 2;
      const by = oy + i * (bh + 14);
      panel(ctx, bx, by, bw, bh, {
        radius: 12, fill: sel ? '#2b2140' : '#171326',
        border: sel ? accent : PALETTE.line, borderWidth: sel ? 3 : 2,
      });
      displayText(ctx, item.label, dw / 2, by + bh / 2, sel ? 26 : 23,
        sel ? accent : PALETTE.text, { outlineWidth: 5 });
    });

    if (this.setup.mode === 'training') {
      label(ctx, 'Training results are not recorded.', dw / 2, dh - 66, 15, PALETTE.dim,
        { align: 'center', weight: 600 });
    }
    label(ctx, 'W/S move   ENTER select', dw / 2, dh - 40, 15, PALETTE.dim,
      { align: 'center', weight: 700 });

    // Progress bar toward a better grade, purely for flavour.
    if (won) {
      bar(ctx, dw / 2 - 200, dh - 110, 400, 10, clamp01(this.setup.stats.accuracy), {
        color: accent, radius: 5,
      });
    }
  }

  /** A letter grade weighted toward clean, skilful fighting. */
  private grade(): { letter: string; text: string; color: string } {
    if (!this.won) return { letter: 'D', text: 'BACK TO THE GYM', color: PALETTE.red };
    const s = this.setup.stats;
    const acc = s.punchesThrown ? s.punchesLanded / s.punchesThrown : 0;
    let score = 0;
    score += acc * 40;
    score += Math.min(20, s.perfectDodges * 2.5);
    score += Math.min(15, s.counters * 2);
    score += Math.min(15, s.weaknessHits * 5);
    score += s.knockdownsTaken === 0 ? 10 : 0;
    if (score >= 82) return { letter: 'S', text: 'FLAWLESS', color: PALETTE.gold };
    if (score >= 66) return { letter: 'A', text: 'SHARP', color: PALETTE.green };
    if (score >= 48) return { letter: 'B', text: 'SOLID', color: PALETTE.blue };
    if (score >= 30) return { letter: 'C', text: 'MESSY', color: PALETTE.orange };
    return { letter: 'D', text: 'UGLY WIN', color: PALETTE.dim };
  }
}
