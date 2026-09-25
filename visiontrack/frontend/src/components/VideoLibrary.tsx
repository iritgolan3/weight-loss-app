import { api } from '../api/client'
import { bytes, clock } from '../lib/format'
import { useStore } from '../lib/store'
import { Dialog } from './Dialog'
import { IconTrash } from './Icons'

export function VideoLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const videos = useStore((s) => s.videos)
  const current = useStore((s) => s.video)
  const selectVideo = useStore((s) => s.selectVideo)
  const removeVideo = useStore((s) => s.removeVideo)
  const loadDemo = useStore((s) => s.loadDemo)
  const system = useStore((s) => s.system)

  return (
    <Dialog
      open={open}
      title="Video library"
      subtitle={`${videos.length} file(s) in data/uploads`}
      onClose={onClose}
      footer={
        <>
          {system?.demo_video_available && (
            <button className="btn" onClick={() => { void loadDemo(); onClose() }}>Load demo</button>
          )}
          <button className="btn" onClick={onClose}>Close</button>
        </>
      }
    >
      {videos.length === 0 ? (
        <p className="py-6 text-center font-mono text-[11px] text-slate-600">
          No videos yet. Use “Upload video” to add one.
        </p>
      ) : (
        <ul className="divide-y divide-ink-600/60">
          {videos.map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-2">
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => { void selectVideo(v); onClose() }}
              >
                <div className="flex items-center gap-2">
                  <span className={`truncate font-mono text-xs ${current?.id === v.id ? 'text-neon' : 'text-slate-200'}`}>
                    {v.filename}
                  </span>
                  {v.analyzed && <span className="chip border-neon/40 text-neon">analysed</span>}
                  {v.id === 'demo' && <span className="chip">demo</span>}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {v.width}×{v.height} · {v.fps.toFixed(0)} fps · {clock(v.duration)} · {bytes(v.size_bytes)} · {v.codec}
                </div>
              </button>
              <a className="btn btn-ghost btn-icon" href={api.streamUrl(v.id)} target="_blank" rel="noreferrer" title="Open raw file">↗</a>
              <button
                className="btn btn-ghost btn-icon hover:text-danger"
                title="Delete video and its results"
                onClick={() => { if (confirm(`Delete ${v.filename}?`)) void removeVideo(v.id) }}
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
