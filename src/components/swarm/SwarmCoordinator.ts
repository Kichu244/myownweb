import {
  swarmIdentities,
  type SwarmActivity,
  type SwarmElement,
  type SwarmIdentity,
  type SwarmTask,
  type SwarmTool,
} from './swarmTypes'
import type { SwarmPoint } from './SwarmLoader'
import { swarmSettings } from './swarmSettings'

type AgentPhase = 'hidden' | 'entering' | 'waiting' | 'to-tool' | 'pickup' | 'moving' | 'working' | 'returning' | 'following'
type BuildTask = SwarmTask & { id: string }
type TextCharacter = { element: HTMLSpanElement }
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
  duplicateOrigin: { x: number; y: number; width: number; height: number } | null
  gesture: HTMLDivElement | null
  gestureLabel: HTMLElement | null
  characters: TextCharacter[]
  revealedCharacters: number
  paths: SVGPathElement[]
  pathLengths: number[]
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
}

const textTags = new Set(['A', 'BUTTON', 'H1', 'H2', 'H3', 'H4', 'LABEL', 'P', 'SMALL', 'SPAN', 'STRONG', 'EM', 'LI', 'CODE'])

export class SwarmCoordinator {
  private readonly agents: AgentRuntime[]
  private readonly toolbar: HTMLElement
  private readonly moveTool: HTMLElement
  private readonly overlay: HTMLElement
  private readonly initialPosition: SwarmPoint
  private readonly onActivity: (activity: SwarmActivity) => void
  private readonly onSectionChange: (sectionId: string) => void
  private readonly reducedMotion: boolean
  private readonly tasks: BuildTask[] = []
  private readonly pendingTargets = new Set<SwarmElement>()
  private readonly knownTargets = new WeakSet<SwarmElement>()
  private readonly targetStates = new Map<SwarmElement, OriginalTargetState>()
  private readonly managedTargets = new Set<SwarmElement>()
  private frameId: number | null = null
  private resumeTimer: number | null = null
  private initialAutoScrollTimer: number | null = null
  private observer: MutationObserver | null = null
  private visibilityObserver: IntersectionObserver | null = null
  private lastFrame = 0
  private lastPublish = 0
  private lastScrollY = window.scrollY
  private scrollPaused = false
  private scrollManuallyPaused = false
  private autoScrolling = false
  private scrollComplete = false
  private entered = false
  private running = false
  private finished = false
  private activitySignature = ''
  private activeSection = ''
  private taskSequence = 0
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
      this.scrollComplete = true
      this.publishActivity('REDUCED MOTION')
      return
    }
    this.visibilityObserver = new IntersectionObserver((entries) => {
      this.activateVisibleTargets(entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as SwarmElement))
      this.dispatchTasks()
    }, { threshold: [0, .25, .5, .75, 1] })
    this.discoverTargets()
    this.observer = new MutationObserver(() => this.discoverTargets())
    const root = document.querySelector('#root') ?? document.querySelector('main')
    if (root) this.observer.observe(root, { childList: true, subtree: true })
    window.addEventListener('scroll', this.handleScroll, { passive: true })
    window.addEventListener('resize', this.handleResize, { passive: true })
    window.addEventListener('wheel', this.handleUserInterrupt, { passive: true })
    window.addEventListener('touchmove', this.handleUserInterrupt, { passive: true })
    window.addEventListener('pointerdown', this.handlePointerInterrupt, { passive: true })
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true })
    window.addEventListener('keydown', this.handleKeyInterrupt)

    this.enterFromSpawn()
    this.lastFrame = performance.now()
    this.frameId = window.requestAnimationFrame(this.animate)
  }

  stop() {
    if (!this.running) return
    this.running = false
    if (this.frameId !== null) window.cancelAnimationFrame(this.frameId)
    if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer)
    if (this.initialAutoScrollTimer !== null) window.clearTimeout(this.initialAutoScrollTimer)
    this.frameId = null
    this.resumeTimer = null
    this.initialAutoScrollTimer = null
    this.observer?.disconnect()
    this.observer = null
    this.visibilityObserver?.disconnect()
    this.visibilityObserver = null
    window.removeEventListener('scroll', this.handleScroll)
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('wheel', this.handleUserInterrupt)
    window.removeEventListener('touchmove', this.handleUserInterrupt)
    window.removeEventListener('pointerdown', this.handlePointerInterrupt)
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('keydown', this.handleKeyInterrupt)
    document.documentElement.classList.remove('swarm-auto-scrolling')
    this.autoScrolling = false
    this.agents.forEach((agent) => this.clearAgentOperation(agent))
    for (const [target, state] of this.targetStates) {
      this.restoreAttribute(target, 'data-swarm-building', state.building)
      this.restoreAttribute(target, 'data-swarm-built', state.built)
      this.restoreAttribute(target, 'data-swarm-build-progress', state.progress)
      target.style.clipPath = state.clipPath
      target.style.visibility = state.visibility
    }
    this.targetStates.clear()
    this.pendingTargets.clear()
    this.managedTargets.clear()
    this.tasks.length = 0
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
      scrollComplete: false,
    })
  }

  toggleAutoScroll() {
    if (this.scrollComplete) return
    if (this.scrollPaused) {
      this.scrollPaused = false
      this.scrollManuallyPaused = false
      if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer)
      this.resumeTimer = null
      this.lastScrollY = window.scrollY
      this.startAutoScroll()
    } else {
      this.pauseForUser(true)
    }
  }

  private discoverTargets() {
    if (!this.running || this.reducedMotion) return
    const root = document.querySelector('#root') ?? document.querySelector('main')
    if (!root) return
    const candidates = new Set<SwarmElement>()

    root.querySelectorAll<HTMLElement>('[data-swarm]').forEach((target) => candidates.add(target))
    root.querySelectorAll<SVGSVGElement>('main svg').forEach((target) => {
      if (target.closest('[data-swarm-exempt]')) return
      candidates.add(target)
    })
    root.querySelectorAll<HTMLElement>(Array.from(textTags, (tag) => tag.toLowerCase()).join(',')).forEach((target) => {
      if (target.closest('.swarm-activate, .theme-toggle, .menu-toggle, .auto-scroll-toggle, .swarm-studio, [data-swarm-exempt]')) return
      if (!target.childNodes.length || !Array.from(target.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()))) return
      if (target.closest('[data-swarm="heading"], [data-swarm="text"]')) return
      const textParent = target.parentElement?.closest<HTMLElement>(Array.from(textTags, (tag) => tag.toLowerCase()).join(','))
      if (textParent && Array.from(textParent.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()))) return
      candidates.add(target)
    })

    candidates.forEach((target) => {
      if (this.knownTargets.has(target) || !target.isConnected) return
      const rect = target.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      if (target instanceof HTMLElement && target.dataset.swarm === 'container' && target.querySelector('[data-swarm]')) return
      if (rect.width > window.innerWidth || rect.height > window.innerHeight) return
      this.knownTargets.add(target)
      this.rememberTarget(target)
      target.setAttribute('data-swarm-building', 'true')
      this.pendingTargets.add(target)
      this.visibilityObserver?.observe(target)
    })
    this.activateVisibleTargets()
    if (this.entered) this.dispatchTasks()
  }

  private activateVisibleTargets(targets: Iterable<SwarmElement> = this.pendingTargets) {
    let activated = false
    for (const target of targets) {
      if (!this.pendingTargets.has(target)) continue
      if (!target.isConnected) {
        this.pendingTargets.delete(target)
        this.visibilityObserver?.unobserve(target)
        continue
      }
      if (!this.isTargetVisible(target)) continue
      this.pendingTargets.delete(target)
      const existingTask = this.tasks.find((candidate) => candidate.target === target)
      if (existingTask) {
        activated = true
        if (this.finished) {
          this.finished = false
          this.stopFollowMode()
        }
        continue
      }
      const task = this.createTask(target)
      if (!task) {
        this.visibilityObserver?.unobserve(target)
        continue
      }
      target.setAttribute('data-swarm-building', 'true')
      this.tasks.push(task)
      if (this.finished) {
        this.finished = false
        this.stopFollowMode()
      }
      activated = true
    }
    if (activated) this.publishActivity('COLLABORATING')
  }

  private createTask(target: SwarmElement): BuildTask | null {
    const tag = target.tagName
    const marker = target.dataset.swarm as SwarmTask['kind'] | undefined
    const isSvg = tag.toLowerCase() === 'svg'
    const text = marker === 'heading' || marker === 'text' || (!marker && textTags.has(tag) && Boolean(target.textContent?.trim()))
    const kind = marker ?? (isSvg ? 'icon' : text ? 'text' : tag === 'BUTTON' ? 'button' : 'decoration')
    const duplicate = (kind === 'card' || kind === 'button')
      && target instanceof HTMLElement
      && this.hasDuplicateSource(target)
    const operation = text ? 'type'
      : kind === 'image' ? 'image'
        : kind === 'style' ? 'colour'
          : kind === 'layout' ? 'align'
            : isSvg ? 'icon'
              : duplicate ? 'transform' : 'draw'
    const tool: SwarmTool = operation === 'type' ? 'Text'
      : operation === 'image' ? 'Image'
        : operation === 'colour' ? 'Colour'
          : operation === 'align' ? 'Arrange'
            : operation === 'icon' ? 'Pen'
              : operation === 'transform' ? 'Transform'
              : kind === 'container' ? 'Frame' : 'Shape'
    const description = operation === 'type' ? 'Typing characters'
      : operation === 'image' ? 'Constructing image'
        : operation === 'colour' ? 'Applying colour'
          : operation === 'align' ? 'Measuring and aligning'
            : operation === 'icon' ? 'Drawing icon paths'
              : operation === 'transform' ? 'Duplicating and transforming'
                : kind === 'card' || kind === 'button' ? 'Drawing component geometry' : 'Drawing a frame'
    const textLength = text ? Math.max(1, target.textContent?.length ?? 1) : 0
    const duration = text
      ? swarmSettings.timing.textSetupDuration + textLength * swarmSettings.timing.textCharacterDelay
      : operation === 'icon'
        ? swarmSettings.timing.iconSetupDuration + (target.querySelectorAll('path').length || 1) * swarmSettings.timing.iconPathDuration
        : operation === 'image' ? swarmSettings.timing.imageConstructionDuration
          : operation === 'align' ? swarmSettings.timing.alignmentDuration
            : operation === 'colour' ? swarmSettings.timing.colourApplicationDuration
              : swarmSettings.timing.drawingDuration + Math.min(
                swarmSettings.timing.drawingSizeDurationCap,
                Math.hypot(target.getBoundingClientRect().width, target.getBoundingClientRect().height) * swarmSettings.timing.drawingSizeScale,
              )
    return {
      id: `operation-${++this.taskSequence}`,
      target,
      kind,
      operation,
      tool,
      description,
      status: 'queued',
      duration,
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
    })
    this.managedTargets.add(target)
  }

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
      agent.cursor.dataset.state = 'entering'
      agent.cursor.style.opacity = '1'
      agent.cursor.style.transform = `translate3d(${agent.position.x}px, ${agent.position.y}px, 0) scale(.55)`
    })
    this.publishActivity('ENTERING')
  }

  private dispatchTasks() {
    if (!this.entered || !this.running) return
    const queued = this.tasks
      .filter((task) => task.status === 'queued' && this.isTargetVisible(task.target))
      .map((task) => ({ task, position: this.elementCenter(task.target) }))
    this.agents.forEach((agent) => {
      if (agent.phase !== 'waiting' || queued.length === 0) return
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY
      queued.forEach(({ position }, index) => {
        const distance = Math.hypot(position.x - agent.position.x, position.y - agent.position.y)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = index
        }
      })
      const [{ task }] = queued.splice(nearestIndex, 1)
      this.visibilityObserver?.unobserve(task.target)
      this.assignTask(agent, task)
    })
    this.updateCompletionState()
  }

  private updateCompletionState() {
    const complete = this.tasks.length > 0
      && this.tasks.every((task) => task.status === 'complete')
      && this.pendingTargets.size === 0
    if (complete === this.finished) return
    this.finished = complete
    if (complete) this.startFollowMode()
    else this.stopFollowMode()
    this.publishActivity(complete ? 'COMPLETE' : 'COLLABORATING')
  }

  private isTargetVisible(target: SwarmElement) {
    if (!target.isConnected) return false
    const bounds = target.getBoundingClientRect()
    return bounds.width > 0 && bounds.height > 0
      && bounds.left >= 0 && bounds.top >= 0
      && bounds.right <= window.innerWidth && bounds.bottom <= window.innerHeight
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

  private deferTask(agent: AgentRuntime) {
    const task = agent.task
    if (task) {
      task.status = 'queued'
      const state = this.targetStates.get(task.target)
      this.restoreAttribute(task.target, 'data-swarm-building', state?.building ?? null)
      this.restoreAttribute(task.target, 'data-swarm-build-progress', state?.progress ?? null)
      task.target.style.clipPath = state?.clipPath ?? ''
      task.target.style.visibility = state?.visibility ?? ''
      task.target.setAttribute('data-swarm-building', 'true')
      this.visibilityObserver?.observe(task.target)
    }
    this.clearAgentOperation(agent)
    agent.task = null
    agent.phase = 'waiting'
    agent.cursor.removeAttribute('data-active')
    agent.cursor.dataset.state = 'waiting'
    agent.cursor.style.opacity = '0'
    this.dispatchTasks()
  }

  private discardDisconnectedTask(agent: AgentRuntime) {
    const task = agent.task
    if (task) {
      const taskIndex = this.tasks.indexOf(task)
      if (taskIndex >= 0) this.tasks.splice(taskIndex, 1)
    }
    this.clearAgentOperation(agent)
    agent.task = null
    agent.phase = 'waiting'
    agent.cursor.removeAttribute('data-active')
    agent.cursor.dataset.state = 'waiting'
    this.dispatchTasks()
  }

  private assignTask(agent: AgentRuntime, task: BuildTask) {
    task.status = 'collecting'
    agent.task = task
    if (agent.tool === task.tool) {
      this.moveToTarget(agent)
      return
    }
    agent.phase = 'to-tool'
    agent.cursor.dataset.state = 'collecting tool'
    agent.cursor.dataset.tool = task.tool.toLowerCase()
    const toolElement = this.toolbar.querySelector<HTMLElement>(`[data-swarm-tool="${task.tool.toLowerCase()}"]`)
    const point = toolElement ? this.elementCenter(toolElement) : this.elementCenter(this.moveTool)
    this.startTravel(agent, point, 'to-tool')
    this.publishActivity('COLLECTING TOOL')
  }

  private moveToTarget(agent: AgentRuntime) {
    if (!agent.task) return
    agent.phase = 'moving'
    agent.cursor.dataset.state = agent.task.operation === 'type' ? 'typing' : 'working'
    agent.cursor.dataset.tool = agent.task.tool.toLowerCase()
    agent.cursor.dataset.active = 'true'
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
    if (!this.isTargetVisible(task.target)) {
      this.deferTask(agent)
      return
    }
    agent.phase = 'working'
    agent.phaseStart = now
    const distance = Math.hypot(task.target.getBoundingClientRect().width, task.target.getBoundingClientRect().height)
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
              : (task.kind === 'card' || task.kind === 'button')
                && task.target instanceof HTMLElement
                && this.hasDuplicateSource(task.target) ? swarmSettings.speed.duplication
              : swarmSettings.speed.drawing
    agent.phaseDuration = baseDuration / operationSpeed
    agent.cursor.dataset.state = task.operation === 'type' ? 'typing'
      : task.operation === 'colour' ? 'styling'
        : task.operation === 'align' ? 'aligning'
          : task.operation === 'transform' ? 'transforming'
          : 'drawing'
    agent.cursor.dataset.active = 'true'
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
      this.createTextProxy(agent, task.target)
    } else if (task.operation === 'icon' && task.target instanceof SVGSVGElement) {
      task.target.setAttribute('data-swarm-building', 'true')
      this.createIconProxy(agent, task.target)
    } else {
      task.target.removeAttribute('data-swarm-building')
      task.target.style.visibility = 'visible'
      task.target.style.clipPath = 'inset(0 100% 0 0)'
      if (task.operation === 'draw' || task.operation === 'image') this.createDrawGesture(agent, task.target)
      if (task.operation === 'align') this.createGuides(agent, task.target)
      if (task.operation === 'colour') this.createColourPass(agent)
      if ((task.kind === 'card' || task.kind === 'button') && task.target instanceof HTMLElement) {
        this.createDuplicateProxy(agent, task.target)
      }
    }
    this.publishActivity(agent.cursor.dataset.state.toUpperCase())
    this.dispatchTasks()
  }

  private createTextProxy(agent: AgentRuntime, target: HTMLElement) {
    const bounds = target.getBoundingClientRect()
    const proxy = target.cloneNode(true) as HTMLElement
    proxy.querySelectorAll('[data-swarm]').forEach((element) => element.remove())
    proxy.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'))
    proxy.removeAttribute('data-swarm-building')
    proxy.removeAttribute('data-swarm-built')
    proxy.classList.add('swarm-text-proxy')
    proxy.style.position = 'fixed'
    proxy.style.left = `${bounds.left}px`
    proxy.style.top = `${bounds.top}px`
    proxy.style.width = `${bounds.width}px`
    proxy.style.height = 'auto'
    proxy.style.margin = '0'
    proxy.style.maxWidth = 'none'
    proxy.style.transform = 'none'
    proxy.style.visibility = 'visible'
    proxy.style.opacity = '1'
    proxy.style.clipPath = 'none'
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
        characters.push({ element: span })
      })
      node.replaceWith(fragment)
    })
    agent.proxy = proxy
    agent.characters = characters
    agent.revealedCharacters = 0
    this.overlay.append(proxy)
    const caret = document.createElement('i')
    caret.className = 'swarm-typing-caret'
    caret.style.setProperty('--cursor-colour', agent.identity.colour)
    this.overlay.append(caret)
    agent.caret = caret
  }

  private createIconProxy(agent: AgentRuntime, target: SVGSVGElement) {
    const bounds = target.getBoundingClientRect()
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
  }

  private createDrawGesture(agent: AgentRuntime, target: SwarmElement) {
    const bounds = target.getBoundingClientRect()
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

  private createGuides(agent: AgentRuntime, target: SwarmElement) {
    const guide = document.createElement('div')
    guide.className = 'swarm-alignment-guides'
    guide.style.setProperty('--guide-colour', agent.identity.colour)
    const bounds = target.getBoundingClientRect()
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
    agent.duplicateOrigin = { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }
    this.overlay.append(duplicate)
  }

  private hasDuplicateSource(target: HTMLElement) {
    const siblings = Array.from(target.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element.dataset.swarm === target.dataset.swarm)
    return siblings.indexOf(target) > 0
  }

  private updateOperation(agent: AgentRuntime, now: number) {
    const task = agent.task
    if (!task) return
    if (!task.target.isConnected) {
      this.discardDisconnectedTask(agent)
      return
    }
    if (!this.isTargetVisible(task.target)) {
      this.deferTask(agent)
      return
    }
    this.showOperation(agent)
    const elapsed = now - agent.phaseStart
    const progress = Math.min(1, elapsed / agent.phaseDuration)
    const eased = 1 - (1 - progress) ** 3
    const rect = task.target.getBoundingClientRect()
    agent.frame.style.left = `${rect.left}px`
    agent.frame.style.top = `${rect.top}px`
    agent.frame.style.width = `${rect.width}px`
    agent.frame.style.height = `${rect.height}px`
    agent.frame.style.visibility = 'visible'

    if (agent.proxy) {
      agent.proxy.style.left = `${rect.left}px`
      agent.proxy.style.top = `${rect.top}px`
      agent.proxy.style.width = `${rect.width}px`
      if (task.operation === 'type') {
        const characterDelay = swarmSettings.timing.textCharacterDelay / swarmSettings.speed.typing
        const visibleCharacters = Math.min(agent.characters.length, Math.floor(elapsed / characterDelay))
        while (agent.revealedCharacters < visibleCharacters) {
          agent.characters[agent.revealedCharacters].element.style.opacity = '1'
          agent.revealedCharacters++
        }
        const character = agent.characters[Math.min(visibleCharacters, agent.characters.length - 1)]?.element
        if (character) {
          const position = character.getBoundingClientRect()
          const x = position.left + (visibleCharacters >= agent.characters.length ? position.width : 0)
          agent.position = { x, y: position.top + position.height / 2 }
          if (agent.caret) {
            agent.caret.style.left = `${x}px`
            agent.caret.style.top = `${position.top}px`
            agent.caret.style.height = `${Math.max(10, position.height)}px`
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
        const transform = activePath.getScreenCTM()
        const screenPoint = transform ? point.matrixTransform(transform) : { x: rect.left + rect.width * progress, y: rect.top + rect.height / 2 }
        this.setAgentPosition(agent, {
          x: screenPoint.x,
          y: screenPoint.y,
        })
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
        agent.duplicate.style.left = `${agent.duplicateOrigin.x + (rect.left - agent.duplicateOrigin.x) * eased}px`
        agent.duplicate.style.top = `${agent.duplicateOrigin.y + (rect.top - agent.duplicateOrigin.y) * eased}px`
        agent.duplicate.style.width = `${agent.duplicateOrigin.width + (rect.width - agent.duplicateOrigin.width) * eased}px`
        agent.duplicate.style.height = `${agent.duplicateOrigin.height + (rect.height - agent.duplicateOrigin.height) * eased}px`
      }
      this.setAgentPosition(agent, {
        x: rect.left + rect.width * progress,
        y: rect.top + rect.height * progress,
      })
    }

    task.target.setAttribute('data-swarm-build-progress', String(Math.floor(progress * 100)))
    if (progress >= 1) this.finishTask(agent)
  }

  private finishTask(agent: AgentRuntime) {
    const task = agent.task
    if (task && !this.isTargetVisible(task.target)) {
      this.deferTask(agent)
      return
    }
    if (task) {
      task.status = 'complete'
      this.completeTarget(task.target)
    }
    this.clearAgentOperation(agent)
    agent.task = null
    agent.cursor.removeAttribute('data-active')
    agent.cursor.removeAttribute('data-gesture')
    if (this.finished) {
      agent.phase = 'waiting'
      agent.cursor.dataset.state = 'complete'
    } else {
      agent.phase = 'waiting'
      agent.cursor.dataset.state = 'waiting'
      this.dispatchTasks()
    }
    this.updateCompletionState()
    this.publishActivity(this.finished ? 'COMPLETE' : 'COLLABORATING')
  }

  private completeTarget(target: SwarmElement) {
    if (!this.isTargetVisible(target)) return
    target.removeAttribute('data-swarm-building')
    target.removeAttribute('data-swarm-build-progress')
    target.setAttribute('data-swarm-built', 'true')
    const original = this.targetStates.get(target)
    target.style.visibility = 'visible'
    if (original) target.style.clipPath = original.clipPath
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
    agent.anchors = []
    agent.guide?.remove()
    agent.guide = null
    agent.guideLabel = null
    agent.frame.style.visibility = 'hidden'
    agent.frame.style.removeProperty('--frame-colour')
    agent.frame.removeAttribute('data-effect')
  }

  private arriveAtGateway(agent: AgentRuntime) {
    agent.phase = 'waiting'
    agent.tool = null
    agent.task = null
    agent.cursor.style.opacity = '0'
    agent.cursor.style.transform = `translate3d(${agent.position.x}px, ${agent.position.y}px, 0) scale(.01)`
    agent.cursor.dataset.state = 'waiting'
    agent.cursor.removeAttribute('data-tool')
    agent.cursor.removeAttribute('data-active')
  }

  private animate = (now: number) => {
    if (!this.running) return
    const delta = Math.min(50, Math.max(0, now - this.lastFrame))
    this.lastFrame = now
    if (this.autoScrolling && !this.scrollPaused) this.advanceScroll(delta)

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
            this.dispatchTasks()
            this.initialAutoScrollTimer = window.setTimeout(() => {
              this.initialAutoScrollTimer = null
              this.startAutoScroll()
            }, swarmSettings.timing.initialAutoScrollDelay)
          }
        }
        return
      }
      if (agent.phase === 'to-tool' || agent.phase === 'moving' || agent.phase === 'returning') {
        if (agent.task && !agent.task.target.isConnected) {
          this.discardDisconnectedTask(agent)
          return
        }
        if (agent.task && !this.isTargetVisible(agent.task.target)) {
          this.deferTask(agent)
          return
        }
        if (now < agent.phaseStart) return
        if (agent.phase === 'moving' && agent.task) this.trackTargetPosition(agent)
        const progress = this.updatePosition(agent, now)
        if (progress >= 1) {
          if (agent.phase === 'to-tool') {
            agent.phase = 'pickup'
            agent.phaseStart = now
            agent.phaseDuration = (swarmSettings.timing.toolPickupDuration + (index % 4) * swarmSettings.timing.toolPickupStagger)
              / swarmSettings.speed.toolCollection
            agent.cursor.dataset.state = 'collecting tool'
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
        if (agent.task && !this.isTargetVisible(agent.task.target)) {
          this.deferTask(agent)
          return
        }
        if (now - agent.phaseStart >= agent.phaseDuration) {
          agent.tool = agent.task?.tool ?? null
          this.moveToTarget(agent)
        }
        return
      }
      if (agent.phase === 'working') this.updateOperation(agent, now)
    })

    this.updateCurrentSection()
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
    const eased = progress < .5
      ? .5 * (2 * progress) ** power
      : 1 - .5 * (2 * (1 - progress)) ** power
    const inverse = 1 - eased
    agent.position = {
      x: inverse * inverse * agent.from.x + 2 * inverse * eased * agent.control.x + eased * eased * agent.to.x,
      y: inverse * inverse * agent.from.y + 2 * inverse * eased * agent.control.y + eased * eased * agent.to.y,
    }
    this.placeCursor(agent, agent.phase === 'returning' ? 1 - eased : .72 + eased * .28)
    return progress
  }

  private setPath(agent: AgentRuntime, from: SwarmPoint, to: SwarmPoint, index: number) {
    agent.from = { ...from }
    agent.to = { ...to }
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const bend = Math.min(90, distance * (.12 + index % 4 * .025))
    const direction = index % 2 === 0 ? 1 : -1
    agent.control = {
      x: (from.x + to.x) / 2 + Math.sin(index * 1.7 + this.taskSequence) * bend * direction,
      y: (from.y + to.y) / 2 + Math.cos(index * 1.3 + this.taskSequence) * bend * direction,
    }
  }

  private trackTargetPosition(agent: AgentRuntime) {
    if (!agent.task) return
    const target = this.elementCenter(agent.task.target)
    const dx = target.x - agent.to.x
    const dy = target.y - agent.to.y
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
    agent.to = target
    agent.control = { x: agent.control.x + dx / 2, y: agent.control.y + dy / 2 }
  }

  private startAutoScroll() {
    if (this.reducedMotion || this.scrollPaused || this.scrollComplete) return
    this.autoScrolling = true
    document.documentElement.classList.add('swarm-auto-scrolling')
    this.publishActivity('AUTO SCROLLING')
  }

  private advanceScroll(delta: number) {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const next = Math.min(maxScroll, window.scrollY + swarmSettings.timing.scrollSpeed * delta / 1000)
    window.scrollTo({ top: next, behavior: 'instant' })
    this.lastScrollY = next
    if (next >= maxScroll - 1) {
      this.autoScrolling = false
      this.scrollComplete = true
      document.documentElement.classList.remove('swarm-auto-scrolling')
      this.updateCompletionState()
      this.dispatchTasks()
    }
  }

  private pauseForUser(explicit = false) {
    if (this.scrollManuallyPaused && !explicit) return
    if (!this.autoScrolling && !this.scrollPaused && !explicit) return
    if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer)
    this.resumeTimer = null
    this.autoScrolling = false
    this.scrollPaused = true
    this.scrollManuallyPaused = explicit
    document.documentElement.classList.remove('swarm-auto-scrolling')
    if (explicit) {
      this.publishActivity('PAUSED BY VISITOR')
      return
    }
    this.resumeTimer = window.setTimeout(() => {
      this.resumeTimer = null
      if (!this.running || this.reducedMotion || this.scrollComplete) return
      this.scrollPaused = false
      this.scrollManuallyPaused = false
      this.startAutoScroll()
    }, swarmSettings.timing.resumeDelay)
    this.publishActivity('PAUSED FOR VISITOR')
  }

  private handleUserInterrupt = () => this.pauseForUser()

  private handlePointerInterrupt = (event: PointerEvent) => {
    const target = event.target
    if (target instanceof Element && target.closest('.swarm-studio, .swarm-loader')) return
    this.pauseForUser()
  }

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
      this.publishActivity('CURSOR FOLLOW MODE')
    }
  }

  private handleKeyInterrupt = (event: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) this.pauseForUser()
  }

  private handleScroll = () => {
    const currentY = window.scrollY
    if (this.autoScrolling && Math.abs(currentY - this.lastScrollY) > 3) {
      this.pauseForUser()
    }
    this.lastScrollY = currentY
    this.updateCurrentSection()
  }

  private handleResize = () => {
    this.agents.forEach((agent) => {
      if (agent.phase !== 'hidden') return
      const gateway = this.elementCenter(this.moveTool)
      agent.position = gateway
      agent.cursor.style.transform = `translate3d(${gateway.x}px, ${gateway.y}px, 0) scale(.01)`
    })
    this.updateCurrentSection()
    this.discoverTargets()
  }

  private updateCurrentSection() {
    const center = window.innerHeight * .42
    const current = Array.from(document.querySelectorAll<HTMLElement>('main [data-swarm-section][id]'))
      .map((section) => ({ section, bounds: section.getBoundingClientRect() }))
      .filter(({ bounds }) => bounds.bottom > 0 && bounds.top < window.innerHeight)
      .sort((a, b) => Math.abs((a.bounds.top + a.bounds.bottom) / 2 - center) - Math.abs((b.bounds.top + b.bounds.bottom) / 2 - center))[0]?.section
    const section = current?.dataset.swarmSection ?? ''
    if (section && section !== this.activeSection) {
      this.activeSection = section
      this.onSectionChange(section)
    }
  }

  private placeCursor(agent: AgentRuntime, scale = 1) {
    agent.cursor.style.opacity = '1'
    agent.cursor.style.transform = `translate3d(${agent.position.x}px, ${agent.position.y}px, 0) scale(${scale})`
  }

  private setAgentPosition(agent: AgentRuntime, point: SwarmPoint) {
    agent.position = point
    this.placeCursor(agent)
  }

  private elementCenter(element: Element) {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
  }

  private operationStartPoint(task: BuildTask) {
    const bounds = task.target.getBoundingClientRect()
    if (task.operation === 'draw' || task.operation === 'image' || task.operation === 'icon') {
      return { x: bounds.left + 2, y: bounds.top + 2 }
    }
    if (task.operation === 'type') return { x: bounds.left + 2, y: bounds.top + bounds.height / 2 }
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
  }

  private startFollowMode() {
    if (!this.finished || !this.pointerPosition || this.reducedMotion) return
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

  private stopFollowMode() {
    this.agents.forEach((agent) => {
      if (agent.phase !== 'following') return
      agent.phase = 'waiting'
      agent.cursor.removeAttribute('data-active')
      agent.cursor.dataset.state = 'waiting'
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
    if (this.scrollPaused) return 'PAUSED BY VISITOR'
    if (this.agents.some((agent) => agent.phase === 'following')) return 'CURSOR FOLLOW MODE'
    if (this.autoScrolling) return 'AUTO SCROLLING'
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
    if (this.agents.some((agent) => agent.phase === 'following')) return 'CURSOR FOLLOW MODE'
    return this.finished ? 'COMPLETE' : 'WAITING'
  }

  private publishActivity(state: string) {
    const cursors = this.agents.map((agent) => this.cursorState(agent))
    const active = cursors.filter((cursor) => cursor.active)
    const completedTasks = this.tasks.filter((task) => task.status === 'complete').length
    const totalTasks = this.tasks.length + this.pendingTargets.size
    const workingAgents = this.agents.filter((agent) => agent.phase === 'working').length
    const coordinatingAgents = this.agents.filter((agent) => ['entering', 'to-tool', 'pickup', 'moving', 'returning'].includes(agent.phase)).length
    const waitingAgents = this.agents.filter((agent) => agent.phase === 'waiting' || agent.phase === 'hidden').length
    const followingAgents = this.agents.filter((agent) => agent.phase === 'following').length
    const progress = totalTasks === 0 ? (this.finished ? 100 : 0)
      : Math.min(100, Math.floor(completedTasks / totalTasks * 100))
    const operation = active.map((cursor) => cursor.operation).filter((value, index, list) => list.indexOf(value) === index).slice(0, 2).join(' · ') || (this.finished ? 'Construction complete' : state)
    const signature = `${state}:${this.activeSection}:${progress}:${completedTasks}:${totalTasks}:${workingAgents}:${coordinatingAgents}:${waitingAgents}:${followingAgents}:${operation}`
    const now = performance.now()
    if (signature === this.activitySignature || now - this.lastPublish < 90) return
    this.activitySignature = signature
    this.lastPublish = now
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
      completedTasks,
      totalTasks,
      animationState: state,
      scrollPaused: this.scrollPaused,
      scrollComplete: this.scrollComplete,
    })
  }

  private restoreAttribute(target: SwarmElement, name: string, value: string | null) {
    if (value === null) target.removeAttribute(name)
    else target.setAttribute(name, value)
  }
}
