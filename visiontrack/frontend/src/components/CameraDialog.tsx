import { useState } from 'react'

import { useStore } from '../lib/store'
import { Dialog, Field, SectionTitle, Toggle } from './Dialog'
import { IconPlayCircle } from './Icons'

const LIMITS = [
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '30 min', value: 1800 },
  { label: 'No limit', value: null },
] as const

export function CameraDialog() {
  const open = useStore((s) => s.cameraOpen)
  const setOpen = useStore((s) => s.openCamera)
  const cameras = useStore((s) => s.cameras)
  const hint = useStore((s) => s.cameraHint)
  const scanning = useStore((s) => s.scanning)
  const scan = useStore((s) => s.scanCameras)
  const connect = useStore((s) => s.connectCamera)
  const busy = useStore((s) => s.busy)
  const liveOptions = useStore((s) => s.liveOptions)
  const setLiveOptions = useStore((s) => s.setLiveOptions)
  const [url, setUrl] = useState('')

  return (
    <Dialog
      open={open}
      title="Connect a camera"
      subtitle="A webcam plugged into this PC, or an IP camera on your network. Detection runs on the live feed exactly as it does on a file."
      onClose={() => setOpen(false)}
      footer={<button className="btn" onClick={() => setOpen(false)}>Close</button>}
    >
      <SectionTitle>Cameras on this PC</SectionTitle>
      <div className="mb-1 flex items-center gap-2">
        <button className="btn" onClick={() => void scan()} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Scan again'}
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          checks device 0–4
        </span>
      </div>

      {scanning && cameras.length === 0 ? (
        <p className="py-4 font-mono text-[11px] text-slate-600">Looking for cameras…</p>
      ) : cameras.length > 0 ? (
        <ul className="mt-3 divide-y divide-ink-600/50 border border-ink-500/70">
          {cameras.map((cam) => (
            <li key={cam.source}>
              <button
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-ink-700/70"
                disabled={Boolean(busy)}
                onClick={() => void connect(cam.source, cam.label)}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-neon" />
                <span className="flex-1">
                  <span className="block font-mono text-xs text-slate-100">{cam.label}</span>
                  <span className="block font-mono text-[10px] text-slate-500">
                    {cam.width}×{cam.height} · {cam.fps.toFixed(0)} fps · device {cam.source}
                  </span>
                </span>
                <span className="chip border-neon/40 text-neon">Connect</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border border-ink-600 bg-ink-900/60 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-500">
          {hint ?? 'No camera found yet. Press “Scan again”.'}
        </p>
      )}

      <div className="mt-6">
        <SectionTitle>IP or RTSP camera</SectionTitle>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => { e.preventDefault(); if (url.trim()) void connect(url.trim()) }}
        >
          <input
            className="field min-w-0 flex-1"
            placeholder="rtsp://user:pass@192.168.1.50:554/stream"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
          />
          <button className="btn btn-primary" type="submit" disabled={!url.trim() || Boolean(busy)}>
            Connect
          </button>
        </form>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-600">
          Include the username and password if the camera asks for them. An http:// MJPEG URL works too.
        </p>
      </div>

      <div className="mt-6">
        <SectionTitle>Live run</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stop after" hint="A live feed has no end, so it runs until this limit or until you press Stop.">
            <div className="flex flex-wrap gap-1">
              {LIMITS.map((limit) => (
                <button
                  key={limit.label}
                  onClick={() => setLiveOptions({ maxDuration: limit.value })}
                  className={`chip ${liveOptions.maxDuration === limit.value ? 'border-neon/50 text-neon' : ''}`}
                >
                  {limit.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Recording" hint="Writes an annotated MP4 into exports/ while the session runs.">
            <Toggle
              label="Record the annotated feed"
              checked={liveOptions.record}
              onChange={(v) => setLiveOptions({ record: v })}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 border border-ink-600 bg-ink-900/60 px-3 py-2.5">
        <p className="flex items-start gap-2 font-mono text-[10px] leading-relaxed text-slate-500">
          <IconPlayCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon" />
          <span>
            The camera is read by the Python backend on this PC, so it must be plugged into the
            machine running VisionTrack. Close any other app holding the camera first.
          </span>
        </p>
      </div>
    </Dialog>
  )
}
