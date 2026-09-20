import { useEffect, useState } from 'react'

/** Observed content-box size of an element, for layout maths that CSS cannot do. */
export function useElementSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    setSize({ width: element.clientWidth, height: element.clientHeight })
    return () => observer.disconnect()
  }, [ref])

  return size
}

/** Largest box with `aspect` that fits inside the container (letterbox fit). */
export function containFit(containerW: number, containerH: number, aspect: number) {
  if (containerW <= 0 || containerH <= 0 || !Number.isFinite(aspect) || aspect <= 0) {
    return { width: 0, height: 0 }
  }
  const byWidth = { width: containerW, height: containerW / aspect }
  if (byWidth.height <= containerH) return byWidth
  return { width: containerH * aspect, height: containerH }
}
