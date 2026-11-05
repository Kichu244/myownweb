import React, { memo } from 'react'
import { MousePointer2 } from 'lucide-react'
import type { SwarmIdentity } from './swarmTypes'

type SwarmCursorProps = {
  identity: SwarmIdentity
  register: (element: HTMLSpanElement | null) => void
}

function SwarmCursorComponent({ identity, register }: SwarmCursorProps) {
  return <span
    ref={register}
    className="swarm-cursor"
    aria-hidden="true"
    data-identity={identity.id}
    data-state="waiting"
    title={`${identity.name} · Waiting for task`}
    style={{ '--cursor-colour': identity.colour } as React.CSSProperties}
  >
    <MousePointer2 />
    <span className="swarm-cursor-label"><strong>{identity.name}</strong><small>waiting</small></span>
    <small className="swarm-cursor-tool" style={{ display: 'none' }}></small>
  </span>
}

export default memo(SwarmCursorComponent)
