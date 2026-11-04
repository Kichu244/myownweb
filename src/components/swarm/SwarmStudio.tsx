import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import SwarmCursor from './SwarmCursor'
import { SwarmCoordinator } from './SwarmCoordinator'
import SwarmToolbar from './SwarmToolbar'
import SwarmTopbar from './SwarmTopbar'
import { swarmIdentities, type SwarmActivity } from './swarmTypes'
import type { SwarmPoint } from './SwarmLoader'

const sectionLabels: Record<string, string> = {
  hero: 'HERO SECTION',
  overview: 'OVERVIEW SECTION',
  about: 'ABOUT SECTION',
  skills: 'SKILLS SECTION',
  projects: 'PROJECTS SECTION',
  experience: 'EXPERIENCE SECTION',
  contact: 'CONTACT SECTION',
}

const initialActivity: SwarmActivity = {
  cursors: swarmIdentities.map((identity) => ({ ...identity, tool: null, operation: 'Waiting for task', active: false, state: 'initializing' })),
  operation: 'Deploying agents',
  runningTasks: 0,
  totalAgents: swarmIdentities.length,
  workingAgents: 0,
  coordinatingAgents: 0,
  waitingAgents: swarmIdentities.length,
  followingAgents: 0,
  progress: 0,
  completedTasks: 0,
  totalTasks: 0,
  animationState: 'INITIALIZING',
  scrollPaused: false,
  scrollComplete: false,
}

function findCurrentSection() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('main [data-swarm-section][id]'))
  const centerY = window.innerHeight * .42
  const current = sections
    .map((section) => ({ section, bounds: section.getBoundingClientRect() }))
    .filter(({ bounds }) => bounds.bottom > 0 && bounds.top < window.innerHeight)
    .sort((a, b) => {
      const aDistance = Math.abs((a.bounds.top + a.bounds.bottom) / 2 - centerY)
      const bDistance = Math.abs((b.bounds.top + b.bounds.bottom) / 2 - centerY)
      return aDistance - bDistance
    })[0]?.section
  return current?.dataset.swarmSection ?? 'hero'
}

export default function SwarmStudio({ origin, agentCount, onExit }: { origin: SwarmPoint; agentCount: number; onExit: () => void }) {
  const cursorCount = agentCount
  const [sectionId, setSectionId] = useState(findCurrentSection)
  const [activity, setActivity] = useState<SwarmActivity>(() => ({
    ...initialActivity,
    cursors: initialActivity.cursors.slice(0, cursorCount),
    totalAgents: cursorCount,
    waitingAgents: cursorCount,
  }))
  const cursorRefs = useRef<(HTMLSpanElement | null)[]>([])
  const frameRefs = useRef<(HTMLDivElement | null)[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLElement>(null)
  const moveToolRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<SwarmCoordinator | null>(null)
  const reduceMotion = useReducedMotion() ?? false
  const exitStudio = () => {
    engineRef.current?.stop()
    onExit()
  }

  useEffect(() => {
    const cursors = cursorRefs.current.slice(0, cursorCount).filter((cursor): cursor is HTMLSpanElement => cursor !== null)
    const frames = frameRefs.current.slice(0, cursorCount).filter((frame): frame is HTMLDivElement => frame !== null)
    const toolbar = toolbarRef.current
    const moveTool = moveToolRef.current
    const overlay = overlayRef.current
    if (cursors.length !== cursorCount || frames.length !== cursors.length || !toolbar || !moveTool || !overlay) return
    const engine = new SwarmCoordinator(cursors, frames, toolbar, moveTool, overlay, origin, (nextActivity) => {
      setActivity(nextActivity)
    }, setSectionId, reduceMotion)
    engineRef.current = engine
    engine.start()
    return () => {
      engine.stop()
      engineRef.current = null
    }
  }, [cursorCount, origin, reduceMotion])

  return <div className={`swarm-studio${reduceMotion ? ' is-reduced-motion' : ''}`} ref={(element) => { toolbarRef.current = element }}>
    <SwarmTopbar
      section={sectionLabels[sectionId] ?? `${sectionId.toUpperCase()} SECTION`}
      activity={activity}
      onExit={exitStudio}
      onToggleScroll={() => engineRef.current?.toggleAutoScroll()}
    />
    <SwarmToolbar cursors={activity.cursors} registerMoveTool={(element) => { moveToolRef.current = element }} />
    <div className="swarm-construction-layer" ref={overlayRef} aria-hidden="true" />
    <div className="swarm-cursor-layer" aria-hidden="true">
      {swarmIdentities.slice(0, cursorCount).map((identity, index) => <SwarmCursor
        identity={identity}
        active={activity.cursors[index]?.active ?? false}
        tool={activity.cursors[index]?.tool ?? null}
        operation={activity.cursors[index]?.operation ?? 'Waiting for task'}
        state={activity.cursors[index]?.state ?? 'waiting'}
        key={identity.id}
        register={(element) => { cursorRefs.current[index] = element }}
      />)}
      {swarmIdentities.slice(0, cursorCount).map((identity, index) => <div
        className="swarm-selection"
        ref={(element) => { frameRefs.current[index] = element }}
        key={`${identity.id}-frame`}
        aria-hidden="true"
      ><i /><i /><i /><i /></div>)}
    </div>
    <div className="swarm-activation-notice" aria-live="polite">SWARM ENVIRONMENT ACTIVATED</div>
  </div>
}
