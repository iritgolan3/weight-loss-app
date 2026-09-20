import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api/client'
import { containFit, useElementSize } from '../hooks/useElementSize'
import { frameBuffer } from '../lib/frameBuffer'
import { clock } from '../lib/format'
import { drawOverlay, pickObject, type OverlayObject, type OverlayStyle } from '../lib/overlay'
import { playerRef } from '../lib/player'
import { useStore } from '../lib/store'
import { buildPlaybackOverlay } from '../lib/timeline'

const ZONE_PALETTE = ['#39ff14', '#00e0ff', '#ffb020', '#ff2bd1', '#b388ff']

interface Props {
  containerRef: React.RefObject<HTMLDivElement>
}

export function VideoStage({ containerRef }: Props) {
  const video = useStore((s) => s.video)
  const viewMode = useStore((s) => s.viewMode)
  const timeline = useStore((s) => s.timeline)
  const tracks = useStore((s) => s.tracks)
  const zones = useStore((s) => s.zones)
  const settings = useStore((s) => s.settings)
  const selectedId = useStore((s) => s.selectedId)
  const zoneEditing = useStore((s) => s.zoneEditing)
  const job = useStore((s) => s.job)
  const setSelected = useStore((s) => s.setSelected)
  const setPlaybackTime = useStore((s) => s.setPlaybackTime)
  const addZone = useStore((s) => s.addZone)
  const setZoneEditing = useStore((s) => s.setZoneEditing)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const previewRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const objectsRef = useRef<OverlayObject[]>([])
  const lastTimePush = useRef(0)
  const [draft, setDraft] = useState<[number, number][]>([])
  const [stale, setStale] = useState(false)

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks])
  const isLive = viewMode === 'live'
  const source = useMemo(
    () => ({ width: video?.width ?? 16, height: video?.height ?? 9 }),
    [video?.width, video?.height],
  )

  const stageSize = useElementSize(stageRef)
  // CSS `aspect-ratio` cannot letterbox inside a box that is constrained on both
  // axes, so the media box is measured and sized explicitly.
  const fit = useMemo(
    () => containFit(stageSize.width, stageSize.height, source.width / source.height),
    [stageSize.width, stageSize.height, source.width, source.height],
  )

  const style: OverlayStyle = useMemo(() => ({
    showBoxes: settings.show_boxes,
    showLabels: settings.show_labels,
    showConfidence: settings.show_confidence,
    showTrajectories: settings.show_trajectories,
    showZones: settings.show_zones,
    showTimers: settings.show_timers,
    trajectoryColor: settings.trajectory_color,
    selectedColor: settings.selected_color,
    thickness: settings.trajectory_thickness,
  }), [settings])

  // Single render loop drives both the live preview and the playback overlay.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const overlay = overlayRef.current
      if (!overlay || !video) return

      let objects: OverlayObject[] = []
      let trails = new Map<number, [number, number][]>()
      let isStale = false

      if (isLive) {
        const preview = previewRef.current
        if (preview && frameBuffer.previewReady && frameBuffer.previewImage) {
          const ratio = window.devicePixelRatio || 1
          const w = preview.clientWidth
          const h = preview.clientHeight
          if (w > 0 && h > 0) {
            if (preview.width !== Math.round(w * ratio) || preview.height !== Math.round(h * ratio)) {
              preview.width = Math.round(w * ratio)
              preview.height = Math.round(h * ratio)
            }
            const ctx = preview.getContext('2d')
            if (ctx) {
              ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
              ctx.drawImage(frameBuffer.previewImage, 0, 0, w, h)
            }
          }
        }
        objects = frameBuffer.toOverlayObjects()
        trails = frameBuffer.trails
      } else {
        const el = videoElRef.current
        const time = el?.currentTime ?? 0
        const built = buildPlaybackOverlay(timeline, time, settings.trajectory_length, trackMap, zones)
        objects = built.objects
        trails = built.trails
        isStale = built.stale && !!timeline
        const now = performance.now()
        if (now - lastTimePush.current > 200) {
          lastTimePush.current = now
          setPlaybackTime(time)
        }
      }

      objectsRef.current = objects
      drawOverlay(overlay, {
        objects, trails, zones, selectedId, style, source,
      })
      if (draft.length > 0) drawDraft(overlay, draft)
      if (isStale !== stale) setStale(isStale)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isLive, timeline, trackMap, zones, selectedId, style, source, video, draft,
      settings.trajectory_length, setPlaybackTime, stale])

  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const overlay = overlayRef.current
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (zoneEditing) {
      setDraft((points) => [...points, [
        Math.min(1, Math.max(0, x / rect.width)),
        Math.min(1, Math.max(0, y / rect.height)),
      ]])
      return
    }
    const hit = pickObject(objectsRef.current, x, y, source, { width: rect.width, height: rect.height })
    setSelected(hit ? hit.id : null)
  }, [zoneEditing, setSelected, source])

  const finishZone = useCallback(() => {
    if (draft.length < 3) {
      setDraft([])
      setZoneEditing(false)
      return
    }
    const name = window.prompt('Zone name', `Zone ${zones.length + 1}`)
    if (name !== null) {
      void addZone(draft, name.trim() || `Zone ${zones.length + 1}`,
        ZONE_PALETTE[zones.length % ZONE_PALETTE.length])
    }
    setDraft([])
    setZoneEditing(false)
  }, [draft, zones.length, addZone, setZoneEditing])

  useEffect(() => {
    if (!zoneEditing) {
      setDraft([])
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') finishZone()
      else if (event.key === 'Escape') { setDraft([]); setZoneEditing(false) }
      else if (event.key === 'Backspace') setDraft((p) => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoneEditing, finishZone, setZoneEditing])

  useEffect(() => {
    playerRef.current = videoElRef.current
    return () => { playerRef.current = null }
  }, [video?.id, isLive])

  if (!video) return null

  const running = job?.status === 'running' || job?.status === 'queued' || job?.status === 'stopping'

  return (
    <div ref={containerRef} className="relative flex min-h-0 w-full flex-1 bg-black">
      <div ref={stageRef} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div
        className="relative overflow-hidden rounded-lg ring-1 ring-ink-500/60"
        style={{ width: fit.width || undefined, height: fit.height || undefined }}
      >
        {isLive ? (
          <canvas ref={previewRef} className="absolute inset-0 h-full w-full bg-black" />
        ) : (
          <video
            ref={videoElRef}
            key={video.id}
            src={api.streamUrl(video.id)}
            className="absolute inset-0 h-full w-full bg-black object-contain"
            playsInline
            preload="auto"
            onError={() => useStore.getState().toast(
              'error', 'The browser could not play this file.',
              'MKV/AVI often need a re-encode to MP4 (H.264) for in-browser playback. Analysis and export still work.',
            )}
          />
        )}

        <canvas
          ref={overlayRef}
          onClick={handleClick}
          onDoubleClick={zoneEditing ? finishZone : undefined}
          className={`absolute inset-0 h-full w-full ${zoneEditing ? 'cursor-crosshair' : 'cursor-pointer'}`}
        />

        {/* Corner HUD */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 rounded bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-neon backdrop-blur-sm">
            <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulseDot bg-neon' : 'bg-slate-500'}`} />
            {running ? 'Analysing' : isLive ? 'Live feed' : 'Playback'}
          </div>
          {!isLive && !timeline && (
            <div className="rounded bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber backdrop-blur-sm">
              No analysis data — press start analysis
            </div>
          )}
          {!isLive && stale && (
            <div className="rounded bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 backdrop-blur-sm">
              Between analysed frames
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute right-3 top-3 rounded bg-black/55 px-2 py-1 font-mono text-[10px] tabular-nums text-slate-300 backdrop-blur-sm">
          {video.width}×{video.height} · {video.fps.toFixed(0)} FPS · {clock(video.duration)}
        </div>

        {zoneEditing && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-neon/40 bg-black/80 px-3 py-1.5 font-mono text-[11px] text-neon backdrop-blur-sm">
            Click to add points · {draft.length} placed · Enter or double-click to finish · Esc to cancel
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

/** In-progress polygon while the user is drawing a zone. */
function drawDraft(canvas: HTMLCanvasElement, points: [number, number][]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  ctx.save()
  ctx.strokeStyle = '#39ff14'
  ctx.fillStyle = 'rgba(57,255,20,0.12)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  points.forEach(([nx, ny], i) => {
    const x = nx * w
    const y = ny * h
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  if (points.length > 2) {
    ctx.closePath()
    ctx.fill()
  }
  ctx.stroke()
  ctx.setLineDash([])
  points.forEach(([nx, ny]) => {
    ctx.beginPath()
    ctx.arc(nx * w, ny * h, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#39ff14'
    ctx.fill()
  })
  ctx.restore()
}
