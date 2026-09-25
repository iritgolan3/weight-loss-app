/**
 * Mutable, render-loop-owned frame state.
 *
 * Live frames arrive at up to 30/s. Pushing them through React state would
 * re-render the whole dashboard every frame, so the canvas loop reads from this
 * plain object instead and only throttled snapshots reach the store.
 */
import type { LiveObject } from '../api/types'
import type { OverlayObject } from './overlay'

export interface LiveFrame {
  frame: number
  timestamp: number
  objects: LiveObject[]
}

class FrameBuffer {
  current: LiveFrame | null = null
  previewImage: HTMLImageElement | null = null
  previewReady = false
  private previewUrl: string | null = null
  trails = new Map<number, [number, number][]>()
  private lastSeen = new Map<number, number>()
  trailLength = 60

  reset(): void {
    this.current = null
    this.trails.clear()
    this.lastSeen.clear()
    this.previewReady = false
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl)
      this.previewUrl = null
    }
  }

  push(frame: LiveFrame): void {
    this.current = frame
    for (const obj of frame.objects) {
      let trail = this.trails.get(obj.id)
      if (!trail) {
        trail = []
        this.trails.set(obj.id, trail)
      }
      trail.push([obj.center[0], obj.center[1]])
      if (trail.length > this.trailLength) trail.splice(0, trail.length - this.trailLength)
      this.lastSeen.set(obj.id, frame.timestamp)
    }
    // Forget trails for objects the tracker dropped a while ago.
    for (const [id, seen] of this.lastSeen) {
      if (frame.timestamp - seen > 2) {
        this.lastSeen.delete(id)
        this.trails.delete(id)
      }
    }
  }

  /** Decode a base64 JPEG preview into an <img> the canvas loop can draw. */
  setPreview(base64: string): void {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'image/jpeg' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      this.previewImage = img
      this.previewReady = true
      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl)
      this.previewUrl = url
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  toOverlayObjects(): OverlayObject[] {
    if (!this.current) return []
    return this.current.objects.map((obj) => {
      const zone = obj.zones.find((z) => z.inside)
      return {
        id: obj.id,
        cls: obj.cls,
        confidence: obj.confidence,
        bbox: obj.bbox,
        center: obj.center,
        status: obj.status,
        visibleDuration: obj.visible_duration,
        zoneName: zone?.zone_name ?? null,
        zoneTime: zone?.total_time ?? null,
      }
    })
  }
}

export const frameBuffer = new FrameBuffer()
