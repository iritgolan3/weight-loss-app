import { bytes, clock } from '../lib/format'
import { useStore } from '../lib/store'
import { IconPlayCircle } from './Icons'

export function VideoInfoCard() {
  const video = useStore((s) => s.video)
  const job = useStore((s) => s.job)
  const startAnalysis = useStore((s) => s.startAnalysis)
  const settings = useStore((s) => s.settings)
  const liveOptions = useStore((s) => s.liveOptions)
  const busy = useStore((s) => s.busy)

  if (!video) return null
  const running = job?.status === 'running' || job?.status === 'queued' || job?.status === 'stopping'
  const analysis = video.analysis

  return (
    <section className="panel shrink-0">
      <header className="panel-header">
        <h2 className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300" title={video.filename}>
          {video.filename}
        </h2>
        {video.kind === 'live' ? (
          <span className="chip border-neon/50 text-neon">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-neon" />live
          </span>
        ) : (
          <span className="chip">{video.codec}</span>
        )}
      </header>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2">
        <div><dt className="label-mono">Resolution</dt><dd className="value-mono text-xs">{video.width} × {video.height}</dd></div>
        <div><dt className="label-mono">FPS</dt><dd className="value-mono text-xs">{video.fps.toFixed(2)}</dd></div>
        {video.kind === 'live' ? (
          <div className="col-span-2">
            <dt className="label-mono">Source</dt>
            <dd className="truncate font-mono text-xs text-slate-100" title={video.source ?? ''}>
              {video.source}
            </dd>
          </div>
        ) : (
          <>
            <div><dt className="label-mono">Duration</dt><dd className="value-mono text-xs">{clock(video.duration)}</dd></div>
            <div><dt className="label-mono">Size</dt><dd className="value-mono text-xs">{bytes(video.size_bytes)}</dd></div>
          </>
        )}
      </dl>

      {analysis && video.kind !== 'live' ? (
        <div className="border-t border-ink-500/60 px-3 py-2">
          <span className="label-mono">Last analysis</span>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-500">
            {analysis.unique_objects} objects · {analysis.frames_analyzed} frames analysed ·
            {' '}{analysis.model} on {analysis.device.toUpperCase()}
            {analysis.stopped_early && ' · stopped early'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(analysis.class_counts).map(([cls, count]) => (
              <span key={cls} className="chip">{cls} <span className="text-neon">{count}</span></span>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-ink-500/60 px-3 py-2.5">
          <button
            className="btn btn-primary w-full py-2"
            disabled={running || Boolean(busy)}
            onClick={() => void startAnalysis()}
          >
            <IconPlayCircle /> Start analysis
          </button>
          <p className="mt-1.5 text-center font-mono text-[10px] text-slate-600">
            mode: {settings.mode.replace('_', ' ')} · model: {settings.model}
            {video.kind === 'live' && (liveOptions.maxDuration
              ? ` · stops after ${Math.round(liveOptions.maxDuration / 60)} min`
              : ' · runs until stopped')}
          </p>
        </div>
      )}
    </section>
  )
}
