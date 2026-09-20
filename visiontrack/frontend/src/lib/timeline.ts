/** Playback-time lookups over the stored analysis timeline. */
import type { Timeline, TrackSummary, Zone } from '../api/types'
import type { OverlayObject } from './overlay'

/** Index of the last analysed sample at or before `time`, or -1. */
export function findSampleIndex(timeline: Timeline, time: number): number {
  const { samples } = timeline
  if (samples.length === 0) return -1
  let lo = 0
  let hi = samples.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= time) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

export interface PlaybackOverlay {
  objects: OverlayObject[]
  trails: Map<number, [number, number][]>
  sampleTime: number
  frame: number
  /** True when the nearest analysed sample is too old to represent this instant. */
  stale: boolean
}

const EMPTY: PlaybackOverlay = {
  objects: [], trails: new Map(), sampleTime: 0, frame: 0, stale: true,
}

/**
 * Build the overlay for a playback instant from stored detections only.
 * Nothing is interpolated or invented: if the nearest analysed sample is older
 * than one detection interval, the overlay is reported as stale.
 */
export function buildPlaybackOverlay(
  timeline: Timeline | null,
  time: number,
  trailLength: number,
  tracks: Map<number, TrackSummary>,
  zones: Zone[],
): PlaybackOverlay {
  if (!timeline) return EMPTY
  const index = findSampleIndex(timeline, time)
  if (index < 0) return EMPTY

  const sample = timeline.samples[index]
  const interval = (timeline.detect_every_n || 1) / (timeline.fps || 25)
  const stale = time - sample.t > interval * 1.75

  const zoneById = new Map(zones.map((z) => [z.id, z]))
  const objects: OverlayObject[] = sample.o.map((o) => {
    const [id, clsIdx, conf, x1, y1, x2, y2, , zoneIdx, zoneTime] = o
    const zoneId = zoneIdx >= 0 ? timeline.zone_ids[zoneIdx] : undefined
    const first = tracks.get(id)?.first_seen ?? sample.t
    return {
      id,
      cls: timeline.classes[clsIdx] ?? String(clsIdx),
      confidence: conf,
      bbox: [x1, y1, x2, y2],
      center: [(x1 + x2) / 2, (y1 + y2) / 2],
      status: o[7] === 0 ? 'stationary' : 'moving',
      visibleDuration: Math.max(0, sample.t - first),
      zoneName: zoneId ? zoneById.get(zoneId)?.name ?? zoneId : null,
      zoneTime: zoneId ? zoneTime : null,
    }
  })

  // Walk backwards to assemble each visible object's recent path.
  const trails = new Map<number, [number, number][]>()
  const wanted = new Set(objects.map((o) => o.id))
  const start = Math.max(0, index - trailLength + 1)
  for (let i = start; i <= index; i += 1) {
    for (const o of timeline.samples[i].o) {
      const id = o[0]
      if (!wanted.has(id)) continue
      const point: [number, number] = [(o[3] + o[5]) / 2, (o[4] + o[6]) / 2]
      const trail = trails.get(id)
      if (trail) trail.push(point)
      else trails.set(id, [point])
    }
  }

  return { objects, trails, sampleTime: sample.t, frame: sample.f, stale }
}

/** Per-object visibility spans, for the timeline ribbon under the player. */
export function trackSpans(tracks: TrackSummary[], duration: number) {
  return tracks.map((t) => ({
    id: t.id,
    cls: t.cls,
    start: duration > 0 ? t.first_seen / duration : 0,
    end: duration > 0 ? Math.min(1, t.last_seen / duration) : 0,
  }))
}
