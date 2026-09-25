import { useRef } from 'react'

import { useStore } from '../lib/store'
import {
  IconCamera, IconExport, IconFolder, IconPlayCircle, IconSettings, IconStop, IconUpload,
} from './Icons'

export function TopBar({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const video = useStore((s) => s.video)
  const job = useStore((s) => s.job)
  const system = useStore((s) => s.system)
  const busy = useStore((s) => s.busy)
  const upload = useStore((s) => s.upload)
  const startAnalysis = useStore((s) => s.startAnalysis)
  const stopAnalysis = useStore((s) => s.stopAnalysis)
  const openSettings = useStore((s) => s.openSettings)
  const openCamera = useStore((s) => s.openCamera)
  const openExport = useStore((s) => s.openExport)
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const running = job?.status === 'running' || job?.status === 'queued' || job?.status === 'stopping'

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-600/70 bg-ink-850/90 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-7 w-7 items-center justify-center rounded border border-neon/40 bg-neon/10">
          <span className="absolute h-3 w-3 rounded-sm border border-neon" />
          <span className="h-1 w-1 rounded-full bg-neon" />
        </span>
        <div className="leading-none">
          <h1 className="font-mono text-sm font-bold tracking-[0.22em] text-slate-100">VISIONTRACK</h1>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">AI video analysis</p>
        </div>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-ink-600 sm:block" />

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

      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
          <IconUpload className="h-3.5 w-3.5" /> Upload video
        </button>
        <button className="btn" onClick={onOpenLibrary}>
          <IconFolder className="h-3.5 w-3.5" /> Open video
        </button>
        <button className="btn" onClick={() => openCamera(true)}>
          <IconCamera className="h-3.5 w-3.5" /> Connect camera
        </button>
        <button
          className="btn btn-primary"
          disabled={!video || running || Boolean(busy)}
          onClick={() => void startAnalysis()}
        >
          <IconPlayCircle className="h-3.5 w-3.5" /> Start analysis
        </button>
        <button className="btn btn-danger" disabled={!running} onClick={() => void stopAnalysis()}>
          <IconStop className="h-3.5 w-3.5" /> Stop
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {video?.analyzed && video.kind !== 'live' && (
          <div className="mr-1 hidden items-center rounded-md border border-ink-600 bg-ink-900 p-0.5 sm:flex">
            {(['live', 'playback'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                disabled={mode === 'live' && !running}
                className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                  viewMode === mode ? 'bg-neon/15 text-neon' : 'text-slate-500 hover:text-slate-300'
                } disabled:opacity-30`}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
        <span className="chip hidden md:inline-flex">
          {(job?.device ?? system?.device_in_use ?? '—').toUpperCase()}
        </span>
        <button className="btn" onClick={() => openExport(true)} disabled={!video}>
          <IconExport className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export</span>
        </button>
        <button className="btn btn-icon" onClick={() => openSettings(true)} title="Settings">
          <IconSettings />
        </button>
      </div>
    </header>
  )
}
