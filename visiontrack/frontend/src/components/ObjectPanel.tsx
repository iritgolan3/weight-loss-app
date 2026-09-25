import { useMemo, useState } from 'react'

import type { LiveObject, TrackSummary } from '../api/types'
import { clock, humanDuration } from '../lib/format'
import { seek } from '../lib/player'
import { useStore } from '../lib/store'

type Row = {
  id: number
  cls: string
  seen: number
  status: string
  confidence: number
  zoneName: string | null
  zoneTime: number
  firstSeen: number
  active: boolean
}

function fromLive(objects: LiveObject[]): Row[] {
  return objects.map((o) => {
    const zone = o.zones.find((z) => z.inside)
    return {
      id: o.id,
      cls: o.cls,
      seen: o.visible_duration,
      status: o.status,
      confidence: o.confidence,
      zoneName: zone?.zone_name ?? null,
      zoneTime: zone?.total_time ?? 0,
      firstSeen: o.first_seen,
      active: true,
    }
  })
}

function fromTracks(tracks: TrackSummary[], now: number): Row[] {
  return tracks.map((t) => {
    const zone = t.zones.find((z) => z.total_time > 0)
    return {
      id: t.id,
      cls: t.cls,
      seen: t.visible_duration,
      status: t.status,
      confidence: t.max_confidence,
      zoneName: zone?.zone_name ?? null,
      zoneTime: zone?.total_time ?? 0,
      firstSeen: t.first_seen,
      active: now >= t.first_seen && now <= t.last_seen + 0.4,
    }
  })
}

export function ObjectPanel() {
  const viewMode = useStore((s) => s.viewMode)
  const liveObjects = useStore((s) => s.liveObjects)
  const tracks = useStore((s) => s.tracks)
  const selectedId = useStore((s) => s.selectedId)
  const setSelected = useStore((s) => s.setSelected)
  const playbackTime = useStore((s) => s.playbackTime)
  const [filter, setFilter] = useState<string>('all')
  const [onlyActive, setOnlyActive] = useState(false)

  const rows = useMemo(
    () => (viewMode === 'live' ? fromLive(liveObjects) : fromTracks(tracks, playbackTime)),
    [viewMode, liveObjects, tracks, playbackTime],
  )

  const classes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.cls))).sort(),
    [rows],
  )

  const visible = useMemo(() => {
    let list = rows
    if (filter !== 'all') list = list.filter((r) => r.cls === filter)
    if (onlyActive) list = list.filter((r) => r.active)
    return [...list].sort((a, b) => (a.active === b.active ? a.id - b.id : a.active ? -1 : 1))
  }, [rows, filter, onlyActive])

  return (
    <section className="panel flex min-h-0 flex-1 flex-col">
      <header className="panel-header">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300">
          Tracked objects
          <span className="ml-2 text-neon">{visible.length}</span>
        </h2>
        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
            className="h-3 w-3 accent-[#39ff14]"
          />
          On screen
        </label>
      </header>

      {classes.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-ink-500/60 px-3 py-2">
          <button
            onClick={() => setFilter('all')}
            className={`chip ${filter === 'all' ? 'border-neon/50 text-neon' : ''}`}
          >
            all
          </button>
          {classes.map((cls) => (
            <button
              key={cls}
              onClick={() => setFilter(cls)}
              className={`chip ${filter === cls ? 'border-neon/50 text-neon' : ''}`}
            >
              {cls}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center font-mono text-[11px] text-slate-600">
            {viewMode === 'live'
              ? 'Waiting for detections…'
              : 'No tracked objects yet. Run an analysis to populate this list.'}
          </p>
        ) : (
          <ul className="divide-y divide-ink-600/60">
            {visible.map((row) => {
              const selected = selectedId === row.id
              return (
                <li key={row.id}>
                  <button
                    onClick={() => {
                      setSelected(selected ? null : row.id)
                      if (viewMode === 'playback' && !row.active) seek(row.firstSeen)
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                      selected ? 'bg-magenta/12' : 'hover:bg-ink-700/70'
                    }`}
                  >
                    <span
                      className={`h-8 w-1 shrink-0 rounded-full ${
                        selected ? 'bg-magenta' : row.active ? 'bg-neon' : 'bg-ink-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`font-mono text-xs uppercase tracking-wider ${selected ? 'text-magenta' : 'text-slate-200'}`}>
                          {row.cls}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">ID {row.id}</span>
                        {!row.active && viewMode === 'playback' && (
                          <span className="font-mono text-[9px] uppercase text-slate-600">off-screen</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
                        <span>Seen: <span className="text-slate-300">{clock(row.seen)}</span></span>
                        {row.zoneName && (
                          <span>
                            {row.zoneName}: <span className="text-neon">{humanDuration(row.zoneTime)}</span>
                          </span>
                        )}
                        <span className={row.status === 'moving' ? 'text-neon/80' : 'text-amber/80'}>
                          {row.status}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-600">
                      {(row.confidence * 100).toFixed(0)}%
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
