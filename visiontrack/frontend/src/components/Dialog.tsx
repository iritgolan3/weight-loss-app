import { useEffect, type ReactNode } from 'react'

import { IconClose } from './Icons'

interface Props {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}

export function Dialog({ open, title, subtitle, onClose, children, footer, width = 'max-w-2xl' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
         role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div
        className={`panel flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-b-none sm:rounded-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-500/60 px-4 py-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-neon">{title}</h2>
            {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-ink-500/60 px-4 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[10px] leading-relaxed text-slate-600">{hint}</p>}
    </label>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-ink-600 bg-ink-900/60 px-2.5 py-1.5">
      <span className="font-mono text-[11px] text-slate-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#39ff14]"
      />
    </label>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2.5 mt-1 border-b border-ink-600/70 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
      {children}
    </h3>
  )
}
