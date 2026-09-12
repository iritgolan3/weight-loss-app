import { lerp } from '../core/MathUtil';
import type { Appearance } from '../data/types';

export interface V2 { x: number; y: number }

export function v(x: number, y: number): V2 { return { x, y }; }

/**
 * A full-body pose in fighter-local units.
 *
 * Convention: origin sits between the feet, -Y is up, and +X is the fighter's
 * own right. The renderer mirrors X for the opponent, who faces the camera.
 * One unit is roughly one third of a standing fighter's height.
 */
export interface Pose {
  hip: V2;
  chest: V2;
  neck: V2;
  head: V2;
  /** Head tilt in radians. */
  headRot: number;
  /** Torso roll in radians. */
  torsoRot: number;

  shoulderL: V2; shoulderR: V2;
  elbowL: V2; elbowR: V2;
  gloveL: V2; gloveR: V2;
  /** Glove scale — grows as a punch comes toward the camera. */
  gloveScaleL: number; gloveScaleR: number;
  /** Glove roll in radians. */
  gloveRotL: number; gloveRotR: number;

  kneeL: V2; kneeR: V2;
  footL: V2; footR: V2;

  /** Expression blends, 0..1. */
  brow: number;      // 0 neutral, 1 furious
  squint: number;    // 0 open, 1 shut
  mouth: number;     // 0 closed, 1 wide
  /** Overall body scale (hop, crouch emphasis). */
  scale: number;
  /** Whole-body offset applied after everything else. */
  offset: V2;
  /** Whole-body rotation about the hips. */
  rot: number;
}

const POINT_KEYS = [
  'hip', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR',
  'elbowL', 'elbowR', 'gloveL', 'gloveR', 'kneeL', 'kneeR', 'footL', 'footR', 'offset',
] as const;

const SCALAR_KEYS = [
  'headRot', 'torsoRot', 'gloveScaleL', 'gloveScaleR', 'gloveRotL', 'gloveRotR',
  'brow', 'squint', 'mouth', 'scale', 'rot',
] as const;

export function clonePose(p: Pose): Pose {
  const out = {} as Pose;
  for (const k of POINT_KEYS) out[k] = { x: p[k].x, y: p[k].y };
  for (const k of SCALAR_KEYS) (out[k] as number) = p[k];
  return out;
}

/** Writes `lerp(a, b, t)` into `out` without allocating. */
export function lerpPoseInto(out: Pose, a: Pose, b: Pose, t: number): void {
  for (const k of POINT_KEYS) {
    out[k].x = lerp(a[k].x, b[k].x, t);
    out[k].y = lerp(a[k].y, b[k].y, t);
  }
  for (const k of SCALAR_KEYS) (out[k] as number) = lerp(a[k], b[k], t);
}

/**
 * The neutral boxing stance, scaled by a fighter's build. Every other pose in
 * the game is authored as a delta from this, which keeps silhouettes coherent
 * across wildly different body types.
 */
/**
 * CARTOON PROPORTIONS, not heroic ones.
 *
 * Roughly four heads tall with a deliberately oversized head and oversized
 * gloves. This is not stylistic whim: in this kind of game every attack is
 * announced by a facial expression and a glove position, so the head and the
 * gloves are the two things that must be legible from across the room. The
 * torso is just a shape holding them apart.
 */
export function stance(app: Appearance): Pose {
  const b = app.build;
  const h = b.height;
  const shoulderX = 0.56 * b.shoulder * b.width;
  const hipX = 0.34 * b.width;

  return {
    hip: v(0, -1.16 * h),
    chest: v(0, -2.06 * h),
    neck: v(0, -2.28 * h),
    head: v(0, -2.60 * h),
    headRot: 0,
    torsoRot: 0,

    shoulderL: v(shoulderX, -2.18 * h),
    shoulderR: v(-shoulderX, -2.18 * h),
    // Elbows tucked by the ribs, forearms near vertical, gloves up at the
    // cheeks. Flaring the elbows turns the arm into a wedge that reads as a
    // wing rather than an arm.
    elbowL: v(shoulderX * 1.2, -1.62 * h),
    elbowR: v(-shoulderX * 1.2, -1.62 * h),
    // Held wide enough that the face stays readable behind the guard. A guard
    // that hides the face hides every telegraph with it.
    gloveL: v(shoulderX * 1.04, -2.26 * h),
    gloveR: v(-shoulderX * 1.04, -2.26 * h),
    gloveScaleL: 1, gloveScaleR: 1,
    gloveRotL: 0, gloveRotR: 0,

    kneeL: v(hipX * 0.94, -0.58 * h),
    kneeR: v(-hipX * 1.02, -0.58 * h),
    footL: v(hipX * 1.15, 0),
    footR: v(-hipX * 1.32, 0),

    brow: 0.35, squint: 0.1, mouth: 0.12,
    scale: 1,
    offset: v(0, 0),
    rot: 0,
  };
}

/** Metrics the renderer needs that are not part of the pose itself. */
export function metrics(app: Appearance) {
  const b = app.build;
  return {
    // Roughly a quarter of the whole fighter. The face carries every tell, so
    // it gets the space.
    headRadius: 0.37 * b.headScale * b.height,
    /** Oversized on purpose — a glove position IS a telegraph. */
    gloveRadius: 0.215 * b.width * (0.85 + b.shoulder * 0.15),
    torsoWidth: 0.5 * b.width,
    shoulderWidth: 0.56 * b.shoulder * b.width,
    chestWidth: 0.44 * b.width,
    hipWidth: 0.3 * b.width,
    neckWidth: 0.16 * b.neck * b.width,
    limbWidth: 0.15 * b.width,
    legWidth: 0.3 * b.width,
    /** Total standing height in local units, used to frame the camera. */
    height: 2.98 * b.height,
  };
}
