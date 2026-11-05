export const swarmTools = [
  'Move',
  'Frame',
  'Shape',
  'Text',
  'Image',
  'Colour',
  'Selection',
  'Transform',
  'Pen',
  'Arrange',
] as const

export type SwarmTool = typeof swarmTools[number]
export type SwarmIdentityId = `agent-${string}`
export type SwarmTargetKind = 'heading' | 'text' | 'image' | 'icon' | 'card' | 'style' | 'layout' | 'container'
export type SwarmElement = HTMLElement | SVGSVGElement

export type ElementClassification =
  | 'CONSTRUCTIBLE'
  | 'WAITING_FOR_RENDER'
  | 'READY_FOR_CONSTRUCTION'
  | 'TEMPORARILY_INTERACTIVE'
  | 'COMPLETED'

export type SectionPhase = 'PENDING' | 'ACTIVE' | 'CONSTRUCTING' | 'VERIFYING' | 'COMPLETED'

export type SwarmIdentity = {
  id: SwarmIdentityId
  name: string
  colour: string
}

export const swarmIdentities: SwarmIdentity[] = [
  { id: 'agent-01', name: 'AGENT 01', colour: '#258BFF' },
  { id: 'agent-02', name: 'AGENT 02', colour: '#A78BFA' },
  { id: 'agent-03', name: 'AGENT 03', colour: '#42D9F5' },
  { id: 'agent-04', name: 'AGENT 04', colour: '#F5B942' },
  { id: 'agent-05', name: 'AGENT 05', colour: '#43D9A3' },
  { id: 'agent-06', name: 'AGENT 06', colour: '#F477B7' },
  { id: 'agent-07', name: 'AGENT 07', colour: '#FF795E' },
  { id: 'agent-08', name: 'AGENT 08', colour: '#8B9DFF' },
  { id: 'agent-09', name: 'AGENT 09', colour: '#D7A6FF' },
  { id: 'agent-10', name: 'AGENT 10', colour: '#75E6C1' },
  { id: 'agent-11', name: 'AGENT 11', colour: '#FFB86B' },
  { id: 'agent-12', name: 'AGENT 12', colour: '#64E1D1' },
  { id: 'agent-13', name: 'AGENT 13', colour: '#E58BFF' },
  { id: 'agent-14', name: 'AGENT 14', colour: '#B5D66B' },
  { id: 'agent-15', name: 'AGENT 15', colour: '#FF8299' },
]

export type SwarmTargetBounds = {
  left: number
  top: number
  width: number
  height: number
}

// ============================================================================
// VISUAL BLUEPRINT SCHEMA (PART 1)
// ============================================================================

export type VisualElementType =
  | 'section'
  | 'container'
  | 'card'
  | 'button'
  | 'heading'
  | 'text'
  | 'image'
  | 'icon'
  | 'divider'
  | 'badge'
  | 'decoration'

export type ComputedVisualProperties = {
  backgroundColor: string
  borderColor: string
  borderWidth: string
  borderRadius: string
  borderStyle: string
  color: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  textAlign: string
  opacity: string
  zIndex: string
  boxShadow: string
  hasBackground: boolean
  hasBorder: boolean
  hasShadow: boolean
}

export type BlueprintLayerKind =
  | 'geometry'
  | 'background'
  | 'border'
  | 'text'
  | 'image'
  | 'icon'
  | 'styling'
  | 'alignment'

export type BlueprintLayerOperation = {
  id: string
  elementId: string
  sectionId: string
  layer: BlueprintLayerKind
  tool: SwarmTool
  description: string
  bounds: SwarmTargetBounds
  status: 'queued' | 'collecting' | 'working' | 'complete'
  dependencies: string[]
  duration: number
  reservedBy?: string | null
  metadata?: {
    text?: string
    fontFamily?: string
    fontSize?: string
    fontWeight?: string
    textColor?: string
    bgColor?: string
    borderColor?: string
    borderRadius?: string
    imageSrc?: string
    svgPaths?: SVGPathElement[]
  }
}

export type VisualBlueprintElement = {
  id: string
  parentId: string | null
  sectionId: string
  type: VisualElementType
  domNode: SwarmElement
  bounds: SwarmTargetBounds
  visualProperties: ComputedVisualProperties
  textContent: string
  imageSource: string | null
  childIds: string[]
  layerOperations: BlueprintLayerOperation[]
  eligibility: 'constructible' | 'exempt' | 'system'
  readiness: 'ready' | 'waiting_render' | 'temporarily_interactive'
  status: 'pending' | 'in_progress' | 'completed'
  dependencies: string[]
}

export type SectionVisualBlueprint = {
  sectionId: string
  label: string
  sectionElement: HTMLElement
  bounds: SwarmTargetBounds
  elements: Map<string, VisualBlueprintElement>
  rootElementIds: string[]
  layers: BlueprintLayerOperation[]
  phase: SectionPhase
  isReady: boolean
  isCompleted: boolean
}

export type SwarmSectionInfo = {
  id: string
  label: string
  phase: SectionPhase
  element: HTMLElement
  blueprint?: SectionVisualBlueprint
}

export type SwarmTask = {
  id: string
  layerId?: string
  elementId?: string
  target: SwarmElement
  sectionId: string
  kind: SwarmTargetKind | 'button' | 'decoration'
  operation: 'type' | 'draw' | 'image' | 'colour' | 'align' | 'icon' | 'transform'
  layerKind?: BlueprintLayerKind
  tool: SwarmTool
  description: string
  status: 'queued' | 'collecting' | 'working' | 'complete'
  duration: number
  bounds: SwarmTargetBounds
  dependencies?: string[]
  reservedBy?: string | null
  metadata?: BlueprintLayerOperation['metadata']
}

export type SwarmCursorState = SwarmIdentity & {
  tool: SwarmTool | null
  operation: string
  active: boolean
  state: string
}

export type SwarmActivity = {
  cursors: SwarmCursorState[]
  operation: string
  runningTasks: number
  totalAgents: number
  workingAgents: number
  coordinatingAgents: number
  waitingAgents: number
  followingAgents: number
  progress: number
  completedTasks: number
  totalTasks: number
  animationState: string
  scrollPaused: boolean
  scrollPausedForConstruction: boolean
  scrollComplete: boolean
}

export type SwarmPhase = 'inactive' | 'loading' | 'active'
