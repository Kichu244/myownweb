import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MousePointer2 } from 'lucide-react'
import { swarmIdentities } from './swarmTypes'

export type SwarmPoint = { x: number; y: number }
type SwarmLoaderProps = { origin: SwarmPoint; agentCount: number; onComplete: () => void }

const loadingDuration = 3000

export default function SwarmLoader({ origin, agentCount, onComplete }: SwarmLoaderProps) {
  const [progress, setProgress] = useState(0)
  const [activated, setActivated] = useState(false)
  const cursorRefs = useRef<(HTMLSpanElement | null)[]>([])
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const start = performance.now()
    let frameId = 0
    let finishTimer: number | null = null
    let completed = false

    const update = (now: number) => {
      const elapsed = Math.min(loadingDuration, now - start)
      const ratio = elapsed / loadingDuration
      const nextProgress = Math.min(100, Math.floor(ratio * 100))
      setProgress((current) => current === nextProgress ? current : nextProgress)

      cursorRefs.current.slice(0, agentCount).forEach((cursor, index) => {
        if (!cursor) return
        if (reduceMotion) {
          cursor.style.transform = `translate3d(${origin.x}px, ${origin.y}px, 0)`
          cursor.style.opacity = '1'
          return
        }
        const angle = index * Math.PI * 2 / agentCount + (index % 2 ? -1 : 1) * ratio * Math.PI * (1.2 + index * .06)
        const radiusX = Math.min(window.innerWidth * .28, 185) * Math.min(1, ratio * 3)
        const radiusY = Math.min(window.innerHeight * .2, 128) * Math.min(1, ratio * 3)
        const orbitX = window.innerWidth * .5 + Math.cos(angle) * radiusX
        const orbitY = window.innerHeight * .5 + Math.sin(angle * (index % 3 === 0 ? 1.15 : 1)) * radiusY
        const stagger = Math.min(1, Math.max(0, (elapsed - index * 75) / 420))
        const x = origin.x + (orbitX - origin.x) * stagger
        const y = origin.y + (orbitY - origin.y) * stagger
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${.45 + stagger * .55})`
        cursor.style.opacity = String(stagger)
      })

      if (elapsed < loadingDuration) {
        frameId = window.requestAnimationFrame(update)
        return
      }

      if (completed) return
      completed = true
      setActivated(true)
      finishTimer = window.setTimeout(onComplete, reduceMotion ? 0 : 360)
    }

    frameId = window.requestAnimationFrame(update)

    return () => {
      window.cancelAnimationFrame(frameId)
      if (finishTimer !== null) window.clearTimeout(finishTimer)
    }
  }, [agentCount, onComplete, origin, reduceMotion])

  return <motion.div
    className={`swarm-loader${reduceMotion ? ' is-reduced-motion' : ''}`}
    role="status"
    aria-live="polite"
    initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: .985 }}
    transition={{ duration: reduceMotion ? .08 : .2 }}
  >
    <div className="swarm-loader-particles" aria-hidden="true">
      {swarmIdentities.slice(0, agentCount).map((identity, index) => <span
        className="swarm-loader-agent"
        key={identity.id}
        ref={(element) => { cursorRefs.current[index] = element }}
        style={{ '--cursor-colour': identity.colour } as React.CSSProperties}
      ><MousePointer2 /><small>{identity.name}</small></span>)}
    </div>
    <div className="swarm-loader-content">
      <div className="swarm-loader-kicker">SWARM STUDIO / BOOT SEQUENCE</div>
      <div className="swarm-loader-progress">
        <div className="swarm-loader-agents-orbit" aria-hidden="true">
          {swarmIdentities.slice(0, agentCount).map((identity) => <i key={identity.id} style={{ '--cursor-colour': identity.colour } as React.CSSProperties} />)}
        </div>
        <strong>{progress}<span>%</span></strong>
      </div>
      <h1>{activated ? 'SWARM ENVIRONMENT ACTIVATED' : 'INITIALIZING SWARM ENVIRONMENT'}</h1>
      <p>{activated ? 'Agents entering the design workspace...' : 'Deploying autonomous design agents...'}</p>
      <div className="swarm-loader-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
    </div>
  </motion.div>
}
