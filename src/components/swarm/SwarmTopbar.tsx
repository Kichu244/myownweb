import { Activity, Orbit, Pause, Play, X } from 'lucide-react'
import type { SwarmActivity } from './swarmTypes'

type SwarmTopbarProps = {
  section: string
  cursorCount: number
  activity: SwarmActivity
  onExit: () => void
  onToggleScroll: () => void
}

export default function SwarmTopbar({ section, cursorCount, activity, onExit, onToggleScroll }: SwarmTopbarProps) {
  return <header className="swarm-topbar">
    <div className="swarm-brand"><Orbit aria-hidden="true" /><strong>SWARM STUDIO</strong><span className="swarm-live"><i /> ACTIVE</span></div>
    <div className="swarm-status-main">
      <span className="swarm-mode"><Activity aria-hidden="true" /> AUTONOMOUS DESIGN MODE</span>
      <span className="swarm-section">{section}</span>
    </div>
    <div className="swarm-status-end">
      <span className="swarm-cursor-count">{String(activity.runningTasks).padStart(2, '0')} / {String(cursorCount).padStart(2, '0')} ACTIVE</span>
      <span className="swarm-animation-state">{activity.animationState}</span>
      <span className="swarm-operation" title={`${activity.operation} · ${activity.completedTasks}/${activity.totalTasks} operations`}>{activity.operation}</span>
      <span className="swarm-progress" aria-label={`Construction progress ${activity.progress}%`}><i style={{ transform: `scaleX(${activity.progress / 100})` }} /></span>
      <span className="swarm-task-count">{activity.completedTasks}/{activity.totalTasks}</span>
      <button className="swarm-scroll-toggle" type="button" onClick={onToggleScroll} disabled={activity.scrollComplete} aria-label={activity.scrollComplete ? 'Automatic scrolling unavailable' : activity.scrollPaused ? 'Resume automatic scrolling' : 'Pause automatic scrolling'} title={activity.scrollComplete ? 'Automatic scrolling unavailable' : activity.scrollPaused ? 'Resume automatic scrolling' : 'Pause automatic scrolling'}>
        {activity.scrollPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </button>
      <button className="swarm-exit" type="button" onClick={onExit}><span>EXIT</span><X aria-hidden="true" /></button>
    </div>
  </header>
}
