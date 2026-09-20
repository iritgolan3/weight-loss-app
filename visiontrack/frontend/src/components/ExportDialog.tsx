import { useEffect, useRef, useState } from 'react'

import { api, socketUrl } from '../api/client'
import type { SocketEvent } from '../api/types'
import { pct } from '../lib/format'
import { useStore } from '../lib/store'
import { Dialog, SectionTitle, Toggle } from './Dialog'
import { IconExport } from './Icons'

export function ExportDialog() {
  const open = useStore((s) => s.exportOpen)
  const close = useStore((s) => s.openExport)
  const video = useStore((s) => s.video)
  const settings = useStore((s) => s.settings)
  const selectedId = useStore((s) => s.selectedId)
  const exportJob = useStore((s) => s.exportJob)
  const setExportJob = useStore((s) => s.setExportJob)
  const reportError = useStore((s) => s.reportError)
  const toast = useStore((s) => s.toast)

  const [options, setOptions] = useState({
    show_boxes: true, show_labels: true, show_confidence: true,
    show_trajectories: true, show_timers: true, show_zones: true, show_hud: true,
    highlight_selected: false,
  })
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => () => socketRef.current?.close(), [])

  const analyzed = Boolean(video?.analyzed)

  const startExport = async () => {
    if (!video) return
    try {
      const job = await api.exportVideo(video.id, {
        ...options,
        trajectory_length: settings.trajectory_length,
        trajectory_thickness: settings.trajectory_thickness,
        trajectory_color: settings.trajectory_color,
        selected_color: settings.selected_color,
        selected_id: options.highlight_selected ? selectedId : null,
      })
      setExportJob(job)
      socketRef.current?.close()
      const socket = new WebSocket(socketUrl(`/ws/exports/${job.id}`))
      socketRef.current = socket
      socket.onmessage = (message) => {
        const event = JSON.parse(message.data as string) as SocketEvent
        if (event.type !== 'export') return
        setExportJob(event.job)
        if (event.job.status === 'completed') {
          toast('success', 'Annotated video ready', event.job.filename ?? undefined)
        } else if (event.job.status === 'failed' && event.job.error) {
          toast('error', event.job.error.message, event.job.error.hint ?? undefined)
        }
      }
    } catch (error) {
      reportError(error, 'Export failed to start.')
    }
  }

  return (
    <Dialog
      open={open}
      title="Export"
      subtitle="Render an annotated MP4, or download the raw detection and tracking data."
      onClose={() => close(false)}
      footer={<button className="btn" onClick={() => close(false)}>Close</button>}
    >
      {!analyzed && (
        <div className="mb-4 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 font-mono text-[11px] text-amber">
          This video has no stored analysis yet. Run START ANALYSIS before exporting.
        </div>
      )}

      <SectionTitle>Annotated video</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle label="Bounding boxes" checked={options.show_boxes} onChange={(v) => setOptions({ ...options, show_boxes: v })} />
        <Toggle label="Labels + IDs" checked={options.show_labels} onChange={(v) => setOptions({ ...options, show_labels: v })} />
        <Toggle label="Confidence" checked={options.show_confidence} onChange={(v) => setOptions({ ...options, show_confidence: v })} />
        <Toggle label="Trajectories" checked={options.show_trajectories} onChange={(v) => setOptions({ ...options, show_trajectories: v })} />
        <Toggle label="Timers" checked={options.show_timers} onChange={(v) => setOptions({ ...options, show_timers: v })} />
        <Toggle label="Zones" checked={options.show_zones} onChange={(v) => setOptions({ ...options, show_zones: v })} />
        <Toggle label="Timestamp HUD" checked={options.show_hud} onChange={(v) => setOptions({ ...options, show_hud: v })} />
        <Toggle
          label={selectedId !== null ? `Highlight ID ${selectedId}` : 'Highlight selected (none)'}
          checked={options.highlight_selected}
          onChange={(v) => setOptions({ ...options, highlight_selected: v })}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={!analyzed || exportJob?.status === 'running'} onClick={() => void startExport()}>
          <IconExport className="h-3.5 w-3.5" />
          {exportJob?.status === 'running' ? 'Rendering…' : 'Render annotated MP4'}
        </button>
        {exportJob && (
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-600">
              <div
                className={`h-full rounded-full ${exportJob.status === 'failed' ? 'bg-danger' : 'bg-neon'}`}
                style={{ width: pct(exportJob.progress) }}
              />
            </div>
            <span className="font-mono text-[10px] text-slate-400">{pct(exportJob.progress)}</span>
          </div>
        )}
        {exportJob?.status === 'completed' && (
          <a className="btn btn-primary" href={api.exportDownloadUrl(exportJob.id)} download>
            Download MP4
          </a>
        )}
      </div>
      {exportJob?.output && exportJob.status === 'completed' && (
        <p className="mt-2 break-all font-mono text-[10px] text-slate-600">Saved to {exportJob.output}</p>
      )}

      <div className="mt-6">
        <SectionTitle>Detection data</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <a className={`btn ${analyzed ? '' : 'pointer-events-none opacity-40'}`}
             href={video ? api.dataExportUrl(video.id, 'json') : '#'} download>
            Tracks JSON
          </a>
          <a className={`btn ${analyzed ? '' : 'pointer-events-none opacity-40'}`}
             href={video ? api.dataExportUrl(video.id, 'csv', 'detections') : '#'} download>
            Detections CSV
          </a>
          <a className={`btn ${analyzed ? '' : 'pointer-events-none opacity-40'}`}
             href={video ? api.dataExportUrl(video.id, 'csv', 'tracks') : '#'} download>
            Tracks CSV
          </a>
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-600">
          JSON contains per-object first/last seen, visible duration, zone dwell time and the full
          trajectory. CSV contains one row per detection per analysed frame.
        </p>
      </div>
    </Dialog>
  )
}
