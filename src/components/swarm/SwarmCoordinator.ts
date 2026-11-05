import {
  swarmIdentities,
  type SwarmActivity,
  type SwarmElement,
  type SwarmIdentity,
  type SwarmTargetBounds,
  type SwarmTask,
  type SwarmTool,
} from './swarmTypes'
import type { SwarmPoint } from './SwarmLoader'
import { swarmSettings } from './swarmSettings'
import { DOMSnapshotEngine, restoreTypingText } from './DOMSnapshotEngine'
import { SectionManager, type ManagedSection } from './SectionManager'
import { DependencyEngine } from './DependencyEngine'
import { SwarmScrollController } from './SwarmScrollController'

type AgentPhase = 'hidden' | 'entering' | 'waiting' | 'to-tool' | 'pickup' | 'moving' | 'working' | 'returning' | 'following'
type BuildTask = SwarmTask & {
  id: string
  bounds: SwarmTargetBounds
}
type TextCharacter = { element: HTMLSpanElement; bounds: SwarmTargetBounds }

type AgentRuntime = {
  identity: SwarmIdentity
  cursor: HTMLElement
  frame: HTMLDivElement
  position: SwarmPoint
  from: SwarmPoint
  to: SwarmPoint
  control: SwarmPoint
  phase: AgentPhase
  phaseStart: number
  phaseDuration: number
  task: BuildTask | null
  tool: SwarmTool | null
  proxy: HTMLElement | null
  caret: HTMLElement | null
  duplicate: HTMLElement | null
  duplicateOrigin: SwarmTargetBounds | null
  gesture: HTMLDivElement | null
  gestureLabel: HTMLElement | null
  characters: TextCharacter[]
  revealedCharacters: number
  paths: SVGPathElement[]
  pathLengths: number[]
  pathTransform: DOMMatrix | null
  anchors: SVGCircleElement[]
  guide: HTMLElement | null
  guideLabel: HTMLElement | null
}

type OriginalTargetState = {
  building: string | null
  built: string | null
  progress: string | null
  clipPath: string
  visibility: string
  opacity: string
}

export class SwarmCoordinator {
  private readonly agents: AgentRuntime[]
  private readonly toolbar: HTMLElement
  private readonly moveTool: HTMLElement
  private readonly overlay: HTMLElement
  private readonly initialPosition: SwarmPoint
  private readonly onActivity: (activity: SwarmActivity) => void
  private readonly onSectionChange: (sectionId: string) => void
  private readonly reducedMotion: boolean

  // Modular engines
  private readonly snapshotEngine = new DOMSnapshotEngine()
  private readonly sectionManager: SectionManager
  private readonly dependencyEngine = new DependencyEngine()
  private readonly scrollController: SwarmScrollController

  // Cumulative completed tasks across prior sections
  private cumulativeCompletedTasks = 0
  private cumulativeTotalTasks = 0

  // Global target tracking
  private readonly targetStates = new Map<SwarmElement, OriginalTargetState>()
  private readonly managedTargets = new Set<SwarmElement>()

  // Animation and state tracking
  private frameId: number | null = null
  private measurementFrameId: number | null = null
  private observer: MutationObserver | null = null
  private lastFrame = 0
  private lastPublish = 0
  private lastCachedScrollY = window.scrollY
  private preparingSectionId: string | null = null
  private entered = false
  private running = false
  private finished = false
  private activitySignature = ''
  private pointerPosition: SwarmPoint | null = null
  private pointerDirection: SwarmPoint = { x: 1, y: 0 }

  constructor(
    cursorElements: HTMLElement[],
    frameElements: HTMLDivElement[],
    toolbar: HTMLElement,
    moveTool: HTMLElement,
    overlay: HTMLElement,
    origin: SwarmPoint,
    onActivity: (activity: SwarmActivity) => void,
    onSectionChange: (sectionId: string) => void,
    reducedMotion: boolean,
  ) {
    this.toolbar = toolbar
    this.moveTool = moveTool
    this.overlay = overlay
    this.initialPosition = origin
    this.onActivity = onActivity
    this.onSectionChange = onSectionChange
    this.reducedMotion = reducedMotion

    this.sectionManager = new SectionManager((sectionId) => {
      this.onSectionChange(sectionId)
    })

    this.scrollController = new SwarmScrollController({
      onScrollPaused: (reason) => {
        this.publishActivity(reason === 'manual' || reason === 'user' ? 'PAUSED BY VISITOR' : 'PAUSED FOR CONSTRUCTION', true)
      },
      onScrollResumed: () => {
        this.publishActivity('AUTO SCROLLING', true)
      },
      onScrollPositionChange: (scrollY) => {
        this.updateCachedBoundsOnScroll(scrollY)
      },
    }, reducedMotion)

    this.agents = swarmIdentities.slice(0, cursorElements.length).map((identity, index) => {
      const position = { ...origin }
      return {
        identity,
        cursor: cursorElements[index],
        frame: frameElements[index],
        position,
        from: position,
        to: position,
        control: position,
        phase: 'hidden',
        phaseStart: 0,
        phaseDuration: 0,
        task: null,
        tool: null,
        proxy: null,
        caret: null,
        duplicate: null,
        duplicateOrigin: null,
        gesture: null,
        gestureLabel: null,
        characters: [],
        revealedCharacters: 0,
        paths: [],
        pathLengths: [],
        pathTransform: null,
        anchors: [],
        guide: null,
        guideLabel: null,
      }
    })
  }

  start() {
    if (this.running) return
    this.running = true
    if (this.reducedMotion) {
      this.scrollController.markCompleted()
      this.publishActivity('REDUCED MOTION', true)
      return
    }

    // Reveal the canvas root; inactive sections remain concealed until their turn.
    const root = document.querySelector<HTMLElement>('#root')
    if (root) root.style.visibility = 'visible'
    // Discover portfolio sections
    this.sectionManager.discoverSections()
    this.sectionManager.getSections().forEach((section) => {
      this.rememberTarget(section.element)
      section.element.style.visibility = 'hidden'
    })

    // Start scroll controller
    this.scrollController.start()

    window.addEventListener('resize', this.handleResize, { passive: true })
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true })

    this.observer = new MutationObserver((records) => {
      if (!this.running || this.finished) return
      const activeSection = this.sectionManager.getActiveSection()
      if (!activeSection || !records.some((record) => activeSection.element.contains(record.target))) return
      if (this.measurementFrameId !== null) return
      this.measurementFrameId = window.requestAnimationFrame(() => {
        this.measurementFrameId = null
        this.refreshActiveSectionTargets()
      })
    })
    if (root) this.observer.observe(root, { childList: true, subtree: true })

    this.enterFromSpawn()
    this.lastFrame = performance.now()
    this.frameId = window.requestAnimationFrame(this.animate)
  }

  stop() {
    if (!this.running) return
    this.running = false
    if (this.frameId !== null) window.cancelAnimationFrame(this.frameId)
    this.frameId = null
    if (this.measurementFrameId !== null) window.cancelAnimationFrame(this.measurementFrameId)
    this.measurementFrameId = null
    this.preparingSectionId = null
    this.observer?.disconnect()
    this.observer = null

    this.scrollController.stop()
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('pointermove', this.handlePointerMove)

    const root = document.querySelector<HTMLElement>('#root')
    if (root) root.style.removeProperty('visibility')
    this.agents.forEach((agent) => this.clearAgentOperation(agent))
    for (const [target, state] of this.targetStates) {
      this.restoreAttribute(target, 'data-swarm-building', state.building)
      this.restoreAttribute(target, 'data-swarm-built', state.built)
      this.restoreAttribute(target, 'data-swarm-build-progress', state.progress)
      target.style.clipPath = state.clipPath
      target.style.visibility = state.visibility
      target.style.opacity = state.opacity
    }
    this.targetStates.clear()
    this.managedTargets.clear()
    this.dependencyEngine.reset()
    this.sectionManager.reset()
    this.snapshotEngine.reset()

    this.agents.forEach((agent) => {
      agent.cursor.removeAttribute('data-tool')
      agent.cursor.removeAttribute('data-state')
      agent.cursor.removeAttribute('data-active')
      agent.cursor.removeAttribute('data-gesture')
      agent.cursor.style.opacity = '0'
      agent.cursor.style.visibility = 'visible'
      agent.cursor.style.transform = 'translate3d(-100px, -100px, 0) scale(.5)'
      agent.frame.style.visibility = 'hidden'
      agent.frame.style.removeProperty('--frame-colour')
    })

    this.onActivity({
      cursors: this.agents.map((agent) => ({ ...agent.identity, tool: null, operation: 'Waiting for task', active: false, state: 'waiting' })),
      operation: 'Waiting for task',
      runningTasks: 0,
      totalAgents: this.agents.length,
      workingAgents: 0,
      coordinatingAgents: 0,
      waitingAgents: this.agents.length,
      followingAgents: 0,
      progress: 0,
      completedTasks: 0,
      totalTasks: 0,
      animationState: 'INACTIVE',
      scrollPaused: false,
      scrollPausedForConstruction: false,
      scrollComplete: false,
    })
  }

  toggleAutoScroll() {
    this.scrollController.toggleAutoScroll()
  }

  // =========================================================================
  // SECTION CONSTRUCTION ORCHESTRATION
  // =========================================================================

  private activateSectionConstruction(section: ManagedSection) {
    if (this.preparingSectionId) return
    const bounds = section.element.getBoundingClientRect()
    if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return

    this.preparingSectionId = section.id
    this.scrollController.pauseForConstruction()
    section.element.style.visibility = 'visible'
    this.publishActivity('PREPARING SECTION', true)
    void this.prepareSectionConstruction(section)
  }

  private async prepareSectionConstruction(section: ManagedSection) {
    const initialBlueprint = this.snapshotEngine.captureSectionBlueprint(section.element, section.id)
    this.markBlueprintTargets(initialBlueprint)
    await this.snapshotEngine.waitForVisualReadiness(section.element)

    if (!this.running || this.preparingSectionId !== section.id
      || this.sectionManager.getActiveSection() !== section || section.phase !== 'ACTIVE') {
      return
    }

    const bounds = section.element.getBoundingClientRect()
    if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) {
      this.preparingSectionId = null
      section.element.style.visibility = 'hidden'
      return
    }

    const blueprint = this.snapshotEngine.captureSectionBlueprint(section.element, section.id)
    if (!this.sectionManager.transitionToConstructing(section.id, blueprint)) {
      this.preparingSectionId = null
      return
    }
    this.preparingSectionId = null
    this.dependencyEngine.loadLayers(blueprint.layers)
    this.markBlueprintTargets(blueprint)
    this.publishActivity('CONSTRUCTING', true)
    this.dispatchTasks()
  }

  private markBlueprintTargets(blueprint: ReturnType<DOMSnapshotEngine['captureSectionBlueprint']>) {
    for (const element of blueprint.elements.values()) {
      if (element.type !== 'section') {
        this.rememberTarget(element.domNode)
        element.domNode.setAttribute('data-swarm-building', 'true')
      }
    }
  }

  private rememberTarget(target: SwarmElement) {
    if (this.targetStates.has(target)) return
    this.targetStates.set(target, {
      building: target.getAttribute('data-swarm-building'),
      built: target.getAttribute('data-swarm-built'),
      progress: target.getAttribute('data-swarm-build-progress'),
      clipPath: target.style.clipPath,
      visibility: target.style.visibility,
      opacity: target.style.opacity,
    })
    this.managedTargets.add(target)
  }

  // =========================================================================
  // TASK DISPATCHING WITH PROPERTY-LEVEL DEPENDENCY GRAPH
  // =========================================================================

  private enterFromSpawn() {
    const now = performance.now()
    const gateway = this.elementCenter(this.moveTool)
    this.agents.forEach((agent, index) => {
      const angle = index * 2.4
      agent.phase = 'entering'
      agent.phaseStart = now + swarmSettings.agents.idleDelay[index] * 2 * swarmSettings.speed.idleDelay
      agent.phaseDuration = (swarmSettings.timing.entryDuration + (index % 5) * swarmSettings.timing.entryDurationStagger)
        / swarmSettings.speed.cursorMovement
      agent.to = { x: gateway.x + Math.cos(angle) * 11, y: gateway.y + Math.sin(angle) * 11 }
      this.setPath(agent, this.initialPosition, agent.to, index)
      this.updateCursorDOM(agent, 'entering', null, false, 'Entering canvas')
      agent.cursor.style.opacity = '1'
      agent.cursor.style.transform = `translate3d(${agent.position.x}px, ${agent.position.y}px, 0) scale(.55)`
    })
    this.publishActivity('ENTERING', true)
  }

  private dispatchTasks() {
    if (!this.entered || !this.running) return
    const activeSection = this.sectionManager.getActiveSection()
    if (!activeSection) return

    if (activeSection.phase === 'ACTIVE') {
      this.activateSectionConstruction(activeSection)
      return
    }

    if (activeSection.phase !== 'CONSTRUCTING') return

    // Assign tasks concurrently to available waiting agents
    for (const agent of this.agents) {
      if (agent.phase !== 'waiting') continue

      // Intelligent assignment:
      // Priority 1: Match agent's current tool (saves round-trip to toolbar!)
      // Priority 2: Proximity to agent
      const bestOperation = this.dependencyEngine.findBestOperationForAgent(
        agent.identity.id,
        agent.tool,
        agent.position,
      )

      if (!bestOperation) break // No ready tasks available right now

      // Atomically reserve operation in dependency engine
      const reserved = this.dependencyEngine.reserveOperation(bestOperation.id, agent.identity.id)
      if (!reserved) continue

      // Find the DOM target for this element
      const element = activeSection.blueprint?.elements.get(bestOperation.elementId)
      const target = element ? element.domNode : activeSection.element

      const task: BuildTask = {
        id: bestOperation.id,
        layerId: bestOperation.id,
        elementId: bestOperation.elementId,
        target,
        sectionId: activeSection.id,
        kind: element?.type === 'heading' || element?.type === 'text' ? 'text'
          : element?.type === 'card' ? 'card'
          : element?.type === 'button' ? 'button'
          : element?.type === 'image' ? 'image'
          : element?.type === 'icon' ? 'icon'
          : element?.type === 'badge' ? 'style'
          : 'decoration',
        operation: bestOperation.layer === 'text' ? 'type'
          : bestOperation.layer === 'image' ? 'image'
          : bestOperation.layer === 'icon' ? 'icon'
          : bestOperation.layer === 'background' || bestOperation.layer === 'styling' ? 'colour'
          : bestOperation.layer === 'alignment' ? 'align'
          : 'draw',
        layerKind: bestOperation.layer,
        tool: bestOperation.tool,
        description: bestOperation.description,
        status: 'collecting',
        duration: bestOperation.duration,
        bounds: bestOperation.bounds,
        dependencies: bestOperation.dependencies,
        metadata: bestOperation.metadata,
      }

      this.assignTask(agent, task)
    }

    this.checkSectionCompletion(activeSection)
  }

  private assignTask(agent: AgentRuntime, task: BuildTask) {
    agent.task = task

    // Tool reuse optimization:
    // If agent already holds the required tool, go straight to the target!
    if (agent.tool === task.tool) {
      this.moveToTarget(agent)
      return
    }

    // Agent needs to fetch the tool from the toolbar
    agent.phase = 'to-tool'
    this.updateCursorDOM(agent, 'collecting tool', task.tool, false, task.description)

    const toolElement = this.toolbar.querySelector<HTMLElement>(`[data-swarm-tool="${task.tool.toLowerCase()}"]`)
    const point = toolElement ? this.elementCenter(toolElement) : this.elementCenter(this.moveTool)
    this.startTravel(agent, point, 'to-tool')
    this.publishActivity('COLLECTING TOOL')
  }

  private moveToTarget(agent: AgentRuntime) {
    if (!agent.task) return
    agent.phase = 'moving'
    const stateText = agent.task.operation === 'type' ? 'typing' : 'working'
    this.updateCursorDOM(agent, stateText, agent.task.tool, true, agent.task.description)

    const point = this.operationStartPoint(agent.task)
    this.startTravel(agent, point, 'moving')
    this.publishActivity(agent.task.operation === 'type' ? 'TYPING' : 'WORKING')
  }

  private startTravel(agent: AgentRuntime, point: SwarmPoint, phase: 'to-tool' | 'moving' | 'returning') {
    const index = this.agents.indexOf(agent)
    const distance = Math.hypot(point.x - agent.position.x, point.y - agent.position.y)
    agent.phase = phase
    agent.phaseStart = performance.now()
    const movementMultiplier = phase === 'returning'
      ? swarmSettings.speed.returnToToolbar
      : swarmSettings.speed.cursorMovement
    agent.phaseDuration = Math.max(
      swarmSettings.timing.minimumTravelDuration / movementMultiplier,
      distance / (swarmSettings.agents.travelSpeed[index] * swarmSettings.timing.travelSpeedScale * movementMultiplier),
    )
    this.setPath(agent, agent.position, point, index)
  }

  private startOperation(agent: AgentRuntime, now: number) {
    const task = agent.task
    if (!task) return
    if (!task.target.isConnected) {
      this.discardDisconnectedTask(agent)
      return
    }

    // Mark working in dependency engine
    if (task.layerId) {
      if (!this.dependencyEngine.startOperation(task.layerId, agent.identity.id)) {
        console.error(`Unable to start reserved Swarm operation ${task.layerId} for ${agent.identity.id}`)
        this.discardDisconnectedTask(agent)
        return
      }
    }

    const activeSection = this.sectionManager.getActiveSection()
    const blueprintElement = activeSection?.blueprint?.elements.get(task.elementId ?? '')
    if (blueprintElement) task.bounds = { ...blueprintElement.bounds }
    else {
      const rect = task.target.getBoundingClientRect()
      task.bounds = {
        left: rect.left,
        top: rect.top,
        width: Math.max(2, rect.width),
        height: Math.max(2, rect.height),
      }
    }

    agent.phase = 'working'
    agent.phaseStart = now
    const distance = Math.hypot(task.bounds.width, task.bounds.height)
    const baseDuration = task.duration + (task.operation === 'type' ? 0 : Math.min(
      swarmSettings.timing.operationTravelDurationCap,
      distance * swarmSettings.timing.operationTravelScale,
    ))

    const operationSpeed = task.operation === 'type' ? swarmSettings.speed.typing
      : task.operation === 'icon' ? swarmSettings.speed.penDrawing
      : task.operation === 'colour' ? swarmSettings.speed.colour
      : task.operation === 'align' ? swarmSettings.speed.alignment
      : task.operation === 'transform' ? swarmSettings.speed.duplication
      : task.tool === 'Transform' ? swarmSettings.speed.transform
      : (task.kind === 'card' || task.kind === 'button') && task.target instanceof HTMLElement && this.hasDuplicateSource(task.target)
      ? swarmSettings.speed.duplication
      : swarmSettings.speed.drawing

    agent.phaseDuration = baseDuration / operationSpeed

    const stateText = task.operation === 'type' ? 'typing'
      : task.operation === 'colour' ? 'styling'
      : task.operation === 'align' ? 'aligning'
      : task.operation === 'transform' ? 'transforming'
      : 'drawing'

    this.updateCursorDOM(agent, stateText, task.tool, true, task.description)
    task.status = 'working'

    agent.frame.style.setProperty('--frame-colour', agent.identity.colour)
    agent.frame.dataset.effect = task.operation === 'type' ? 'text'
      : task.operation === 'image' ? 'image'
      : task.operation === 'colour' ? 'colour'
      : task.operation === 'align' ? 'placement'
      : task.operation === 'transform' ? 'transform'
      : task.kind === 'container' ? 'frame' : 'shape'

    if (task.operation === 'type' && task.target instanceof HTMLElement) {
      task.target.setAttribute('data-swarm-building', 'true')
      this.createTextProxy(agent, task.target, task.bounds)
    } else if (task.operation === 'icon' && task.target instanceof SVGSVGElement) {
      task.target.setAttribute('data-swarm-building', 'true')
      this.createIconProxy(agent, task.target, task.bounds)
    } else {
      task.target.removeAttribute('data-swarm-building')
      task.target.style.visibility = 'visible'
      task.target.style.clipPath = 'inset(0 100% 0 0)'
      if (task.operation === 'draw' || task.operation === 'image') this.createDrawGesture(agent, task.bounds)
      if (task.operation === 'align') this.createGuides(agent, task.bounds)
      if (task.operation === 'colour') this.createColourPass(agent)
      if ((task.kind === 'card' || task.kind === 'button') && task.target instanceof HTMLElement && this.hasDuplicateSource(task.target)) {
        this.createDuplicateProxy(agent, task.target)
      }
    }

    this.publishActivity(stateText.toUpperCase())
    this.dispatchTasks()
  }

  // =========================================================================
  // PROXIES AND GESTURES
  // =========================================================================

  private createTextProxy(agent: AgentRuntime, target: HTMLElement, bounds: SwarmTargetBounds) {
    const proxy = target.cloneNode(true) as HTMLElement
    proxy.querySelectorAll('[data-swarm]').forEach((element) => element.remove())
    proxy.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'))
    proxy.removeAttribute('data-swarm-building')
    proxy.removeAttribute('data-swarm-built')
    proxy.classList.add('swarm-text-proxy')
    proxy.style.position = 'fixed'
    proxy.style.left = '0px'
    proxy.style.top = '0px'
    proxy.style.width = `${bounds.width}px`
    proxy.style.height = 'auto'
    proxy.style.margin = '0'
    proxy.style.maxWidth = 'none'
    proxy.style.transform = `translate3d(${bounds.left}px, ${bounds.top}px, 0)`
    proxy.style.visibility = 'visible'
    proxy.style.opacity = '1'
    proxy.style.clipPath = 'none'
    proxy.dataset.swarmBounds = `${bounds.left}:${bounds.top}:${bounds.width}`

    proxy.querySelectorAll<HTMLElement>('.typing-text').forEach(restoreTypingText)

    const walker = document.createTreeWalker(proxy, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (node instanceof Text && node.textContent) nodes.push(node)
    }
    const characters: TextCharacter[] = []
    nodes.forEach((node) => {
      const fragment = document.createDocumentFragment()
      Array.from(node.textContent ?? '').forEach((character) => {
        const span = document.createElement('span')
        span.className = 'swarm-typed-character'
        span.textContent = character
        span.style.opacity = '0'
        fragment.append(span)
        characters.push({
          element: span,
          bounds: { left: 0, top: 0, width: 0, height: 0 },
        })
      })
      node.replaceWith(fragment)
    })

    agent.proxy = proxy
    agent.characters = characters
    agent.revealedCharacters = 0
    this.overlay.append(proxy)
    agent.characters.forEach((character) => {
      const rect = character.element.getBoundingClientRect()
      character.bounds = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }
    })

    const caret = document.createElement('i')
    caret.className = 'swarm-typing-caret'
    caret.style.setProperty('--cursor-colour', agent.identity.colour)
    this.overlay.append(caret)
    agent.caret = caret
  }

  private createIconProxy(agent: AgentRuntime, target: SVGSVGElement, bounds: SwarmTargetBounds) {
    const proxy = target.cloneNode(true) as HTMLElement
    proxy.removeAttribute('data-swarm-building')
    proxy.removeAttribute('data-swarm-built')
    proxy.classList.add('swarm-icon-proxy')
    proxy.style.position = 'fixed'
    proxy.style.left = `${bounds.left}px`
    proxy.style.top = `${bounds.top}px`
    proxy.style.width = `${bounds.width}px`
    proxy.style.height = `${bounds.height}px`
    proxy.style.visibility = 'visible'
    proxy.style.opacity = '1'
    proxy.style.overflow = 'visible'

    const paths = Array.from(proxy.querySelectorAll<SVGPathElement>('path'))
    agent.paths = paths
    agent.pathLengths = paths.map((path) => {
      const length = path.getTotalLength()
      path.style.strokeDasharray = `${length}`
      path.style.strokeDashoffset = `${length}`
      path.style.stroke = agent.identity.colour
      return length
    })
    agent.proxy = proxy
    this.overlay.append(proxy)
    agent.pathTransform = paths[0]?.getScreenCTM() ?? null
    proxy.dataset.swarmBounds = `${bounds.left}:${bounds.top}:${bounds.width}:${bounds.height}`
  }

  private createDrawGesture(agent: AgentRuntime, bounds: SwarmTargetBounds) {
    const gesture = document.createElement('div')
    gesture.className = 'swarm-draw-gesture'
    gesture.style.setProperty('--gesture-colour', agent.identity.colour)
    gesture.style.left = `${bounds.left}px`
    gesture.style.top = `${bounds.top}px`
    gesture.style.width = '1px'
    gesture.style.height = '1px'

    const label = document.createElement('small')
    label.className = 'swarm-draw-measurement'
    label.textContent = 'W 0 · H 0'
    gesture.append(label)
    this.overlay.append(gesture)
    agent.gesture = gesture
    agent.gestureLabel = label
    agent.cursor.dataset.gesture = 'dragging'
  }

  private createGuides(agent: AgentRuntime, bounds: SwarmTargetBounds) {
    const guide = document.createElement('div')
    guide.className = 'swarm-alignment-guides'
    guide.style.setProperty('--guide-colour', agent.identity.colour)
    guide.style.left = `${bounds.left}px`
    guide.style.top = `${bounds.top}px`
    guide.style.width = `${bounds.width}px`
    guide.style.height = `${bounds.height}px`

    const label = document.createElement('small')
    label.className = 'swarm-guide-measurement'
    label.textContent = `${Math.round(bounds.width)} × ${Math.round(bounds.height)} px`
    guide.append(label)
    this.overlay.append(guide)
    agent.guide = guide
    agent.guideLabel = label
  }

  private createColourPass(agent: AgentRuntime) {
    const pass = document.createElement('div')
    pass.className = 'swarm-colour-pass'
    pass.style.setProperty('--pass-colour', agent.identity.colour)
    agent.guide = pass
    this.overlay.append(pass)
  }

  private createDuplicateProxy(agent: AgentRuntime, target: HTMLElement) {
    const siblings = Array.from(target.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element.dataset.swarm === target.dataset.swarm)
    const siblingIndex = siblings.indexOf(target)
    const master = siblings[siblingIndex - 1]
    if (!master) return
    const bounds = master.getBoundingClientRect()
    const duplicate = master.cloneNode(true) as HTMLElement
    duplicate.querySelectorAll('[data-swarm]').forEach((element) => element.remove())
    duplicate.removeAttribute('data-swarm-building')
    duplicate.removeAttribute('data-swarm-built')
    duplicate.removeAttribute('id')
    duplicate.classList.add('swarm-duplicate-proxy')
    duplicate.style.position = 'fixed'
    duplicate.style.left = `${bounds.left}px`
    duplicate.style.top = `${bounds.top}px`
    duplicate.style.width = `${bounds.width}px`
    duplicate.style.height = `${bounds.height}px`
    duplicate.style.opacity = '.28'
    agent.duplicate = duplicate
    agent.duplicateOrigin = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
    this.overlay.append(duplicate)
  }

  private hasDuplicateSource(target: HTMLElement) {
    const siblings = Array.from(target.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element.dataset.swarm === target.dataset.swarm)
    return siblings.indexOf(target) > 0
  }

  // =========================================================================
  // OPERATION EXECUTION & FINISHING
  // =========================================================================

  private updateOperation(agent: AgentRuntime, now: number) {
    const task = agent.task
    if (!task) return
    if (!task.target.isConnected) {
      this.discardDisconnectedTask(agent)
      return
    }

    this.showOperation(agent)
    const elapsed = now - agent.phaseStart
    const progress = Math.min(1, elapsed / agent.phaseDuration)
    const eased = 1 - (1 - progress) ** 3
    const rect = task.bounds

    agent.frame.style.left = `${rect.left}px`
    agent.frame.style.top = `${rect.top}px`
    agent.frame.style.width = `${rect.width}px`
    agent.frame.style.height = `${rect.height}px`
    agent.frame.style.visibility = 'visible'

    if (agent.proxy) {
      if (task.operation === 'type') {
        const proxyBounds = `${rect.left}:${rect.top}:${rect.width}`
        if (agent.proxy.dataset.swarmBounds !== proxyBounds) {
          agent.proxy.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`
          agent.proxy.style.width = `${rect.width}px`
          agent.proxy.dataset.swarmBounds = proxyBounds
        }
      } else {
        const proxyBounds = `${rect.left}:${rect.top}:${rect.width}:${rect.height}`
        if (agent.proxy.dataset.swarmBounds !== proxyBounds) {
          const previousBounds = agent.proxy.dataset.swarmBounds?.split(':').map(Number)
          agent.proxy.style.left = `${rect.left}px`
          agent.proxy.style.top = `${rect.top}px`
          agent.proxy.style.width = `${rect.width}px`
          agent.proxy.style.height = `${rect.height}px`
          if (previousBounds?.length === 4 && previousBounds[2] === rect.width && previousBounds[3] === rect.height && agent.pathTransform) {
            agent.pathTransform.e += rect.left - previousBounds[0]
            agent.pathTransform.f += rect.top - previousBounds[1]
          } else {
            agent.pathTransform = agent.paths[0]?.getScreenCTM() ?? null
          }
          agent.proxy.dataset.swarmBounds = proxyBounds
        }
      }
      if (task.operation === 'type') {
        const characterDelay = swarmSettings.timing.textCharacterDelay / swarmSettings.speed.typing
        const visibleCharacters = Math.min(agent.characters.length, Math.floor(elapsed / characterDelay))
        while (agent.revealedCharacters < visibleCharacters) {
          agent.characters[agent.revealedCharacters].element.style.opacity = '1'
          agent.revealedCharacters++
        }
        const character = agent.characters[Math.min(visibleCharacters, agent.characters.length - 1)]?.element
        const charBounds = agent.characters[Math.min(visibleCharacters, agent.characters.length - 1)]?.bounds
        if (character && charBounds) {
          const x = charBounds.left + (visibleCharacters >= agent.characters.length ? charBounds.width : 0)
          agent.position = { x, y: charBounds.top + charBounds.height / 2 }
          if (agent.caret) {
            agent.caret.style.left = `${x}px`
            agent.caret.style.top = `${charBounds.top}px`
            agent.caret.style.height = `${Math.max(10, charBounds.height)}px`
          }
          this.placeCursor(agent)
        }
      } else if (agent.paths.length) {
        const pathProgress = eased * agent.paths.length
        const currentPath = Math.min(agent.paths.length - 1, Math.floor(pathProgress))
        agent.paths.forEach((path, index) => {
          const localProgress = Math.min(1, Math.max(0, pathProgress - index))
          path.style.strokeDashoffset = `${agent.pathLengths[index] * (1 - localProgress)}`
          for (let anchor = 0; anchor < 3; anchor++) {
            const anchorIndex = index * 3 + anchor
            if (agent.anchors[anchorIndex]) agent.anchors[anchorIndex].style.opacity = localProgress >= anchor / 2 ? '1' : '0'
          }
        })
        const activePath = agent.paths[currentPath]
        const localPathProgress = Math.min(1, Math.max(0, pathProgress - currentPath))
        const point = activePath.getPointAtLength(agent.pathLengths[currentPath] * localPathProgress)
        const transform = agent.pathTransform
        const screenPoint = transform ? point.matrixTransform(transform) : { x: rect.left + rect.width * progress, y: rect.top + rect.height / 2 }
        this.setAgentPosition(agent, { x: screenPoint.x, y: screenPoint.y })
      }
    } else {
      const reveal = task.operation === 'image'
        ? `inset(0 0 ${(1 - eased) * 100}% 0)`
        : `inset(0 ${(1 - eased) * 100}% 0 0)`
      task.target.style.clipPath = reveal
      if (agent.gesture) {
        agent.gesture.style.left = `${rect.left}px`
        agent.gesture.style.top = `${rect.top}px`
        agent.gesture.style.width = `${Math.max(1, rect.width * eased)}px`
        agent.gesture.style.height = `${Math.max(1, rect.height * eased)}px`
        if (agent.gestureLabel) {
          agent.gestureLabel.textContent = `W ${Math.round(rect.width * eased)} · H ${Math.round(rect.height * eased)}`
        }
      }
      agent.frame.style.left = `${rect.left}px`
      agent.frame.style.top = `${rect.top}px`
      agent.frame.style.width = `${Math.max(1, rect.width * eased)}px`
      agent.frame.style.height = `${Math.max(1, rect.height * eased)}px`
      agent.frame.style.visibility = 'visible'

      if (agent.guide?.classList.contains('swarm-colour-pass')) {
        agent.guide.style.left = `${rect.left}px`
        agent.guide.style.top = `${rect.top}px`
        agent.guide.style.width = `${rect.width * eased}px`
        agent.guide.style.height = `${rect.height}px`
      } else if (agent.guide) {
        agent.guide.style.left = `${rect.left}px`
        agent.guide.style.top = `${rect.top}px`
        agent.guide.style.width = `${rect.width}px`
        agent.guide.style.height = `${rect.height}px`
        agent.guide.style.opacity = String(.2 + Math.sin(now / 180) * .1)
        if (agent.guideLabel) agent.guideLabel.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`
      }
      if (agent.duplicate && agent.duplicateOrigin) {
        agent.duplicate.style.left = `${agent.duplicateOrigin.left + (rect.left - agent.duplicateOrigin.left) * eased}px`
        agent.duplicate.style.top = `${agent.duplicateOrigin.top + (rect.top - agent.duplicateOrigin.top) * eased}px`
        agent.duplicate.style.width = `${agent.duplicateOrigin.width + (rect.width - agent.duplicateOrigin.width) * eased}px`
        agent.duplicate.style.height = `${agent.duplicateOrigin.height + (rect.height - agent.duplicateOrigin.height) * eased}px`
      }
      this.setAgentPosition(agent, {
        x: rect.left + rect.width * progress,
        y: rect.top + rect.height * progress,
      })
    }

    const progressPercent = Math.floor(progress * 10) * 10
    if (task.target.getAttribute('data-swarm-build-progress') !== String(progressPercent)) {
      task.target.setAttribute('data-swarm-build-progress', String(progressPercent))
    }
    if (progress >= 1) this.finishTask(agent)
  }

  private finishTask(agent: AgentRuntime) {
    const task = agent.task
    if (task) {
      task.status = 'complete'
      if (task.layerId) {
        this.dependencyEngine.completeOperation(task.layerId)
      }

      // Check if all layers for this specific element are complete
      const activeSection = this.sectionManager.getActiveSection()
      const elementLayers = activeSection?.blueprint?.elements.get(task.elementId ?? '')?.layerOperations ?? []
      const allElementLayersComplete = elementLayers.every((l) => this.dependencyEngine.isCompleted(l.id))

      if (allElementLayersComplete || elementLayers.length === 0) {
        this.completeTarget(task.target)
      }
    }

    this.clearAgentOperation(agent)
    agent.task = null
    this.updateCursorDOM(agent, 'waiting', null, false, 'Waiting for task')
    agent.phase = 'waiting'

    const activeSection = this.sectionManager.getActiveSection()
    if (activeSection) {
      this.dispatchTasks()
    }
  }

  private completeTarget(target: SwarmElement) {
    target.removeAttribute('data-swarm-building')
    target.removeAttribute('data-swarm-build-progress')
    target.setAttribute('data-swarm-built', 'true')
    target.style.visibility = 'visible'
    target.style.opacity = '1'

    const original = this.targetStates.get(target)
    if (original) {
      target.style.clipPath = original.clipPath || 'none'
    } else {
      target.style.clipPath = 'none'
    }

    // Ensure TypingText span shows full resting text
    target.querySelectorAll<HTMLElement>('.typing-text').forEach(restoreTypingText)
  }

  private clearAgentOperation(agent: AgentRuntime) {
    agent.cursor.removeAttribute('data-gesture')
    agent.proxy?.remove()
    agent.proxy = null
    agent.caret?.remove()
    agent.caret = null
    agent.duplicate?.remove()
    agent.duplicate = null
    agent.duplicateOrigin = null
    agent.gesture?.remove()
    agent.gesture = null
    agent.gestureLabel = null
    agent.characters = []
    agent.revealedCharacters = 0
    agent.paths = []
    agent.pathLengths = []
    agent.pathTransform = null
    agent.anchors = []
    agent.guide?.remove()
    agent.guide = null
    agent.guideLabel = null
    agent.frame.style.visibility = 'hidden'
    agent.frame.style.removeProperty('--frame-colour')
    agent.frame.removeAttribute('data-effect')
  }

  private showOperation(agent: AgentRuntime) {
    agent.cursor.style.visibility = 'visible'
    if (agent.proxy) agent.proxy.style.visibility = 'visible'
    if (agent.caret) agent.caret.style.visibility = 'visible'
    if (agent.guide) agent.guide.style.visibility = 'visible'
    if (agent.duplicate) agent.duplicate.style.visibility = 'visible'
    if (agent.gesture) agent.gesture.style.visibility = 'visible'
    agent.frame.style.visibility = agent.phase === 'working' ? 'visible' : 'hidden'
  }

  private discardDisconnectedTask(agent: AgentRuntime) {
    const task = agent.task
    if (task && task.layerId) {
      this.dependencyEngine.releaseOperation(task.layerId)
    }
    this.clearAgentOperation(agent)
    agent.task = null
    agent.phase = 'waiting'
    this.updateCursorDOM(agent, 'waiting', null, false, 'Waiting for task')
    this.dispatchTasks()
  }

  // =========================================================================
  // SECTION COMPLETION, VERIFICATION & TRANSITION
  // =========================================================================

  private checkSectionCompletion(section: ManagedSection) {
    if (section.phase !== 'CONSTRUCTING') return

    // 1. Check if all operations in the section's dependency graph are complete
    const isComplete = this.dependencyEngine.isAllOperationsComplete()
    const anyActiveAgents = this.agents.some((a) => a.task && a.task.sectionId === section.id)

    if (isComplete && !anyActiveAgents) {
      this.verifyAndCompleteSection(section)
    }
  }

  private verifyAndCompleteSection(section: ManagedSection) {
    if (!this.sectionManager.transitionToVerifying(section.id)) {
      console.error(`Unable to verify completed Swarm section ${section.id}`)
      return
    }
    this.publishActivity('VERIFYING', true)

    // Complete all target DOM cleanups and record completion
    if (!this.sectionManager.verifyAndComplete(section.id)) {
      console.error(`Unable to complete verified Swarm section ${section.id}`)
      return
    }

    // Accumulate verified stats
    const stats = this.dependencyEngine.getStats()
    this.cumulativeCompletedTasks += stats.completed
    this.cumulativeTotalTasks += stats.total

    this.publishActivity('SECTION COMPLETED', true)

    // Check for next section
    const nextSection = this.sectionManager.advanceToNext()
    if (nextSection) {
      // Resume auto-scrolling toward next section
      this.scrollController.resumeAfterConstruction()
    } else {
      // All sections in the portfolio are completely constructed and verified!
      this.finishAllSections()
    }
  }

  private finishAllSections() {
    this.finished = true
    this.scrollController.markCompleted()
    this.stopAutoScroll()
    this.startFollowMode()
    this.publishActivity('CURSOR FOLLOW MODE', true)
  }

  private stopAutoScroll() {
    this.scrollController.stop()
  }

  // =========================================================================
  // ANIMATION LOOP & AGENT COORDINATION
  // =========================================================================

  private handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || this.reducedMotion
      || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const previous = this.pointerPosition
    if (previous) {
      const dx = event.clientX - previous.x
      const dy = event.clientY - previous.y
      const distance = Math.hypot(dx, dy)
      if (distance > 1) this.pointerDirection = { x: dx / distance, y: dy / distance }
    }
    this.pointerPosition = { x: event.clientX, y: event.clientY }
    if (this.finished) {
      this.startFollowMode()
    }
  }

  private handleResize = () => {
    this.agents.forEach((agent) => {
      if (agent.phase !== 'hidden') return
      const gateway = this.elementCenter(this.moveTool)
      agent.position = gateway
      agent.cursor.style.transform = `translate3d(${gateway.x}px, ${gateway.y}px, 0) scale(.01)`
    })
    this.lastCachedScrollY = window.scrollY
    this.refreshActiveSectionTargets()
  }

  private updateCachedBoundsOnScroll(scrollY: number) {
    const deltaY = scrollY - this.lastCachedScrollY
    this.lastCachedScrollY = scrollY
    if (deltaY === 0) return

    const activeSection = this.sectionManager.getActiveSection()
    if (activeSection?.blueprint) {
      this.snapshotEngine.translateMeasurements(activeSection.blueprint, 0, -deltaY)
    }

    this.agents.forEach((agent) => {
      if (agent.task && agent.task.status !== 'complete') {
        agent.task.bounds = { ...agent.task.bounds, top: agent.task.bounds.top - deltaY }
        agent.characters.forEach((character) => {
          character.bounds = { ...character.bounds, top: character.bounds.top - deltaY }
        })
      }
    })

    if (this.entered && activeSection?.phase === 'ACTIVE') {
      this.dispatchTasks()
    }
  }

  private refreshActiveSectionTargets() {
    const activeSection = this.sectionManager.getActiveSection()
    if (!activeSection) return
    if (activeSection.phase !== 'CONSTRUCTING' || !activeSection.blueprint) {
      if (this.entered && activeSection.phase === 'ACTIVE') this.dispatchTasks()
      return
    }

    this.snapshotEngine.refreshMeasurements(activeSection.blueprint)
    const textAgents: AgentRuntime[] = []
    const iconAgents: AgentRuntime[] = []
    this.agents.forEach((agent) => {
      const task = agent.task
      if (!task || task.status === 'complete') return
      const element = activeSection.blueprint?.elements.get(task.elementId ?? '')
      if (!element) return
      task.bounds = { ...element.bounds }
      if (agent.proxy && task.operation === 'type') {
        agent.proxy.style.transform = `translate3d(${task.bounds.left}px, ${task.bounds.top}px, 0)`
        agent.proxy.style.width = `${task.bounds.width}px`
        agent.proxy.dataset.swarmBounds = `${task.bounds.left}:${task.bounds.top}:${task.bounds.width}`
        textAgents.push(agent)
      } else if (agent.proxy && task.operation === 'icon') {
        agent.proxy.style.left = `${task.bounds.left}px`
        agent.proxy.style.top = `${task.bounds.top}px`
        agent.proxy.style.width = `${task.bounds.width}px`
        agent.proxy.style.height = `${task.bounds.height}px`
        agent.proxy.dataset.swarmBounds = `${task.bounds.left}:${task.bounds.top}:${task.bounds.width}:${task.bounds.height}`
        iconAgents.push(agent)
      }
    })
    iconAgents.forEach((agent) => {
      agent.pathTransform = agent.paths[0]?.getScreenCTM() ?? null
    })
    textAgents.forEach((agent) => agent.characters.forEach((character) => {
      const rect = character.element.getBoundingClientRect()
      character.bounds = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }
    }))
    this.dispatchTasks()
  }

  private animate = (now: number) => {
    if (!this.running) return
    const delta = Math.min(50, Math.max(0, now - this.lastFrame))
    this.lastFrame = now

    // Advance section-aware scrolling if in progress
    if (this.scrollController.isScrolling()) {
      const activeSection = this.sectionManager.getActiveSection()
      const nextTargetEl = activeSection && activeSection.phase === 'ACTIVE'
        ? activeSection.element
        : null

      this.scrollController.advance(delta, nextTargetEl, () => {
        if (activeSection && activeSection.phase === 'ACTIVE') {
          this.activateSectionConstruction(activeSection)
        }
      })
    }

    // Update all 15 agents
    this.agents.forEach((agent, index) => {
      if (agent.phase === 'hidden' || agent.phase === 'waiting') return

      if (agent.phase === 'following') {
        this.updateFollower(agent, delta)
        return
      }

      if (agent.phase === 'entering') {
        if (now < agent.phaseStart) return
        const progress = this.updatePosition(agent, now)
        if (progress >= 1) {
          this.arriveAtGateway(agent)
          if (this.agents.every((item) => item.phase !== 'entering')) {
            this.entered = true
            const firstSection = this.sectionManager.getActiveSection()
            if (firstSection) {
              this.activateSectionConstruction(firstSection)
            }
          }
        }
        return
      }

      if (agent.phase === 'to-tool' || agent.phase === 'moving' || agent.phase === 'returning') {
        if (agent.task && !agent.task.target.isConnected) {
          this.discardDisconnectedTask(agent)
          return
        }
        if (now < agent.phaseStart) return

        const progress = this.updatePosition(agent, now)
        if (progress >= 1) {
          if (agent.phase === 'to-tool') {
            agent.phase = 'pickup'
            agent.phaseStart = now
            agent.phaseDuration = (swarmSettings.timing.toolPickupDuration + (index % 4) * swarmSettings.timing.toolPickupStagger)
              / swarmSettings.speed.toolCollection
            this.updateCursorDOM(agent, 'collecting tool', agent.task?.tool ?? null, false, agent.task?.description ?? 'Collecting tool')
          } else if (agent.phase === 'moving') {
            this.startOperation(agent, now)
          } else {
            this.arriveAtGateway(agent)
            this.dispatchTasks()
          }
        }
        return
      }

      if (agent.phase === 'pickup') {
        if (agent.task && !agent.task.target.isConnected) {
          this.discardDisconnectedTask(agent)
          return
        }
        if (now - agent.phaseStart >= agent.phaseDuration) {
          agent.tool = agent.task?.tool ?? null
          this.moveToTarget(agent)
        }
        return
      }

      if (agent.phase === 'working') {
        this.updateOperation(agent, now)
      }
    })

    this.publishActivity(this.activityState())
    this.frameId = window.requestAnimationFrame(this.animate)
  }

  private updatePosition(agent: AgentRuntime, now: number) {
    const progress = Math.min(1, Math.max(0, (now - agent.phaseStart) / agent.phaseDuration))
    const power = Math.max(
      swarmSettings.timing.minimumAccelerationPower,
      swarmSettings.agents.acceleration[this.agents.indexOf(agent)]
        / swarmSettings.speed.accelerationResponsiveness
        * swarmSettings.speed.accelerationCurve,
    )
    const eased = progress < 0.5
      ? 0.5 * (2 * progress) ** power
      : 1 - 0.5 * (2 * (1 - progress)) ** power
    const inverse = 1 - eased

    agent.position = {
      x: inverse * inverse * agent.from.x + 2 * inverse * eased * agent.control.x + eased * eased * agent.to.x,
      y: inverse * inverse * agent.from.y + 2 * inverse * eased * agent.control.y + eased * eased * agent.to.y,
    }
    this.placeCursor(agent, agent.phase === 'returning' ? 1 - eased : 0.72 + eased * 0.28)
    return progress
  }

  private setPath(agent: AgentRuntime, from: SwarmPoint, to: SwarmPoint, index: number) {
    agent.from = { ...from }
    agent.to = { ...to }
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const bend = Math.min(80, distance * (0.1 + (index % 4) * 0.02))
    const direction = index % 2 === 0 ? 1 : -1
    agent.control = {
      x: (from.x + to.x) / 2 + Math.sin(index * 1.7) * bend * direction,
      y: (from.y + to.y) / 2 + Math.cos(index * 1.3) * bend * direction,
    }
  }

  private arriveAtGateway(agent: AgentRuntime) {
    agent.phase = 'waiting'
    agent.tool = null
    agent.task = null
    agent.cursor.style.opacity = '0'
    agent.cursor.style.transform = `translate3d(${agent.position.x}px, ${agent.position.y}px, 0) scale(.01)`
    this.updateCursorDOM(agent, 'waiting', null, false, 'Waiting for task')
  }

  private placeCursor(agent: AgentRuntime, scale = 1) {
    agent.cursor.style.opacity = '1'
    agent.cursor.style.transform = `translate3d(${agent.position.x}px, ${agent.position.y}px, 0) scale(${scale})`
  }

  private setAgentPosition(agent: AgentRuntime, point: SwarmPoint) {
    agent.position = point
    this.placeCursor(agent)
  }

  private updateCursorDOM(agent: AgentRuntime, stateText: string, toolText: string | null, active: boolean, operationText: string) {
    agent.cursor.dataset.state = stateText.toLowerCase().replace(/ /g, '-')
    if (active) agent.cursor.dataset.active = 'true'
    else agent.cursor.removeAttribute('data-active')

    if (toolText && active) {
      agent.cursor.dataset.tool = toolText.toLowerCase()
    } else {
      agent.cursor.removeAttribute('data-tool')
    }

    const labelSmall = agent.cursor.querySelector<HTMLElement>('.swarm-cursor-label small')
    if (labelSmall && labelSmall.textContent !== stateText) {
      labelSmall.textContent = stateText
    }

    const toolBadge = agent.cursor.querySelector<HTMLElement>('.swarm-cursor-tool')
    if (toolBadge) {
      if (active && toolText) {
        toolBadge.style.display = ''
        toolBadge.textContent = toolText.toUpperCase()
      } else {
        toolBadge.style.display = 'none'
      }
    }

    agent.cursor.title = `${agent.identity.name} · ${active ? operationText : stateText}`
  }

  private elementCenter(element: Element) {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
  }

  private operationStartPoint(task: BuildTask) {
    const bounds = task.bounds
    if (task.operation === 'draw' || task.operation === 'image' || task.operation === 'icon') {
      return { x: bounds.left + 2, y: bounds.top + 2 }
    }
    if (task.operation === 'type') {
      return { x: bounds.left + 2, y: bounds.top + bounds.height / 2 }
    }
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
  }

  // =========================================================================
  // CURSOR FOLLOW MODE
  // =========================================================================

  private startFollowMode() {
    if (!this.pointerPosition || this.reducedMotion) return
    this.agents.forEach((agent) => {
      if (agent.phase === 'following') return
      agent.phase = 'following'
      agent.task = null
      agent.cursor.dataset.state = 'cursor-follow'
      agent.cursor.dataset.active = 'true'
      agent.cursor.removeAttribute('data-tool')
      agent.cursor.style.visibility = 'visible'
      agent.cursor.style.opacity = '1'
    })
  }

  private updateFollower(agent: AgentRuntime, delta: number) {
    if (!this.pointerPosition) return
    const index = this.agents.indexOf(agent)
    const perpendicular = { x: -this.pointerDirection.y, y: this.pointerDirection.x }
    const side = index % 2 === 0 ? 1 : -1
    const lane = Math.floor(index / 2) + 1
    const trail = 15 + index * 3.2
    const lateral = side * (4 + lane * 2.4)
    const target = {
      x: this.pointerPosition.x - this.pointerDirection.x * trail + perpendicular.x * lateral,
      y: this.pointerPosition.y - this.pointerDirection.y * trail + perpendicular.y * lateral,
    }
    const response = 95 + index * 15
    const amount = 1 - Math.exp(-delta / response)
    agent.position = {
      x: agent.position.x + (target.x - agent.position.x) * amount,
      y: agent.position.y + (target.y - agent.position.y) * amount,
    }
    this.placeCursor(agent)
  }

  // =========================================================================
  // ACTIVITY REPORTING
  // =========================================================================

  private cursorState(agent: AgentRuntime) {
    const active = !['hidden', 'waiting'].includes(agent.phase)
    const task = agent.task
    const state = agent.phase === 'hidden' ? (this.finished ? 'complete' : 'waiting')
      : agent.phase === 'entering' ? 'entering'
      : agent.phase === 'to-tool' || agent.phase === 'pickup' ? 'collecting tool'
      : agent.phase === 'returning' ? 'returning'
      : agent.phase === 'following' ? 'cursor follow'
      : agent.phase === 'waiting' ? (this.finished ? 'complete' : 'waiting')
      : task?.operation === 'type' ? 'typing'
      : task?.operation === 'colour' ? 'styling'
      : task?.operation === 'align' ? 'aligning'
      : task?.operation === 'transform' ? 'transforming'
      : task?.operation === 'icon' || task?.operation === 'draw' || task?.operation === 'image' ? 'drawing'
      : 'working'

    return {
      ...agent.identity,
      tool: active ? agent.tool ?? (agent.phase === 'to-tool' || agent.phase === 'pickup' ? agent.task?.tool ?? null : null) : null,
      operation: task?.description ?? (agent.phase === 'following' ? 'Following your cursor' : 'Waiting for task'),
      active,
      state,
    }
  }

  private activityState() {
    if (this.scrollController.isPaused()) {
      return this.scrollController.getPauseReason() === 'construction' ? 'PAUSED FOR CONSTRUCTION' : 'PAUSED BY VISITOR'
    }
    if (this.agents.some((agent) => agent.phase === 'following')) return 'CURSOR FOLLOW MODE'
    if (this.scrollController.isScrolling()) return 'AUTO SCROLLING'
    if (this.agents.some((agent) => agent.phase === 'entering')) return 'ENTERING'
    if (this.agents.some((agent) => agent.phase === 'to-tool' || agent.phase === 'pickup')) return 'COLLECTING TOOL'
    if (this.agents.some((agent) => agent.phase === 'working')) {
      const operations = this.agents.filter((agent) => agent.phase === 'working').map((agent) => agent.task?.operation)
      return operations.includes('type') ? 'TYPING'
        : operations.includes('colour') ? 'STYLING'
        : operations.includes('transform') ? 'TRANSFORMING'
        : operations.includes('align') ? 'ALIGNING'
        : 'DRAWING'
    }
    if (this.agents.some((agent) => agent.phase === 'returning')) return 'RETURNING'
    return this.finished ? 'COMPLETE' : 'WAITING'
  }

  private publishActivity(state: string, force = false) {
    const now = performance.now()
    if (!force && now - this.lastPublish < 180) return
    this.lastPublish = now

    const cursors = this.agents.map((agent) => this.cursorState(agent))
    const active = cursors.filter((cursor) => cursor.active)

    const depStats = this.dependencyEngine.getStats()
    const totalTasksCount = this.cumulativeTotalTasks + depStats.total
    const completedTasksCount = this.cumulativeCompletedTasks + depStats.completed

    const workingAgents = this.agents.filter((agent) => agent.phase === 'working').length
    const coordinatingAgents = this.agents.filter((agent) => ['entering', 'to-tool', 'pickup', 'moving', 'returning'].includes(agent.phase)).length
    const waitingAgents = this.agents.filter((agent) => agent.phase === 'waiting' || agent.phase === 'hidden').length
    const followingAgents = this.agents.filter((agent) => agent.phase === 'following').length

    const sections = this.sectionManager.getSections()
    const completedSectionsCount = this.sectionManager.getCompletedSectionIds().size
    const activeSec = this.sectionManager.getActiveSection()
    const activeSecId = activeSec?.id ?? ''

    // Calculate genuine progress percentage based on section completion and verified layer progress
    const sectionRatio = sections.length > 0 ? completedSectionsCount / sections.length : 0
    const currentSectionRatio = sections.length > 0 && depStats.total > 0
      ? (depStats.completed / depStats.total) / sections.length
      : 0
    const progress = this.finished ? 100 : Math.min(100, Math.floor((sectionRatio + currentSectionRatio) * 100))

    const operation = active.map((c) => c.operation).filter((val, idx, arr) => arr.indexOf(val) === idx).slice(0, 2).join(' · ')
      || (this.finished ? 'Construction complete' : state)

    const signature = `${state}:${activeSecId}:${progress}:${completedTasksCount}:${totalTasksCount}:${workingAgents}:${operation}`
    if (signature === this.activitySignature && !force) return
    this.activitySignature = signature

    this.onActivity({
      cursors,
      operation,
      runningTasks: active.length,
      totalAgents: this.agents.length,
      workingAgents,
      coordinatingAgents,
      waitingAgents,
      followingAgents,
      progress,
      completedTasks: completedTasksCount,
      totalTasks: totalTasksCount,
      animationState: state,
      scrollPaused: this.scrollController.isPaused(),
      scrollPausedForConstruction: this.scrollController.isPaused()
        && this.scrollController.getPauseReason() === 'construction',
      scrollComplete: this.scrollController.isCompleted(),
    })
  }

  private restoreAttribute(target: SwarmElement, name: string, value: string | null) {
    if (value === null) target.removeAttribute(name)
    else target.setAttribute(name, value)
  }
}
