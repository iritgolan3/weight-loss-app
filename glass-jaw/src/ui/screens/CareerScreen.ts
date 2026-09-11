import type { Game } from '../../core/Game';
import { MenuScreen, MenuItem } from './MenuBase';
import { LEAGUE_INFO, LEAGUE_ORDER, ALL_BOXERS } from '../../data/boxers';
import { UPGRADES } from '../../data/player';
import { startFight } from '../../scenes/launch';
import { BoxerPortrait } from '../BoxerPortrait';
import type { Ctx } from '../../render/draw';
import { rgba } from '../../render/draw';
import { bar, displayText, flagChip, label, PALETTE, panel, wrapText, FONT_UI } from '../ui';
import { DIFFICULTIES } from '../../data/difficulty';

type Tab = 'ladder' | 'gym';

/**
 * Career hub: the tournament ladder and the gym where purse money is spent.
 *
 * Both live on one screen because they are the same decision — "am I ready for
 * the next one, or do I need another point of Chin first?"
 */
export class CareerScreen extends MenuScreen {
  readonly name = 'career';
  private tab: Tab = 'ladder';
  private portrait: BoxerPortrait;

  constructor(game: Game) {
    super(game);
    const next = game.career.nextOpponent ?? ALL_BOXERS[0];
    this.portrait = new BoxerPortrait(next.appearance);
    this.listTop = 292;
    this.listW = 660;
    this.rowH = 56;
    this.visibleRows = 8;
    this.rebuild();
  }

  title(): string { return 'CAREER'; }
  protected override subtitle(): string {
    const c = this.game.career;
    return `${c.title}  ·  $${c.state.money.toLocaleString()}  ·  ${c.state.rank} pts  ·  ${c.state.wins}-${c.state.losses}`;
  }

  override enter(): void {
    super.enter();
    this.rebuild();
    const next = this.game.career.nextOpponent;
    if (next) this.portrait.setAppearance(next.appearance);
    this.game.audio.playMusic('career', 0.6);
  }

  override exit(): void { super.exit(); }

  protected override rebuild(): void {
    const g = this.game;
    const c = g.career;
    const items: MenuItem[] = [];

    if (this.tab === 'ladder') {
      const next = c.nextOpponent;
      if (next) {
        items.push({
          kind: 'action', label: `FIGHT — ${next.name.toUpperCase()}`, accent: PALETTE.gold,
          value: () => `$${next.purse.toLocaleString()}`,
          hint: `${next.archetype}. ${next.bio}`,
          run: () => this.fight(),
        });
      } else {
        items.push({
          kind: 'info', label: 'CAREER COMPLETE',
          value: () => 'You hold the belt',
        });
      }

      let league = '';
      for (const entry of c.ladder()) {
        if (entry.boxer.league !== league) {
          league = entry.boxer.league;
          items.push({ kind: 'header', label: LEAGUE_INFO[entry.boxer.league].name });
        }
        const b = entry.boxer;
        const rec = g.save.data.records[b.id];
        items.push({
          kind: 'action',
          label: entry.state === 'locked' && !g.save.isUnlocked(b.id)
            ? '???' : `${b.name.toUpperCase()}  "${b.nickname}"`,
          accent: b.appearance.glow,
          value: () => entry.state === 'cleared'
            ? `BEATEN ${rec?.wins ?? 1}×`
            : entry.state === 'next' ? 'NEXT' : 'LOCKED',
          disabled: () => entry.state !== 'next',
          hint: entry.state === 'locked'
            ? 'Work your way up the ladder.'
            : `${b.archetype} — ${b.style}`,
          run: () => this.fight(),
        });
      }
    } else {
      items.push({ kind: 'header', label: `Gym — $${c.state.money.toLocaleString()} available` });
      for (const u of UPGRADES) {
        const lvl = c.upgradeLevel(u.key);
        const cost = c.upgradeCost(u.key);
        items.push({
          kind: 'action',
          label: `${u.label}   ${'●'.repeat(lvl)}${'○'.repeat(u.maxLevel - lvl)}`,
          accent: PALETTE.green,
          value: () => (cost === null ? 'MAX' : `$${cost.toLocaleString()}`),
          disabled: () => cost === null || c.state.money < cost,
          hint: u.description,
          run: () => {
            if (c.buyUpgrade(u.key)) {
              this.game.audio.play('uiUnlock');
              this.rebuild();
            } else {
              this.game.audio.play('uiDeny');
            }
          },
        });
      }
      items.push({ kind: 'header', label: 'Danger zone' });
      items.push({
        kind: 'action', label: 'RESTART CAREER', accent: PALETTE.red,
        hint: 'Wipes ladder progress, money and gym upgrades. Unlocked boxers, records and lifetime statistics are kept.',
        run: () => { c.restart(); this.game.audio.play('uiDeny'); this.rebuild(); },
      });
    }

    items.push({ kind: 'header', label: '' });
    items.push({ kind: 'action', label: 'BACK TO MENU', run: () => this.onBack() });

    this.items = items;
    this.index = Math.min(this.index, this.items.length - 1);
    this.ensureSelectable(1);
  }

  private fight(): void {
    const g = this.game;
    const c = g.career;
    const opp = c.nextOpponent;
    if (!opp) { g.audio.play('uiDeny'); return; }

    startFight(g, {
      opponent: opp,
      difficulty: g.settings.current.difficulty,
      mode: 'career',
      playerStats: c.playerStats(),
      onResolve: (result) => {
        const won = result.winner?.isPlayer === true;
        if (!won) { c.onLoss(opp.id); return undefined; }
        const method = result.method === 'DRAW' ? 'DEC' : result.method;
        return c.onWin(opp.id, method, result.playerScore, result.seconds);
      },
      onDone: () => {
        this.rebuild();
        const nxt = c.nextOpponent;
        if (nxt) this.portrait.setAppearance(nxt.appearance);
      },
    });
  }

  protected override adjust(dir: number): void {
    const item = this.items[this.index];
    if (item?.kind === 'header' || this.index === 0) {
      this.tab = this.tab === 'ladder' ? 'gym' : 'ladder';
      this.index = 0;
      this.scroll = this.scrollTarget = 0;
      this.game.audio.play('uiConfirm');
      this.rebuild();
      return;
    }
    super.adjust(dir);
  }

  override updateRaw(rawDt: number): void {
    super.updateRaw(rawDt);
    this.portrait.update(rawDt);
  }

  protected override drawBackdrop(ctx: Ctx): void {
    const { dw, dh } = this.game.renderer;
    this.defaultBackdrop(ctx, dw, dh);
    const x = this.titleX(dw);
    const tabs: [Tab, string][] = [['ladder', 'THE LADDER'], ['gym', 'THE GYM']];
    let cx = x;
    for (const [id, name] of tabs) {
      const active = id === this.tab;
      panel(ctx, cx, 214, 210, 48, {
        radius: 10, fill: active ? '#332651' : '#171326',
        border: active ? PALETTE.gold : PALETTE.line,
      });
      label(ctx, name, cx + 105, 239, 17, active ? PALETTE.gold : PALETTE.dim,
        { align: 'center', weight: 900 });
      cx += 220;
    }
    label(ctx, '← →  on a heading switches tab', cx + 14, 239, 14, PALETTE.dim, { weight: 600 });

    // League progress ribbon.
    const rx = dw - 70;
    let ry = 220;
    for (const lg of LEAGUE_ORDER) {
      const info = LEAGUE_INFO[lg];
      const cleared = this.game.career.state.cleared.filter(
        (id) => ALL_BOXERS.find((b) => b.id === id)?.league === lg,
      ).length;
      label(ctx, info.name, rx, ry, 12, rgba(info.color, cleared === 4 ? 1 : 0.55),
        { align: 'right', weight: 900 });
      bar(ctx, rx - 160, ry + 10, 160, 8, cleared / 4, { color: info.color, radius: 4 });
      ry += 32;
    }
  }

  protected override drawDetail(ctx: Ctx, x: number, y: number, w: number): void {
    const c = this.game.career;
    const next = c.nextOpponent;
    const h = 580;

    if (this.tab === 'gym') {
      panel(ctx, x, y, w, h, { radius: 16, fill: '#191430', border: PALETTE.green });
      displayText(ctx, 'YOUR ATTRIBUTES', x + w / 2, y + 44, 26, PALETTE.green, { outlineWidth: 5 });
      const stats = c.playerStats();
      const rows: [string, number, number][] = [
        ['CHIN', stats.maxHealth, 160],
        ['LUNGS', stats.maxStamina, 170],
        ['POWER', stats.power, 1.5],
        ['SPEED', stats.speed, 1.4],
        ['COUNTER', stats.counter, 1.5],
        ['DEFENSE', stats.defense, 0.45],
        ['POISE', stats.poise, 180],
        ['HEART', stats.knockdownResistance, 1.6],
      ];
      rows.forEach((r, i) => {
        const ry = y + 90 + i * 44;
        label(ctx, r[0], x + 20, ry, 15, PALETTE.dim, { weight: 800 });
        label(ctx, typeof r[1] === 'number' && r[1] < 5 ? r[1].toFixed(2) : Math.round(r[1]).toString(),
          x + w - 20, ry, 15, PALETTE.text, { align: 'right', weight: 800 });
        bar(ctx, x + 20, ry + 12, w - 40, 12, r[1] / r[2], { color: PALETTE.green, radius: 6 });
      });
      label(ctx, 'Upgrades apply to every mode, including Arcade.',
        x + 20, y + h - 26, 13, PALETTE.dim, { weight: 600 });
      return;
    }

    if (!next) {
      panel(ctx, x, y, w, h, { radius: 16, fill: '#241a08', border: PALETTE.gold });
      displayText(ctx, 'CHAMPION', x + w / 2, y + h / 2 - 30, 46, PALETTE.gold, { outlineWidth: 9 });
      label(ctx, 'There is nobody left on the ladder.', x + w / 2, y + h / 2 + 20, 17,
        PALETTE.dim, { align: 'center', weight: 600 });
      label(ctx, 'Try the whole run again on a higher difficulty.', x + w / 2, y + h / 2 + 46, 15,
        PALETTE.dim, { align: 'center', weight: 600 });
      return;
    }

    panel(ctx, x, y, w, h, { radius: 16, fill: '#191430', border: rgba(next.appearance.glow, 0.6) });
    label(ctx, 'NEXT FIGHT', x + 20, y + 26, 13, PALETTE.gold, { weight: 900 });
    this.portrait.draw(ctx, x + 6, y + 36, w - 12, 250, { crop: 'full', rim: next.appearance.glow });

    displayText(ctx, next.name.toUpperCase(), x + w / 2, y + 314, 30, PALETTE.text, { outlineWidth: 6 });
    label(ctx, `"${next.nickname}"`, x + w / 2, y + 344, 18, next.appearance.glow,
      { align: 'center', weight: 800 });
    flagChip(ctx, x + w / 2 - 26, y + 360, 52, 34, next.flag);
    label(ctx, next.archetype, x + w / 2, y + 414, 15, PALETTE.gold, { align: 'center', weight: 900 });

    const lines = wrapText(ctx, next.personality, w - 40, `600 15px ${FONT_UI}`);
    lines.forEach((ln, i) => label(ctx, ln, x + 20, y + 446 + i * 20, 15, PALETTE.dim, { weight: 600 }));

    let cy = y + 452 + lines.length * 20;
    label(ctx, 'PURSE', x + 20, cy, 13, PALETTE.dim, { weight: 800 });
    label(ctx, `$${next.purse.toLocaleString()}`, x + w - 20, cy, 15, PALETTE.gold,
      { align: 'right', weight: 900 });
    cy += 24;
    label(ctx, 'DIFFICULTY', x + 20, cy, 13, PALETTE.dim, { weight: 800 });
    const d = DIFFICULTIES[this.game.settings.current.difficulty];
    label(ctx, d.name, x + w - 20, cy, 15, d.color, { align: 'right', weight: 900 });
  }
}
