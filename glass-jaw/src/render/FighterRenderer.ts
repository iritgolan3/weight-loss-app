import type { Appearance } from '../data/types';
import type { Pose } from '../anim/Pose';
import { metrics } from '../anim/Pose';
import { clamp01, lerp } from '../core/MathUtil';
import {
  blobPath, clearShadow, Ctx, drawChain, fillForm, groundShadow, OUTLINE,
  rgba, roundRect, setShadow, shade, splinePath, starPath, tint,
} from './draw';

export interface FighterDrawOptions {
  /** Screen position of the fighter's feet. */
  x: number;
  y: number;
  /** Pixels per local unit. */
  unit: number;
  /** +1 draws the fighter's right on screen right (back view / player). */
  facing: 1 | -1;
  /** True when the face should be drawn (opponent faces the camera). */
  showFace: boolean;
  /** Ambient light tint from the arena. */
  light: string;
  /** Rim light colour from the arena. */
  rim: string;
  /** 0..1 white flash on being hit. */
  flash: number;
  /** 0..1 telegraph glow. */
  tell: number;
  tellColor: string;
  /** 0..1 rage aura. */
  rage: number;
  /** 0..1 stun — drives the dazed face. */
  stun: number;
  /** 0..1 exhaustion — drives sweat and a slack mouth. */
  gassed: number;
  /** Quality flags. */
  softShadows: boolean;
  richShading: boolean;
  /** Global alpha, used for the player when they must not occlude. */
  alpha: number;
  /** Draw a mirrored, faded copy on the canvas below. */
  reflection: boolean;
  /** Seconds, for idle jitter in hair and sweat. */
  time: number;
}

interface P2 { x: number; y: number }

/**
 * Draws a fully posed fighter as resolution-independent vector art.
 *
 * Nothing here is a sprite: bodies, faces, hair, trunks and gloves are all
 * generated from the Appearance spec, which is why sixteen boxers can have
 * genuinely distinct silhouettes without a single image asset.
 */
export class FighterRenderer {
  constructor(private app: Appearance) {}

  setAppearance(app: Appearance): void { this.app = app; }

  draw(ctx: Ctx, pose: Pose, o: FighterDrawOptions): void {
    const m = metrics(this.app);
    const u = o.unit * pose.scale;

    ctx.save();
    ctx.globalAlpha = o.alpha;

    // Contact shadow sits in world space, before the body transform.
    const shadowW = u * m.torsoWidth * 2.6;
    groundShadow(ctx, o.x + pose.offset.x * u * o.facing, o.y + 4, shadowW, shadowW * 0.26, 0.5);

    if (o.reflection) this.drawReflection(ctx, pose, o, m, u);

    ctx.translate(o.x + pose.offset.x * u * o.facing, o.y + pose.offset.y * u);
    if (pose.rot !== 0) ctx.rotate(pose.rot * o.facing);
    ctx.scale(o.facing * u, u);
    // From here on we are in local units with the fighter's own handedness.

    this.drawBody(ctx, pose, o, m);

    ctx.restore();

    // Post effects drawn in screen space so they are not squashed by scale.
    if (o.rage > 0.02) this.drawRageAura(ctx, pose, o, m, u);
    if (o.gassed > 0.05) this.drawSweat(ctx, pose, o, u);
  }

  // -- Whole body ------------------------------------------------------------

  private drawBody(ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>): void {
    const app = this.app;
    // Local space is unit-scaled, so line widths must be expressed in units.
    const lw = 0.045;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const skin = o.flash > 0.01 ? tint(app.skin, o.flash * 0.85) : app.skin;
    const trunk = app.trunks.main;

    // Which side is farther from the camera depends on torso rotation.
    const farIsLeft = p.torsoRot < 0;

    // Legs go down first, far side dimmed.
    this.drawLeg(ctx, p, o, m, farIsLeft ? 'L' : 'R', 0.72, lw);
    this.drawLeg(ctx, p, o, m, farIsLeft ? 'R' : 'L', 1, lw);

    this.drawTorso(ctx, p, o, m, skin, trunk, lw);
    this.drawHead(ctx, p, o, m, skin, lw);

    // Both arms draw over the torso and head. A guard held at the cheeks has
    // to show both gloves in front of the face, and a punch has to come
    // forward over everything — so arms are always the top layer.
    this.drawArm(ctx, p, o, m, farIsLeft ? 'L' : 'R', 0.78, lw, skin);
    this.drawArm(ctx, p, o, m, farIsLeft ? 'R' : 'L', 1, lw, skin);
  }

  // -- Legs ------------------------------------------------------------------

  private drawLeg(
    ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>,
    side: 'L' | 'R', depth: number, lw: number,
  ): void {
    const hip = p.hip;
    const knee = side === 'L' ? p.kneeL : p.kneeR;
    const foot = side === 'L' ? p.footL : p.footR;
    const app = this.app;
    const dim = depth < 1 ? 0.68 : 1;

    ctx.save();
    ctx.globalAlpha *= depth < 1 ? 0.94 : 1;

    const thighColor = shade(app.skin, dim * (o.flash > 0.01 ? 1.4 : 1));
    const w = m.legWidth;
    drawChain(ctx, [
      { x: hip.x + (side === 'L' ? w * 0.45 : -w * 0.45), y: hip.y },
      knee,
      { x: foot.x, y: foot.y - w * 0.5 },
    ], w * 1.5, thighColor, o.rim, lw);

    // Boot.
    ctx.beginPath();
    const bootDir = side === 'L' ? 1 : -1;
    ctx.moveTo(foot.x - w * 0.62, foot.y - w * 1.5);
    ctx.lineTo(foot.x + w * 0.62, foot.y - w * 1.5);
    ctx.lineTo(foot.x + w * 0.66 + bootDir * w * 0.5, foot.y);
    ctx.lineTo(foot.x - w * 0.9 + bootDir * w * 0.5, foot.y);
    ctx.closePath();
    const bg = ctx.createLinearGradient(foot.x, foot.y - w * 1.5, foot.x, foot.y);
    bg.addColorStop(0, tint(app.boots, 0.3));
    bg.addColorStop(1, shade(app.boots, 0.6 * dim));
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Laces.
    ctx.strokeStyle = rgba('#ffffff', 0.35 * dim);
    ctx.lineWidth = lw * 0.7;
    for (let i = 0; i < 3; i++) {
      const yy = foot.y - w * 1.3 + i * w * 0.42;
      ctx.beginPath();
      ctx.moveTo(foot.x - w * 0.4, yy);
      ctx.lineTo(foot.x + w * 0.4, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // -- Torso -----------------------------------------------------------------

  private drawTorso(
    ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>,
    skin: string, trunk: string, lw: number,
  ): void {
    const app = this.app;
    const sw = m.shoulderWidth;
    const hw = m.hipWidth;
    const gut = app.build.gut;
    const chestY = p.chest.y;
    const hipY = p.hip.y;
    const cx = p.chest.x;
    const hx = p.hip.x;
    // Waist sits between chest and hip; the gut pushes it out.
    const waistY = lerp(chestY, hipY, 0.58);
    const waistW = hw * (1.12 + gut * 0.95);

    // Silhouette: trapezius → upper chest → lat → waist → hips.
    // The torso stops short of the shoulder joints on purpose: the deltoid
    // caps drawn with the arms are what define the outer shoulder line. If the
    // torso reaches past them its corners stick out as stray flares.
    const pts: P2[] = [
      { x: cx + sw * 0.36, y: chestY - 0.32 },
      { x: cx + sw * 0.86, y: chestY - 0.16 },
      { x: cx + sw * 0.9, y: chestY + 0.22 },
      { x: hx + waistW, y: waistY },
      { x: hx + hw * 1.08, y: hipY + 0.12 },
      { x: hx - hw * 1.08, y: hipY + 0.12 },
      { x: hx - waistW, y: waistY },
      { x: cx - sw * 0.9, y: chestY + 0.22 },
      { x: cx - sw * 0.86, y: chestY - 0.16 },
      { x: cx - sw * 0.36, y: chestY - 0.32 },
    ];
    splinePath(ctx, pts, true);
    const g = ctx.createLinearGradient(cx - sw, chestY - 0.3, cx + sw * 0.8, hipY);
    g.addColorStop(0, tint(skin, 0.2));
    g.addColorStop(0.3, skin);
    g.addColorStop(1, shade(skin, 0.56));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Pectoral and ab definition — cheap, and it sells the "built" look.
    if (o.richShading) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = rgba('#000000', 0.16);
      ctx.lineWidth = lw * 0.9;
      // Sternum line and pec sweep.
      ctx.beginPath();
      ctx.moveTo(cx, chestY + 0.02);
      ctx.lineTo(cx, waistY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - sw * 0.74, chestY + 0.02);
      ctx.quadraticCurveTo(cx, chestY + 0.3, cx + sw * 0.74, chestY + 0.02);
      ctx.stroke();
      // A couple of ab creases, fading out on softer builds.
      ctx.globalAlpha *= 1 - gut * 0.8;
      for (let i = 1; i <= 2; i++) {
        const ay = lerp(chestY + 0.26, waistY, i / 3);
        ctx.beginPath();
        ctx.moveTo(cx - hw * 0.62, ay);
        ctx.quadraticCurveTo(cx, ay + 0.05, cx + hw * 0.62, ay);
        ctx.stroke();
      }
      ctx.globalAlpha /= Math.max(0.05, 1 - gut * 0.8);
      // Rim light down the key edge.
      ctx.strokeStyle = rgba(o.rim, 0.34);
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + sw * 0.94, chestY - 0.1);
      ctx.quadraticCurveTo(hx + waistW, waistY, hx + hw * 1.05, hipY);
      ctx.stroke();
      ctx.restore();
    }

    // Trunks.
    this.drawTrunks(ctx, p, m, trunk, lw);

    // Neck.
    drawChain(ctx, [{ x: p.chest.x, y: chestY - 0.06 }, p.neck], m.neckWidth * 2.1, shade(skin, 0.82), o.rim, lw);

    // Tattoo accessory rides on the shoulder.
    if (app.accessory === 'tattoo') {
      ctx.save();
      ctx.globalAlpha *= 0.65;
      ctx.fillStyle = app.accessoryColor ?? '#2b4a6f';
      starPath(ctx, cx + sw * 0.62, chestY + 0.26, 0.14, 0.06, 6);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + sw * 0.62, chestY + 0.26, 0.2, 0, Math.PI * 2);
      ctx.strokeStyle = app.accessoryColor ?? '#2b4a6f';
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
      ctx.restore();
    }
    if (app.accessory === 'chain') {
      ctx.strokeStyle = app.accessoryColor ?? '#f0c040';
      ctx.lineWidth = lw * 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - m.neckWidth * 1.4, p.neck.y + 0.06);
      ctx.quadraticCurveTo(cx, chestY + 0.3, cx + m.neckWidth * 1.4, p.neck.y + 0.06);
      ctx.stroke();
    }
  }

  private drawTrunks(ctx: Ctx, p: Pose, m: ReturnType<typeof metrics>, color: string, lw: number): void {
    const app = this.app;
    const hw = m.hipWidth;
    const hipY = p.hip.y;
    const hx = p.hip.x;
    const top = hipY - 0.2;
    const bot = hipY + 0.52;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(hx - hw * 1.12, top);
    ctx.quadraticCurveTo(hx, top - 0.08, hx + hw * 1.12, top);
    ctx.lineTo(hx + hw * 1.2, bot);
    ctx.quadraticCurveTo(hx, bot + 0.12, hx - hw * 1.2, bot);
    ctx.closePath();

    const g = ctx.createLinearGradient(hx - hw, top, hx + hw, bot);
    g.addColorStop(0, tint(color, 0.26));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, 0.58));
    ctx.fillStyle = g;
    ctx.fill();

    // Pattern, clipped to the trunks.
    ctx.save();
    ctx.clip();
    this.drawTrunkPattern(ctx, hx, top, bot, hw, lw);
    ctx.restore();

    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Waistband.
    ctx.beginPath();
    ctx.moveTo(hx - hw * 1.14, top + 0.04);
    ctx.quadraticCurveTo(hx, top - 0.04, hx + hw * 1.14, top + 0.04);
    ctx.strokeStyle = app.trunks.accent;
    ctx.lineWidth = lw * 3;
    ctx.stroke();
    ctx.strokeStyle = rgba('#000000', 0.4);
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
    ctx.restore();
  }

  private drawTrunkPattern(ctx: Ctx, hx: number, top: number, bot: number, hw: number, lw: number): void {
    const { pattern, accent } = this.app.trunks;
    ctx.fillStyle = accent;
    ctx.strokeStyle = accent;
    const h = bot - top;

    switch (pattern) {
      case 'stripe':
        ctx.lineWidth = hw * 0.3;
        for (const dx of [-0.62, 0.62]) {
          ctx.beginPath();
          ctx.moveTo(hx + hw * dx, top - 0.1);
          ctx.lineTo(hx + hw * dx * 1.15, bot + 0.1);
          ctx.stroke();
        }
        break;
      case 'flame':
        ctx.beginPath();
        ctx.moveTo(hx - hw * 1.3, bot + 0.1);
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          const x = hx - hw * 1.3 + t * hw * 2.6;
          const y = bot - h * (0.3 + Math.abs(Math.sin(t * Math.PI * 2.4)) * 0.55);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(hx + hw * 1.3, bot + 0.1);
        ctx.closePath();
        ctx.fill();
        break;
      case 'stars':
        for (let i = 0; i < 3; i++) {
          starPath(ctx, hx + (i - 1) * hw * 0.7, top + h * 0.45, hw * 0.26, hw * 0.11);
          ctx.fill();
        }
        break;
      case 'zigzag':
        ctx.lineWidth = hw * 0.22;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const x = hx - hw * 1.3 + (i / 8) * hw * 2.6;
          const y = top + h * (i % 2 === 0 ? 0.35 : 0.65);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      case 'check':
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
            if ((r + c) % 2) continue;
            ctx.fillRect(hx - hw * 1.3 + c * hw * 0.54, top + r * h * 0.36, hw * 0.54, h * 0.36);
          }
        }
        break;
      case 'waves':
        ctx.lineWidth = hw * 0.16;
        for (let r = 0; r < 3; r++) {
          ctx.beginPath();
          for (let i = 0; i <= 10; i++) {
            const x = hx - hw * 1.3 + (i / 10) * hw * 2.6;
            const y = top + h * (0.28 + r * 0.24) + Math.sin(i * 0.9) * h * 0.07;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      case 'split':
        ctx.fillRect(hx, top - 0.2, hw * 1.5, h + 0.4);
        break;
      default:
        break;
    }
    void lw;
  }

  // -- Arms ------------------------------------------------------------------

  private drawArm(
    ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>,
    side: 'L' | 'R', depth: number, lw: number, skin: string,
  ): void {
    const shoulder = side === 'L' ? p.shoulderL : p.shoulderR;
    const elbow = side === 'L' ? p.elbowL : p.elbowR;
    const glove = side === 'L' ? p.gloveL : p.gloveR;
    const gscale = side === 'L' ? p.gloveScaleL : p.gloveScaleR;
    const app = this.app;

    ctx.save();
    if (depth < 1) ctx.globalAlpha *= 0.92;
    const dim = depth < 1 ? 0.72 : 1;
    const armColor = depth < 1 ? shade(skin, dim) : skin;
    const w = m.limbWidth;

    // One continuous stroke from shoulder through elbow to wrist.
    drawChain(ctx, [shoulder, elbow, { x: glove.x, y: glove.y + m.gloveRadius * 0.55 }],
      w * 2.0, armColor, o.rim, lw);

    // Deltoid cap on top, so the shoulder reads as mass rather than a hinge.
    blobPath(ctx, shoulder.x, shoulder.y, w * 1.9, w * 1.72);
    fillForm(ctx, armColor, shoulder.x, shoulder.y, w * 1.8, o.rim, lw, o.richShading);

    // Hand wrap between forearm and glove.
    if (app.accessory === 'tape') {
      ctx.save();
      ctx.strokeStyle = rgba(app.accessoryColor ?? '#ffffff', 0.8 * dim);
      ctx.lineWidth = w * 0.5;
      ctx.beginPath();
      const mx = lerp(elbow.x, glove.x, 0.72), my = lerp(elbow.y, glove.y, 0.72);
      ctx.moveTo(mx, my);
      ctx.lineTo(lerp(elbow.x, glove.x, 0.88), lerp(elbow.y, glove.y, 0.88));
      ctx.stroke();
      ctx.restore();
    }

    this.drawGlove(ctx, glove.x, glove.y, m.gloveRadius * gscale, dim, o, lw, side);
    ctx.restore();
  }

  private drawGlove(
    ctx: Ctx, x: number, y: number, r: number, dim: number,
    o: FighterDrawOptions, lw: number, side: 'L' | 'R',
  ): void {
    const g = this.app.gloves;
    const main = o.flash > 0.01 ? tint(g.main, o.flash * 0.6) : shade(g.main, dim);

    // Cuff.
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.82, r * 0.72, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(g.accent, dim * 0.9);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Mitt.
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.06, r, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.08, x, y, r * 1.3);
    grad.addColorStop(0, tint(main, 0.42));
    grad.addColorStop(0.38, main);
    grad.addColorStop(1, shade(main, 0.52));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw * 1.1;
    ctx.stroke();

    // Thumb.
    const tdir = side === 'L' ? -1 : 1;
    ctx.beginPath();
    ctx.ellipse(x + tdir * r * 0.72, y + r * 0.24, r * 0.34, r * 0.44, tdir * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = shade(main, 0.82);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw * 0.9;
    ctx.stroke();

    // Knuckle seam + specular. This is what makes the glove read as leather.
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.1, r * 0.66, r * 0.5, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.strokeStyle = rgba('#000000', 0.28);
    ctx.lineWidth = lw * 0.9;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x - r * 0.36, y - r * 0.42, r * 0.3, r * 0.19, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#ffffff', 0.44 * dim);
    ctx.fill();
  }

  // -- Head ------------------------------------------------------------------

  private drawHead(
    ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>,
    skin: string, lw: number,
  ): void {
    const app = this.app;
    const r = m.headRadius;
    const hx = p.head.x, hy = p.head.y;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headRot);

    // Skull: an egg, widened or narrowed by the jaw parameter.
    const jaw = app.face.jaw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.98, -r * 0.18);
    ctx.quadraticCurveTo(-r * 1.02, -r * 1.06, 0, -r * 1.1);
    ctx.quadraticCurveTo(r * 1.02, -r * 1.06, r * 0.98, -r * 0.18);
    ctx.quadraticCurveTo(r * 0.96 * jaw, r * 0.72, 0, r * 0.96);
    ctx.quadraticCurveTo(-r * 0.96 * jaw, r * 0.72, -r * 0.98, -r * 0.18);
    ctx.closePath();
    const g = ctx.createRadialGradient(-r * 0.34, -r * 0.46, r * 0.1, 0, 0, r * 1.5);
    g.addColorStop(0, tint(skin, 0.19));
    g.addColorStop(0.34, skin);
    g.addColorStop(1, shade(skin, 0.56));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Ears.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.98, r * 0.06, r * 0.16, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fillStyle = shade(skin, 0.85);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
    }

    if (o.showFace) this.drawFace(ctx, p, o, r, lw, skin);
    else this.drawBackOfHead(ctx, r, lw, skin);

    this.drawHair(ctx, r, lw, o.showFace);
    this.drawHeadAccessory(ctx, r, lw, o);

    // Rim light on the skull edge.
    if (o.richShading) {
      ctx.beginPath();
      ctx.moveTo(r * 0.9, -r * 0.5);
      ctx.quadraticCurveTo(r * 1.0, r * 0.1, r * 0.6, r * 0.72);
      ctx.strokeStyle = rgba(o.rim, 0.4);
      ctx.lineWidth = lw * 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBackOfHead(ctx: Ctx, r: number, lw: number, skin: string): void {
    // Occipital shading and a neck crease — enough to read as "from behind".
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.1, r * 0.72, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(shade(skin, 0.86), 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, r * 0.72);
    ctx.quadraticCurveTo(0, r * 0.86, r * 0.4, r * 0.72);
    ctx.strokeStyle = rgba('#000000', 0.22);
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  private drawFace(ctx: Ctx, p: Pose, o: FighterDrawOptions, r: number, lw: number, skin: string): void {
    const f = this.app.face;
    const eyeY = -r * 0.12;
    const eyeX = r * 0.4;
    const eyeR = r * 0.2 * f.eyeSize;
    const squint = clamp01(Math.max(p.squint, o.stun * 0.3));
    const open = 1 - squint * 0.9;

    // --- Eyes ---
    for (const s of [-1, 1]) {
      const ex = s * eyeX;
      // Socket shadow.
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeR * 1.35, eyeR * 1.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(shade(skin, 0.7), 0.45);
      ctx.fill();

      if (o.stun > 0.5) {
        // Dazed: spiralling eyes. Unambiguous "hit me now" signal.
        ctx.strokeStyle = '#2a2030';
        ctx.lineWidth = lw * 1.2;
        ctx.beginPath();
        for (let i = 0; i <= 26; i++) {
          const t = i / 26;
          const a = t * Math.PI * 4 + o.time * 6;
          const rr = t * eyeR * 1.15;
          const px = ex + Math.cos(a) * rr;
          const py = eyeY + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeR * 1.05, eyeR * open, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#f6f2ee';
      ctx.fillRect(ex - eyeR * 1.2, eyeY - eyeR * 1.2, eyeR * 2.4, eyeR * 2.4);
      // Iris tracks slightly toward the camera-centre for engagement.
      const ix = ex - s * eyeR * 0.12;
      ctx.beginPath();
      ctx.arc(ix, eyeY + eyeR * 0.08, eyeR * 0.52, 0, Math.PI * 2);
      ctx.fillStyle = '#3a2a1e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ix, eyeY + eyeR * 0.08, eyeR * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = '#120c10';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ix - eyeR * 0.2, eyeY - eyeR * 0.18, eyeR * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeR * 1.05, eyeR * open, 0, 0, Math.PI * 2);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = lw * 0.85;
      ctx.stroke();
    }

    // --- Telegraph eye flash ---
    if (o.tell > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) {
        const grd = ctx.createRadialGradient(s * eyeX, eyeY, 0, s * eyeX, eyeY, eyeR * 3.4);
        grd.addColorStop(0, rgba(o.tellColor, 0.95 * o.tell));
        grd.addColorStop(1, rgba(o.tellColor, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(s * eyeX, eyeY, eyeR * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- Brows ---
    const angry = clamp01(p.brow);
    const ba = f.browAngle - angry * 0.5;
    ctx.strokeStyle = this.app.hair.color;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const bx = s * eyeX;
      const by = eyeY - eyeR * (1.5 + angry * 0.25);
      ctx.beginPath();
      ctx.moveTo(bx - s * eyeR * 0.95, by - s * -ba * eyeR * 1.4);
      ctx.lineTo(bx + s * eyeR * 0.95, by + s * -ba * eyeR * 1.4);
      ctx.stroke();
    }

    // --- Nose ---
    const nr = r * 0.17 * f.noseSize;
    ctx.beginPath();
    ctx.moveTo(-nr * 0.6, r * 0.24);
    ctx.quadraticCurveTo(0, r * 0.34, nr * 0.6, r * 0.24);
    ctx.quadraticCurveTo(nr * 0.5, r * 0.08, 0, r * 0.04);
    ctx.quadraticCurveTo(-nr * 0.5, r * 0.08, -nr * 0.6, r * 0.24);
    ctx.closePath();
    ctx.fillStyle = shade(skin, 0.88);
    ctx.fill();
    ctx.strokeStyle = rgba('#000000', 0.35);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();

    // --- Mouth ---
    const mo = clamp01(p.mouth);
    const mw = r * 0.42 * f.mouth;
    const my = r * 0.55;
    ctx.beginPath();
    if (mo > 0.16) {
      ctx.ellipse(0, my + mo * r * 0.08, mw * (0.8 + mo * 0.3), r * 0.1 + mo * r * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#40141c';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = lw * 0.9;
      ctx.stroke();
      // Teeth catch the light.
      ctx.beginPath();
      ctx.ellipse(0, my - r * 0.04 - mo * r * 0.1, mw * 0.72, r * 0.07, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f4efe6';
      ctx.fill();
    } else {
      ctx.moveTo(-mw, my);
      ctx.quadraticCurveTo(0, my + r * 0.1 * (1 - angry * 2), mw, my);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = lw * 1.3;
      ctx.stroke();
    }

    this.drawFacialHair(ctx, r, lw, my, mw);

    // Battle damage: a cut opens up as health drops (driven by flash/gassed).
    if (o.gassed > 0.35) {
      ctx.strokeStyle = 'rgba(150,26,36,0.75)';
      ctx.lineWidth = lw * 1.4;
      ctx.beginPath();
      ctx.moveTo(-eyeX - eyeR * 0.6, eyeY - eyeR * 1.9);
      ctx.lineTo(-eyeX + eyeR * 0.2, eyeY - eyeR * 1.2);
      ctx.stroke();
    }
  }

  private drawFacialHair(ctx: Ctx, r: number, lw: number, my: number, mw: number): void {
    const app = this.app;
    if (app.facialHair === 'none') return;
    const col = app.facialHairColor ?? app.hair.color;
    ctx.fillStyle = col;
    ctx.strokeStyle = col;

    switch (app.facialHair) {
      case 'stubble':
        ctx.save();
        ctx.globalAlpha *= 0.32;
        ctx.beginPath();
        ctx.ellipse(0, my + r * 0.1, mw * 1.9, r * 0.42, 0, 0, Math.PI);
        ctx.fill();
        ctx.restore();
        break;
      case 'mustache':
        ctx.beginPath();
        ctx.ellipse(0, my - r * 0.12, mw * 1.35, r * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'goatee':
        ctx.beginPath();
        ctx.ellipse(0, my + r * 0.3, mw * 0.7, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, my - r * 0.12, mw * 1.2, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'beard':
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, r * 0.02);
        ctx.quadraticCurveTo(-r * 0.8, r * 1.35, 0, r * 1.35);
        ctx.quadraticCurveTo(r * 0.8, r * 1.35, r * 0.95, r * 0.02);
        ctx.quadraticCurveTo(r * 0.6, r * 0.5, 0, r * 0.48);
        ctx.quadraticCurveTo(-r * 0.6, r * 0.5, -r * 0.95, r * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = lw * 0.8;
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, my - r * 0.14, mw * 1.3, r * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'muttonchops':
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.95, -r * 0.2);
          ctx.quadraticCurveTo(s * r * 1.05, r * 0.7, s * r * 0.45, r * 0.62);
          ctx.quadraticCurveTo(s * r * 0.72, r * 0.2, s * r * 0.78, -r * 0.2);
          ctx.closePath();
          ctx.fill();
        }
        break;
    }
  }

  private drawHair(ctx: Ctx, r: number, lw: number, front: boolean): void {
    const { style, color } = this.app.hair;
    if (style === 'bald') {
      // A highlight arc still reads as a shaved head under stage lights.
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, -r * 0.6, r * 0.34, r * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fill();
      return;
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;

    switch (style) {
      case 'buzz':
        ctx.beginPath();
        ctx.moveTo(-r * 1.0, -r * 0.3);
        ctx.quadraticCurveTo(-r * 1.06, -r * 1.16, 0, -r * 1.2);
        ctx.quadraticCurveTo(r * 1.06, -r * 1.16, r * 1.0, -r * 0.3);
        ctx.quadraticCurveTo(r * 0.6, -r * 0.62, 0, -r * 0.58);
        ctx.quadraticCurveTo(-r * 0.6, -r * 0.62, -r * 1.0, -r * 0.3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'afro':
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = Math.PI + (i / 16) * Math.PI;
          const rr = r * (1.42 + Math.sin(i * 2.3) * 0.08);
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr * 1.05 - r * 0.1;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'mohawk':
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, -r * 1.05);
        for (let i = 0; i <= 5; i++) {
          const t = i / 5;
          ctx.lineTo(-r * 0.2 + t * r * 0.4, -r * (1.3 + Math.sin(t * Math.PI) * 0.55));
        }
        ctx.lineTo(r * 0.22, -r * 1.05);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'flattop':
        ctx.beginPath();
        ctx.moveTo(-r * 1.02, -r * 0.45);
        ctx.lineTo(-r * 1.02, -r * 1.28);
        ctx.lineTo(r * 1.02, -r * 1.28);
        ctx.lineTo(r * 1.02, -r * 0.45);
        ctx.quadraticCurveTo(0, -r * 0.72, -r * 1.02, -r * 0.45);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'long':
        ctx.beginPath();
        ctx.moveTo(-r * 1.04, -r * 0.5);
        ctx.quadraticCurveTo(-r * 1.1, -r * 1.2, 0, -r * 1.24);
        ctx.quadraticCurveTo(r * 1.1, -r * 1.2, r * 1.04, -r * 0.5);
        ctx.quadraticCurveTo(r * 1.3, r * 0.9, r * 0.82, r * 1.0);
        ctx.quadraticCurveTo(r * 0.9, r * 0.1, r * 0.86, -r * 0.3);
        ctx.quadraticCurveTo(0, -r * 0.66, -r * 0.86, -r * 0.3);
        ctx.quadraticCurveTo(-r * 0.9, r * 0.1, -r * 0.82, r * 1.0);
        ctx.quadraticCurveTo(-r * 1.3, r * 0.9, -r * 1.04, -r * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'topknot':
        ctx.beginPath();
        ctx.ellipse(0, -r * 1.32, r * 0.32, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 1.0, -r * 0.4);
        ctx.quadraticCurveTo(0, -r * 1.24, r * 1.0, -r * 0.4);
        ctx.quadraticCurveTo(0, -r * 0.78, -r * 1.0, -r * 0.4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'curls':
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.98, Math.sin(a) * r * 1.0 - r * 0.08, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'braids':
        ctx.beginPath();
        ctx.moveTo(-r * 1.02, -r * 0.4);
        ctx.quadraticCurveTo(0, -r * 1.28, r * 1.02, -r * 0.4);
        ctx.quadraticCurveTo(0, -r * 0.82, -r * 1.02, -r * 0.4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        if (!front) {
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(i * r * 0.34, -r * 0.8);
            ctx.quadraticCurveTo(i * r * 0.42, r * 0.4, i * r * 0.3, r * 1.3);
            ctx.strokeStyle = color;
            ctx.lineWidth = r * 0.16;
            ctx.stroke();
          }
        }
        break;
      case 'ponytail':
        ctx.beginPath();
        ctx.moveTo(-r * 1.02, -r * 0.4);
        ctx.quadraticCurveTo(0, -r * 1.3, r * 1.02, -r * 0.4);
        ctx.quadraticCurveTo(0, -r * 0.8, -r * 1.02, -r * 0.4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.9, -r * 0.55);
        ctx.quadraticCurveTo(r * 1.5, r * 0.1, r * 1.12, r * 0.86);
        ctx.quadraticCurveTo(r * 1.1, r * 0.1, r * 0.76, -r * 0.3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'pompadour':
        ctx.beginPath();
        ctx.moveTo(-r * 1.0, -r * 0.4);
        ctx.quadraticCurveTo(-r * 1.2, -r * 1.5, 0, -r * 1.46);
        ctx.quadraticCurveTo(r * 1.16, -r * 1.4, r * 1.0, -r * 0.4);
        ctx.quadraticCurveTo(0, -r * 0.78, -r * 1.0, -r * 0.4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'shaggy':
      default:
        ctx.beginPath();
        ctx.moveTo(-r * 1.06, -r * 0.28);
        ctx.quadraticCurveTo(-r * 1.16, -r * 1.2, 0, -r * 1.26);
        ctx.quadraticCurveTo(r * 1.16, -r * 1.2, r * 1.06, -r * 0.28);
        for (let i = 4; i >= 0; i--) {
          const t = i / 4;
          const x = -r * 1.0 + t * r * 2.0;
          ctx.lineTo(x, -r * (0.52 + (i % 2 === 0 ? 0.18 : 0)));
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
    }

    // Sheen across the hair mass.
    ctx.save();
    ctx.globalAlpha *= 0.22;
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.92, r * 0.38, r * 0.13, -0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  private drawHeadAccessory(ctx: Ctx, r: number, lw: number, o: FighterDrawOptions): void {
    const { accessory, accessoryColor } = this.app;
    const col = accessoryColor ?? '#ffffff';
    switch (accessory) {
      case 'headband':
        ctx.beginPath();
        ctx.moveTo(-r * 1.06, -r * 0.56);
        ctx.quadraticCurveTo(0, -r * 0.9, r * 1.06, -r * 0.56);
        ctx.lineTo(r * 1.06, -r * 0.26);
        ctx.quadraticCurveTo(0, -r * 0.6, -r * 1.06, -r * 0.26);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = lw;
        ctx.stroke();
        // Tails trailing behind the head.
        ctx.beginPath();
        ctx.moveTo(-r * 1.0, -r * 0.4);
        ctx.quadraticCurveTo(-r * 1.6, -r * 0.1 + Math.sin(o.time * 6) * r * 0.2, -r * 1.8, r * 0.3);
        ctx.strokeStyle = col;
        ctx.lineWidth = r * 0.14;
        ctx.stroke();
        break;
      case 'shades':
        ctx.fillStyle = col;
        roundRect(ctx, -r * 0.92, -r * 0.38, r * 0.82, r * 0.46, r * 0.14);
        ctx.fill();
        roundRect(ctx, r * 0.1, -r * 0.38, r * 0.82, r * 0.46, r * 0.14);
        ctx.fill();
        ctx.fillRect(-r * 0.12, -r * 0.26, r * 0.24, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(-r * 0.86, -r * 0.3);
        ctx.lineTo(-r * 0.5, -r * 0.06);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = lw * 1.5;
        ctx.stroke();
        break;
      case 'crown':
        ctx.beginPath();
        ctx.moveTo(-r * 0.76, -r * 1.06);
        ctx.lineTo(-r * 0.76, -r * 1.44);
        ctx.lineTo(-r * 0.38, -r * 1.2);
        ctx.lineTo(0, -r * 1.58);
        ctx.lineTo(r * 0.38, -r * 1.2);
        ctx.lineTo(r * 0.76, -r * 1.44);
        ctx.lineTo(r * 0.76, -r * 1.06);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      case 'facepaint':
        ctx.save();
        ctx.globalAlpha *= 0.85;
        ctx.fillStyle = col;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.18, -r * 0.42);
          ctx.lineTo(s * r * 0.72, -r * 0.5);
          ctx.lineTo(s * r * 0.6, r * 0.34);
          ctx.lineTo(s * r * 0.3, r * 0.12);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      case 'scar':
        ctx.strokeStyle = 'rgba(190,120,110,0.85)';
        ctx.lineWidth = lw * 1.4;
        ctx.beginPath();
        ctx.moveTo(r * 0.32, -r * 0.62);
        ctx.lineTo(r * 0.52, r * 0.12);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(r * (0.3 + i * 0.06) - r * 0.1, -r * (0.5 - i * 0.22));
          ctx.lineTo(r * (0.3 + i * 0.06) + r * 0.14, -r * (0.54 - i * 0.22));
          ctx.stroke();
        }
        break;
      case 'mask':
        ctx.beginPath();
        ctx.moveTo(-r * 1.0, -r * 0.42);
        ctx.quadraticCurveTo(0, -r * 0.74, r * 1.0, -r * 0.42);
        ctx.lineTo(r * 0.9, r * 0.18);
        ctx.quadraticCurveTo(0, r * 0.02, -r * 0.9, r * 0.18);
        ctx.closePath();
        ctx.fillStyle = 'rgba(14,14,18,0.78)';
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = lw * 1.4;
        ctx.stroke();
        break;
      case 'eyepatch':
        ctx.beginPath();
        ctx.ellipse(-r * 0.42, -r * 0.12, r * 0.3, r * 0.26, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#15121a';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, -r * 0.34);
        ctx.lineTo(r * 1.0, -r * 0.56);
        ctx.strokeStyle = '#15121a';
        ctx.lineWidth = lw * 1.6;
        ctx.stroke();
        break;
      default:
        break;
    }
  }

  // -- Effects ---------------------------------------------------------------

  private drawRageAura(
    ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>, u: number,
  ): void {
    const cx = o.x + p.offset.x * u * o.facing;
    const cy = o.y - m.height * u * 0.5;
    const r = m.height * u * 0.72;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, r * 0.42, cx, cy, r);
    g.addColorStop(0, rgba(this.app.glow, 0));
    g.addColorStop(0.7, rgba(this.app.glow, 0.13 * o.rage));
    g.addColorStop(1, rgba(this.app.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Rising embers.
    for (let i = 0; i < 7; i++) {
      const t = (o.time * 0.9 + i * 0.19) % 1;
      const a = (i / 7) * Math.PI * 2;
      const px = cx + Math.cos(a) * r * 0.5 * (1 - t * 0.3);
      const py = cy + r * 0.65 - t * r * 1.25;
      ctx.globalAlpha = (1 - t) * 0.65 * o.rage;
      ctx.fillStyle = this.app.glow;
      ctx.beginPath();
      ctx.arc(px, py, u * 0.05 * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSweat(ctx: Ctx, p: Pose, o: FighterDrawOptions, u: number): void {
    const cx = o.x + p.offset.x * u * o.facing;
    ctx.save();
    ctx.fillStyle = 'rgba(190,230,255,0.75)';
    for (let i = 0; i < 5; i++) {
      const t = (o.time * 1.5 + i * 0.23) % 1;
      const side = i % 2 ? 1 : -1;
      const px = cx + side * u * (0.3 + i * 0.07) + Math.sin(o.time * 3 + i) * u * 0.05;
      const py = o.y + (p.head.y + t * 1.1) * u;
      ctx.globalAlpha = (1 - t) * 0.8 * o.gassed;
      ctx.beginPath();
      ctx.ellipse(px, py, u * 0.032, u * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawReflection(
    ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>, u: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = o.alpha * 0.17;
    ctx.translate(o.x + p.offset.x * u * o.facing, o.y + 2);
    ctx.scale(o.facing * u, -u * 0.42);
    ctx.filter = 'blur(2px)';
    // A cheap silhouette is enough: a mirrored body reads as a wet-canvas sheen.
    ctx.fillStyle = 'rgba(10,10,20,0.9)';
    ctx.beginPath();
    ctx.ellipse(0, -m.height * 0.4, m.torsoWidth * 1.3, m.height * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.head.x, p.head.y, m.headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  }
}

export { setShadow, clearShadow };
