import {
  AlignHorizontalDistributeCenter,
  Frame,
  Image,
  MousePointer2,
  Palette,
  PenTool,
  Scaling,
  Scan,
  Square,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { swarmTools, type SwarmCursorState, type SwarmTool } from './swarmTypes'

const toolIcons: Record<SwarmTool, LucideIcon> = {
  Move: MousePointer2,
  Frame,
  Shape: Square,
  Text: Type,
  Image,
  Colour: Palette,
  Selection: Scan,
  Transform: Scaling,
  Pen: PenTool,
  Arrange: AlignHorizontalDistributeCenter,
}

const toolDescriptions: Record<SwarmTool, string> = {
  Move: 'Selects and moves elements',
  Frame: 'Creates section and layout boundaries',
  Shape: 'Creates cards, containers, and shapes',
  Text: 'Places headings and descriptions',
  Image: 'Inserts images into the layout',
  Colour: 'Applies colours to elements',
  Selection: 'Selects individual interface elements',
  Transform: 'Resizes and positions elements',
  Pen: 'Creates decorative paths and visual elements',
  Arrange: 'Aligns and arranges elements',
}

const dividersAfter = new Set([1, 4, 7])

export default function SwarmToolbar({ cursors, registerMoveTool }: { cursors: SwarmCursorState[]; registerMoveTool: (element: HTMLDivElement | null) => void }) {
  return <aside className="swarm-toolbar" aria-label="Autonomous design tools" aria-disabled="true">
    {swarmTools.map((tool, index) => {
      const Icon = toolIcons[tool]
      const activeCursors = cursors.filter((cursor) => cursor.active && cursor.tool === tool)
      const active = activeCursors.length > 0
      return <div
        ref={tool === 'Move' ? registerMoveTool : undefined}
        className={`swarm-tool${active ? ' is-active' : ''}${dividersAfter.has(index) ? ' has-divider' : ''}`}
        data-swarm-tool={tool.toLowerCase()}
        key={tool}
        title={`${tool} Tool — ${toolDescriptions[tool]}`}
        aria-label={`${tool} tool${active ? `, used by ${activeCursors.map((cursor) => cursor.name).join(', ')}` : ''}`}
        aria-current={active ? 'true' : undefined}
        style={{ '--tool-colour': activeCursors[0]?.colour ?? '#63b7ff' } as React.CSSProperties}
      >
        <Icon aria-hidden="true" />
        {active && <span className="swarm-tool-cursor-dots" aria-hidden="true">{activeCursors.map((cursor) => <i key={cursor.id} style={{ '--tool-colour': cursor.colour } as React.CSSProperties} />)}</span>}
        <span className="swarm-tool-tooltip" role="tooltip">{tool} Tool</span>
      </div>
    })}
  </aside>
}
