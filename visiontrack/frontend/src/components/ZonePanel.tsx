import { useState } from 'react'

import { useStore } from '../lib/store'
import { IconEye, IconEyeOff, IconPolygon, IconTrash } from './Icons'

export function ZonePanel() {
  const zones = useStore((s) => s.zones)
  const zoneEditing = useStore((s) => s.zoneEditing)
  const setZoneEditing = useStore((s) => s.setZoneEditing)
  const patchZone = useStore((s) => s.patchZone)
  const removeZone = useStore((s) => s.removeZone)
  const zoneLog = useStore((s) => s.zoneLog)
  const video = useStore((s) => s.video)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  return (
    <section className="panel shrink-0">
      <header className="panel-header">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300">
          Zones <span className="ml-1 text-neon">{zones.length}</span>
        </h2>
        <button
          className={`btn ${zoneEditing ? 'btn-primary' : ''}`}
          disabled={!video}
          onClick={() => setZoneEditing(!zoneEditing)}
        >
          <IconPolygon className="h-3.5 w-3.5" />
          {zoneEditing ? 'Drawing…' : 'Draw zone'}
        </button>
      </header>

      {zones.length === 0 ? (
        <p className="px-3 py-3 font-mono text-[11px] leading-relaxed text-slate-600">
          No zones yet. Draw a polygon on the video to measure how long objects stay inside it.
        </p>
      ) : (
        <ul className="divide-y divide-ink-600/50">
          {zones.map((zone) => (
            <li key={zone.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: zone.color }} />
              {renaming === zone.id ? (
                <input
                  autoFocus
                  className="field flex-1 py-0.5"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => { void patchZone(zone.id, { name: draftName }); setRenaming(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { void patchZone(zone.id, { name: draftName }); setRenaming(null) }
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                <button
                  className="flex-1 truncate text-left font-mono text-[11px] text-slate-200 hover:text-neon"
                  onDoubleClick={() => { setRenaming(zone.id); setDraftName(zone.name) }}
                  title="Double-click to rename"
                >
                  {zone.name}
                </button>
              )}
              <button
                className="btn btn-ghost btn-icon"
                title={zone.visible ? 'Hide zone' : 'Show zone'}
                onClick={() => void patchZone(zone.id, { visible: !zone.visible })}
              >
                {zone.visible ? <IconEye className="h-3.5 w-3.5" /> : <IconEyeOff className="h-3.5 w-3.5" />}
              </button>
              <button
                className="btn btn-ghost btn-icon hover:text-danger"
                title="Delete zone"
                onClick={() => { if (confirm(`Delete zone "${zone.name}"?`)) void removeZone(zone.id) }}
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {zoneLog.length > 0 && (
        <div className="border-t border-ink-500/60">
          <div className="px-3 pt-2"><span className="label-mono">Zone events</span></div>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto px-3 py-1.5">
            {zoneLog.map((entry) => (
              <li key={entry.id} className="font-mono text-[10px] leading-relaxed text-slate-500">
                {entry.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
