import { clock, pct } from '../lib/format'
import { useStore } from '../lib/store'

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'neon' | 'dim' }) {
  const color = tone === 'neon' ? 'text-neon' : tone === 'dim' ? 'text-slate-500' : 'text-slate-100'
  return (
    <div className="flex min-w-[84px] flex-col gap-0.5">
      <span className="label-mono">{label}</span>
      <span className={`font-mono text-sm tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

export function StatsBar() {
  const job = useStore((s) => s.job)
  const video = useStore((s) => s.video)
  const system = useStore((s) => s.system)
  const tracks = useStore((s) => s.tracks)
  const liveObjects = useStore((s) => s.liveObjects)
  const viewMode = useStore((s) => s.viewMode)

  const stats = job?.stats
  const running = job?.status === 'running' || job?.status === 'stopping'
  const live = Boolean(job?.live || video?.kind === 'live')
  const tracked = viewMode === 'live' ? liveObjects.length : tracks.length
  const device = (job?.device ?? system?.device_in_use ?? 'cpu').toUpperCase()

  return (
    <div className="panel flex flex-wrap items-center gap-x-6 gap-y-3 px-3 py-2.5">
      <Stat label="Processing FPS" value={stats ? stats.processing_fps.toFixed(1) : '—'} tone={running ? 'neon' : 'default'} />
      <Stat label="Detection FPS" value={stats ? stats.detection_fps.toFixed(1) : '—'} />
      <Stat label="Video FPS" value={video ? video.fps.toFixed(0) : '—'} tone="dim" />
      <Stat label={viewMode === 'live' ? 'Tracked now' : 'Objects'} value={String(tracked)} tone="neon" />
      <Stat label="Unique IDs" value={stats ? String(stats.unique_objects) : String(tracks.length)} />
      <Stat label="Device" value={device} tone="dim" />
      {live && stats && <Stat label="Elapsed" value={clock(stats.elapsed)} />}
      {stats && stats.eta !== null && running && (
        <Stat label={live ? 'Stops in' : 'ETA'} value={clock(stats.eta)} />
      )}

      {job && (
        <div className="ml-auto flex min-w-[180px] flex-1 items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-600">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${
                job.status === 'failed' ? 'bg-danger' : 'bg-neon'
              }`}
              style={{ width: pct(job.progress) }}
            />
            {running && (
              <div className="scan-line absolute inset-y-0 w-1/4 animate-sweep opacity-70" />
            )}
          </div>
          <span className="font-mono text-[11px] tabular-nums text-slate-400">
            {live && job.progress === 0 ? '—' : pct(job.progress)}
          </span>
          <span className={`chip ${
            job.status === 'failed' ? 'border-danger/50 text-danger'
              : job.status === 'completed' ? 'border-neon/40 text-neon' : ''
          }`}>
            {job.status}
          </span>
        </div>
      )}
    </div>
  )
}
