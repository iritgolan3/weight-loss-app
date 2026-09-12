import type { Fighter } from '../combat/Fighter';

import type { BoxerDef } from '../data/types';
import { FightPhase, Referee } from '../combat/Referee';
import { clamp01, Ease, lerp } from '../core/MathUtil';
import type { Ctx } from '../render/draw';
import { rgba } from '../render/draw';
import {
  bar, displayText, dodgeArrow, flagChip, FONT_DISPLAY, FONT_UI,
  label, PALETTE, panel, tokenStar,
} from './ui';
import type { Settings } from '../settings/SettingsSystem';
import { COLOR_MODES } from '../settings/SettingsSystem';

export interface HudState {
  player: Fighter;
  opponent: Fighter;
  def: BoxerDef;
  ref: Referee;
  settings: Settings;
  /** Seconds, for animation. */
  time: number;
  /** Current telegraph info for the optional attack indicator. */
  tell: { label: string; color: string; side: string; remaining: number } | null;
  /** True while the player has an open counter window. */
  counterWindow: number;
  /** Training drill state, when a drill is running. */
  drill: {
    name: string; goal: string; progress: number; target: number; complete: boolean;
  } | null;
  /** Screen width/height in design units. */
  dw: number;
  dh: number;
}

/**
 * The fight HUD.
 *
 * Rule followed throughout: nothing sits in the middle of the screen where the
 * opponent's tells happen. Bars hug the top and bottom edges, the timer is a
 * small badge, and optional assists (dodge arrows, weakness hints) are opt-in.
 */
export class HUD {
  /** Pops when the player earns a token. */
  private tokenPop = [0, 0, 0];
  private lastTokens = 0;
  private roundFlash = 0;
  private lastRound = 1;

  update(rawDt: number, s: HudState): void {
    for (let i = 0; i < 3; i++) this.tokenPop[i] = Math.max(0, this.tokenPop[i] - rawDt * 2.6);
    const t = s.player.special.tokens;
    if (t > this.lastTokens) this.tokenPop[Math.min(2, t - 1)] = 1;
    this.lastTokens = t;

    if (s.ref.round !== this.lastRound) { this.roundFlash = 1; this.lastRound = s.ref.round; }
    this.roundFlash = Math.max(0, this.roundFlash - rawDt);
  }

  draw(ctx: Ctx, s: HudState): void {
    const big = s.settings.largeText;
    const scale = big ? 1.18 : 1;
    this.drawOpponentBar(ctx, s, scale);
    this.drawPlayerBar(ctx, s, scale);
    this.drawRoundBadge(ctx, s, scale);
    this.drawTokens(ctx, s, scale);
    if (s.settings.attackIndicators) this.drawAttackIndicator(ctx, s);
    if (s.settings.weaknessHints) this.drawWeaknessHint(ctx, s, scale);
    this.drawCounterWindow(ctx, s);
    if (s.drill) this.drawDrill(ctx, s, scale);
    this.drawStateBanners(ctx, s);
  }

  // -- Opponent -------------------------------------------------------------

  private drawOpponentBar(ctx: Ctx, s: HudState, scale: number): void {
    const { opponent: o, def, dw } = s;
    const w = Math.min(1180, dw * 0.72) * (s.settings.largeText ? 1 : 1);
    const x = dw / 2 - w / 2;
    const y = 20;
    const h = 96 * scale;
    const accent = s.settings.colorMode === 'normal'
      ? def.appearance.glow : COLOR_MODES[s.settings.colorMode].danger;

    panel(ctx, x - 16, y - 10, w + 32, h + 20, {
      radius: 10, fill: '#120e1c', border: rgba(accent, 0.55), alpha: 0.95,
    });

    // Row one: who he is, and how much trouble he is in.
    flagChip(ctx, x, y + 2, 40, 26, def.flag);
    const nameSize = 27 * scale;
    const nameText = def.name.toUpperCase();
    label(ctx, nameText, x + 52, y + 14, nameSize, PALETTE.text, { weight: 900 });
    ctx.save();
    ctx.font = `900 ${nameSize}px ${FONT_UI}`;
    const nameW = ctx.measureText(nameText).width;
    ctx.restore();
    label(ctx, `"${def.nickname}"`, x + 52 + nameW + 14, y + 15,
      17 * scale, rgba(accent, 0.95), { weight: 700 });

    // Knockdown pips sit at the far right of the same row, with the rage or
    // phase marker just inside them.
    let right = x + w;
    for (let i = 2; i >= 0; i--) {
      const px = right - 11 - (2 - i) * 24;
      ctx.beginPath();
      ctx.arc(px, y + 12, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = i < o.totalKnockdowns ? PALETTE.gold : 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    label(ctx, 'DOWN', right - 82, y + 17, 11, PALETTE.dim, { weight: 800, align: 'right' });
    right -= 130;

    if (o.rage) {
      displayText(ctx, 'RAGE', right, y + 16, 23 * scale, PALETTE.red, {
        align: 'right', outlineWidth: 5,
      });
    } else if (o.phase > 0) {
      label(ctx, `PHASE ${o.phase + 1}`, right, y + 16, 15 * scale, rgba(accent, 0.9),
        { align: 'right', weight: 800 });
    }

    // Row two: the bar that matters, and a hairline of stamina under it.
    const lowPulse = o.health.fraction < 0.25 ? (Math.sin(s.time * 9) * 0.5 + 0.5) * 0.6 : 0;
    bar(ctx, x, y + 36, w, 30 * scale, o.health.fraction, {
      ghost: o.health.ghostFraction,
      color: o.health.fraction > 0.5 ? '#ff6b35' : o.health.fraction > 0.22 ? '#ff9a3c' : '#ff4d4d',
      pulse: lowPulse,
      segments: 4,
    });
    bar(ctx, x, y + 72 * scale, w, 9 * scale, o.stamina.fraction, {
      color: '#4cc9f0', radius: 5,
    });

    // Stun builds toward a knockdown, so it reads on top of his own bar.
    if (o.stunFraction > 0.05) {
      const sw = w * 0.42;
      bar(ctx, x + w / 2 - sw / 2, y + 86 * scale, sw, 6, o.stunFraction, {
        color: '#ffe066', radius: 3, bg: 'rgba(0,0,0,0.5)',
      });
    }
  }

  // -- Player ---------------------------------------------------------------

  /**
   * The player's strip.
   *
   * Everything the player owns lives in ONE bar welded to the bottom edge:
   * his condition on the left, his stars in the middle, the clock and the
   * round on the right. The middle of the screen stays empty, because that is
   * where the opponent's tells happen and nothing may compete with them.
   */
  private drawPlayerBar(ctx: Ctx, s: HudState, scale: number): void {
    const { player: p, dw, dh } = s;
    const h = 126 * scale;
    const y = dh - h;

    panel(ctx, -20, y, dw + 40, h + 24, {
      radius: 0, fill: '#0d1020', border: 'rgba(120,180,255,0.28)', alpha: 0.94,
    });

    // --- left: name, health, stamina, knockdowns ---
    const bx = Math.max(30, dw * 0.035);
    const bw = Math.min(470, dw * 0.3) * scale;
    label(ctx, 'KID COMET', bx, y + 26, 21 * scale, PALETTE.text, { weight: 900 });
    if (p.stamina.gassed) {
      label(ctx, 'GASSED', bx + bw, y + 26, 15 * scale, PALETTE.red,
        { weight: 900, align: 'right', alpha: 0.6 + Math.sin(s.time * 8) * 0.4 });
    }
    const lowPulse = p.health.fraction < 0.25 ? (Math.sin(s.time * 9) * 0.5 + 0.5) * 0.6 : 0;
    bar(ctx, bx, y + 40, bw, 26 * scale, p.health.fraction, {
      ghost: p.health.ghostFraction,
      color: p.health.fraction > 0.5 ? '#7ef9a2' : p.health.fraction > 0.22 ? '#ffd166' : '#ff4d4d',
      pulse: lowPulse,
      segments: 4,
    });
    bar(ctx, bx, y + 72 * scale, bw, 12 * scale, p.stamina.fraction, {
      color: p.stamina.gassed ? '#ff6b6b' : '#4cc9f0', radius: 6,
    });
    label(ctx, 'STAMINA', bx + bw, y + 81 * scale, 10, PALETTE.dim, { weight: 800, align: 'right' });

    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(bx + 9 + i * 23, y + 104 * scale, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = i < p.totalKnockdowns ? PALETTE.red : 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    label(ctx, 'DOWN', bx + 84, y + 109 * scale, 10, PALETTE.dim, { weight: 800 });
  }

  // -- Round / timer ---------------------------------------------------------

  private drawRoundBadge(ctx: Ctx, s: HudState, scale: number): void {
    const { ref, dw, dh } = s;
    const h = 126 * scale;
    const y = dh - h;
    const rx = dw - Math.max(30, dw * 0.035);

    const mins = Math.floor(ref.clock / 60);
    const secs = Math.floor(ref.clock % 60);
    const urgent = ref.clock <= 10 && ref.fighting;
    const timeColor = urgent
      ? (Math.sin(s.time * 10) > 0 ? PALETTE.red : PALETTE.text) : PALETTE.text;
    displayText(ctx, `${mins}:${secs.toString().padStart(2, '0')}`, rx, y + 56 * scale,
      50 * scale, timeColor, { align: 'right', outlineWidth: 6 });

    const finalRound = ref.round === ref.config.rounds;
    label(ctx, `ROUND ${ref.round} / ${ref.config.rounds}`, rx, y + 88 * scale, 16 * scale,
      this.roundFlash > 0 || finalRound ? PALETTE.gold : PALETTE.dim,
      { weight: 900, align: 'right' });
  }

  // -- Tokens ---------------------------------------------------------------

  private drawTokens(ctx: Ctx, s: HudState, scale: number): void {
    const { player: p, dw, dh } = s;
    const h = 126 * scale;
    const y = dh - h + 54 * scale;
    const r = 24 * scale;
    const gap = r * 2.4;
    const cx = dw / 2;

    for (let i = 0; i < 3; i++) {
      tokenStar(ctx, cx + (i - 1) * gap, y, r, i < p.special.tokens, this.tokenPop[i]);
    }

    const chargeW = 176 * scale;
    bar(ctx, cx - chargeW / 2, y + 34 * scale, chargeW, 8, p.special.charge, {
      color: PALETTE.gold, radius: 4, bg: 'rgba(0,0,0,0.55)',
    });

    if (p.special.tokens > 0) {
      const glow = 0.55 + Math.sin(s.time * 5) * 0.45;
      displayText(ctx, 'SHIFT', cx, y - r - 12 * scale, 15 * scale, rgba(PALETTE.gold, glow), {
        outlineWidth: 4,
      });
    }
    if (p.special.lostFlashTimer > 0) {
      displayText(ctx, 'STAR LOST', cx, y - r - 38 * scale, 20 * scale,
        rgba(PALETTE.red, clamp01(p.special.lostFlashTimer / 0.7)), { outlineWidth: 5 });
    }
  }

  /** Training drill progress. Only ever drawn in training mode. */
  private drawDrill(ctx: Ctx, s: HudState, scale: number): void {
    const d = s.drill!;
    const w = 320 * scale;
    const x = 34;
    const y = 150;

    panel(ctx, x, y, w, d.target > 0 ? 96 * scale : 66 * scale, {
      radius: 12, fill: d.complete ? '#13301c' : '#171326',
      border: d.complete ? PALETTE.green : PALETTE.line, alpha: 0.94,
    });
    label(ctx, 'DRILL', x + 16, y + 22, 12 * scale, PALETTE.green, { weight: 900 });
    label(ctx, d.name, x + 16, y + 44, 17 * scale, PALETTE.text, { weight: 800 });

    if (d.target > 0) {
      bar(ctx, x + 16, y + 60 * scale, w - 32, 16 * scale,
        clamp01(d.progress / d.target), {
          color: d.complete ? PALETTE.green : PALETTE.gold, radius: 8,
        });
      label(ctx, `${d.progress} / ${d.target}`, x + w - 16, y + 84 * scale, 13 * scale,
        d.complete ? PALETTE.green : PALETTE.dim, { align: 'right', weight: 800 });
      if (d.complete) {
        label(ctx, 'COMPLETE', x + 16, y + 84 * scale, 13 * scale, PALETTE.green, { weight: 900 });
      }
    } else if (d.goal === 'combo') {
      label(ctx, `BEST COMBO  ${d.progress}`, x + 16, y + 62 * scale, 15 * scale,
        PALETTE.gold, { weight: 800 });
    } else if (d.goal === 'reaction') {
      label(ctx, `READS  ${d.progress}`, x + 16, y + 62 * scale, 15 * scale,
        PALETTE.gold, { weight: 800 });
    } else {
      label(ctx, 'No target — take your time', x + 16, y + 62 * scale, 13 * scale,
        PALETTE.dim, { weight: 600 });
    }
  }

  // -- Assists ---------------------------------------------------------------

  private drawAttackIndicator(ctx: Ctx, s: HudState): void {
    const t = s.tell;
    if (!t || t.remaining <= 0) return;
    const cx = s.dw / 2;
    const y = 262;
    const a = clamp01(t.remaining * 3);

    ctx.save();
    ctx.globalAlpha = a;
    panel(ctx, cx - 210, y - 26, 420, 52, {
      radius: 26, fill: '#1a0f14', border: t.color, glow: t.color, alpha: 0.9 * a,
    });
    displayText(ctx, t.label, cx, y, 26, t.color, { outlineWidth: 5 });
    ctx.restore();

    if (t.side === 'left' || t.side === 'right') {
      // The arrow points where to GO, which is away from the incoming hand.
      const dir: -1 | 1 = t.side === 'left' ? 1 : -1;
      const pulse = 0.6 + Math.sin(s.time * 14) * 0.4;
      dodgeArrow(ctx, cx + dir * 300, y + 6, 46, dir, t.color, a * pulse);
    }
  }

  private drawWeaknessHint(ctx: Ctx, s: HudState, scale: number): void {
    const w = s.opponent.weakness;
    if (!w) return;
    const x = s.dw - 34;
    const y = s.dh - 300 * scale;
    const live = s.opponent.weaknessOpen;

    ctx.save();
    ctx.globalAlpha = live ? 1 : 0.62;
    const pw = 300 * scale;
    panel(ctx, x - pw, y - 24, pw, 72 * scale, {
      radius: 12, fill: live ? '#2a1c0a' : '#171326',
      border: live ? PALETTE.gold : PALETTE.line,
      glow: live ? PALETTE.gold : undefined, alpha: 0.9,
    });
    label(ctx, 'WEAK POINT', x - pw + 14, y - 6, 12 * scale, live ? PALETTE.gold : PALETTE.dim, { weight: 800 });
    const zone = w.zone === 'head' ? 'HEAD' : 'BODY';
    displayText(ctx, `${zone} ON THE TELL`, x - pw / 2, y + 24 * scale, 20 * scale,
      live ? PALETTE.gold : PALETTE.text, { outlineWidth: 4 });
    ctx.restore();

    if (live) {
      const pulse = 0.5 + Math.sin(s.time * 16) * 0.5;
      ctx.save();
      ctx.globalAlpha = pulse;
      displayText(ctx, 'NOW!', x - pw / 2, y - 62 * scale, 34 * scale, PALETTE.gold, {
        outlineWidth: 7, shadow: PALETTE.gold,
      });
      ctx.restore();
    }
  }

  private drawCounterWindow(ctx: Ctx, s: HudState): void {
    if (s.counterWindow <= 0) return;
    const a = clamp01(s.counterWindow * 3.4);
    const cx = s.dw / 2;
    const y = s.dh - 190;
    const pulse = 0.6 + Math.sin(s.time * 22) * 0.4;
    ctx.save();
    ctx.globalAlpha = a * pulse;
    displayText(ctx, 'COUNTER!', cx, y, 54, PALETTE.green, {
      outlineWidth: 11, shadow: PALETTE.green,
    });
    ctx.restore();
  }

  // -- Phase banners ---------------------------------------------------------

  private drawStateBanners(ctx: Ctx, s: HudState): void {
    const { ref, dw, dh } = s;

    if (ref.phase === FightPhase.RoundCard) {
      const t = clamp01(ref.timer / ref.config.roundCardSeconds);
      const pop = Ease.backOut(clamp01(t * 4));
      const fade = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(dw / 2, dh * 0.42);
      ctx.scale(pop, pop);
      displayText(ctx, `ROUND ${ref.round}`, 0, 0, 132, PALETTE.gold, {
        outlineWidth: 20, shadow: PALETTE.orange,
      });
      if (ref.round === ref.config.rounds) {
        displayText(ctx, 'FINAL ROUND', 0, 96, 40, PALETTE.red, { outlineWidth: 8 });
      }
      ctx.restore();
    }

    if (ref.phase === FightPhase.Count && ref.downed) {
      this.drawCount(ctx, s);
    }

    if (ref.phase === FightPhase.BetweenRounds) {
      const remain = ref.config.breakSeconds - ref.timer;
      ctx.save();
      ctx.globalAlpha = 0.94;
      panel(ctx, dw / 2 - 300, dh * 0.3, 600, 220, { radius: 18, fill: '#14101f', border: PALETTE.gold });
      displayText(ctx, 'END OF ROUND', dw / 2, dh * 0.3 + 52, 44, PALETTE.gold, { outlineWidth: 8 });
      const card = ref.cards[ref.cards.length - 1];
      if (card) {
        displayText(ctx, `${card.player} — ${card.opponent}`, dw / 2, dh * 0.3 + 122, 62, PALETTE.text, { outlineWidth: 9 });
        label(ctx, 'JUDGES SCORECARD', dw / 2, dh * 0.3 + 168, 15, PALETTE.dim, { align: 'center', weight: 700 });
      }
      label(ctx, `NEXT ROUND IN ${Math.ceil(remain)}`, dw / 2, dh * 0.3 + 198, 16, PALETTE.dim,
        { align: 'center', weight: 700 });
      ctx.restore();
    }
  }

  private drawCount(ctx: Ctx, s: HudState): void {
    const { ref, dw, dh } = s;
    const f = ref.downed!;
    const n = Math.max(1, ref.count);

    ctx.save();
    // Dim the ring so the count is unmissable.
    ctx.fillStyle = 'rgba(6,4,10,0.45)';
    ctx.fillRect(0, 0, dw, dh);

    const beat = clamp01(1 - (ref.timer % 1));
    const scale = 1 + Ease.quartOut(clamp01(beat)) * 0.12;
    ctx.save();
    ctx.translate(dw / 2, dh * 0.34);
    ctx.scale(scale, scale);
    displayText(ctx, String(n), 0, 0, 200, n >= 8 ? PALETTE.red : PALETTE.gold, {
      outlineWidth: 26, shadow: n >= 8 ? PALETTE.red : PALETTE.orange,
    });
    ctx.restore();

    if (f.isPlayer) {
      const y = dh * 0.62;
      const pulse = 0.6 + Math.sin(s.time * 20) * 0.4;
      displayText(ctx, 'MASH ANY BUTTON!', dw / 2, y, 52, rgba(PALETTE.green, pulse), { outlineWidth: 10 });
      const bw = 520;
      bar(ctx, dw / 2 - bw / 2, y + 46, bw, 30, ref.riseProgress, {
        color: PALETTE.green, segments: 5,
      });
      label(ctx, 'GET UP', dw / 2, y + 92, 16, PALETTE.dim, { align: 'center', weight: 800 });
    } else {
      displayText(ctx, `${s.def.name.toUpperCase()} IS DOWN`, dw / 2, dh * 0.6, 44, PALETTE.text, {
        outlineWidth: 9,
      });
      const bw = 440;
      bar(ctx, dw / 2 - bw / 2, dh * 0.6 + 42, bw, 20, ref.riseProgress, {
        color: PALETTE.orange, radius: 10,
      });
      label(ctx, 'RISING', dw / 2, dh * 0.6 + 82, 14, PALETTE.dim, { align: 'center', weight: 800 });
    }
    ctx.restore();
  }

  /** The entrance card shown during the intro. */
  drawIntro(ctx: Ctx, s: HudState): void {
    const { ref, def, dw, dh } = s;
    const t = clamp01(ref.timer / ref.config.introSeconds);
    const slide = Ease.cubicOut(clamp01(t * 3));
    const out = t > 0.86 ? (t - 0.86) / 0.14 : 0;
    const x = lerp(-560, 56, slide) + out * 560;

    ctx.save();
    ctx.globalAlpha = 1 - out;
    panel(ctx, x, dh * 0.3, 520, 300, {
      radius: 20, fill: '#12101d', border: def.appearance.glow, glow: def.appearance.glow,
    });
    flagChip(ctx, x + 30, dh * 0.3 + 28, 58, 38, def.flag);
    label(ctx, def.country.toUpperCase(), x + 100, dh * 0.3 + 47, 16, PALETTE.dim, { weight: 800 });
    displayText(ctx, def.name.toUpperCase(), x + 30, dh * 0.3 + 106, 44, PALETTE.text, {
      align: 'left', outlineWidth: 8,
    });
    displayText(ctx, `"${def.nickname}"`, x + 30, dh * 0.3 + 152, 30, def.appearance.glow, {
      align: 'left', outlineWidth: 6,
    });
    label(ctx, def.archetype, x + 30, dh * 0.3 + 192, 17, PALETTE.gold, { weight: 800 });

    const rows: [string, string][] = [
      ['RECORD', `${def.record.w}-${def.record.l} (${def.record.ko} KO)`],
      ['HEIGHT', `${def.height} cm`],
      ['WEIGHT', `${def.weight} kg`],
      ['AGE', `${def.age}`],
    ];
    rows.forEach((r, i) => {
      const ry = dh * 0.3 + 226 + i * 22;
      label(ctx, r[0], x + 30, ry, 13, PALETTE.dim, { weight: 700 });
      label(ctx, r[1], x + 250, ry, 13, PALETTE.text, { weight: 700, align: 'right' });
    });

    if (def.boss && def.bossTitle) {
      displayText(ctx, def.bossTitle, dw / 2, dh * 0.16, 64, PALETTE.red, {
        outlineWidth: 12, shadow: PALETTE.red,
      });
    }
    ctx.restore();

    // Skip prompt.
    const blink = 0.5 + Math.sin(s.time * 5) * 0.5;
    label(ctx, 'PRESS ANY BUTTON TO SKIP', dw / 2, dh - 46, 16, rgba(PALETTE.dim, blink),
      { align: 'center', weight: 800, font: FONT_UI });
    void FONT_DISPLAY;
  }
}
