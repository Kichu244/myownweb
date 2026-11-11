import { useEffect, useState } from 'react'

type Position = { x: number; y: number } | null

/** Viewport-level crosshair inspired by the supplied Axis Cursor example. */
export default function AxisCursor({ enabled }: { enabled: boolean }) {
  const [position, setPosition] = useState<Position>(null)

  useEffect(() => {
    if (!enabled) return
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!pointer.matches) return
    const previousCursor = document.documentElement.style.cursor
    document.documentElement.style.cursor = 'none'
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      setPosition({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.style.cursor = previousCursor
    }
  }, [enabled])

  if (!enabled || !position) return null
  return <div className="axis-cursor" aria-hidden="true">
    <span className="axis-cursor-vertical" style={{ left: position.x }} />
    <span className="axis-cursor-horizontal" style={{ top: position.y }} />
    <span className="axis-cursor-dot" style={{ left: position.x, top: position.y }} />
    <span className="axis-cursor-label" style={{ left: position.x, top: position.y }}>X: {Math.round(position.x)} · Y: {Math.round(position.y)}</span>
  </div>
}
