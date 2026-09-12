import { Fighter, FState } from '../combat/Fighter';
import type { Appearance, EntranceStyle } from '../data/types';
import { clamp01, damp, lerp } from '../core/MathUtil';
import { clonePose, lerpPoseInto, Pose, stance } from './Pose';
import * as P from './poses';

/**
 * Produces a renderable pose for a fighter every frame.
 *
 * The pose is *derived from the same frame data the combat system uses*, so a
 * telegraph can never be out of sync with the hitbox it advertises. There are
 * no authored clips to drift: the wind-up silhouette is a function of the
 * fighter's wind-up timer, and the punch extension is a function of the attack
 * clock. If a punch lands on frame 7, the glove is fully extended on frame 7.
 */
export class AnimationSystem {
  /** The pose handed to the renderer. */
  readonly pose: Pose;
  private readonly base: Pose;
  private readonly target: Pose;

  /** Alternating hand for multi-hit combinations. */
  private altHand: 'left' | 'right' = 'right';
  private lastHitIndex = -1;

  /** Small smoothing so state changes never pop. ~2 frames at 60fps. */
  private blendRate = 34;

  /** Which entrance this fighter performs before the bell. */
  entrance: EntranceStyle = 'hop';

  constructor(app: Appearance, private readonly facingCamera: boolean) {
    this.base = stance(app);
    this.pose = clonePose(this.base);
    this.target = clonePose(this.base);
  }

  setAppearance(app: Appearance): void {
    const s = stance(app);
    for (const k of Object.keys(s) as (keyof Pose)[]) {
      const val = s[k];
      if (typeof val === 'number') (this.base[k] as number) = val;
      else { (this.base[k] as { x: number; y: number }).x = val.x; (this.base[k] as { x: number; y: number }).y = val.y; }
    }
  }

  /** Extension of the current punch: 0 at the chamber, 1 at full reach. */
  private punchExtend(f: Fighter): number {
    switch (f.state) {
      case FState.Startup:
        return f.stateDuration > 0 ? clamp01(f.stateTime / f.stateDuration) : 1;
      case FState.Active:
        return 1;
      case FState.Recovery:
        return f.stateDuration > 0 ? 1 - clamp01(f.stateTime / f.stateDuration) : 0;
      default:
        return 0;
    }
  }

  update(dt: number, f: Fighter, time: number): void {
    const t = this.target;
    // Reset to the neutral stance, then layer this frame's pose on top.
    lerpPoseInto(t, this.base, this.base, 0);

    const gassed = f.stamina.gassed ? 1 - f.stamina.fraction / 0.18 : 0;
    const energy = 0.5 + f.health.fraction * 0.5;

    switch (f.state) {
      case FState.Intro:
        P.applyIntro(t, f.progress, time, this.entrance);
        break;

      case FState.Idle:
        P.applyIdle(t, time, energy, gassed);
        break;

      case FState.Windup:
        P.applyIdle(t, time, energy * 0.5, gassed * 0.5);
        if (f.telegraphKind) P.applyWindup(t, f.telegraphKind, f.progress, time);
        break;

      case FState.Startup:
      case FState.Active:
      case FState.Recovery: {
        if (f.attack) {
          // Track which hand is live across a multi-hit combination.
          if (f.hitIndex !== this.lastHitIndex) {
            this.lastHitIndex = f.hitIndex;
            if (f.attack.hand === 'both') {
              this.altHand = f.hitIndex % 2 === 0 ? 'right' : 'left';
            }
          }
          const extend = this.punchExtend(f);
          // Carry the wind-up through the first half of the startup so the
          // punch reads as "loaded then fired", not "teleported forward".
          if (f.state === FState.Startup && f.lastTelegraphKind && f.hitIndex === 0) {
            P.applyWindup(t, f.lastTelegraphKind, 1, time);
            const carry = 1 - extend;
            const fired = clonePose(t);
            lerpPoseInto(t, this.base, fired, carry);
          }
          P.applyPunch(t, {
            anim: f.attack.anim ?? 'jab',
            hand: f.attack.hand,
            zone: f.attack.zone,
            extend,
            facingCamera: this.facingCamera,
            altHand: this.altHand,
          });
        }
        break;
      }

      case FState.Block:
        P.applyIdle(t, time, energy * 0.4, gassed);
        P.applyBlock(t, f.guardZone, f.stateTime);
        break;

      case FState.Parry:
        P.applyParry(t, f.progress);
        break;

      case FState.Dodge:
        P.applyIdle(t, time, energy * 0.4, gassed * 0.5);
        P.applyDodge(t, f.dodgeDir, f.progress);
        break;

      case FState.Duck:
        P.applyDuck(t, f.progress);
        break;

      case FState.HitStun:
        P.applyHitReaction(t, f.progress, f.recoilDir, false, f.attack?.zone ?? 'head');
        break;

      case FState.Stagger:
        P.applyStagger(t, f.progress, f.recoilDir);
        break;

      case FState.Stunned:
        P.applyStunned(t, time);
        break;

      case FState.KnockedDown:
        P.applyKnockdown(t, f.downPose, f.recoilDir, time);
        break;

      case FState.GettingUp:
        P.applyGetUp(t, f.progress, f.recoilDir);
        break;

      case FState.Taunt:
        P.applyTaunt(t, f.progress, time);
        break;

      case FState.Victory:
        P.applyVictory(t, time);
        break;

      case FState.Defeat:
        P.applyDefeat(t, time);
        break;
    }

    // --- Additive layers, applied on top of whatever the state produced ---

    // Residual recoil from the last hit taken.
    if (f.recoil > 0.01) {
      const r = f.recoil;
      t.offset.x += -f.recoilDir * r * 0.12;
      t.head.x += -f.recoilDir * r * 0.1;
      t.headRot += -f.recoilDir * r * 0.16;
    }

    // Rage: a permanent low-frequency tremor plus a wider stance.
    if (f.ragePulse > 0.01) {
      const rp = f.ragePulse;
      t.offset.x += Math.sin(time * 34) * 0.02 * rp;
      t.offset.y += Math.cos(time * 41) * 0.014 * rp;
      t.scale += 0.03 * rp;
      t.brow = Math.max(t.brow, 0.9);
    }

    // Voluntary lean/crouch from the fighter's own defensive drift.
    t.offset.x += f.lean * 0.18;

    // Blend into the visible pose. Knockdowns and hits snap; everything else
    // eases, so no state change ever pops.
    const snap = f.state === FState.HitStun || f.state === FState.Stagger ||
      f.state === FState.KnockedDown || f.state === FState.Active;
    const rate = snap ? 999 : this.blendRate;
    const k = rate >= 999 ? 1 : 1 - Math.exp(-rate * dt);
    lerpPoseInto(this.pose, this.pose, t, k);
  }

  /** Instantly snap to the target pose — used on scene entry. */
  snap(): void {
    lerpPoseInto(this.pose, this.pose, this.target, 1);
  }
}

export { lerp, damp };
