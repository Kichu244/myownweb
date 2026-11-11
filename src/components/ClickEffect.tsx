import { useEffect, useRef, useState } from 'react'

type ClickMark = { id: number; x: number; y: number }

/** Brief viewport click burst adapted from the supplied Originkit sniper mode. */
export default function ClickEffect({ enabled }: { enabled: boolean }) {
  const [marks, setMarks] = useState<ClickMark[]>([])
  const nextId = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (!enabled) return
    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      const mark = { id: nextId.current++, x: event.clientX, y: event.clientY }
      setMarks((current) => [...current.slice(-12), mark])
      const timer = window.setTimeout(() => setMarks((current) => current.filter((item) => item.id !== mark.id)), 460)
      timers.current.push(timer)
    }
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      timers.current.forEach(window.clearTimeout)
      timers.current = []
      setMarks([])
    }
  }, [enabled])

  if (!enabled) return null
  return <div className="click-effect-layer" aria-hidden="true">{marks.map((mark) => <svg className="click-effect-mark" key={mark.id} style={{ left: mark.x, top: mark.y }} viewBox="0 0 90 90">
    <circle cx="45" cy="45" r="13" />
    <path d="M45 7v19M45 64v19M7 45h19M64 45h19" />
    <path className="click-effect-diagonals" d="m19 19 5 5m47 47 5 5M71 19l-5 5M24 66l-5 5" />
  </svg>)}</div>
}
