import { MousePointer2 } from 'lucide-react'
import type { SwarmIdentity } from './swarmTypes'

type SwarmCursorProps = {
  identity: SwarmIdentity
  active: boolean
  tool: string | null
  operation: string
  state: string
  register: (element: HTMLSpanElement | null) => void
}

export default function SwarmCursor({ identity, active, tool, operation, state, register }: SwarmCursorProps) {
  return <span
    ref={register}
    className={`swarm-cursor${active ? ' is-working' : ''}`}
    aria-hidden="true"
    data-identity={identity.id}
    data-active={active ? 'true' : undefined}
    data-tool={active && tool ? tool.toLowerCase() : undefined}
    data-state={state.toLowerCase().replace(/ /g, '-')}
    title={`${identity.name} · ${active ? operation : state}`}
    style={{ '--cursor-colour': identity.colour } as React.CSSProperties}
  >
    <MousePointer2 />
    <span className="swarm-cursor-label"><strong>{identity.name}</strong><small>{state}</small></span>
    {active && tool && <small className="swarm-cursor-tool">{tool.toUpperCase()}</small>}
  </span>
}
