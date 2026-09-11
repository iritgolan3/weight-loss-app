import type { Game } from '../../core/Game';
import { MenuScreen, MenuItem } from './MenuBase';
import { REMAPPABLE, ACTION_LABELS } from '../../input/Actions';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/difficulty';
import { COLOR_MODES, type ColorMode } from '../../settings/SettingsSystem';
import type { Quality } from '../../render/Renderer';
import type { Ctx } from '../../render/draw';
import { label, PALETTE, panel, displayText } from '../ui';

type Tab = 'audio' | 'graphics' | 'gameplay' | 'accessibility' | 'controls';

const TABS: { id: Tab; name: string }[] = [
  { id: 'gameplay', name: 'GAMEPLAY' },
  { id: 'audio', name: 'AUDIO' },
  { id: 'graphics', name: 'GRAPHICS' },
  { id: 'accessibility', name: 'ACCESS' },
  { id: 'controls', name: 'CONTROLS' },
];

/** Full settings screen, tabbed, with everything applied live. */
export class SettingsScreen extends MenuScreen {
  readonly name = 'settings';
  override readonly transparent: boolean;
  private tab: Tab = 'gameplay';

  constructor(game: Game, overlay = false) {
    super(game);
    this.transparent = overlay;
    this.listTop = 300;
    this.visibleRows = 8;
    this.listW = 860;
    this.rebuild();
  }

  title(): string { return 'SETTINGS'; }
  protected override subtitle(): string { return 'Everything here applies immediately.'; }

  override enter(): void {
    super.enter();
    this.rebuild();
  }

  private pct = (v: number) => `${Math.round(v * 100)}%`;

  protected override rebuild(): void {
    const s = this.game.settings;
    const c = s.current;
    const items: MenuItem[] = [];

    switch (this.tab) {
      case 'gameplay':
        items.push({ kind: 'header', label: 'Difficulty' });
        items.push({
          kind: 'choice', label: 'DIFFICULTY',
          hint: DIFFICULTIES[c.difficulty].blurb,
          options: DIFFICULTY_ORDER.map((d) => ({
            label: DIFFICULTIES[d].name, value: d, color: DIFFICULTIES[d].color,
          })),
          get: () => c.difficulty,
          set: (v) => s.set('difficulty', v as typeof c.difficulty),
        });
        items.push({ kind: 'header', label: 'Feel' });
        items.push({
          kind: 'slider', label: 'HIT STOP', min: 0, max: 1.5, step: 0.1,
          hint: 'Frames freeze on impact. This is most of what makes a punch feel heavy. Lower it if it feels sluggish.',
          get: () => c.hitStop, set: (v) => s.set('hitStop', v), format: this.pct,
        });
        items.push({
          kind: 'slider', label: 'SLOW MOTION', min: 0, max: 1.5, step: 0.1,
          hint: 'How long time slows after a perfect dodge or counter. Set to zero to remove it entirely.',
          get: () => c.slowMotion, set: (v) => s.set('slowMotion', v), format: this.pct,
        });
        items.push({
          kind: 'slider', label: 'INPUT BUFFER', min: 0, max: 260, step: 10,
          hint: 'How long a button press is remembered if you press it a touch early. Higher feels more forgiving.',
          get: () => c.inputBuffer, set: (v) => s.set('inputBuffer', v), format: (v) => `${Math.round(v)} ms`,
        });
        items.push({ kind: 'header', label: 'Display' });
        items.push({
          kind: 'toggle', label: 'SHOW FPS', hint: 'Frame rate and frame-time readout in the corner.',
          get: () => c.showFps, set: (v) => s.set('showFps', v),
        });
        break;

      case 'audio':
        items.push({ kind: 'header', label: 'Mix' });
        items.push({ kind: 'slider', label: 'MASTER', min: 0, max: 1, step: 0.05, get: () => c.masterVolume, set: (v) => s.set('masterVolume', v), format: this.pct });
        items.push({ kind: 'slider', label: 'MUSIC', min: 0, max: 1, step: 0.05, get: () => c.musicVolume, set: (v) => s.set('musicVolume', v), format: this.pct });
        items.push({ kind: 'slider', label: 'SOUND EFFECTS', min: 0, max: 1, step: 0.05, get: () => c.sfxVolume, set: (v) => s.set('sfxVolume', v), format: this.pct });
        items.push({ kind: 'slider', label: 'VOICES', min: 0, max: 1, step: 0.05, hint: 'Fighter grunts and the referee count.', get: () => c.voiceVolume, set: (v) => s.set('voiceVolume', v), format: this.pct });
        items.push({ kind: 'slider', label: 'CROWD', min: 0, max: 1, step: 0.05, get: () => c.crowdVolume, set: (v) => s.set('crowdVolume', v), format: this.pct });
        items.push({
          kind: 'action', label: 'TEST SOUND',
          hint: 'Plays a heavy punch and a crowd reaction at the current mix.',
          run: () => { this.game.audio.play('punchHeavy'); this.game.audio.play('crowdCheer'); },
        });
        break;

      case 'graphics':
        items.push({ kind: 'header', label: 'Quality' });
        items.push({
          kind: 'choice', label: 'GRAPHICS QUALITY',
          hint: 'Controls shadows, reflections, crowd detail, particle budget and render resolution.',
          options: [
            { label: 'LOW', value: 'low' }, { label: 'MEDIUM', value: 'medium' },
            { label: 'HIGH', value: 'high' }, { label: 'ULTRA', value: 'ultra' },
          ],
          get: () => c.quality,
          set: (v) => s.set('quality', v as Quality),
        });
        items.push({
          kind: 'slider', label: 'RESOLUTION SCALE', min: 0.5, max: 2, step: 0.1,
          hint: 'Renders above or below the display resolution. Above 1 supersamples for a crisper image.',
          get: () => c.resolutionScale, set: (v) => s.set('resolutionScale', v), format: (v) => `${v.toFixed(1)}×`,
        });
        items.push({
          kind: 'toggle', label: 'FULLSCREEN',
          hint: 'Some browsers require this to be triggered from a click.',
          get: () => !!document.fullscreenElement,
          set: (v) => {
            if (v) void document.documentElement.requestFullscreen?.().catch(() => undefined);
            else void document.exitFullscreen?.().catch(() => undefined);
            s.set('fullscreen', v);
          },
        });
        items.push({
          kind: 'toggle', label: 'VSYNC',
          hint: 'The browser always presents in sync with the display; this caps the simulation to match.',
          get: () => c.vsync, set: (v) => s.set('vsync', v),
        });
        items.push({
          kind: 'choice', label: 'FRAME CAP',
          hint: 'Limits how often the game renders. Useful on a laptop battery.',
          options: [
            { label: 'UNCAPPED', value: '0' }, { label: '30', value: '30' },
            { label: '60', value: '60' }, { label: '120', value: '120' },
          ],
          get: () => String(c.frameCap),
          set: (v) => s.set('frameCap', Number(v)),
        });
        break;

      case 'accessibility':
        items.push({ kind: 'header', label: 'Motion and effects' });
        items.push({
          kind: 'slider', label: 'CAMERA SHAKE', min: 0, max: 1, step: 0.1,
          hint: 'Set to zero to stop the camera moving on impact. Gameplay is unaffected.',
          get: () => c.cameraShake, set: (v) => s.set('cameraShake', v), format: this.pct,
        });
        items.push({
          kind: 'slider', label: 'SCREEN EFFECTS', min: 0, max: 1, step: 0.1,
          hint: 'Particles, impact bursts and speed lines.',
          get: () => c.screenEffects, set: (v) => s.set('screenEffects', v), format: this.pct,
        });
        items.push({
          kind: 'slider', label: 'FLASH INTENSITY', min: 0, max: 1, step: 0.1,
          hint: 'Full-screen flashes on heavy impacts. Lower or disable if bright flashes are uncomfortable.',
          get: () => c.flashIntensity, set: (v) => s.set('flashIntensity', v), format: this.pct,
        });
        items.push({ kind: 'header', label: 'Readability' });
        items.push({
          kind: 'toggle', label: 'ATTACK INDICATORS',
          hint: 'Names every incoming attack on screen and points an arrow at the safe direction.',
          get: () => c.attackIndicators, set: (v) => s.set('attackIndicators', v),
        });
        items.push({
          kind: 'toggle', label: 'WEAK POINT HINTS',
          hint: "Shows the current opponent's weak point on the HUD and flashes when it is exposed.",
          get: () => c.weaknessHints, set: (v) => s.set('weaknessHints', v),
        });
        items.push({
          kind: 'toggle', label: 'LARGE HUD TEXT',
          hint: 'Scales the health bars, timer and labels up.',
          get: () => c.largeText, set: (v) => s.set('largeText', v),
        });
        items.push({
          kind: 'choice', label: 'COLOUR MODE',
          hint: 'Adjusts accent colours. No mechanic in this game depends on colour alone — every tell also has its own silhouette and a text label.',
          options: (Object.keys(COLOR_MODES) as ColorMode[]).map((k) => ({ label: COLOR_MODES[k].name, value: k })),
          get: () => c.colorMode, set: (v) => s.set('colorMode', v as ColorMode),
        });
        break;

      case 'controls':
        items.push({ kind: 'header', label: 'Keyboard  /  Gamepad' });
        for (const a of REMAPPABLE) {
          items.push({
            kind: 'binding', label: ACTION_LABELS[a], action: a,
            hint: 'Press ENTER, then the key or gamepad button you want.',
          });
        }
        items.push({ kind: 'header', label: 'Reference' });
        items.push({ kind: 'info', label: 'DUCK', value: () => 'Dodge Left + Right together' });
        items.push({ kind: 'info', label: 'BLOCK LOW', value: () => 'Block + Body Punch' });
        items.push({ kind: 'info', label: 'BIGGEST SPECIAL', value: () => 'Special alone' });
        items.push({ kind: 'info', label: 'ONE-STAR SPECIAL', value: () => 'Special + Body Punch' });
        items.push({
          kind: 'action', label: 'RESET TO DEFAULTS',
          hint: 'Restores the original keyboard and gamepad layout.',
          run: () => { this.game.settings.resetControls(); this.rebuild(); },
        });
        break;
    }

    items.push({ kind: 'header', label: 'General' });
    items.push({
      kind: 'action', label: 'RESET ALL SETTINGS', accent: PALETTE.red,
      hint: 'Restores every setting except your chosen difficulty. Does not touch career progress.',
      run: () => { this.game.settings.resetAll(); this.rebuild(); },
    });
    items.push({ kind: 'action', label: 'BACK', run: () => this.onBack() });

    this.items = items;
    this.index = Math.min(this.index, this.items.length - 1);
    this.ensureSelectable(1);
  }

  /** Left/right at the top row switches tabs. */
  protected override adjust(dir: number): void {
    const item = this.items[this.index];
    if (item?.kind === 'header' || this.index === 0) {
      this.switchTab(dir);
      return;
    }
    super.adjust(dir);
  }

  private switchTab(dir: number): void {
    const i = TABS.findIndex((t) => t.id === this.tab);
    this.tab = TABS[(i + dir + TABS.length) % TABS.length].id;
    this.index = 1;
    this.scroll = this.scrollTarget = 0;
    this.game.audio.play('uiConfirm');
    this.rebuild();
  }

  protected override drawBackdrop(ctx: Ctx): void {
    const { dw, dh } = this.game.renderer;
    if (this.transparent) {
      ctx.fillStyle = 'rgba(6,4,10,0.9)';
      ctx.fillRect(0, 0, dw, dh);
    } else {
      this.defaultBackdrop(ctx, dw, dh);
    }
    // Tab strip.
    const x = this.titleX(dw);
    const y = 212;
    let cx = x;
    for (const t of TABS) {
      const active = t.id === this.tab;
      const w = 172;
      panel(ctx, cx, y, w, 46, {
        radius: 10,
        fill: active ? '#332651' : '#171326',
        border: active ? PALETTE.gold : PALETTE.line,
        alpha: active ? 1 : 0.8,
      });
      label(ctx, t.name, cx + w / 2, y + 24, 16, active ? PALETTE.gold : PALETTE.dim,
        { align: 'center', weight: 900 });
      cx += w + 10;
    }
    label(ctx, '← →  on a section header switches tab', cx + 16, y + 24, 14, PALETTE.dim, { weight: 600 });
  }

  protected override drawDetail(ctx: Ctx, x: number, y: number, w: number): void {
    let cy = this.drawHint(ctx, x, y, w);
    if (this.tab === 'gameplay') {
      const d = DIFFICULTIES[this.game.settings.current.difficulty];
      panel(ctx, x, cy, w, 250, { radius: 12, fill: '#191430', border: d.color });
      displayText(ctx, d.name, x + w / 2, cy + 40, 34, d.color, { outlineWidth: 7 });
      const rows: [string, string][] = [
        ['Reaction speed', `${(1 / d.reaction).toFixed(2)}×`],
        ['Tell length', `${Math.round(d.telegraph * 100)}%`],
        ['Feint chance', `${Math.round(d.feint * 100)}%`],
        ['Counter frequency', `${d.counter.toFixed(2)}×`],
        ['Your timing windows', `${Math.round(d.window * 100)}%`],
        ['Their damage', `${Math.round(d.enemyDamage * 100)}%`],
      ];
      rows.forEach((r, i) => {
        const ry = cy + 82 + i * 26;
        label(ctx, r[0], x + 20, ry, 15, PALETTE.dim, { weight: 600 });
        label(ctx, r[1], x + w - 20, ry, 15, PALETTE.text, { align: 'right', weight: 800 });
      });
      label(ctx, 'Health is never inflated by difficulty.', x + 20, cy + 244, 13, PALETTE.gold, { weight: 700 });
      cy += 268;
    }
    if (this.tab === 'controls' && this.game.input.gamepadConnected) {
      panel(ctx, x, cy, w, 60, { radius: 10, fill: '#14261a', border: PALETTE.green });
      label(ctx, 'GAMEPAD CONNECTED', x + 20, cy + 30, 17, PALETTE.green, { weight: 800 });
    }
  }
}
