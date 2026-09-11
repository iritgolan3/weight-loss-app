import type { Game, Scene } from '../core/Game';
import type { GameTime } from '../core/Time';
import { Fighter, FState } from '../combat/Fighter';
import { AnimationSystem } from '../anim/AnimationSystem';
import { FighterRenderer } from '../render/FighterRenderer';
import { metrics, stance } from '../anim/Pose';
import { ALL_BOXERS } from '../data/boxers';
import { PLAYER_LOOK } from '../data/player';
import type { BoxerDef } from '../data/types';
import type { Ctx } from '../render/draw';
import { label, PALETTE, displayText } from '../ui/ui';
import { Action } from '../input/Actions';
import { atk, tell } from '../data/factory';

interface Cell {
  name: string;
  apply: (f: Fighter, t: number) => void;
}

/**
 * Development harness: renders a grid of fighters in every pose with their
 * joints marked, so silhouette problems are obvious instead of inferred from
 * gameplay screenshots. Reached with ?lab in the URL.
 */
export class PoseLab implements Scene {
  readonly name = 'poselab';
  private t = 0;
  private page = 0;
  private showJoints = true;
  private showBack = false;

  private cells: Cell[] = [
    { name: 'IDLE', apply: (f) => f.setState(FState.Idle, 0) },
    { name: 'BLOCK HIGH', apply: (f) => { f.startBlock('head'); } },
    { name: 'BLOCK LOW', apply: (f) => { f.startBlock('body'); } },
    { name: 'DODGE L', apply: (f, t) => { if (f.state !== FState.Dodge) f.startDodge(-1); f.stateTime = (t % 1) * f.stateDuration; } },
    { name: 'DUCK', apply: (f, t) => { if (f.state !== FState.Duck) f.startDuck(); f.stateTime = (t % 1) * f.stateDuration; } },
    { name: 'TELL: wideWind', apply: (f, t) => this.windup(f, t, 'wideWind') },
    { name: 'TELL: eyeFlash', apply: (f, t) => this.windup(f, t, 'eyeFlash') },
    { name: 'TELL: stomp', apply: (f, t) => this.windup(f, t, 'stomp') },
    { name: 'TELL: lean', apply: (f, t) => this.windup(f, t, 'lean') },
    { name: 'TELL: hop', apply: (f, t) => this.windup(f, t, 'hop') },
    { name: 'TELL: raiseBoth', apply: (f, t) => this.windup(f, t, 'raiseBoth') },
    { name: 'TELL: crouch', apply: (f, t) => this.windup(f, t, 'crouch') },
    { name: 'TELL: roar', apply: (f, t) => this.windup(f, t, 'roar') },
    { name: 'TELL: guardDrop', apply: (f, t) => this.windup(f, t, 'guardDrop') },
    { name: 'TELL: spin', apply: (f, t) => this.windup(f, t, 'spin') },
    { name: 'TELL: point', apply: (f, t) => this.windup(f, t, 'point') },
    { name: 'PUNCH HEAD', apply: (f, t) => this.punch(f, t, 'head', 'straight') },
    { name: 'PUNCH BODY', apply: (f, t) => this.punch(f, t, 'body', 'uppercut') },
    { name: 'HOOK', apply: (f, t) => this.punch(f, t, 'head', 'hook') },
    { name: 'HIT', apply: (f) => { f.setState(FState.HitStun, 13); f.stateTime = f.stateDuration * 0.22; f.recoilDir = 1; f.recoil = 1; } },
    { name: 'STUNNED', apply: (f) => f.setState(FState.Stunned, 150) },
    { name: 'KNOCKED DOWN', apply: (f, t) => { f.setState(FState.KnockedDown, 0); f.downPose = Math.min(1, (t % 3) / 1.2); f.recoilDir = 1; } },
    { name: 'TAUNT', apply: (f, t) => { f.setState(FState.Taunt, 48); f.stateTime = (t % 1) * f.stateDuration; } },
    { name: 'VICTORY', apply: (f) => f.setState(FState.Victory, 0) },
    { name: 'DEFEAT', apply: (f) => f.setState(FState.Defeat, 0) },
  ];

  private windup(f: Fighter, t: number, kind: string): void {
    const a = atk({ id: 'lab', name: 'lab', tell: tell(kind as never, 40, '#ffd166', kind) });
    if (f.telegraphKind !== kind) f.beginWindup(a);
    f.stateTime = f.stateDuration * 0.85; void t;
  }

  private punch(f: Fighter, t: number, zone: 'head' | 'body', anim: string): void {
    const a = atk({ id: 'labp', name: 'lab', zone, anim, startup: 6, active: 3, recovery: 18 });
    if (!f.attack) f.startAttack(a);
    // Hold at the active frame: the peak is the pose that has to read.
    const total = (a.startup + a.active + a.recovery) / 60;
    f.attackClock = (a.startup + a.active * 0.5) / 60;
    void t; void total;
    const sF = a.startup / 60, aF = (a.startup + a.active) / 60;
    if (f.attackClock < sF) { f.state = FState.Startup; f.stateDuration = sF; f.stateTime = f.attackClock; }
    else if (f.attackClock < aF) { f.state = FState.Active; f.stateDuration = a.active / 60; f.stateTime = f.attackClock - sF; }
    else { f.state = FState.Recovery; f.stateDuration = a.recovery / 60; f.stateTime = f.attackClock - aF; }
  }

  private boxers: BoxerDef[] = ALL_BOXERS;

  constructor(private readonly game: Game) {}

  enter(): void { /* no audio in the lab */ }
  exit(): void { /* nothing */ }

  update(_dt: number, _time: GameTime): void {
    const i = this.game.input;
    if (i.justPressed(Action.MenuRight)) this.page++;
    if (i.justPressed(Action.MenuLeft)) this.page = Math.max(0, this.page - 1);
    if (i.justPressed(Action.Confirm)) this.showJoints = !this.showJoints;
    if (i.justPressed(Action.Block)) this.showBack = !this.showBack;
  }

  updateRaw(rawDt: number): void { this.t += rawDt; }

  render(ctx: Ctx, _alpha: number, _time: GameTime): void {
    const { dw, dh } = this.game.renderer;
    ctx.fillStyle = '#151220';
    ctx.fillRect(0, 0, dw, dh);

    const mode = this.page % 2;
    if (mode === 0) this.drawPoseGrid(ctx, dw, dh);
    else this.drawRosterGrid(ctx, dw, dh);

    label(ctx, '← → page   ENTER joints   SPACE front/back   |  ?lab debug view',
      dw / 2, dh - 24, 16, PALETTE.dim, { align: 'center', weight: 700 });
  }

  private drawPoseGrid(ctx: Ctx, dw: number, dh: number): void {
    const look = this.showBack ? PLAYER_LOOK : this.boxers[0].appearance;
    displayText(ctx, this.showBack ? 'PLAYER POSES (BACK)' : 'OPPONENT POSES (FRONT)',
      dw / 2, 44, 34, PALETTE.gold, { outlineWidth: 6 });

    const cols = 7;
    const rows = Math.ceil(this.cells.length / cols);
    const cw = dw / cols;
    const chh = (dh - 120) / rows;
    const unit = Math.min(chh * 0.26, cw * 0.3);

    this.cells.forEach((cell, i) => {
      const cxi = i % cols, cyi = Math.floor(i / cols);
      const x = cxi * cw + cw / 2;
      const y = 110 + cyi * chh + chh * 0.86;

      const f = new Fighter('lab', this.showBack, {});
      cell.apply(f, this.t);
      const anim = new AnimationSystem(look, !this.showBack);
      // Settle the pose so it is not caught mid-blend.
      for (let k = 0; k < 24; k++) anim.update(1 / 60, f, this.t);
      const art = new FighterRenderer(look);

      art.draw(ctx, anim.pose, {
        x, y, unit, facing: this.showBack ? 1 : -1, showFace: !this.showBack,
        light: '#ffe9c8', rim: '#ff9a3c', flash: 0,
        tell: f.state === FState.Windup ? 1 : 0, tellColor: '#ffd166',
        rage: 0, stun: f.state === FState.Stunned ? 1 : 0, gassed: 0,
        softShadows: false, richShading: true, alpha: 1, reflection: false, time: this.t,
      });

      if (this.showJoints) this.drawJoints(ctx, anim.pose, x, y, unit, this.showBack ? 1 : -1, look);
      label(ctx, cell.name, x, 110 + cyi * chh + 14, 13, PALETTE.dim, { align: 'center', weight: 800 });
    });
  }

  private drawRosterGrid(ctx: Ctx, dw: number, dh: number): void {
    displayText(ctx, 'ROSTER SILHOUETTES', dw / 2, 44, 34, PALETTE.gold, { outlineWidth: 6 });
    const cols = 8;
    const rows = Math.ceil(this.boxers.length / cols);
    const cw = dw / cols;
    const chh = (dh - 120) / rows;
    const unit = Math.min(chh * 0.26, cw * 0.3);

    this.boxers.forEach((b, i) => {
      const cxi = i % cols, cyi = Math.floor(i / cols);
      const x = cxi * cw + cw / 2;
      const y = 120 + cyi * chh + chh * 0.84;
      const f = new Fighter(b.name, false, b.stats);
      f.setState(FState.Idle, 0);
      const anim = new AnimationSystem(b.appearance, true);
      for (let k = 0; k < 24; k++) anim.update(1 / 60, f, this.t + i);
      const art = new FighterRenderer(b.appearance);
      art.draw(ctx, anim.pose, {
        x, y, unit, facing: -1, showFace: true,
        light: '#ffe9c8', rim: b.appearance.glow, flash: 0, tell: 0, tellColor: '#fff',
        rage: 0, stun: 0, gassed: 0, softShadows: false, richShading: true,
        alpha: 1, reflection: false, time: this.t,
      });
      label(ctx, b.name.toUpperCase(), x, 120 + cyi * chh + 12, 12, PALETTE.dim,
        { align: 'center', weight: 800 });
    });
  }

  private drawJoints(
    ctx: Ctx, pose: ReturnType<typeof stance>, x: number, y: number,
    unit: number, facing: number, look: typeof PLAYER_LOOK,
  ): void {
    const m = metrics(look);
    const px = (p: { x: number; y: number }) => ({
      sx: x + (p.x + pose.offset.x) * unit * facing,
      sy: y + (p.y + pose.offset.y) * unit,
    });
    const pts: [string, { x: number; y: number }, string][] = [
      ['hip', pose.hip, '#ff4d4d'], ['chest', pose.chest, '#ffd166'],
      ['neck', pose.neck, '#7ef9a2'], ['head', pose.head, '#4cc9f0'],
      ['sL', pose.shoulderL, '#c77dff'], ['sR', pose.shoulderR, '#c77dff'],
      ['eL', pose.elbowL, '#ff9a3c'], ['eR', pose.elbowR, '#ff9a3c'],
      ['gL', pose.gloveL, '#ffffff'], ['gR', pose.gloveR, '#ffffff'],
      ['kL', pose.kneeL, '#8ecae6'], ['kR', pose.kneeR, '#8ecae6'],
      ['fL', pose.footL, '#aaaaaa'], ['fR', pose.footR, '#aaaaaa'],
    ];
    ctx.save();
    for (const [, p, c] of pts) {
      const { sx, sy } = px(p);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    }
    // Ground line and head-height reference.
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - unit * 1.4, y);
    ctx.lineTo(x + unit * 1.4, y);
    ctx.stroke();
    const heads = m.height / (m.headRadius * 2);
    label(ctx, `${heads.toFixed(1)} heads`, x, y + 16, 11, PALETTE.dim, { align: 'center', weight: 700 });
    ctx.restore();
  }
}
