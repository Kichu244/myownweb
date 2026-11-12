import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MousePointer2 } from 'lucide-react'
import SwarmLoader, { type SwarmPoint } from './SwarmLoader'
import type { SwarmPhase } from './swarmTypes'

const SwarmStudio = lazy(() => import('./SwarmStudio'))
const getAgentCount = () => 15

export default function SwarmController({ enabled }: { enabled: boolean }) {
  const [phase, setPhase] = useState<SwarmPhase>('inactive')
  const [spawnOrigin, setSpawnOrigin] = useState<SwarmPoint>({ x: 0, y: 0 })
  const [agentCount, setAgentCount] = useState(getAgentCount)
  const activateRef = useRef<HTMLButtonElement>(null)
  const active = phase !== 'inactive'
  const finishLoading = useCallback(() => setPhase('active'), [])

  useEffect(() => {
    if (enabled || phase === 'inactive') return
    document.documentElement.classList.remove('swarm-canvas-active')
    setPhase('inactive')
  }, [enabled, phase])

  const exitStudio = () => {
    document.documentElement.classList.remove('swarm-canvas-active')
    setPhase('inactive')
    window.requestAnimationFrame(() => activateRef.current?.focus())
  }

  return <>
    <button
      ref={activateRef}
      className={`swarm-activate${active ? ' is-active' : ''}`}
      type="button"
      title={active ? 'Swarm Studio is active' : enabled ? 'Activate Swarm Mouse' : 'Enable Swarm Cursor in Developer settings'}
      aria-label={active ? 'Swarm Studio is active' : enabled ? 'Activate Swarm Mouse' : 'Swarm Mouse disabled. Enable Swarm Cursor in Developer settings.'}
      aria-pressed={active}
      data-label={enabled ? 'SWARM' : 'OFF'}
      disabled={!enabled || active}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          document.documentElement.classList.add('swarm-canvas-active')
        }
        setAgentCount(getAgentCount())
        setSpawnOrigin({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
        window.dispatchEvent(new Event('swarm:activate'))
        setPhase('loading')
      }}
    >
      <MousePointer2 aria-hidden="true" />
      <span>{active ? 'SWARM' : enabled ? 'Activate Swarm Mouse' : 'Swarm Cursor Off'}</span>
    </button>
    {createPortal(
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'loading' && <SwarmLoader key="swarm-loader" origin={spawnOrigin} agentCount={agentCount} onComplete={finishLoading} />}
        {phase === 'active' && <motion.div
          key="swarm-studio-transition"
          className="swarm-studio-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: .18 }}
        ><Suspense fallback={null}><SwarmStudio origin={spawnOrigin} agentCount={agentCount} onExit={exitStudio} /></Suspense></motion.div>}
      </AnimatePresence>,
      document.body,
    )}
  </>
}
