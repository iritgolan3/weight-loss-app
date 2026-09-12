import { Ease, clamp01, lerp, TAU } from '../core/MathUtil';
import type { Pose, V2 } from './Pose';
import type { EntranceStyle } from '../data/types';

/**
 * Procedural pose library.
 *
 * Every function mutates `out` (already seeded with the fighter's stance).
 * The guiding rule for telegraphs: reach the extreme pose FAST, then HOLD it.
 * A silhouette the player can stare at for ten frames is readable; one that
 * eases smoothly all the way into the punch is not.
 */

function set(p: V2, x: number, y: number): void { p.x = x; p.y = y; }
function add(p: V2, x: number, y: number): void { p.x += x; p.y += y; }

/** Snap to the pose over the first `reach` of the window, then hold it. */
function hold(t: number, reach = 0.42): number {
  return Ease.quartOut(clamp01(t / reach));
}

// ---------------------------------------------------------------------------
// IDLE
// ---------------------------------------------------------------------------

export function applyIdle(out: Pose, time: number, energy: number, gassed: number): void {
  const bob = Math.sin(time * 3.4) * 0.035 * (0.6 + energy);
  const sway = Math.sin(time * 1.7) * 0.028 * (0.5 + energy);
  // Gassed fighters breathe heavily and let the guard sag.
  const heave = gassed * Math.sin(time * 5.2) * 0.05;
  const sag = gassed * 0.16;

  add(out.hip, sway * 0.5, bob + heave * 0.5);
  add(out.chest, sway, bob * 1.2 + heave);
  add(out.neck, sway, bob * 1.25 + heave);
  add(out.head, sway * 1.1, bob * 1.3 + heave * 1.1);
  add(out.shoulderL, sway, bob * 1.2 + heave);
  add(out.shoulderR, sway, bob * 1.2 + heave);
  add(out.elbowL, sway * 1.1, bob * 1.1 + sag * 0.5);
  add(out.elbowR, sway * 1.1, bob * 1.1 + sag * 0.5);
  add(out.gloveL, sway * 1.2 + Math.sin(time * 3.9) * 0.02, bob * 1.35 + sag);
  add(out.gloveR, sway * 1.2 + Math.sin(time * 3.9 + 1.1) * 0.02, bob * 1.35 + sag);
  add(out.kneeL, sway * 0.3, bob * 0.3);
  add(out.kneeR, sway * 0.3, bob * 0.3);
  out.mouth = Math.max(out.mouth, gassed * 0.55);
  out.brow += gassed * 0.15;
}

// ---------------------------------------------------------------------------
// TELEGRAPHS — one distinct silhouette per tell
// ---------------------------------------------------------------------------

export function applyWindup(out: Pose, kind: string, t: number, time: number): void {
  const k = hold(t);
  const h = out.head.y; // for reference offsets

  switch (kind) {
    case 'shoulder': {
      // Small, honest tell: the punching shoulder loads back and down.
      add(out.shoulderR, -0.1 * k, 0.04 * k);
      set(out.elbowR, out.elbowR.x - 0.16 * k, out.elbowR.y + 0.1 * k);
      set(out.gloveR, out.gloveR.x - 0.22 * k, out.gloveR.y + 0.14 * k);
      out.torsoRot += 0.1 * k;
      out.brow = lerp(out.brow, 0.75, k);
      break;
    }

    case 'wideWind': {
      // The unmistakable haymaker load: arm swings out to the horizontal.
      const wobble = Math.sin(time * 15) * 0.02 * k;
      // Elbow swings out and back; the glove chambers behind it rather than
      // flying off on its own, so the arm stays visually connected.
      set(out.elbowR, lerp(out.elbowR.x, -0.86, k), lerp(out.elbowR.y, -1.98, k));
      set(out.gloveR, lerp(out.gloveR.x, -1.16, k) + wobble, lerp(out.gloveR.y, -1.72, k));
      out.gloveScaleR = lerp(1, 0.82, k);
      out.torsoRot += 0.3 * k;
      out.rot += 0.08 * k;
      add(out.chest, 0.1 * k, 0);
      add(out.head, 0.06 * k, 0.02 * k);
      out.brow = lerp(out.brow, 1, k);
      out.mouth = lerp(out.mouth, 0.5, k);
      break;
    }

    case 'crouch': {
      // Whole body sinks — reads instantly even in peripheral vision.
      const drop = 0.34 * k;
      add(out.hip, 0, drop);
      add(out.chest, 0, drop * 1.05);
      add(out.neck, 0, drop * 1.05);
      add(out.head, 0, drop * 1.08);
      add(out.shoulderL, 0, drop); add(out.shoulderR, 0, drop);
      add(out.elbowL, 0.04, drop * 0.9); add(out.elbowR, -0.04, drop * 0.9);
      add(out.gloveL, 0.06 * k, drop * 1.3); add(out.gloveR, -0.06 * k, drop * 1.3);
      add(out.kneeL, 0.1 * k, drop * 0.4); add(out.kneeR, -0.1 * k, drop * 0.4);
      out.brow = lerp(out.brow, 0.9, k);
      break;
    }

    case 'lean': {
      // Weight rocks onto the back foot; the body compresses and tips away.
      add(out.hip, 0, -0.04 * k);
      add(out.chest, 0, 0.1 * k);
      add(out.neck, 0, 0.18 * k);
      add(out.head, -0.1 * k, 0.3 * k);
      out.headRot -= 0.46 * k;
      out.torsoRot -= 0.24 * k;
      out.rot -= 0.16 * k;
      out.scale = lerp(out.scale, 0.9, k);
      add(out.gloveL, 0.3 * k, 0.12 * k);
      add(out.gloveR, -0.16 * k, 0.24 * k);
      add(out.kneeR, -0.14 * k, -0.06 * k);
      out.brow = lerp(out.brow, 0.85, k);
      out.squint = lerp(out.squint, 0.45, k);
      break;
    }

    case 'raiseBoth': {
      // Both arms overhead. Enormous, unmissable, and leaves the ribs bare.
      const up = 0.78 * k;
      set(out.elbowL, out.elbowL.x + 0.12, out.elbowL.y - up * 0.75);
      set(out.elbowR, out.elbowR.x - 0.12, out.elbowR.y - up * 0.75);
      set(out.gloveL, out.gloveL.x + 0.18, out.gloveL.y - up);
      set(out.gloveR, out.gloveR.x - 0.18, out.gloveR.y - up);
      add(out.chest, 0, -0.08 * k);
      add(out.head, 0, -0.05 * k);
      out.headRot -= 0.1 * k;
      out.mouth = lerp(out.mouth, 0.8, k);
      out.brow = lerp(out.brow, 1, k);
      out.scale = lerp(out.scale, 1.04, k);
      break;
    }

    case 'eyeFlash': {
      // Almost no body movement: the read happens in the face and the VFX.
      out.brow = lerp(out.brow, 1, k);
      out.squint = lerp(out.squint, 0.6, k);
      out.headRot += 0.08 * k;
      add(out.head, 0, 0.03 * k);
      add(out.chest, 0.04 * k, 0.02 * k);
      out.scale = lerp(out.scale, 1.02, k);
      break;
    }

    case 'hop': {
      // Rhythmic bounce — the player learns to punch between the beats.
      const b = Math.abs(Math.sin(t * Math.PI * 3.2));
      const lift = -0.14 * b * clamp01(t * 4);
      add(out.hip, 0, lift); add(out.chest, 0, lift); add(out.neck, 0, lift);
      add(out.head, 0, lift * 1.05);
      add(out.shoulderL, 0, lift); add(out.shoulderR, 0, lift);
      add(out.elbowL, 0, lift * 0.9); add(out.elbowR, 0, lift * 0.9);
      add(out.gloveL, 0, lift * 0.8); add(out.gloveR, 0, lift * 0.8);
      add(out.kneeL, 0, lift * 0.6); add(out.kneeR, 0, lift * 0.6);
      add(out.footL, 0, lift * 0.35); add(out.footR, 0, lift * 0.35);
      out.brow = lerp(out.brow, 0.8, k);
      break;
    }

    case 'spin': {
      // A full turn. The back comes round, which is exactly the opening.
      const turn = Ease.cubicInOut(clamp01(t / 0.8));
      // Most of the turn lives in the torso and the trailing arm; rotating the
      // whole body reads as falling over rather than pivoting.
      out.rot += turn * 0.16;
      out.torsoRot += turn * 1.0;
      out.headRot += turn * 0.7;
      const trail = Math.sin(turn * Math.PI);
      set(out.elbowR, out.elbowR.x - 0.5 * trail, out.elbowR.y + 0.2 * trail);
      set(out.gloveR, out.gloveR.x - 0.85 * trail, out.gloveR.y + 0.3 * trail);
      add(out.gloveL, 0.3 * trail, -0.1 * trail);
      out.scale = lerp(out.scale, 0.97, turn);
      out.brow = lerp(out.brow, 1, k);
      break;
    }

    case 'guardDrop': {
      // The lead hand falls away from the cheek. A door opening.
      set(out.gloveL, out.gloveL.x + 0.2 * k, out.gloveL.y + 0.72 * k);
      set(out.elbowL, out.elbowL.x + 0.14 * k, out.elbowL.y + 0.3 * k);
      add(out.gloveR, -0.14 * k, 0.1 * k);
      add(out.chest, 0.05 * k, 0);
      out.torsoRot += 0.12 * k;
      out.brow = lerp(out.brow, 0.95, k);
      out.squint = lerp(out.squint, 0.35, k);
      break;
    }

    case 'stomp': {
      // Back foot lifts, then plants hard. Body drops on the plant.
      // Raise, HOLD, then stamp. A quick in-and-out is unreadable.
      const lift = t < 0.72 ? Ease.quartOut(clamp01(t / 0.22)) : 1 - clamp01((t - 0.72) / 0.28);
      const plant = clamp01((t - 0.78) / 0.22);
      add(out.footR, -0.12 * lift, -0.52 * lift);
      add(out.kneeR, -0.1 * lift, -0.4 * lift);
      add(out.hip, 0.04 * lift, -0.04 * lift);
      out.rot += 0.06 * lift;
      const drop = 0.2 * plant;
      add(out.hip, 0, drop); add(out.chest, 0, drop); add(out.neck, 0, drop);
      add(out.head, 0, drop); add(out.shoulderL, 0, drop); add(out.shoulderR, 0, drop);
      add(out.elbowL, 0, drop); add(out.elbowR, 0, drop);
      add(out.gloveL, 0, drop * 1.2); add(out.gloveR, 0, drop * 1.2);
      out.brow = lerp(out.brow, 1, k);
      out.mouth = lerp(out.mouth, 0.45, plant);
      break;
    }

    case 'point': {
      // One arm extends straight at the camera. Theatrical, and a free second.
      set(out.elbowR, out.elbowR.x * 0.5, out.elbowR.y - 0.26 * k);
      set(out.gloveR, out.gloveR.x * 0.25, out.gloveR.y - 0.1 * k);
      out.gloveScaleR = lerp(1, 1.35, k);
      add(out.gloveL, 0.14 * k, 0.2 * k);
      add(out.chest, 0, -0.04 * k);
      out.headRot += 0.06 * k;
      out.brow = lerp(out.brow, 0.6, k);
      out.mouth = lerp(out.mouth, 0.5, k);
      break;
    }

    case 'roar': {
      // Head back, chest out, arms flung wide. You can hear it.
      const shake = Math.sin(time * 22) * 0.016 * k;
      out.headRot -= 0.34 * k;
      add(out.head, shake, -0.1 * k);
      add(out.chest, 0, -0.1 * k);
      set(out.elbowL, out.elbowL.x + 0.36 * k, out.elbowL.y + 0.14 * k);
      set(out.elbowR, out.elbowR.x - 0.36 * k, out.elbowR.y + 0.14 * k);
      set(out.gloveL, out.gloveL.x + 0.68 * k, out.gloveL.y + 0.42 * k);
      set(out.gloveR, out.gloveR.x - 0.68 * k, out.gloveR.y + 0.42 * k);
      out.mouth = lerp(out.mouth, 1, k);
      out.brow = lerp(out.brow, 1, k);
      out.squint = lerp(out.squint, 0.5, k);
      out.scale = lerp(out.scale, 1.06, k);
      break;
    }
  }
  void h;
}

// ---------------------------------------------------------------------------
// PUNCHES
// ---------------------------------------------------------------------------

export interface PunchParams {
  /** 'jab' | 'straight' | 'hook' | 'uppercut' | 'overhand' | 'axe' | 'combo' | 'double' | 'spin' */
  anim: string;
  hand: 'left' | 'right' | 'both';
  zone: 'head' | 'body';
  /** 0..1 across startup, 1 at full extension, back to 0 through recovery. */
  extend: number;
  /** True when this fighter faces the camera (the opponent). */
  facingCamera: boolean;
  /** Which hand is live on this strike of a multi-hit combo. */
  altHand: 'left' | 'right';
}

export function applyPunch(out: Pose, p: PunchParams): void {
  const e = p.extend;
  if (e <= 0.001) return;

  let hand = p.hand;
  if (hand === 'both') hand = p.altHand;
  const isL = hand === 'left';
  const s = isL ? 1 : -1;              // fighter-local X sign of that arm
  const glove = isL ? out.gloveL : out.gloveR;
  const elbow = isL ? out.elbowL : out.elbowR;
  const shoulder = isL ? out.shoulderL : out.shoulderR;
  const otherGlove = isL ? out.gloveR : out.gloveL;

  // Target the head or the body of whoever is opposite.
  const targetY = p.zone === 'head' ? -2.5 : -1.75;

  if (p.facingCamera) {
    // --- Opponent: the punch travels toward the camera ---------------------
    // Depth is faked with scale; the glove converges on screen centre.
    const reach = Ease.backOut(clamp01(e));
    switch (p.anim) {
      case 'hook':
        // Sweeps in from the side and across — the widest, most readable arc.
        set(glove, lerp(glove.x, s * 0.62, reach), lerp(glove.y, targetY + 0.12, reach));
        set(elbow, lerp(elbow.x, s * 0.92, reach), lerp(elbow.y, targetY + 0.44, reach));
        break;
      case 'uppercut':
        set(glove, lerp(glove.x, s * 0.36, reach), lerp(glove.y, targetY + 0.5 - reach * 0.55, reach));
        set(elbow, lerp(elbow.x, s * 0.52, reach), lerp(elbow.y, targetY + 0.92, reach));
        break;
      case 'overhand':
      case 'axe':
        set(glove, lerp(glove.x, s * 0.4, reach), lerp(glove.y, targetY - 0.04, reach));
        set(elbow, lerp(elbow.x, s * 0.7, reach), lerp(elbow.y, targetY - 0.5, reach));
        break;
      case 'spin':
        set(glove, lerp(glove.x, s * 0.3, reach), lerp(glove.y, targetY, reach));
        set(elbow, lerp(elbow.x, s * 0.6, reach), lerp(elbow.y, targetY + 0.2, reach));
        out.rot += 0.25 * reach;
        break;
      default: // jab / straight / combo / double
        // Offset from centre so the glove passes beside the chin instead of
        // parking on top of the face — the face still has to be readable.
        set(glove, lerp(glove.x, s * 0.34, reach), lerp(glove.y, targetY + 0.18, reach));
        set(elbow, lerp(elbow.x, s * 0.56, reach), lerp(elbow.y, targetY + 0.46, reach));
        break;
    }
    // Foreshortening: the glove reads as coming at you. Kept modest — at 3x
    // the glove covers the fighter and you can no longer see what hit you.
    const gs = 1 + reach * (p.anim === 'jab' ? 0.6 : 0.82);
    if (isL) out.gloveScaleL = gs; else out.gloveScaleR = gs;
    // The shoulder drives through with the punch.
    add(shoulder, s * 0.08 * reach, 0.03 * reach);
    add(out.chest, s * 0.1 * reach, 0);
    out.torsoRot += -s * 0.18 * reach;
    // The other hand stays home, which is the tell that it is a single shot.
    add(otherGlove, -s * 0.04 * reach, 0.03 * reach);
    out.scale = lerp(out.scale, 1.05, reach);
    out.brow = Math.max(out.brow, 0.8);
    out.mouth = Math.max(out.mouth, 0.35 * reach);
  } else {
    // --- Player: seen from behind, the punch travels away from the camera --
    const reach = Ease.quartOut(clamp01(e));
    const away = p.zone === 'head' ? -0.55 : -0.28;
    switch (p.anim) {
      case 'hook':
        set(glove, lerp(glove.x, s * 0.5, reach), lerp(glove.y, targetY + away, reach));
        set(elbow, lerp(elbow.x, s * 0.68, reach), lerp(elbow.y, targetY + away + 0.34, reach));
        break;
      case 'uppercut':
        set(glove, lerp(glove.x, s * 0.24, reach), lerp(glove.y, targetY + away + 0.2, reach));
        set(elbow, lerp(elbow.x, s * 0.4, reach), lerp(elbow.y, targetY + away + 0.62, reach));
        break;
      case 'overhand':
      case 'axe':
        set(glove, lerp(glove.x, s * 0.26, reach), lerp(glove.y, targetY + away - 0.14, reach));
        set(elbow, lerp(elbow.x, s * 0.54, reach), lerp(elbow.y, targetY + away - 0.4, reach));
        break;
      default:
        set(glove, lerp(glove.x, s * 0.2, reach), lerp(glove.y, targetY + away, reach));
        set(elbow, lerp(elbow.x, s * 0.42, reach), lerp(elbow.y, targetY + away + 0.3, reach));
        break;
    }
    // Punching away from camera: the glove shrinks with distance.
    const gs = 1 - reach * 0.34;
    if (isL) out.gloveScaleL = gs; else out.gloveScaleR = gs;
    add(shoulder, s * 0.06 * reach, -0.05 * reach);
    add(out.chest, s * 0.06 * reach, -0.04 * reach);
    add(out.hip, s * 0.03 * reach, -0.02 * reach);
    out.torsoRot += -s * 0.2 * reach;
    out.scale = lerp(out.scale, 1.03, reach);
  }
}

// ---------------------------------------------------------------------------
// DEFENCE
// ---------------------------------------------------------------------------

export function applyBlock(out: Pose, zone: 'head' | 'body', t: number): void {
  const k = Ease.quartOut(clamp01(t * 7));
  if (zone === 'head') {
    set(out.gloveL, lerp(out.gloveL.x, 0.2, k), lerp(out.gloveL.y, out.head.y - 0.06, k));
    set(out.gloveR, lerp(out.gloveR.x, -0.2, k), lerp(out.gloveR.y, out.head.y - 0.06, k));
    set(out.elbowL, lerp(out.elbowL.x, 0.34, k), lerp(out.elbowL.y, out.head.y + 0.58, k));
    set(out.elbowR, lerp(out.elbowR.x, -0.34, k), lerp(out.elbowR.y, out.head.y + 0.58, k));
  } else {
    set(out.gloveL, lerp(out.gloveL.x, 0.24, k), lerp(out.gloveL.y, out.chest.y + 0.28, k));
    set(out.gloveR, lerp(out.gloveR.x, -0.24, k), lerp(out.gloveR.y, out.chest.y + 0.28, k));
    set(out.elbowL, lerp(out.elbowL.x, 0.42, k), lerp(out.elbowL.y, out.chest.y + 0.52, k));
    set(out.elbowR, lerp(out.elbowR.x, -0.42, k), lerp(out.elbowR.y, out.chest.y + 0.52, k));
    add(out.head, 0, 0.12 * k);
    add(out.chest, 0, 0.08 * k);
  }
  out.squint = lerp(out.squint, 0.7, k);
  out.brow = lerp(out.brow, 0.9, k);
  out.scale = lerp(out.scale, 0.97, k);
}

export function applyParry(out: Pose, t: number): void {
  const flash = Math.sin(clamp01(t) * Math.PI);
  add(out.gloveL, 0.3 * flash, -0.1 * flash);
  add(out.gloveR, -0.3 * flash, -0.1 * flash);
  out.gloveScaleL += flash * 0.4;
  out.gloveScaleR += flash * 0.4;
  out.scale = lerp(out.scale, 1.06, flash);
  out.brow = Math.max(out.brow, 0.9);
}

export function applyDodge(out: Pose, dir: number, t: number): void {
  const bell = Math.sin(clamp01(t) * Math.PI);
  const slip = dir * 0.95 * bell;
  out.offset.x += slip;
  out.rot += -dir * 0.24 * bell;
  add(out.head, dir * 0.16 * bell, 0.16 * bell);
  add(out.chest, dir * 0.1 * bell, 0.08 * bell);
  add(out.gloveL, dir * 0.08 * bell, 0.06 * bell);
  add(out.gloveR, dir * 0.08 * bell, 0.06 * bell);
  // Trailing foot stays planted — the slip reads as a slip, not a sidestep.
  add(out.footL, dir * 0.3 * bell, 0);
  add(out.footR, dir * 0.14 * bell, 0);
  out.squint = lerp(out.squint, 0.55, bell);
}

export function applyDuck(out: Pose, t: number): void {
  const bell = Math.sin(clamp01(t) * Math.PI);
  const drop = 0.72 * bell;
  add(out.hip, 0, drop * 0.6);
  add(out.chest, 0, drop * 0.9);
  add(out.neck, 0, drop);
  add(out.head, 0, drop * 1.05);
  add(out.shoulderL, 0, drop * 0.9); add(out.shoulderR, 0, drop * 0.9);
  add(out.elbowL, 0.08 * bell, drop * 0.85); add(out.elbowR, -0.08 * bell, drop * 0.85);
  add(out.gloveL, 0.05 * bell, drop); add(out.gloveR, -0.05 * bell, drop);
  add(out.kneeL, 0.14 * bell, drop * 0.3); add(out.kneeR, -0.14 * bell, drop * 0.3);
  out.squint = lerp(out.squint, 0.7, bell);
}

// ---------------------------------------------------------------------------
// DAMAGE REACTIONS
// ---------------------------------------------------------------------------

export function applyHitReaction(out: Pose, t: number, dir: number, heavy: boolean, zone: 'head' | 'body'): void {
  // Snap away hard, then settle — the snap is what sells the impact.
  const snap = t < 0.25 ? Ease.quartOut(t / 0.25) : 1 - Ease.cubicOut((t - 0.25) / 0.75);
  const mag = heavy ? 1.5 : 0.95;
  const d = -dir;

  if (zone === 'head') {
    add(out.head, d * 0.36 * snap * mag, -0.08 * snap * mag);
    out.headRot += d * 0.5 * snap * mag;
    add(out.neck, d * 0.18 * snap * mag, 0);
    add(out.chest, d * 0.12 * snap * mag, 0.04 * snap * mag);
  } else {
    add(out.chest, d * 0.1 * snap * mag, 0.2 * snap * mag);
    add(out.hip, d * 0.06 * snap * mag, 0.14 * snap * mag);
    add(out.head, d * 0.12 * snap * mag, 0.3 * snap * mag);
    out.headRot += 0.24 * snap * mag;
  }
  out.torsoRot += d * 0.2 * snap * mag;
  out.offset.x += d * 0.18 * snap * mag;
  add(out.gloveL, d * 0.2 * snap * mag, 0.12 * snap * mag);
  add(out.gloveR, d * 0.2 * snap * mag, 0.12 * snap * mag);
  out.squint = Math.max(out.squint, 0.85 * snap);
  out.mouth = Math.max(out.mouth, 0.7 * snap);
  out.brow = Math.max(out.brow, snap);
}

export function applyStagger(out: Pose, t: number, dir: number): void {
  const wob = Math.sin(t * TAU * 2.2) * (1 - t * 0.5);
  out.offset.x += -dir * 0.34 * (1 - t) + wob * 0.12;
  out.rot += wob * 0.14;
  out.headRot += wob * 0.3;
  add(out.head, wob * 0.12, 0.06);
  add(out.gloveL, wob * 0.2, 0.3 * (1 - t));
  add(out.gloveR, wob * 0.2, 0.3 * (1 - t));
  out.squint = Math.max(out.squint, 0.6);
  out.mouth = Math.max(out.mouth, 0.5);
}

export function applyStunned(out: Pose, time: number): void {
  // Guard drops, head lolls, weight wanders. Unmistakably a free shot.
  const w = Math.sin(time * 3.1);
  const w2 = Math.sin(time * 2.3 + 1.2);
  out.offset.x += w * 0.2;
  out.rot += w2 * 0.1;
  out.headRot += w * 0.34;
  add(out.head, w * 0.14, 0.1 + w2 * 0.05);
  add(out.chest, w * 0.06, 0.08);
  set(out.gloveL, 0.46 + w * 0.1, out.chest.y + 0.62);
  set(out.gloveR, -0.46 + w2 * 0.1, out.chest.y + 0.66);
  set(out.elbowL, 0.5, out.chest.y + 0.4);
  set(out.elbowR, -0.5, out.chest.y + 0.42);
  add(out.kneeL, w * 0.08, 0.06);
  add(out.kneeR, w2 * 0.08, 0.06);
  out.squint = 0.75;
  out.mouth = 0.7;
  out.brow = 0.1;
}

export function applyKnockdown(out: Pose, t: number, dir: number, time: number): void {
  // Rotating the whole body about the feet lays it flat along the canvas:
  // at 90 degrees the hips, chest and head all end up at ground level.
  const fall = Ease.cubicIn(clamp01(t * 1.4));
  const settle = clamp01((t - 0.55) / 0.45);
  const d = -dir || -1; // topple away from the punch
  const breathe = Math.sin(time * 3.4) * 0.035 * settle;

  // Just short of flat: a fully horizontal body reads as a plank and sprawls
  // right across the foreground fighter.
  out.rot += d * 1.26 * fall;
  // Re-centre and lift the body so it rests on the mat instead of inside it.
  // The lateral drift is small on purpose: a long topple carries the body out
  // of the lit centre of the ring and behind the referee, and the count is
  // the one moment the player most needs to see the man on the canvas.
  out.offset.x -= d * 0.3 * fall;
  out.offset.y -= 0.3 * fall;
  out.scale = lerp(out.scale, 0.94, fall);

  // Sprawl: limbs flop away from the torso line.
  out.headRot += d * 0.42 * fall;
  add(out.chest, 0, breathe);
  add(out.elbowL, 0.22 * fall, 0.34 * fall);
  add(out.elbowR, -0.3 * fall, 0.38 * fall);
  add(out.gloveL, 0.34 * fall, 0.5 * fall + breathe);
  add(out.gloveR, -0.5 * fall, 0.54 * fall + breathe);
  add(out.kneeL, 0.26 * fall, 0.12 * fall);
  add(out.kneeR, -0.14 * fall, -0.22 * fall);
  add(out.footL, 0.4 * fall, 0.05 * fall);
  add(out.footR, -0.24 * fall, -0.34 * fall);

  out.squint = 0.95;
  out.mouth = 0.5 + Math.sin(time * 3.4) * 0.2 * settle;
  out.brow = 0.2;
}

export function applyGetUp(out: Pose, t: number, dir: number): void {
  // Reverse of the knockdown, with a shaky hold at the halfway point.
  const rise = Ease.cubicInOut(clamp01(t));
  const shake = Math.sin(t * TAU * 3) * (1 - rise) * 0.06;
  applyKnockdown(out, 1 - rise, dir, 0);
  out.offset.x += shake;
  out.rot += shake * 0.4;
  out.squint = lerp(0.9, 0.3, rise);
  out.mouth = lerp(0.6, 0.3, rise);
}

// ---------------------------------------------------------------------------
// FLAVOUR
// ---------------------------------------------------------------------------

export function applyTaunt(out: Pose, t: number, time: number): void {
  const k = Math.sin(clamp01(t) * Math.PI);
  set(out.gloveL, 0.66 * k + out.gloveL.x * (1 - k), out.head.y - 0.45 * k);
  set(out.gloveR, -0.66 * k + out.gloveR.x * (1 - k), out.head.y - 0.45 * k);
  set(out.elbowL, 0.6, out.chest.y + 0.05);
  set(out.elbowR, -0.6, out.chest.y + 0.05);
  add(out.head, 0, -0.06 * k);
  out.headRot += Math.sin(time * 6) * 0.1 * k;
  out.mouth = Math.max(out.mouth, 0.85 * k);
  out.brow = lerp(out.brow, 0.1, k);
  out.scale = lerp(out.scale, 1.05, k);
}

export function applyVictory(out: Pose, time: number): void {
  const pump = Math.abs(Math.sin(time * 3.4));
  set(out.gloveL, 0.52, out.head.y - 0.5 - pump * 0.3);
  set(out.gloveR, -0.52, out.head.y - 0.5 - pump * 0.3);
  set(out.elbowL, 0.56, out.chest.y - 0.1);
  set(out.elbowR, -0.56, out.chest.y - 0.1);
  add(out.hip, 0, -0.08 * pump);
  add(out.chest, 0, -0.12 * pump);
  add(out.head, 0, -0.14 * pump);
  out.headRot -= 0.12;
  out.mouth = 1;
  out.brow = 0;
  out.squint = 0.5;
  out.scale = 1 + pump * 0.04;
}

export function applyDefeat(out: Pose, time: number): void {
  const slump = 0.5 + Math.sin(time * 2) * 0.03;
  add(out.chest, 0, 0.14 * slump);
  add(out.neck, 0, 0.18 * slump);
  add(out.head, 0.06 * slump, 0.2 * slump);
  out.headRot += 0.26;
  set(out.gloveL, 0.42, out.hip.y + 0.1);
  set(out.gloveR, -0.42, out.hip.y + 0.14);
  set(out.elbowL, 0.44, out.chest.y + 0.5);
  set(out.elbowR, -0.44, out.chest.y + 0.52);
  add(out.kneeL, 0.06, 0.1);
  add(out.kneeR, -0.06, 0.1);
  out.squint = 0.9;
  out.mouth = 0.4;
  out.brow = 0.2;
  out.scale = 0.96;
}

/**
 * A boxer's entrance, before the bell.
 *
 * Every opponent gets his own. This is the first thing the player ever sees a
 * new fighter do, and the whole game is about learning to read fighters, so a
 * shared entrance would waste the one moment the player is looking at nothing
 * else. `t` runs 0..1 across the entrance.
 */
export function applyIntro(out: Pose, t: number, time: number, style: EntranceStyle = 'hop'): void {
  const k = clamp01(t);
  // Everyone arrives out of a crouch and settles into the stance; the style
  // plays on top of that, and hands back to the guard before the bell.
  const rise = Ease.cubicOut(clamp01(k * 1.8));
  out.offset.y += (1 - rise) * 0.55;
  out.scale = lerp(0.9, 1, rise);
  out.brow = 0.7;

  // The performance occupies the middle of the entrance and unwinds by the end,
  // so nobody is still mid-flourish when the referee steps in.
  const act = Math.sin(clamp01((k - 0.1) / 0.78) * Math.PI);

  switch (style) {
    case 'hop': {
      const b = Math.abs(Math.sin(time * 6.5));
      out.offset.y -= b * 0.13 * act;
      add(out.gloveL, -0.05 * act, -0.16 * act);
      add(out.gloveR, 0.05 * act, -0.16 * act);
      out.headRot += Math.sin(time * 6.5) * 0.07;
      break;
    }
    case 'raise': {
      // Both arms straight up to the crowd, head back.
      out.gloveL.x -= 0.34 * act; out.gloveL.y -= 0.86 * act;
      out.gloveR.x += 0.34 * act; out.gloveR.y -= 0.86 * act;
      out.elbowL.x -= 0.2 * act; out.elbowL.y -= 0.5 * act;
      out.elbowR.x += 0.2 * act; out.elbowR.y -= 0.5 * act;
      out.headRot += 0.14 * act;
      out.mouth = 0.9 * act;
      out.offset.y -= Math.sin(time * 3) * 0.03 * act;
      break;
    }
    case 'shadow': {
      // Throws his own combination at nobody. Fast, tight, unshowy.
      const beat = (time * 3.4) % 2;
      const punch = Math.sin(clamp01(beat % 1) * Math.PI);
      const lead = beat < 1;
      const g = lead ? out.gloveL : out.gloveR;
      const e = lead ? out.elbowL : out.elbowR;
      g.y -= 0.1 * punch * act;
      g.x += (lead ? -1 : 1) * 0.1 * punch * act;
      e.y -= 0.06 * punch * act;
      if (lead) out.gloveScaleL += punch * 0.45 * act; else out.gloveScaleR += punch * 0.45 * act;
      out.torsoRot += (lead ? -1 : 1) * 0.1 * punch * act;
      break;
    }
    case 'bow': {
      // A deep, unhurried bow from the waist.
      const b = act;
      out.rot += b * 0.34;
      out.offset.y += b * 0.16;
      out.headRot += b * 0.3;
      add(out.gloveL, 0.12 * b, 0.5 * b);
      add(out.gloveR, -0.12 * b, 0.5 * b);
      out.squint = 0.6 * b;
      break;
    }
    case 'flex': {
      // Arms wide, chest out, daring the room to be unimpressed.
      out.gloveL.x -= 0.6 * act; out.gloveL.y += 0.16 * act;
      out.gloveR.x += 0.6 * act; out.gloveR.y += 0.16 * act;
      out.elbowL.x -= 0.34 * act; out.elbowR.x += 0.34 * act;
      out.chest.y -= 0.08 * act;
      out.headRot += Math.sin(time * 1.6) * 0.16 * act;
      out.brow = 1;
      break;
    }
    case 'pray': {
      // Gloves together, head down, a long beat, then up.
      const down = act;
      out.gloveL.x = lerp(out.gloveL.x, -0.05, down);
      out.gloveR.x = lerp(out.gloveR.x, 0.05, down);
      out.gloveL.y = lerp(out.gloveL.y, out.chest.y - 0.1, down);
      out.gloveR.y = lerp(out.gloveR.y, out.chest.y - 0.1, down);
      out.headRot += 0.26 * down;
      out.squint = down;
      break;
    }
    case 'stomp': {
      // Heavy, forward, low. Shakes on every footfall.
      const beat = Math.sin(time * 4.4);
      out.offset.y -= Math.max(0, beat) * 0.07 * act;
      out.offset.x += beat * 0.05 * act;
      out.rot += 0.1 * act;
      out.headRot -= 0.12 * act;
      add(out.gloveL, 0.06 * act, 0.34 * act);
      add(out.gloveR, -0.06 * act, 0.34 * act);
      out.brow = 1;
      break;
    }
    case 'spin': {
      // One showy turn, landing square on the beat.
      const turn = clamp01((k - 0.18) / 0.4);
      out.rot += Math.sin(turn * Math.PI) * 0.5;
      out.offset.x += Math.sin(turn * Math.PI * 2) * 0.22;
      out.gloveL.y -= 0.3 * act; out.gloveR.y -= 0.3 * act;
      out.headRot += Math.sin(time * 7) * 0.1 * act;
      out.mouth = 0.8 * act;
      break;
    }
    case 'point': {
      // Straight down the camera. At you.
      const pt = act;
      out.gloveR.x = lerp(out.gloveR.x, 0.1, pt);
      out.gloveR.y = lerp(out.gloveR.y, out.chest.y - 0.24, pt);
      out.gloveScaleR += pt * 0.85;
      out.elbowR.y -= 0.18 * pt;
      out.headRot -= 0.1 * pt;
      out.brow = 1;
      out.mouth = 0.7 * pt;
      break;
    }
    case 'fold': {
      // Arms folded. Does not move. Does not need to.
      const fo = act;
      out.gloveL.x = lerp(out.gloveL.x, 0.22, fo);
      out.gloveR.x = lerp(out.gloveR.x, -0.22, fo);
      out.gloveL.y = lerp(out.gloveL.y, out.chest.y + 0.06, fo);
      out.gloveR.y = lerp(out.gloveR.y, out.chest.y + 0.12, fo);
      out.elbowL.x -= 0.1 * fo; out.elbowR.x += 0.1 * fo;
      out.squint = 0.45 * fo;
      out.brow = 0.9;
      break;
    }
    case 'cross': {
      // Signs a cross, then kisses the glove.
      const sign = clamp01((k - 0.12) / 0.34);
      const kiss = clamp01((k - 0.5) / 0.3);
      const arc = Math.sin(sign * Math.PI);
      out.gloveR.x = lerp(out.gloveR.x, lerp(0.02, 0.3, sign), arc);
      out.gloveR.y = lerp(out.gloveR.y, lerp(out.head.y - 0.1, out.chest.y + 0.2, sign), arc);
      if (kiss > 0) {
        const k2 = Math.sin(kiss * Math.PI);
        out.gloveR.x = lerp(out.gloveR.x, 0.04, k2);
        out.gloveR.y = lerp(out.gloveR.y, out.head.y + 0.16, k2);
        out.headRot += 0.1 * k2;
      }
      out.squint = 0.5 * act;
      break;
    }
    case 'salute': {
      // One sharp salute, held, then cut away.
      const up = clamp01((k - 0.15) / 0.16);
      const hold = 1 - clamp01((k - 0.62) / 0.16);
      const sal = Math.min(up, hold);
      out.gloveR.x = lerp(out.gloveR.x, -0.16, sal);
      out.gloveR.y = lerp(out.gloveR.y, out.head.y - 0.06, sal);
      out.elbowR.x = lerp(out.elbowR.x, -0.42, sal);
      out.elbowR.y = lerp(out.elbowR.y, out.chest.y - 0.04, sal);
      out.rot += 0.03 * sal;
      out.brow = 0.95;
      break;
    }
  }
}
