/**
 * Canvas overlay renderer.
 *
 * Mirrors backend/app/video/renderer.py so the live view, the playback view and
 * an exported MP4 all look identical. Coordinates arrive in source-video pixels
 * and are scaled to whatever size the <video>/<img> is currently displayed at.
 */
import type { Zone } from '../api/types'
import { humanDuration } from './format'

export interface OverlayObject {
  id: number
  cls: string
  confidence: number
  bbox: [number, number, number, number]
  center: [number, number]
  status: 'moving' | 'stationary'
  visibleDuration: number
  zoneName?: string | null
  zoneTime?: number | null
}

export interface OverlayStyle {
  showBoxes: boolean
  showLabels: boolean
  showConfidence: boolean
  showTrajectories: boolean
  showZones: boolean
  showTimers: boolean
  trajectoryColor: string
  selectedColor: string
  thickness: number
}

export interface OverlayInput {
  objects: OverlayObject[]
  trails: Map<number, [number, number][]>
  zones: Zone[]
  selectedId: number | null
  style: OverlayStyle
  source: { width: number; height: number }
}

const NEON = '#39ff14'
const LABEL_TEXT = '#04160a'

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return `rgba(57,255,20,${alpha})`
  return `rgba(${r},${g},${b},${alpha})`
}

/** Overlay scale factor, so text stays readable on a phone and on a 4K monitor. */
function uiScale(canvasWidth: number): number {
  return Math.max(0.55, Math.min(1.35, canvasWidth / 1100))
}

function chip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  fg: string,
  scale: number,
): { width: number; height: number } {
  const fontSize = Math.round(12 * scale)
  ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`
  const padX = Math.round(5 * scale)
  const padY = Math.round(3.5 * scale)
  const width = ctx.measureText(text).width + padX * 2
  const height = fontSize + padY * 2
  const left = Math.max(0, Math.min(x, ctx.canvas.width / dpr(ctx) - width))
  const top = Math.max(0, y - height)
  ctx.fillStyle = bg
  ctx.fillRect(left, top, width, height)
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(text, left + padX, top + height / 2 + 0.5)
  return { width, height }
}

function dpr(ctx: CanvasRenderingContext2D): number {
  const t = ctx.getTransform()
  return t.a || 1
}

function cornerTicks(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, lw: number, scale: number,
) {
  const len = Math.min(16 * scale, (x2 - x1) / 3, (y2 - y1) / 3)
  ctx.strokeStyle = color
  ctx.lineWidth = lw + 1
  ctx.beginPath()
  ctx.moveTo(x1, y1 + len); ctx.lineTo(x1, y1); ctx.lineTo(x1 + len, y1)
  ctx.moveTo(x2 - len, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + len)
  ctx.moveTo(x1, y2 - len); ctx.lineTo(x1, y2); ctx.lineTo(x1 + len, y2)
  ctx.moveTo(x2 - len, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - len)
  ctx.stroke()
}

export function drawOverlay(canvas: HTMLCanvasElement, input: OverlayInput): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const ratio = window.devicePixelRatio || 1
  const cssWidth = canvas.clientWidth
  const cssHeight = canvas.clientHeight
  if (cssWidth === 0 || cssHeight === 0) return

  if (canvas.width !== Math.round(cssWidth * ratio) || canvas.height !== Math.round(cssHeight * ratio)) {
    canvas.width = Math.round(cssWidth * ratio)
    canvas.height = Math.round(cssHeight * ratio)
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  const sx = cssWidth / Math.max(1, input.source.width)
  const sy = cssHeight / Math.max(1, input.source.height)
  const scale = uiScale(cssWidth)
  const { style } = input
  const lw = Math.max(1, style.thickness * scale)

  if (style.showZones) drawZones(ctx, input.zones, cssWidth, cssHeight, scale)

  if (style.showTrajectories) {
    for (const obj of input.objects) {
      const trail = input.trails.get(obj.id)
      if (!trail || trail.length < 2) continue
      const selected = input.selectedId === obj.id
      drawTrail(ctx, trail, sx, sy, selected ? style.selectedColor : style.trajectoryColor,
        selected ? lw + 1.2 : lw * 0.8, selected)
    }
  }

  for (const obj of input.objects) {
    const selected = input.selectedId === obj.id
    const color = selected ? style.selectedColor : NEON
    const x1 = obj.bbox[0] * sx
    const y1 = obj.bbox[1] * sy
    const x2 = obj.bbox[2] * sx
    const y2 = obj.bbox[3] * sy

    if (style.showBoxes) {
      ctx.strokeStyle = selected ? color : withAlpha(color, 0.92)
      ctx.lineWidth = selected ? lw + 1 : lw
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
      if (selected) cornerTicks(ctx, x1, y1, x2, y2, color, lw, scale)
    }

    ctx.fillStyle = selected ? style.selectedColor : style.trajectoryColor
    ctx.beginPath()
    ctx.arc(obj.center[0] * sx, obj.center[1] * sy, Math.max(2, 2.6 * scale), 0, Math.PI * 2)
    ctx.fill()

    if (style.showLabels) {
      const label = style.showConfidence
        ? `${obj.cls} ID:${obj.id} ${obj.confidence.toFixed(2)}`
        : `${obj.cls} ID:${obj.id}`
      chip(ctx, label, x1, y1 - 1, color, LABEL_TEXT, scale)
    }

    if (style.showTimers) {
      const timer = obj.zoneName && (obj.zoneTime ?? 0) >= 1
        ? humanDuration(obj.zoneTime ?? 0)
        : obj.visibleDuration >= 1
          ? humanDuration(obj.visibleDuration)
          : null
      if (timer) {
        chip(ctx, timer, x1, Math.min(cssHeight, y2 + 20 * scale),
          withAlpha(selected ? style.selectedColor : '#0d2f08', 0.82), '#d8ffd0', scale)
      }
    }
  }
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: [number, number][],
  sx: number, sy: number,
  color: string, width: number, solid: boolean,
) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (solid) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.shadowColor = withAlpha(color, 0.75)
    ctx.shadowBlur = 8
    ctx.beginPath()
    trail.forEach(([x, y], i) => {
      const px = x * sx
      const py = y * sy
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
    ctx.shadowBlur = 0
    return
  }
  // Faded tail for unselected objects: older segments are more transparent.
  for (let i = 1; i < trail.length; i += 1) {
    const alpha = 0.12 + 0.58 * (i / trail.length)
    ctx.strokeStyle = withAlpha(color, alpha)
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(trail[i - 1][0] * sx, trail[i - 1][1] * sy)
    ctx.lineTo(trail[i][0] * sx, trail[i][1] * sy)
    ctx.stroke()
  }
}

function drawZones(
  ctx: CanvasRenderingContext2D,
  zones: Zone[],
  width: number,
  height: number,
  scale: number,
) {
  for (const zone of zones) {
    if (!zone.visible || zone.points.length < 3) continue
    ctx.beginPath()
    zone.points.forEach(([nx, ny], i) => {
      const x = nx * width
      const y = ny * height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = withAlpha(zone.color, 0.1)
    ctx.fill()
    ctx.strokeStyle = zone.color
    ctx.lineWidth = Math.max(1, 1.6 * scale)
    ctx.setLineDash([6 * scale, 4 * scale])
    ctx.stroke()
    ctx.setLineDash([])

    const top = zone.points.reduce((a, b) => (b[1] < a[1] ? b : a))
    chip(ctx, zone.name.toUpperCase(), top[0] * width, top[1] * height - 2, zone.color, LABEL_TEXT, scale * 0.92)
  }
}

/** Topmost object whose box contains a display-space point (for click-to-select). */
export function pickObject(
  objects: OverlayObject[],
  displayX: number,
  displayY: number,
  source: { width: number; height: number },
  display: { width: number; height: number },
): OverlayObject | null {
  const x = (displayX / display.width) * source.width
  const y = (displayY / display.height) * source.height
  let best: OverlayObject | null = null
  let bestArea = Infinity
  for (const obj of objects) {
    const [x1, y1, x2, y2] = obj.bbox
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
      const area = (x2 - x1) * (y2 - y1)
      if (area < bestArea) {
        bestArea = area
        best = obj
      }
    }
  }
  return best
}
