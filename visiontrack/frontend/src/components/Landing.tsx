import { useRef, useState } from 'react'

import { pct } from '../lib/format'
import { useStore } from '../lib/store'
import { IconPlayCircle, IconUpload } from './Icons'

export function Landing() {
  const upload = useStore((s) => s.upload)
  const loadDemo = useStore((s) => s.loadDemo)
  const system = useStore((s) => s.system)
  const busy = useStore((s) => s.busy)
  const uploadProgress = useStore((s) => s.uploadProgress)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void upload(file)
  }

  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center p-6"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className={`panel w-full max-w-xl px-6 py-10 text-center transition ${dragging ? 'border-neon/60 shadow-neon' : ''}`}>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-neon/40 bg-neon/10">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-sm border-2 border-neon">
            <span className="h-1.5 w-1.5 rounded-full bg-neon" />
          </span>
        </div>

        <h1 className="font-mono text-2xl font-bold tracking-[0.3em] text-slate-100">VISIONTRACK</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.35em] text-neon">AI video analysis</p>
        <p className="mx-auto mt-5 max-w-sm text-[12px] leading-relaxed text-slate-500">
          Detect and track people and vehicles with persistent IDs, movement trails, dwell-time zones
          and exportable data. Everything runs locally on your machine.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
            e.target.value = ''
          }}
        />

        <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button className="btn btn-primary px-5 py-2.5 text-xs" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
            <IconUpload /> Upload video
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-600">or</span>
          <button
            className="btn px-5 py-2.5 text-xs"
            disabled={Boolean(busy) || !system?.demo_video_available}
            onClick={() => void loadDemo()}
            title={system?.demo_video_available ? undefined : 'No sample video installed'}
          >
            <IconPlayCircle /> Load demo
          </button>
        </div>

        {busy && (
          <div className="mx-auto mt-6 w-64">
            <div className="h-1 overflow-hidden rounded-full bg-ink-600">
              <div className="h-full rounded-full bg-neon transition-[width]"
                   style={{ width: uploadProgress !== null ? pct(uploadProgress) : '40%' }} />
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">{busy}</p>
          </div>
        )}

        {system && !system.demo_video_available && (
          <p className="mt-6 font-mono text-[10px] leading-relaxed text-slate-600">
            No demo video installed. Drop any .mp4 into <span className="text-slate-400">visiontrack/data/demo/</span> to
            enable demo mode, or upload a video above.
          </p>
        )}

        {system && !system.backend_ready && (
          <p className="mt-4 rounded border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[10px] text-danger">
            The detection stack is not installed. Run
            <span className="text-slate-200"> pip install -r backend/requirements.txt</span>.
          </p>
        )}

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-700">
          MP4 · MOV · AVI · MKV · drag &amp; drop supported
        </p>
      </div>
    </div>
  )
}
