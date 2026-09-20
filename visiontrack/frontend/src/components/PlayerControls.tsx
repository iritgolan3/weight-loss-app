import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { clock } from '../lib/format'
import {
  PLAYBACK_RATES, playerRef, restart, seek, setRate, stepFrames, toggleFullscreen, togglePlay,
} from '../lib/player'
import { useStore } from '../lib/store'
import { trackSpans } from '../lib/timeline'
import {
  IconFullscreen, IconPause, IconPlay, IconRestart, IconStepBack, IconStepForward,
} from './Icons'

interface Props {
  containerRef: React.RefObject<HTMLDivElement>
}

export function PlayerControls({ containerRef }: Props) {
  const video = useStore((s) => s.video)
  const tracks = useStore((s) => s.tracks)
  const selectedId = useStore((s) => s.selectedId)
  const setSelected = useStore((s) => s.setSelected)
  const viewMode = useStore((s) => s.viewMode)

  const [time, setTime] = useState(0)
  const [paused, setPaused] = useState(true)
  const [rate, setRateState] = useState(1)
  const barRef = useRef<HTMLDivElement | null>(null)

  const duration = video?.duration ?? 0
  const fps = video?.fps ?? 30
  const live = viewMode === 'live'

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = playerRef.current
      if (!el) return
      setTime(el.currentTime)
      setPaused(el.paused)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === ' ') { event.preventDefault(); togglePlay() }
      else if (event.key === 'ArrowRight') stepFrames(event.shiftKey ? 10 : 1, fps)
      else if (event.key === 'ArrowLeft') stepFrames(event.shiftKey ? -10 : -1, fps)
      else if (event.key.toLowerCase() === 'f') toggleFullscreen(containerRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fps, containerRef])

  const spans = useMemo(() => trackSpans(tracks, duration), [tracks, duration])

  const scrub = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const bar = barRef.current
    if (!bar || !duration) return
    const rect = bar.getBoundingClientRect()
    seek(((event.clientX - rect.left) / rect.width) * duration)
  }, [duration])

  const progress = duration > 0 ? Math.min(1, time / duration) : 0

  return (
    <div className="panel px-3 py-2.5">
      <div className="mb-2 flex items-center gap-3">
        <div
          ref={barRef}
          onClick={scrub}
          className={`group relative h-7 flex-1 cursor-pointer overflow-hidden rounded bg-ink-900 ring-1 ring-ink-500/60 ${live ? 'pointer-events-none opacity-60' : ''}`}
          role="slider"
          aria-label="Seek"
          aria-valuenow={Math.round(time)}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          tabIndex={0}
        >
          {/* Per-object visibility ribbon */}
          <div className="absolute inset-x-0 top-0 h-full">
            {spans.map((span, i) => (
              <div
                key={span.id}
                onClick={(e) => { e.stopPropagation(); setSelected(span.id); seek(span.start * duration) }}
                title={`${span.cls} ID:${span.id}`}
                className={`absolute h-[3px] rounded-full transition-all ${
                  selectedId === span.id ? 'bg-magenta' : 'bg-neon/35 hover:bg-neon/70'
                }`}
                style={{
                  left: `${span.start * 100}%`,
                  width: `${Math.max(0.6, (span.end - span.start) * 100)}%`,
                  top: `${4 + (i % 6) * 4}px`,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 bg-neon/10" style={{ width: `${progress * 100}%` }} />
          <div className="absolute inset-y-0 w-px bg-neon shadow-[0_0_8px_rgba(57,255,20,0.9)]"
               style={{ left: `${progress * 100}%` }} />
        </div>
        <div className="value-mono shrink-0 text-xs text-slate-300">
          {clock(time)} <span className="text-slate-600">/</span> {clock(duration)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn btn-icon" onClick={() => togglePlay()} disabled={live} title="Play / Pause (Space)">
          {paused ? <IconPlay /> : <IconPause />}
        </button>
        <button className="btn btn-icon" onClick={restart} disabled={live} title="Restart">
          <IconRestart />
        </button>
        <button className="btn btn-icon" onClick={() => stepFrames(-1, fps)} disabled={live} title="Previous frame (←)">
          <IconStepBack />
        </button>
        <button className="btn btn-icon" onClick={() => stepFrames(1, fps)} disabled={live} title="Next frame (→)">
          <IconStepForward />
        </button>

        <div className="mx-1 h-5 w-px bg-ink-500" />

        <div className="flex items-center gap-1">
          {PLAYBACK_RATES.map((r) => (
            <button
              key={r}
              onClick={() => { setRate(r); setRateState(r) }}
              disabled={live}
              className={`btn px-2 py-1 font-mono text-[11px] ${rate === r ? 'btn-primary' : ''}`}
            >
              {r}x
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="chip">Frame {Math.round(time * fps)}</span>
          <button className="btn btn-icon" onClick={() => toggleFullscreen(containerRef.current)} title="Fullscreen (F)">
            <IconFullscreen />
          </button>
        </div>
      </div>
    </div>
  )
}
