import { useMemo } from 'react'

import { clock, humanDuration } from '../lib/format'
import { seek } from '../lib/player'
import { useStore } from '../lib/store'

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="label-mono">{label}</span>
      <span className="text-right font-mono text-[11px] tabular-nums text-slate-200">
        {value}
        {hint && <span className="ml-1 text-[9px] uppercase text-slate-600">{hint}</span>}
      </span>
    </div>
  )
}

export function ObjectDetail() {
  const selectedId = useStore((s) => s.selectedId)
  const tracks = useStore((s) => s.tracks)
  const liveObjects = useStore((s) => s.liveObjects)
  const viewMode = useStore((s) => s.viewMode)
  const setSelected = useStore((s) => s.setSelected)

  const track = useMemo(
    () => tracks.find((t) => t.id === selectedId) ?? null,
    [tracks, selectedId],
  )
  const live = useMemo(
    () => liveObjects.find((o) => o.id === selectedId) ?? null,
    [liveObjects, selectedId],
  )

  if (selectedId === null) return null
  const cls = track?.cls ?? live?.cls ?? '—'
  const speed = track?.speed_px_per_s ?? live?.speed_px_per_s ?? null
  const zones = track?.zones ?? live?.zones ?? []

  return (
    <section className="panel shrink-0">
      <header className="panel-header">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-magenta">
          {cls} · ID {selectedId}
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)} title="Clear selection">
          ✕
        </button>
      </header>
      <div className="divide-y divide-ink-600/50 px-3 py-1.5">
        {track ? (
          <>
            <Row label="First seen" value={clock(track.first_seen)} />
            <Row label="Last seen" value={clock(track.last_seen)} />
            <Row label="Visible for" value={humanDuration(track.visible_duration)} />
            <Row label="Detections" value={String(track.samples)} />
            <Row label="Frames" value={`${track.first_frame} → ${track.last_frame}`} />
            <Row label="Confidence" value={`${(track.max_confidence * 100).toFixed(0)}% peak`} />
            <Row label="Status" value={track.status} />
            <Row
              label="Speed"
              value={speed !== null ? `${speed.toFixed(0)} px/s` : 'unavailable'}
              hint={speed !== null ? 'image space' : undefined}
            />
            <Row label="Real-world speed" value="unavailable" hint="needs calibration" />
            <Row label="Trajectory pts" value={String(track.trajectory?.length ?? 0)} />
          </>
        ) : live ? (
          <>
            <Row label="First seen" value={clock(live.first_seen)} />
            <Row label="Visible for" value={humanDuration(live.visible_duration)} />
            <Row label="Confidence" value={`${(live.confidence * 100).toFixed(0)}%`} />
            <Row label="Status" value={live.status} />
            <Row
              label="Speed"
              value={speed !== null ? `${speed.toFixed(0)} px/s` : 'unavailable'}
              hint={speed !== null ? 'image space' : undefined}
            />
          </>
        ) : (
          <p className="py-3 text-center font-mono text-[11px] text-slate-600">
            This object is not in the current results.
          </p>
        )}

        {zones.length > 0 && (
          <div className="py-2">
            <span className="label-mono">Zone time</span>
            <ul className="mt-1 space-y-1">
              {zones.map((z) => (
                <li key={z.zone_id} className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-400">{z.zone_name}</span>
                  <span className={z.total_time > 0 ? 'text-neon' : 'text-slate-600'}>
                    {humanDuration(z.total_time)}
                    <span className="ml-1 text-slate-600">×{z.entries}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {track && viewMode === 'playback' && (
        <div className="flex gap-2 border-t border-ink-500/60 px-3 py-2">
          <button className="btn flex-1" onClick={() => seek(track.first_seen)}>Jump to entry</button>
          <button className="btn flex-1" onClick={() => seek(track.last_seen)}>Jump to exit</button>
        </div>
      )}
    </section>
  )
}
