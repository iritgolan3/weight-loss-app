/**
 * Shared handle on the <video> element.
 *
 * Playback controls live in their own component but must drive the same media
 * element the stage renders, so the ref is shared here rather than pushed
 * through React state (which would re-render the stage on every frame).
 */
export const playerRef: { current: HTMLVideoElement | null } = { current: null }

export const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2] as const

export function play(): void {
  void playerRef.current?.play().catch(() => undefined)
}

export function pause(): void {
  playerRef.current?.pause()
}

export function togglePlay(): void {
  const el = playerRef.current
  if (!el) return
  if (el.paused) play()
  else pause()
}

export function seek(seconds: number): void {
  const el = playerRef.current
  if (!el || !Number.isFinite(el.duration)) return
  el.currentTime = Math.max(0, Math.min(el.duration, seconds))
}

export function restart(): void {
  seek(0)
  play()
}

export function stepFrames(frames: number, fps: number): void {
  const el = playerRef.current
  if (!el) return
  el.pause()
  seek(el.currentTime + frames / Math.max(1, fps))
}

export function setRate(rate: number): void {
  if (playerRef.current) playerRef.current.playbackRate = rate
}

export function toggleFullscreen(container: HTMLElement | null): void {
  if (!container) return
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  else void container.requestFullscreen?.().catch(() => undefined)
}
