import { useStore } from '../lib/store'
import { IconClose } from './Icons'

const TONE = {
  error: 'border-danger/50 bg-danger/10 text-danger',
  success: 'border-neon/40 bg-neon/10 text-neon',
  info: 'border-ink-400 bg-ink-700 text-slate-200',
} as const

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,460px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-md border px-3 py-2 shadow-panel backdrop-blur ${TONE[toast.kind]}`}
          role="status"
        >
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] leading-snug">{toast.title}</p>
            {toast.body && <p className="mt-1 text-[11px] leading-snug text-slate-400">{toast.body}</p>}
          </div>
          <button className="btn btn-ghost btn-icon shrink-0" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
