import type { Appearance } from '../data/types';
import type { Pose } from '../anim/Pose';
import { metrics } from '../anim/Pose';
import { clamp01, lerp } from '../core/MathUtil';
import {
  blobPath, capsule, celShadow, chainShade, Ctx, darken, ink, inkChain,
  INK, LINE, lighten, oval, starPath,
} from './Cel';

export interface FighterDrawOptions {
  /** Screen position of the fighter's feet. */
  x: number;
  y: number;
  /** Pixels per local unit. */
  unit: number;
  /** +1 draws the fighter's right on screen right (back view / player). */
  facing: 1 | -1;
  /** True when the face should be drawn (the opponent faces the camera). */
  showFace: boolean;
  /** 0..1 white hit flash. */
  flash: number;
  /** 0..1 telegraph emphasis — drives the eye flash only. */
  tell: number;
  tellColor: string;
  /** 0..1 rage. */
  rage: number;
  /** 0..1 dizzy — swaps the eyes for spirals. */
  stun: number;
  /** 0..1 exhaustion — opens the mouth, adds sweat. */
  gassed: number;
  /** 0..1 hurt — bruising and a wince. */
  hurt: number;
  alpha: number;
  /** Seconds, for idle jitter. */
  time: number;
}

/**
 * Draws a fighter as FLAT CEL ARTWORK.
 *
 * Every form here is a flat colour with a hard contour and at most one
 * hard-edged shadow. There is deliberately not a single gradient, glow, blur
 * or rim light on any part of a character — those are what made the previous
 * renderer look airbrushed instead of drawn. See `Cel.ts` for the house rules.
 *
 * Nothing is a sprite: the whole figure is generated from the `Appearance`
 * spec, which is how sixteen boxers get genuinely different silhouettes with
 * no image assets at all.
 */
export class FighterRenderer {
  constructor(private app: Appearance) {}

  setAppearance(app: Appearance): void { this.app = app; }

  draw(ctx: Ctx, p: Pose, o: FighterDrawOptions): void {
    const m = metrics(this.app);
    const u = o.unit * p.scale;

    ctx.save();
    ctx.globalAlpha = o.alpha;

    // Flat contact shadow on the canvas, drawn in world space.
    celShadow(ctx, o.x + p.offset.x * u * o.facing, o.y + 3,
      u * m.torsoWidth * 1.5, u * m.torsoWidth * 0.32, 0.26);

    ctx.translate(o.x + p.offset.x * u * o.facing, o.y + p.offset.y * u);
    if (p.rot !== 0) ctx.rotate(p.rot * o.facing);
    ctx.scale(o.facing * u, u);

    this.drawFigure(ctx, p, o, m);
    ctx.restore();

    if (o.gassed > 0.06) this.drawSweat(ctx, p, o, u);
  }

  // -- Whole figure ----------------------------------------------------------

  private drawFigure(ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>): void {
    // Light sits upper-left in SCREEN space, so the local shade side has to
    // flip with the fighter's facing or the two would be lit from opposite
    // directions in the same ring.
    const shadeSide: -1 | 1 = o.facing > 0 ? 1 : -1;
    const skin = o.flash > 0.01 ? lighten(this.app.skin, o.flash * 0.55) : this.app.skin;
    const skinShade = darken(skin, 0.78);

    // Which arm is further from camera follows the torso twist.
    const farIsLeft = p.torsoRot < 0;

    this.drawLeg(ctx, p, m, farIsLeft ? 'L' : 'R', true, shadeSide);
    this.drawLeg(ctx, p, m, farIsLeft ? 'R' : 'L', false, shadeSide);
    this.drawTrunks(ctx, p, m, shadeSide);
    this.drawTorso(ctx, p, o, m, skin, skinShade, shadeSide);
    this.drawNeck(ctx, p, m, skinShade);
    this.drawHead(ctx, p, o, m, skin, skinShade, shadeSide);

    // Arms sit on top of everything: a high guard must show both gloves in
    // front of the face, and a punch must come forward over the whole figure.
    this.drawArm(ctx, p, m, farIsLeft ? 'L' : 'R', true, skin, skinShade, shadeSide);
    this.drawArm(ctx, p, m, farIsLeft ? 'R' : 'L', false, skin, skinShade, shadeSide);
  }

  // -- Legs ------------------------------------------------------------------

  private drawLeg(
    ctx: Ctx, p: Pose, m: ReturnType<typeof metrics>,
    side: 'L' | 'R', far: boolean, shadeSide: -1 | 1,
  ): void {
    const hip = p.hip;
    const knee = side === 'L' ? p.kneeL : p.kneeR;
    const foot = side === 'L' ? p.footL : p.footR;
    const a = this.app;
    const w = m.legWidth;
    const base = far ? darken(a.skin, 0.9) : a.skin;

    // The ankle, not the sole, is where the leg ends. Drawing the leg all the
    // way to the floor and then putting a boot over it is what turned the
    // boots into a skirt: the boot has to be a small shape at the bottom of a
    // long leg, never the other way round.
    const ankleY = foot.y - w * 0.62;
    const shin = { x: foot.x, y: ankleY };
    const chain = [
      { x: hip.x + (side === 'L' ? w * 0.4 : -w * 0.4), y: hip.y },
      knee,
      shin,
    ];
    inkChain(ctx, chain, w * 1.34, base);
    chainShade(ctx, chain, w * 1.34, darken(base, 0.82), shadeSide);

    const dir = side === 'L' ? 1 : -1;
    const boot = far ? darken(a.boots, 0.9) : a.boots;
    // Ankle-height. A tall shaft turns the lower half of a dark-booted boxer
    // into one black slab with no leg in it.
    const bootTop = ankleY - w * 0.44;
    // High-top shaft, drawn at leg width so the silhouette stays a leg.
    const t = (bootTop - knee.y) / ((shin.y - knee.y) || 1e-4);
    const shaft = [
      { x: lerp(knee.x, shin.x, t), y: bootTop },
      shin,
    ];
    inkChain(ctx, shaft, w * 1.38, boot);
    chainShade(ctx, shaft, w * 1.38, darken(boot, 0.74), shadeSide);

    // Foot: a short wedge with the toe pointing the way the fighter faces.
    ctx.beginPath();
    ctx.moveTo(foot.x - w * 0.62, ankleY);
    ctx.lineTo(foot.x + w * 0.62, ankleY);
    ctx.lineTo(foot.x + w * 0.6 + dir * w * 0.42, foot.y);
    ctx.lineTo(foot.x - w * 0.68 + dir * w * 0.42, foot.y);
    ctx.closePath();
    ink(ctx, boot);

    // Two lace bars. Flat, no highlights.
    ctx.strokeStyle = lighten(boot, 0.55);
    ctx.lineWidth = LINE * 0.9;
    for (let i = 0; i < 2; i++) {
      const yy = bootTop + w * 0.2 + i * w * 0.3;
      ctx.beginPath();
      ctx.moveTo(foot.x - w * 0.36, yy);
      ctx.lineTo(foot.x + w * 0.36, yy);
      ctx.stroke();
    }
  }

  // -- Trunks ----------------------------------------------------------------

  private drawTrunks(ctx: Ctx, p: Pose, m: ReturnType<typeof metrics>, shadeSide: -1 | 1): void {
    const t = this.app.trunks;
    const hw = m.hipWidth;
    const hy = p.hip.y;
    const hx = p.hip.x;
    const top = hy - 0.3;
    const bot = hy + 0.28;

    // Deliberately baggy. Trunks are one of the biggest shapes in a boxer's
    // silhouette and one of the easiest ways to tell two fighters apart.
    const build = () => {
      ctx.beginPath();
      ctx.moveTo(hx - hw * 1.3, top);
      ctx.quadraticCurveTo(hx, top - 0.08, hx + hw * 1.3, top);
      ctx.quadraticCurveTo(hx + hw * 1.92, lerp(top, bot, 0.62), hx + hw * 1.68, bot);
      ctx.quadraticCurveTo(hx, bot + 0.02, hx - hw * 1.68, bot);
      ctx.quadraticCurveTo(hx - hw * 1.92, lerp(top, bot, 0.62), hx - hw * 1.3, top);
      ctx.closePath();
    };

    ctx.save();
    build();
    ctx.fillStyle = t.main;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Hard cel shadow down one side.
    ctx.fillStyle = darken(t.main, 0.78);
    const sw = hw * 1.05;
    ctx.fillRect(shadeSide > 0 ? hx + hw * 1.92 - sw : hx - hw * 1.92, top - 0.14, sw, (bot - top) + 0.4);
    this.drawTrunkPattern(ctx, hx, top, bot, hw * 1.35);
    ctx.restore();
    build();
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // Waistband: a solid bar, inked.
    ctx.beginPath();
    ctx.moveTo(hx - hw * 1.32, top + 0.02);
    ctx.quadraticCurveTo(hx, top - 0.07, hx + hw * 1.32, top + 0.02);
    ctx.lineTo(hx + hw * 1.32, top + 0.2);
    ctx.quadraticCurveTo(hx, top + 0.11, hx - hw * 1.32, top + 0.2);
    ctx.closePath();
    ink(ctx, t.accent);
  }

  private drawTrunkPattern(ctx: Ctx, hx: number, top: number, bot: number, hw: number): void {
    const { pattern, accent } = this.app.trunks;
    const h = bot - top;
    ctx.fillStyle = accent;
    ctx.strokeStyle = accent;

    switch (pattern) {
      case 'stripe':
        ctx.lineWidth = hw * 0.3;
        for (const dx of [-0.6, 0.6]) {
          ctx.beginPath();
          ctx.moveTo(hx + hw * dx, top - 0.1);
          ctx.lineTo(hx + hw * dx * 1.16, bot + 0.12);
          ctx.stroke();
        }
        break;
      case 'flame':
        ctx.beginPath();
        ctx.moveTo(hx - hw * 1.4, bot + 0.12);
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          ctx.lineTo(hx - hw * 1.4 + t * hw * 2.8,
            bot - h * (0.25 + Math.abs(Math.sin(t * Math.PI * 2.2)) * 0.5));
        }
        ctx.lineTo(hx + hw * 1.4, bot + 0.12);
        ctx.closePath();
        ctx.fill();
        break;
      case 'stars':
        for (let i = -1; i <= 1; i++) {
          starPath(ctx, hx + i * hw * 0.72, top + h * 0.5, hw * 0.28, hw * 0.12);
          ctx.fill();
        }
        break;
      case 'zigzag':
        ctx.lineWidth = hw * 0.22;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const x = hx - hw * 1.4 + (i / 8) * hw * 2.8;
          const y = top + h * (i % 2 === 0 ? 0.34 : 0.66);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      case 'check':
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 6; c++) {
            if ((r + c) % 2) continue;
            ctx.fillRect(hx - hw * 1.4 + c * hw * 0.48, top + r * h * 0.36, hw * 0.48, h * 0.36);
          }
        }
        break;
      case 'waves':
        ctx.lineWidth = hw * 0.16;
        for (let r = 0; r < 3; r++) {
          ctx.beginPath();
          for (let i = 0; i <= 10; i++) {
            const x = hx - hw * 1.4 + (i / 10) * hw * 2.8;
            const y = top + h * (0.25 + r * 0.24) + Math.sin(i * 0.9) * h * 0.06;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      case 'split':
        ctx.fillRect(hx, top - 0.2, hw * 1.6, h + 0.5);
        break;
      default:
        break;
    }
  }

  // -- Torso -----------------------------------------------------------------

  private drawTorso(
    ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>,
    skin: string, skinShade: string, shadeSide: -1 | 1,
  ): void {
    const sw = m.shoulderWidth;
    const hw = m.hipWidth;
    const gut = this.app.build.gut;
    const cy = p.chest.y, hy = p.hip.y, cx = p.chest.x, hx = p.hip.x;
    const waistY = lerp(cy, hy, 0.6);
    // Deliberately narrower than the shoulders: the V-taper is what makes a
    // figure read as a boxer instead of a barrel.
    const waistW = hw * (0.86 + gut * 0.95);

    // The torso stops inside the shoulder joints on purpose: the deltoid caps
    // drawn with the arms define the outer shoulder line. If the torso reached
    // past them, its corners would stick out as stray flares.
    const build = () => blobPath(ctx, [
      { x: cx + sw * 0.3, y: cy - 0.3 },
      { x: cx + sw * 0.92, y: cy - 0.12 },
      { x: cx + sw * 0.8, y: cy + 0.3 },
      { x: hx + waistW, y: waistY },
      { x: hx + hw * 1.04, y: hy + 0.06 },
      { x: hx - hw * 1.04, y: hy + 0.06 },
      { x: hx - waistW, y: waistY },
      { x: cx - sw * 0.8, y: cy + 0.3 },
      { x: cx - sw * 0.92, y: cy - 0.12 },
      { x: cx - sw * 0.3, y: cy - 0.3 },
    ]);

    ctx.save();
    build();
    ctx.fillStyle = skin;
    ctx.fill();

    ctx.save();
    ctx.clip();
    // One hard-edged shadow slab. No gradient.
    // The shade follows the contour rather than being a straight bar across a
    // curved form, which is what made the previous pass look like a sticker.
    ctx.fillStyle = skinShade;
    const sd = shadeSide;
    ctx.beginPath();
    ctx.moveTo(cx + sd * sw * 0.34, cy - 0.4);
    ctx.quadraticCurveTo(cx + sd * sw * 0.5, waistY, hx + sd * hw * 0.42, hy + 0.2);
    ctx.lineTo(hx + sd * hw * 2, hy + 0.2);
    ctx.lineTo(cx + sd * sw * 2, cy - 0.4);
    ctx.closePath();
    ctx.fill();

    // Two inked chest lines. Flat cel anatomy: suggest, do not render.
    ctx.strokeStyle = 'rgba(23,17,28,0.32)';
    ctx.lineWidth = LINE * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - sw * 0.6, cy + 0.1);
    ctx.quadraticCurveTo(cx, cy + 0.3, cx + sw * 0.6, cy + 0.1);
    ctx.stroke();
    if (gut < 0.3) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 0.22);
      ctx.lineTo(cx, waistY - 0.04);
      ctx.stroke();
    }
    // Bruising as damage accumulates.
    if (o.hurt > 0.35) {
      ctx.globalAlpha = (o.hurt - 0.35) * 0.7;
      ctx.fillStyle = '#8a3550';
      oval(ctx, cx + sw * 0.3, cy + 0.34, sw * 0.26, 0.12);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    build();
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    if (this.app.accessory === 'tattoo') {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = this.app.accessoryColor ?? '#2b4a6f';
      starPath(ctx, cx + sw * 0.52, cy + 0.18, 0.13, 0.055, 5);
      ctx.fill();
      ctx.restore();
    }
    if (this.app.accessory === 'chain') {
      ctx.beginPath();
      ctx.moveTo(cx - m.neckWidth * 1.5, p.neck.y + 0.1);
      ctx.quadraticCurveTo(cx, cy + 0.24, cx + m.neckWidth * 1.5, p.neck.y + 0.1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = LINE * 2.6;
      ctx.stroke();
      ctx.strokeStyle = this.app.accessoryColor ?? '#f0c040';
      ctx.lineWidth = LINE * 1.6;
      ctx.stroke();
    }
  }

  private drawNeck(ctx: Ctx, p: Pose, m: ReturnType<typeof metrics>, skinShade: string): void {
    capsule(ctx, p.chest.x, p.chest.y - 0.04, p.neck.x, p.neck.y, m.neckWidth * 1.15, m.neckWidth);
    ink(ctx, skinShade);
  }

  // -- Arms ------------------------------------------------------------------

  private drawArm(
    ctx: Ctx, p: Pose, m: ReturnType<typeof metrics>,
    side: 'L' | 'R', far: boolean, skin: string, skinShade: string, shadeSide: -1 | 1,
  ): void {
    const shoulder = side === 'L' ? p.shoulderL : p.shoulderR;
    const elbow = side === 'L' ? p.elbowL : p.elbowR;
    const glove = side === 'L' ? p.gloveL : p.gloveR;
    const gs = side === 'L' ? p.gloveScaleL : p.gloveScaleR;
    const w = m.limbWidth;
    const base = far ? darken(skin, 0.88) : skin;

    const chain = [shoulder, elbow, { x: glove.x, y: glove.y + m.gloveRadius * 0.5 }];
    inkChain(ctx, chain, w * 1.95, base);
    chainShade(ctx, chain, w * 1.95, far ? darken(base, 0.84) : skinShade, shadeSide);

    // Deltoid cap, so the shoulder reads as mass and not a hinge.
    oval(ctx, shoulder.x, shoulder.y, w * 1.75, w * 1.6);
    ink(ctx, base);

    if (this.app.accessory === 'tape') {
      ctx.strokeStyle = this.app.accessoryColor ?? '#efe7d8';
      ctx.lineWidth = w * 0.9;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(lerp(elbow.x, glove.x, 0.66), lerp(elbow.y, glove.y, 0.66));
      ctx.lineTo(lerp(elbow.x, glove.x, 0.86), lerp(elbow.y, glove.y, 0.86));
      ctx.stroke();
      ctx.lineCap = 'round';
    }

    this.drawGlove(ctx, glove.x, glove.y, m.gloveRadius * gs, far, side, shadeSide);
  }

  private drawGlove(
    ctx: Ctx, x: number, y: number, r: number, far: boolean,
    side: 'L' | 'R', shadeSide: -1 | 1,
  ): void {
    const g = this.app.gloves;
    const main = far ? darken(g.main, 0.88) : g.main;
    const shade = darken(main, 0.74);

    // Cuff behind the mitt.
    oval(ctx, x, y + r * 0.8, r * 0.66, r * 0.4);
    ink(ctx, far ? darken(g.accent, 0.8) : g.accent);

    // Mitt: one flat fill, one hard shadow, one contour.
    ctx.save();
    const mitt = () => oval(ctx, x, y, r * 1.04, r);
    mitt();
    ctx.fillStyle = main;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = shade;
    ctx.fillRect(shadeSide > 0 ? x + r * 0.18 : x - r * 1.1, y - r * 1.2, r * 0.92, r * 2.4);
    ctx.restore();
    mitt();
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    ctx.stroke();
    ctx.restore();

    // Thumb.
    const td = side === 'L' ? -1 : 1;
    oval(ctx, x + td * r * 0.74, y + r * 0.2, r * 0.32, r * 0.42, td * 0.35);
    ink(ctx, shade);

    // Single inked knuckle seam. No specular highlight.
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.06, r * 0.6, r * 0.46, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = 'rgba(23,17,28,0.5)';
    ctx.lineWidth = LINE * 0.85;
    ctx.stroke();
  }

  // -- Head ------------------------------------------------------------------

  private drawHead(
    ctx: Ctx, p: Pose, o: FighterDrawOptions, m: ReturnType<typeof metrics>,
    skin: string, skinShade: string, shadeSide: -1 | 1,
  ): void {
    const r = m.headRadius;
    const f = this.app.face;

    ctx.save();
    ctx.translate(p.head.x, p.head.y);
    ctx.rotate(p.headRot);

    // Ears first, so the skull contour cuts across them.
    for (const s of [-1, 1]) {
      oval(ctx, s * r * 0.98, r * 0.06, r * 0.17, r * 0.25);
      ink(ctx, skinShade);
    }

    // Skull: an egg, widened or narrowed by the jaw parameter.
    const jaw = f.jaw;
    const skull = () => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.97, -r * 0.2);
      ctx.quadraticCurveTo(-r * 1.0, -r * 1.05, 0, -r * 1.08);
      ctx.quadraticCurveTo(r * 1.0, -r * 1.05, r * 0.97, -r * 0.2);
      ctx.quadraticCurveTo(r * 0.95 * jaw, r * 0.74, 0, r * 0.98);
      ctx.quadraticCurveTo(-r * 0.95 * jaw, r * 0.74, -r * 0.97, -r * 0.2);
      ctx.closePath();
    };
    ctx.save();
    skull();
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = skinShade;
    ctx.fillRect(shadeSide > 0 ? r * 0.34 : -r * 1.1, -r * 1.2, r * 0.78, r * 2.4);
    ctx.restore();
    skull();
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    ctx.stroke();
    ctx.restore();

    if (o.showFace) this.drawFace(ctx, p, o, r);
    else this.drawBackOfHead(ctx, r, skinShade);

    this.drawHair(ctx, r, o.showFace);
    this.drawHeadGear(ctx, r, o);
    ctx.restore();
  }

  private drawBackOfHead(ctx: Ctx, r: number, skinShade: string): void {
    // A crease and an occipital mass: enough to read as "from behind".
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.72);
    ctx.quadraticCurveTo(0, r * 0.88, r * 0.42, r * 0.72);
    ctx.strokeStyle = 'rgba(23,17,28,0.3)';
    ctx.lineWidth = LINE;
    ctx.stroke();
    for (const s of [-1, 1]) {
      oval(ctx, s * r * 0.55, r * 0.5, r * 0.2, r * 0.12);
      ctx.fillStyle = skinShade;
      ctx.fill();
    }
  }

  /**
   * The face. This is the most important object in the game: nearly every
   * telegraph is read here first, so it is drawn large, flat and high-contrast.
   */
  private drawFace(ctx: Ctx, p: Pose, o: FighterDrawOptions, r: number): void {
    const f = this.app.face;
    const eyeY = -r * 0.1;
    const eyeX = r * 0.38;
    const eyeR = r * 0.21 * f.eyeSize;
    const squint = clamp01(Math.max(p.squint, o.stun * 0.25));
    const open = 1 - squint * 0.85;
    const angry = clamp01(p.brow);

    for (const s of [-1, 1]) {
      const ex = s * eyeX;

      if (o.stun > 0.5) {
        // Dizzy: inked spirals. Unmistakable "hit me" signal.
        ctx.strokeStyle = INK;
        ctx.lineWidth = LINE * 1.1;
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          const a = t * Math.PI * 4 + o.time * 6;
          const rr = t * eyeR * 1.2;
          const px = ex + Math.cos(a) * rr, py = eyeY + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        continue;
      }

      // Sclera: flat white, inked.
      ctx.save();
      oval(ctx, ex, eyeY, eyeR * 1.08, eyeR * open);
      ctx.fillStyle = '#fbf7f2';
      ctx.fill();
      ctx.clip();
      // Pupil: a solid disc, no iris gradient.
      const ix = ex - s * eyeR * 0.1;
      ctx.beginPath();
      ctx.arc(ix, eyeY + eyeR * 0.06, eyeR * 0.46, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();
      oval(ctx, ex, eyeY, eyeR * 1.08, eyeR * open);
      ctx.strokeStyle = INK;
      ctx.lineWidth = LINE * 0.9;
      ctx.stroke();
    }

    // Telegraph flash: the ONE place a glow is allowed, because it is a
    // gameplay signal rather than shading.
    if (o.tell > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = o.tell;
      for (const s of [-1, 1]) {
        ctx.fillStyle = o.tellColor;
        starPath(ctx, s * eyeX, eyeY, eyeR * 1.9, eyeR * 0.7, 4, o.time * 3);
        ctx.fill();
      }
      ctx.restore();
    }

    // Brows: thick inked bars. The single clearest readability tool on a face.
    const ba = f.browAngle - angry * 0.55;
    ctx.strokeStyle = this.app.hair.style === 'bald' ? INK : this.app.hair.color;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const bx = s * eyeX;
      const by = eyeY - eyeR * (1.5 + angry * 0.3);
      ctx.beginPath();
      ctx.moveTo(bx - s * eyeR * 1.0, by + s * ba * eyeR * 1.5);
      ctx.lineTo(bx + s * eyeR * 1.0, by - s * ba * eyeR * 1.5);
      ctx.stroke();
    }

    // Nose: a flat wedge.
    const nr = r * 0.16 * f.noseSize;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.02);
    ctx.quadraticCurveTo(nr * 0.9, r * 0.24, 0, r * 0.3);
    ctx.quadraticCurveTo(-nr * 0.9, r * 0.24, 0, r * 0.02);
    ctx.closePath();
    ink(ctx, darken(this.app.skin, 0.84), LINE * 0.8);

    // Mouth.
    const mo = clamp01(Math.max(p.mouth, o.gassed * 0.45));
    const mw = r * 0.4 * f.mouth;
    const my = r * 0.58;
    if (mo > 0.16) {
      oval(ctx, 0, my + mo * r * 0.06, mw * (0.82 + mo * 0.3), r * 0.08 + mo * r * 0.26);
      ink(ctx, '#4a1420', LINE * 0.9);
      // Teeth: a flat bar, clipped.
      ctx.save();
      oval(ctx, 0, my + mo * r * 0.06, mw * (0.82 + mo * 0.3), r * 0.08 + mo * r * 0.26);
      ctx.clip();
      ctx.fillStyle = '#f6f1e6';
      ctx.fillRect(-mw, my - r * 0.24, mw * 2, r * 0.17);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(-mw, my);
      ctx.quadraticCurveTo(0, my + r * 0.1 * (1 - angry * 2.2), mw, my);
      ctx.strokeStyle = INK;
      ctx.lineWidth = LINE * 1.3;
      ctx.stroke();
    }

    this.drawFacialHair(ctx, r, my, mw);

    // Damage: a flat cut, not a painted wound.
    if (o.hurt > 0.4) {
      ctx.strokeStyle = '#a02a3a';
      ctx.lineWidth = LINE * 1.3;
      ctx.beginPath();
      ctx.moveTo(-eyeX - eyeR * 0.5, eyeY - eyeR * 1.9);
      ctx.lineTo(-eyeX + eyeR * 0.3, eyeY - eyeR * 1.25);
      ctx.stroke();
    }
    if (o.hurt > 0.7) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      oval(ctx, eyeX, eyeY + eyeR * 0.9, eyeR * 0.9, eyeR * 0.38);
      ctx.fillStyle = '#7b4a8a';
      ctx.fill();
      ctx.restore();
    }
  }

  private drawFacialHair(ctx: Ctx, r: number, my: number, mw: number): void {
    const a = this.app;
    if (a.facialHair === 'none') return;
    const col = a.facialHairColor ?? a.hair.color;
    ctx.fillStyle = col;

    switch (a.facialHair) {
      case 'stubble':
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.ellipse(0, my + r * 0.08, mw * 1.9, r * 0.4, 0, 0, Math.PI);
        ctx.fill();
        ctx.restore();
        break;
      case 'mustache':
        oval(ctx, 0, my - r * 0.13, mw * 1.35, r * 0.13);
        ink(ctx, col, LINE * 0.7);
        break;
      case 'goatee':
        oval(ctx, 0, my + r * 0.3, mw * 0.72, r * 0.24);
        ink(ctx, col, LINE * 0.7);
        oval(ctx, 0, my - r * 0.13, mw * 1.2, r * 0.11);
        ink(ctx, col, LINE * 0.7);
        break;
      case 'beard':
        ctx.beginPath();
        ctx.moveTo(-r * 0.94, r * 0.04);
        ctx.quadraticCurveTo(-r * 0.8, r * 1.3, 0, r * 1.32);
        ctx.quadraticCurveTo(r * 0.8, r * 1.3, r * 0.94, r * 0.04);
        ctx.quadraticCurveTo(r * 0.6, r * 0.5, 0, r * 0.46);
        ctx.quadraticCurveTo(-r * 0.6, r * 0.5, -r * 0.94, r * 0.04);
        ctx.closePath();
        ink(ctx, col);
        oval(ctx, 0, my - r * 0.15, mw * 1.3, r * 0.12);
        ink(ctx, col, LINE * 0.7);
        break;
      case 'muttonchops':
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.94, -r * 0.22);
          ctx.quadraticCurveTo(s * r * 1.04, r * 0.68, s * r * 0.44, r * 0.6);
          ctx.quadraticCurveTo(s * r * 0.7, r * 0.18, s * r * 0.76, -r * 0.22);
          ctx.closePath();
          ink(ctx, col, LINE * 0.8);
        }
        break;
    }
  }

  private drawHair(ctx: Ctx, r: number, front: boolean): void {
    const { style, color } = this.app.hair;
    if (style === 'bald') return;
    const shade = darken(color, 0.78);

    switch (style) {
      case 'buzz':
        ctx.beginPath();
        ctx.moveTo(-r * 0.99, -r * 0.32);
        ctx.quadraticCurveTo(-r * 1.02, -r * 1.14, 0, -r * 1.17);
        ctx.quadraticCurveTo(r * 1.02, -r * 1.14, r * 0.99, -r * 0.32);
        ctx.quadraticCurveTo(r * 0.58, -r * 0.6, 0, -r * 0.56);
        ctx.quadraticCurveTo(-r * 0.58, -r * 0.6, -r * 0.99, -r * 0.32);
        ctx.closePath();
        ink(ctx, color);
        break;
      case 'afro': {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= 14; i++) {
          const a = Math.PI + (i / 14) * Math.PI;
          const rr = r * (1.38 + (i % 2 ? 0.06 : -0.04));
          pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 1.02 - r * 0.12 });
        }
        pts.push({ x: r * 0.9, y: r * 0.1 }, { x: -r * 0.9, y: r * 0.1 });
        blobPath(ctx, pts);
        ink(ctx, color);
        break;
      }
      case 'mohawk':
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, -r * 1.02);
        for (let i = 0; i <= 5; i++) {
          const t = i / 5;
          ctx.lineTo(-r * 0.22 + t * r * 0.44, -r * (1.26 + Math.sin(t * Math.PI) * 0.5));
        }
        ctx.lineTo(r * 0.24, -r * 1.02);
        ctx.closePath();
        ink(ctx, color);
        break;
      case 'flattop':
        ctx.beginPath();
        ctx.moveTo(-r * 1.01, -r * 0.46);
        ctx.lineTo(-r * 1.01, -r * 1.24);
        ctx.lineTo(r * 1.01, -r * 1.24);
        ctx.lineTo(r * 1.01, -r * 0.46);
        ctx.quadraticCurveTo(0, -r * 0.7, -r * 1.01, -r * 0.46);
        ctx.closePath();
        ink(ctx, color);
        break;
      case 'long':
        ctx.beginPath();
        ctx.moveTo(-r * 1.02, -r * 0.5);
        ctx.quadraticCurveTo(-r * 1.08, -r * 1.16, 0, -r * 1.2);
        ctx.quadraticCurveTo(r * 1.08, -r * 1.16, r * 1.02, -r * 0.5);
        ctx.quadraticCurveTo(r * 1.26, r * 0.85, r * 0.8, r * 0.96);
        ctx.quadraticCurveTo(r * 0.88, r * 0.1, r * 0.84, -r * 0.3);
        ctx.quadraticCurveTo(0, -r * 0.64, -r * 0.84, -r * 0.3);
        ctx.quadraticCurveTo(-r * 0.88, r * 0.1, -r * 0.8, r * 0.96);
        ctx.quadraticCurveTo(-r * 1.26, r * 0.85, -r * 1.02, -r * 0.5);
        ctx.closePath();
        ink(ctx, color);
        break;
      case 'topknot':
        oval(ctx, 0, -r * 1.28, r * 0.3, r * 0.28);
        ink(ctx, color);
        ctx.beginPath();
        ctx.moveTo(-r * 0.99, -r * 0.42);
        ctx.quadraticCurveTo(0, -r * 1.2, r * 0.99, -r * 0.42);
        ctx.quadraticCurveTo(0, -r * 0.76, -r * 0.99, -r * 0.42);
        ctx.closePath();
        ink(ctx, color);
        break;
      case 'curls':
        for (let i = 0; i < 8; i++) {
          const a = Math.PI + (i / 7) * Math.PI;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.96 - r * 0.1, r * 0.29, 0, Math.PI * 2);
          ink(ctx, i % 2 ? color : shade, LINE * 0.7);
        }
        break;
      case 'braids':
        ctx.beginPath();
        ctx.moveTo(-r * 1.0, -r * 0.42);
        ctx.quadraticCurveTo(0, -r * 1.24, r * 1.0, -r * 0.42);
        ctx.quadraticCurveTo(0, -r * 0.8, -r * 1.0, -r * 0.42);
        ctx.closePath();
        ink(ctx, color);
        if (!front) {
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(i * r * 0.32, -r * 0.78);
            ctx.quadraticCurveTo(i * r * 0.4, r * 0.38, i * r * 0.28, r * 1.26);
            ctx.strokeStyle = color;
            ctx.lineWidth = r * 0.15;
            ctx.stroke();
          }
        }
        break;
      case 'ponytail':
        ctx.beginPath();
        ctx.moveTo(r * 0.88, -r * 0.56);
        ctx.quadraticCurveTo(r * 1.48, r * 0.12, r * 1.1, r * 0.88);
        ctx.quadraticCurveTo(r * 1.06, r * 0.1, r * 0.74, -r * 0.3);
        ctx.closePath();
        ink(ctx, shade);
        ctx.beginPath();
        ctx.moveTo(-r * 1.0, -r * 0.42);
        ctx.quadraticCurveTo(0, -r * 1.26, r * 1.0, -r * 0.42);
        ctx.quadraticCurveTo(0, -r * 0.78, -r * 1.0, -r * 0.42);
        ctx.closePath();
        ink(ctx, color);
        break;
      case 'pompadour':
        ctx.beginPath();
        ctx.moveTo(-r * 0.99, -r * 0.42);
        ctx.quadraticCurveTo(-r * 1.16, -r * 1.44, 0, -r * 1.4);
        ctx.quadraticCurveTo(r * 1.12, -r * 1.34, r * 0.99, -r * 0.42);
        ctx.quadraticCurveTo(0, -r * 0.76, -r * 0.99, -r * 0.42);
        ctx.closePath();
        ink(ctx, color);
        break;
      case 'shaggy':
      default:
        ctx.beginPath();
        ctx.moveTo(-r * 1.04, -r * 0.3);
        ctx.quadraticCurveTo(-r * 1.12, -r * 1.16, 0, -r * 1.2);
        ctx.quadraticCurveTo(r * 1.12, -r * 1.16, r * 1.04, -r * 0.3);
        for (let i = 4; i >= 0; i--) {
          const t = i / 4;
          ctx.lineTo(-r * 0.98 + t * r * 1.96, -r * (0.5 + (i % 2 === 0 ? 0.2 : 0)));
        }
        ctx.closePath();
        ink(ctx, color);
        break;
    }
  }

  private drawHeadGear(ctx: Ctx, r: number, o: FighterDrawOptions): void {
    const { accessory, accessoryColor } = this.app;
    const col = accessoryColor ?? '#ffffff';
    switch (accessory) {
      case 'headband':
        ctx.beginPath();
        ctx.moveTo(-r * 1.04, -r * 0.56);
        ctx.quadraticCurveTo(0, -r * 0.88, r * 1.04, -r * 0.56);
        ctx.lineTo(r * 1.04, -r * 0.28);
        ctx.quadraticCurveTo(0, -r * 0.6, -r * 1.04, -r * 0.28);
        ctx.closePath();
        ink(ctx, col);
        ctx.beginPath();
        ctx.moveTo(-r * 0.98, -r * 0.42);
        ctx.quadraticCurveTo(-r * 1.5, -r * 0.1 + Math.sin(o.time * 5) * r * 0.18, -r * 1.7, r * 0.3);
        ctx.strokeStyle = INK;
        ctx.lineWidth = r * 0.17;
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = r * 0.12;
        ctx.stroke();
        break;
      case 'shades': {
        const lens = (x: number) => {
          ctx.beginPath();
          ctx.moveTo(x, -r * 0.36);
          ctx.lineTo(x + r * 0.8, -r * 0.36);
          ctx.lineTo(x + r * 0.7, r * 0.1);
          ctx.lineTo(x + r * 0.1, r * 0.1);
          ctx.closePath();
        };
        lens(-r * 0.9); ink(ctx, col);
        lens(r * 0.1); ink(ctx, col);
        ctx.fillStyle = INK;
        ctx.fillRect(-r * 0.12, -r * 0.3, r * 0.24, r * 0.1);
        break;
      }
      case 'crown':
        ctx.beginPath();
        ctx.moveTo(-r * 0.74, -r * 1.02);
        ctx.lineTo(-r * 0.74, -r * 1.42);
        ctx.lineTo(-r * 0.36, -r * 1.16);
        ctx.lineTo(0, -r * 1.56);
        ctx.lineTo(r * 0.36, -r * 1.16);
        ctx.lineTo(r * 0.74, -r * 1.42);
        ctx.lineTo(r * 0.74, -r * 1.02);
        ctx.closePath();
        ink(ctx, col);
        break;
      case 'facepaint':
        ctx.save();
        ctx.globalAlpha = 0.9;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.16, -r * 0.4);
          ctx.lineTo(s * r * 0.72, -r * 0.48);
          ctx.lineTo(s * r * 0.6, r * 0.34);
          ctx.lineTo(s * r * 0.3, r * 0.12);
          ctx.closePath();
          ink(ctx, col, 0);
        }
        ctx.restore();
        break;
      case 'scar':
        ctx.strokeStyle = '#b8747c';
        ctx.lineWidth = LINE * 1.2;
        ctx.beginPath();
        ctx.moveTo(r * 0.3, -r * 0.62);
        ctx.lineTo(r * 0.5, r * 0.1);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(r * (0.28 + i * 0.06) - r * 0.1, -r * (0.5 - i * 0.2));
          ctx.lineTo(r * (0.28 + i * 0.06) + r * 0.12, -r * (0.54 - i * 0.2));
          ctx.stroke();
        }
        break;
      case 'mask':
        ctx.beginPath();
        ctx.moveTo(-r * 0.99, -r * 0.44);
        ctx.quadraticCurveTo(0, -r * 0.74, r * 0.99, -r * 0.44);
        ctx.lineTo(r * 0.88, r * 0.16);
        ctx.quadraticCurveTo(0, r * 0.0, -r * 0.88, r * 0.16);
        ctx.closePath();
        ink(ctx, '#221c2c');
        ctx.strokeStyle = col;
        ctx.lineWidth = LINE * 1.4;
        ctx.stroke();
        break;
      case 'eyepatch':
        oval(ctx, -r * 0.4, -r * 0.1, r * 0.3, r * 0.26);
        ink(ctx, '#1a1620');
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.32);
        ctx.lineTo(r * 0.99, -r * 0.54);
        ctx.strokeStyle = '#1a1620';
        ctx.lineWidth = LINE * 1.6;
        ctx.stroke();
        break;
      default:
        break;
    }
  }

  // -- Sweat -----------------------------------------------------------------

  private drawSweat(ctx: Ctx, p: Pose, o: FighterDrawOptions, u: number): void {
    const cx = o.x + p.offset.x * u * o.facing;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const t = (o.time * 1.4 + i * 0.27) % 1;
      const side = i % 2 ? 1 : -1;
      const px = cx + side * u * (0.34 + i * 0.06);
      const py = o.y + (p.head.y + t * 1.0) * u;
      ctx.globalAlpha = (1 - t) * 0.85 * o.gassed;
      ctx.beginPath();
      ctx.ellipse(px, py, u * 0.035, u * 0.055, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#9fd8f5';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = u * 0.012;
      ctx.stroke();
    }
    ctx.restore();
  }
}
