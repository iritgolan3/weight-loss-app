/** Shared formatting helpers. All durations come from real frame timestamps. */

export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Reference-style timers: "37 sec", "2 min", "1 hour 15 min". */
export function humanDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem ? `${hours} hour ${rem} min` : `${hours} hour`
}

export function bytes(value: number): string {
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB']
  let v = value / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`
}

export function pct(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

const CLASS_COLORS: Record<string, string> = {
  person: '#39ff14',
  car: '#39ff14',
  truck: '#7dff5a',
  bus: '#7dff5a',
  bicycle: '#c6ff4d',
  motorcycle: '#c6ff4d',
}

export function classColor(cls: string): string {
  return CLASS_COLORS[cls] ?? '#39ff14'
}
