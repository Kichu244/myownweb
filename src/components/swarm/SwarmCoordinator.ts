import {
  swarmIdentities,
  type ElementClassification,
  type SwarmActivity,
  type SwarmElement,
  type SwarmIdentity,
  type SwarmSectionInfo,
  type SwarmTargetBounds,
  type SwarmTask,
  type SwarmTool,
} from './swarmTypes'
import type { SwarmPoint } from './SwarmLoader'
import { swarmSettings } from './swarmSettings'

type AgentPhase = 'hidden' | 'entering' | 'waiting' | 'to-tool' | 'pickup' | 'moving' | 'working' | 'returning' | 'following'
type BuildTask = SwarmTask & {
  id: string
  bounds: SwarmTargetBounds
}
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
  duplicateOrigin: SwarmTargetBounds | null
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
  opacity: string
}

type PendingElementRecord = {
  element: SwarmElement
  sectionId: string
  registeredAt: number
}

const textTags = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LABEL', 'SPAN', 'STRONG', 'EM', 'SMALL', 'CODE', 'LI', 'B', 'I'])

export class SwarmCoordinator {
  private readonly agents: AgentRuntime[]
  private readonly toolbar: HTMLElement
  private readonly moveTool: HTMLElement
  private readonly overlay: HTMLElement
  private readonly initialPosition: SwarmPoint
  private readonly onActivity: (activity: SwarmActivity) => void
  private readonly onSectionChange: (sectionId: string) => void
  private readonly reducedMotion: boolean

  // Section tracking
  private sections: SwarmSectionInfo[] = []
  private currentSectionIndex = 0
  private sectionTasks = new Map<string, BuildTask[]>()
  private completedSections = new Set<string>()
  private pendingReadiness = new Map<SwarmElement, PendingElementRecord>()

  // Global target tracking
  private readonly targetStates = new Map<SwarmElement, OriginalTargetState>()
  private readonly knownTargets = new WeakSet<SwarmElement>()
  private readonly managedTargets = new Set<SwarmElement>()

  // Animation and scroll controllers
  private frameId: number | null = null
  private resumeTimer: number | null = null
  private observer: MutationObserver | null = null
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
      this.publishActivity('REDUCED MOTION', true)
      return
    }

    // Ensure root and main containers are visible
    const root = document.querySelector<HTMLElement>('#root')
    if (root) root.style.visibility = 'visible'
    const main = document.querySelector<HTMLElement>('main')
    if (main) main.style.visibility = 'visible'

    // Initialize section registry
    this.initSections()

    // Listeners for user interactions and scroll
    window.addEventListener('scroll', this.handleScroll, { passive: true })
    window.addEventListener('resize', this.handleResize, { passive: true })
    window.addEventListener('wheel', this.handleUserInterrupt, { passive: true })
    window.addEventListener('touchmove', this.handleUserInterrupt, { passive: true })
    window.addEventListener('pointerdown', this.handlePointerInterrupt, { passive: true })
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true })
    window.addEventListener('keydown', this.handleKeyInterrupt)

    this.observer = new MutationObserver(() => {
      if (!this.running || this.finished) return
      this.refreshActiveSectionTargets()
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
    if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer)
    this.frameId = null
    this.resumeTimer = null
    this.observer?.disconnect()
    this.observer = null

    window.removeEventListener('scroll', this.handleScroll)
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('wheel', this.handleUserInterrupt)
    window.removeEventListener('touchmove', this.handleUserInterrupt)
    window.removeEventListener('pointerdown', this.handlePointerInterrupt)
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('keydown', this.handleKeyInterrupt)

    document.documentElement.classList.remove('swarm-auto-scrolling')
    this.autoScrolling = false

    const root = document.querySelector<HTMLElement>('#root')
    if (root) root.style.removeProperty('visibility')
    const main = document.querySelector<HTMLElement>('main')
    if (main) main.style.removeProperty('visibility')

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
    this.sectionTasks.clear()
    this.completedSections.clear()
    this.pendingReadiness.clear()

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

  // =========================================================================
  // SECTION MANAGEMENT
  // =========================================================================

  private initSections() {
    const sectionEls = Array.from(document.querySelectorAll<HTMLElement>('main [data-swarm-section][id]'))
    if (!sectionEls.length) {
      const main = document.querySelector('main') as HTMLElement | null
      if (main) sectionEls.push(main)
    }

    this.sections = sectionEls.map((element, index) => {
      const id = element.dataset.swarmSection || element.id || `section-${index}`
      return {
        id,
        label: id.toUpperCase(),
        phase: 'PENDING',
        element,
      }
    })

    // Determine starting section based on current scroll position
    let startingIndex = 0
    if (window.scrollY > 100) {
      const centerY = window.innerHeight * 0.42
      let minDistance = Number.POSITIVE_INFINITY
      this.sections.forEach((sec, idx) => {
        const bounds = sec.element.getBoundingClientRect()
        const dist = Math.abs((bounds.top + bounds.bottom) / 2 - centerY)
        if (bounds.bottom > 0 && bounds.top < window.innerHeight && dist < minDistance) {
          minDistance = dist
          startingIndex = idx
        }
      })
    }

    this.currentSectionIndex = startingIndex
    if (this.sections[startingIndex]) {
      this.sections[startingIndex].phase = 'ACTIVE'
      this.onSectionChange(this.sections[startingIndex].id)
    }
  }

  private getActiveSection(): SwarmSectionInfo | null {
    return this.sections[this.currentSectionIndex] ?? null
  }

  private activateSectionConstruction(section: SwarmSectionInfo) {
    section.phase = 'CONSTRUCTING'
    section.element.style.visibility = 'visible'
    this.onSectionChange(section.id)

    // Stop auto-scrolling during construction
    this.stopAutoScroll()

    // Discover all visual content in this section
    this.discoverSectionTargets(section)

    // Dispatch tasks to available agents
    this.dispatchTasks()
    this.publishActivity('CONSTRUCTING', true)
  }

  private refreshActiveSectionTargets() {
    const activeSection = this.getActiveSection()
    if (!activeSection || activeSection.phase !== 'CONSTRUCTING') return
    this.discoverSectionTargets(activeSection)
    this.dispatchTasks()
  }

  // =========================================================================
  // CLASSIFICATION & CONTENT DETECTION (NEVER EXCLUDE ANIMATED/INTERACTIVE)
  // =========================================================================

  private isConstructible(element: SwarmElement): boolean {
    // Exclude Swarm Studio's own internal UI
    if (element.closest('.swarm-activate, .swarm-studio, .swarm-loader, .theme-toggle, .menu-toggle, .auto-scroll-toggle')) {
      return false
    }

    // Exclude explicitly exempted elements
    if (element.hasAttribute('data-swarm-exempt') || element.closest('[data-swarm-exempt]')) {
      return false
    }

    // Exclude dialogs/modals that are not open
    if (element.tagName === 'DIALOG' && !(element as HTMLDialogElement).open) {
      return false
    }

    return true
  }

  private classifyReadiness(element: SwarmElement, registeredAt = performance.now()): ElementClassification {
    if (element.getAttribute('data-swarm-built') === 'true') {
      return 'COMPLETED'
    }

    // Check if element is temporarily showing hover / active state
    if (element.matches?.(':hover, :active')) {
      return 'TEMPORARILY_INTERACTIVE'
    }

    // Check image load state
    if (element instanceof HTMLImageElement) {
      if (!element.complete || element.naturalWidth === 0) {
        return 'WAITING_FOR_RENDER'
      }
    }

    // Check if element has zero rendered dimensions
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      // Allow up to 350ms for entrance animation or render to establish dimensions
      if (performance.now() - registeredAt < 350) {
        return 'WAITING_FOR_RENDER'
      }
      return 'READY_FOR_CONSTRUCTION'
    }

    // Check if entrance animation has non-infinite opacity: 0
    try {
      const comp = window.getComputedStyle(element)
      if (comp.opacity === '0' && !element.hasAttribute('data-swarm-building')) {
        if (performance.now() - registeredAt < 400) {
          return 'WAITING_FOR_RENDER'
        }
      }
    } catch {
      // safe fallback
    }

    return 'READY_FOR_CONSTRUCTION'
  }

  private discoverSectionTargets(section: SwarmSectionInfo) {
    if (!this.running || this.reducedMotion) return
    const container = section.element
    if (!container || !container.isConnected) return

    const candidates = new Set<SwarmElement>()

    // 1. Elements with data-swarm marker
    container.querySelectorAll<HTMLElement>('[data-swarm]').forEach((target) => {
      candidates.add(target)
    })

    // 2. Headings & Typography
    const textSelector = Array.from(textTags, (tag) => tag.toLowerCase()).join(',')
    container.querySelectorAll<HTMLElement>(textSelector).forEach((target) => {
      if (!this.isConstructible(target)) return
      const text = this.getTargetFinalText(target)
      if (!text) return

      // Avoid nested duplicates if parent heading already captured
      const parentHeading = target.parentElement?.closest('h1, h2, h3, h4, h5, h6')
      if (parentHeading && parentHeading !== target) return

      candidates.add(target)
    })

    // 3. Cards, articles, panels, buttons
    container.querySelectorAll<HTMLElement>('.career-entry, .home-overview-card, .project-row, .skills-tree-parent, .skills-category, .skills-tree-leaf, .button, a.button, button, .hero-intro-card, .identity-visual, .identity-actions, .identity-focus, .contact-primary-action, .contact-copy-action, .hero-tech-tags').forEach((target) => {
      if (this.isConstructible(target)) candidates.add(target)
    })

    // 4. SVGs & Icons
    container.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
      if (this.isConstructible(svg)) candidates.add(svg)
    })

    // 5. Images
    container.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (this.isConstructible(img)) candidates.add(img)
    })

    const currentTasks = this.sectionTasks.get(section.id) ?? []

    candidates.forEach((target) => {
      if (this.knownTargets.has(target) || !target.isConnected) return
      if (!this.isConstructible(target)) return

      const readiness = this.classifyReadiness(target)
      if (readiness === 'WAITING_FOR_RENDER' || readiness === 'TEMPORARILY_INTERACTIVE') {
        if (!this.pendingReadiness.has(target)) {
          this.pendingReadiness.set(target, {
            element: target,
            sectionId: section.id,
            registeredAt: performance.now(),
          })
        }
        return
      }

      this.pendingReadiness.delete(target)
      this.knownTargets.add(target)
      this.rememberTarget(target)

      const rect = target.getBoundingClientRect()
      const task = this.createTask(target, section.id, rect)
      if (!task) return

      target.setAttribute('data-swarm-building', 'true')
      currentTasks.push(task)
    })

    this.sectionTasks.set(section.id, currentTasks)
  }

  private processPendingReadiness() {
    if (this.pendingReadiness.size === 0) return
    const activeSection = this.getActiveSection()
    if (!activeSection || activeSection.phase !== 'CONSTRUCTING') return

    const currentTasks = this.sectionTasks.get(activeSection.id) ?? []
    let newlyReady = false

    for (const [element, record] of this.pendingReadiness) {
      if (record.sectionId !== activeSection.id) continue
      if (!element.isConnected) {
        this.pendingReadiness.delete(element)
        continue
      }

      const readiness = this.classifyReadiness(element, record.registeredAt)
      if (readiness === 'READY_FOR_CONSTRUCTION' || performance.now() - record.registeredAt > 450) {
        this.pendingReadiness.delete(element)
        this.knownTargets.add(element)
        this.rememberTarget(element)

        const rect = element.getBoundingClientRect()
        const task = this.createTask(element, activeSection.id, rect)
        if (task) {
          element.setAttribute('data-swarm-building', 'true')
          currentTasks.push(task)
          newlyReady = true
        }
      }
    }

    if (newlyReady) {
      this.sectionTasks.set(activeSection.id, currentTasks)
      this.dispatchTasks()
    }
  }

  private getTargetFinalText(target: HTMLElement): string {
    const typingSpan = target.querySelector('.typing-text') || (target.classList.contains('typing-text') ? target : null)
    if (typingSpan) {
      const fullText = typingSpan.getAttribute('aria-label')
      if (fullText && fullText.trim()) return fullText.trim()
    }

    const ariaLabel = target.getAttribute('aria-label')
    if (ariaLabel && ariaLabel.trim() && ariaLabel.length > (target.textContent?.length ?? 0)) {
      return ariaLabel.trim()
    }

    return target.textContent?.trim() || ''
  }

  private createTask(target: SwarmElement, sectionId: string, rect: DOMRect): BuildTask | null {
    const tag = target.tagName.toUpperCase()
    const marker = target.dataset.swarm as SwarmTask['kind'] | undefined
    const isSvg = tag === 'SVG'
    const isImg = tag === 'IMG' || marker === 'image'
    const isButton = tag === 'BUTTON' || target.classList.contains('button') || target.classList.contains('contact-primary-action') || target.classList.contains('contact-copy-action')
    const isCard = target.classList.contains('career-entry') || target.classList.contains('home-overview-card') || target.classList.contains('project-row') || target.classList.contains('skills-tree-parent') || target.classList.contains('hero-intro-card') || target.classList.contains('skills-tree-leaf') || target.classList.contains('skills-category') || marker === 'card'

    const hasText = !isSvg && !isImg && Boolean(this.getTargetFinalText(target as HTMLElement))
    const isPureText = hasText && !isCard && !isButton && textTags.has(tag)

    const kind = marker ?? (isSvg ? 'icon' : isImg ? 'image' : isPureText ? 'text' : isButton ? 'button' : isCard ? 'card' : 'decoration')
    const duplicate = (kind === 'card' || kind === 'button') && target instanceof HTMLElement && this.hasDuplicateSource(target)

    const operation = isPureText ? 'type'
      : isImg ? 'image'
      : isSvg ? 'icon'
      : kind === 'style' ? 'colour'
      : kind === 'layout' ? 'align'
      : duplicate ? 'transform' : 'draw'

    const tool: SwarmTool = operation === 'type' ? 'Text'
      : operation === 'image' ? 'Image'
      : operation === 'icon' ? 'Pen'
      : operation === 'colour' ? 'Colour'
      : operation === 'align' ? 'Arrange'
      : operation === 'transform' ? 'Transform'
      : kind === 'container' ? 'Frame' : 'Shape'

    const description = operation === 'type' ? 'Typing characters'
      : operation === 'image' ? 'Constructing image'
      : operation === 'icon' ? 'Drawing vector paths'
      : operation === 'colour' ? 'Applying styling'
      : operation === 'align' ? 'Measuring and aligning'
      : operation === 'transform' ? 'Duplicating component'
      : isCard || isButton ? 'Constructing component geometry' : 'Drawing layout frame'

    const textLength = isPureText ? Math.max(1, this.getTargetFinalText(target as HTMLElement).length) : 0
    const duration = isPureText
      ? swarmSettings.timing.textSetupDuration + textLength * swarmSettings.timing.textCharacterDelay
      : operation === 'icon'
      ? swarmSettings.timing.iconSetupDuration + (target.querySelectorAll('path').length || 1) * swarmSettings.timing.iconPathDuration
      : operation === 'image' ? swarmSettings.timing.imageConstructionDuration
      : operation === 'align' ? swarmSettings.timing.alignmentDuration
      : operation === 'colour' ? swarmSettings.timing.colourApplicationDuration
      : swarmSettings.timing.drawingDuration + Math.min(
        swarmSettings.timing.drawingSizeDurationCap,
        Math.hypot(rect.width, rect.height) * swarmSettings.timing.drawingSizeScale,
      )

    return {
      id: `operation-${++this.taskSequence}`,
      target,
      sectionId,
      kind,
      operation,
      tool,
      description,
      status: 'queued',
      duration,
      bounds: {
        left: rect.left,
        top: rect.top,
        width: Math.max(2, rect.width),
        height: Math.max(2, rect.height),
      },
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
  // TASK DISPATCHING & AGENT ASSIGNMENT
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
    const activeSection = this.getActiveSection()
    if (!activeSection) return

    if (activeSection.phase === 'ACTIVE') {
      this.activateSectionConstruction(activeSection)
      return
    }

    if (activeSection.phase !== 'CONSTRUCTING') return

    const tasks = this.sectionTasks.get(activeSection.id) ?? []
    const queued = tasks.filter((t) => t.status === 'queued')

    if (queued.length === 0) {
      this.checkSectionCompletion(activeSection)
      return
    }

    // Assign tasks concurrently to available agents
    this.agents.forEach((agent) => {
      if (agent.phase !== 'waiting' || queued.length === 0) return
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY

      queued.forEach((task, idx) => {
        const centerX = task.bounds.left + task.bounds.width / 2
        const centerY = task.bounds.top + task.bounds.height / 2
        const distance = Math.hypot(centerX - agent.position.x, centerY - agent.position.y)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = idx
        }
      })

      const [task] = queued.splice(nearestIndex, 1)
      this.assignTask(agent, task)
    })

    this.checkSectionCompletion(activeSection)
  }

  private assignTask(agent: AgentRuntime, task: BuildTask) {
    task.status = 'collecting'
    agent.task = task

    if (agent.tool === task.tool) {
      this.moveToTarget(agent)
      return
    }

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

    const rect = task.target.getBoundingClientRect()
    task.bounds = {
      left: rect.left,
      top: rect.top,
      width: Math.max(2, rect.width),
      height: Math.max(2, rect.height),
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
      if ((task.kind === 'card' || task.kind === 'button') && task.target instanceof HTMLElement) {
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

    // Replace any TypingText span with its full resting aria-label string
    const typingSpans = proxy.querySelectorAll<HTMLElement>('.typing-text')
    typingSpans.forEach((span) => {
      const full = span.getAttribute('aria-label')
      if (full) span.textContent = full
    })

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
          const charBounds = character.getBoundingClientRect()
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
        const transform = activePath.getScreenCTM()
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

    task.target.setAttribute('data-swarm-build-progress', String(Math.floor(progress * 100)))
    if (progress >= 1) this.finishTask(agent)
  }

  private finishTask(agent: AgentRuntime) {
    const task = agent.task
    if (task) {
      task.status = 'complete'
      this.completeTarget(task.target)
    }

    this.clearAgentOperation(agent)
    agent.task = null
    this.updateCursorDOM(agent, 'waiting', null, false, 'Waiting for task')
    agent.phase = 'waiting'

    const activeSection = this.getActiveSection()
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

    // If target has a typing-text child, make sure its final resting text is shown
    const typingSpan = target.querySelector<HTMLElement>('.typing-text')
    if (typingSpan) {
      const fullText = typingSpan.getAttribute('aria-label')
      if (fullText && typingSpan.textContent !== fullText) {
        typingSpan.textContent = fullText
      }
    }
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
    if (task) {
      const sectionTasks = this.sectionTasks.get(task.sectionId)
      if (sectionTasks) {
        const idx = sectionTasks.indexOf(task)
        if (idx >= 0) sectionTasks.splice(idx, 1)
      }
    }
    this.clearAgentOperation(agent)
    agent.task = null
    agent.phase = 'waiting'
    this.updateCursorDOM(agent, 'waiting', null, false, 'Waiting for task')
    this.dispatchTasks()
  }

  // =========================================================================
  // SECTION COMPLETION & TRANSITION
  // =========================================================================

  private checkSectionCompletion(section: SwarmSectionInfo) {
    const tasks = this.sectionTasks.get(section.id) ?? []
    if (tasks.length === 0) return

    // If there are still pending elements waiting for render, don't complete yet
    const hasPendingInThisSection = Array.from(this.pendingReadiness.values()).some((r) => r.sectionId === section.id)
    if (hasPendingInThisSection) return

    const allComplete = tasks.every((t) => t.status === 'complete')
    const anyActiveAgents = this.agents.some((a) => a.task && a.task.sectionId === section.id)

    if (allComplete && !anyActiveAgents) {
      this.completeSection(section)
    }
  }

  private completeSection(section: SwarmSectionInfo) {
    if (section.phase === 'COMPLETED') return
    section.phase = 'COMPLETED'
    section.element.style.visibility = 'visible'
    this.completedSections.add(section.id)

    // Ensure all elements in the section are fully visible
    section.element.querySelectorAll<HTMLElement>('[data-swarm-building]').forEach((el) => {
      el.removeAttribute('data-swarm-building')
      el.setAttribute('data-swarm-built', 'true')
      el.style.visibility = 'visible'
      el.style.opacity = '1'
    })

    this.publishActivity('SECTION COMPLETED', true)

    if (this.currentSectionIndex < this.sections.length - 1) {
      this.advanceToNextSection()
    } else {
      // All sections complete!
      this.finished = true
      this.scrollComplete = true
      this.stopAutoScroll()
      this.startFollowMode()
      this.publishActivity('CURSOR FOLLOW MODE', true)
    }
  }

  private advanceToNextSection() {
    this.currentSectionIndex++
    const nextSection = this.sections[this.currentSectionIndex]
    if (!nextSection) return

    nextSection.phase = 'ACTIVE'
    this.onSectionChange(nextSection.id)

    // Resume auto-scrolling toward next section
    this.startAutoScroll()
  }

  // =========================================================================
  // AUTO-SCROLLING & USER INTERACTION
  // =========================================================================

  private startAutoScroll() {
    if (this.reducedMotion || this.scrollPaused || this.scrollComplete) return
    this.autoScrolling = true
    document.documentElement.classList.add('swarm-auto-scrolling')
    this.publishActivity('AUTO SCROLLING')
  }

  private stopAutoScroll() {
    this.autoScrolling = false
    document.documentElement.classList.remove('swarm-auto-scrolling')
  }

  private advanceScroll(delta: number) {
    const activeSection = this.getActiveSection()

    // If active section is waiting to be constructed, check if it's in view
    if (activeSection && activeSection.phase === 'ACTIVE') {
      const bounds = activeSection.element.getBoundingClientRect()
      if (bounds.top <= window.innerHeight * 0.25 || bounds.top <= 100) {
        this.stopAutoScroll()
        this.activateSectionConstruction(activeSection)
        return
      }
    }

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const next = Math.min(maxScroll, window.scrollY + swarmSettings.timing.scrollSpeed * delta / 1000)
    window.scrollTo({ top: next, behavior: 'instant' })
    this.lastScrollY = next

    if (next >= maxScroll - 1) {
      this.stopAutoScroll()
      if (activeSection && activeSection.phase === 'ACTIVE') {
        this.activateSectionConstruction(activeSection)
      }
    }
  }

  private pauseForUser(explicit = false) {
    if (this.scrollManuallyPaused && !explicit) return
    if (!this.autoScrolling && !this.scrollPaused && !explicit) return
    if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer)
    this.resumeTimer = null
    this.stopAutoScroll()
    this.scrollPaused = true
    this.scrollManuallyPaused = explicit

    if (explicit) {
      this.publishActivity('PAUSED BY VISITOR', true)
      return
    }

    this.resumeTimer = window.setTimeout(() => {
      this.resumeTimer = null
      if (!this.running || this.reducedMotion || this.scrollComplete) return
      this.scrollPaused = false
      this.scrollManuallyPaused = false
      const activeSection = this.getActiveSection()
      if (activeSection && activeSection.phase === 'ACTIVE') {
        this.startAutoScroll()
      }
    }, swarmSettings.timing.resumeDelay)
    this.publishActivity('PAUSED FOR VISITOR', true)
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
    }
  }

  private handleKeyInterrupt = (event: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      this.pauseForUser()
    }
  }

  private handleScroll = () => {
    const currentY = window.scrollY
    if (this.autoScrolling && Math.abs(currentY - this.lastScrollY) > 3) {
      this.pauseForUser()
    }
    this.lastScrollY = currentY
    this.updateCachedBoundsOnScroll()
  }

  private handleResize = () => {
    this.agents.forEach((agent) => {
      if (agent.phase !== 'hidden') return
      const gateway = this.elementCenter(this.moveTool)
      agent.position = gateway
      agent.cursor.style.transform = `translate3d(${gateway.x}px, ${gateway.y}px, 0) scale(.01)`
    })
    this.updateCachedBoundsOnScroll()
  }

  private updateCachedBoundsOnScroll() {
    for (const tasks of this.sectionTasks.values()) {
      tasks.forEach((task) => {
        if (task.status !== 'complete' && task.target.isConnected) {
          const rect = task.target.getBoundingClientRect()
          task.bounds = {
            left: rect.left,
            top: rect.top,
            width: Math.max(2, rect.width),
            height: Math.max(2, rect.height),
          }
        }
      })
    }
  }

  // =========================================================================
  // ANIMATION LOOP & CURSOR MOVEMENT
  // =========================================================================

  private animate = (now: number) => {
    if (!this.running) return
    const delta = Math.min(50, Math.max(0, now - this.lastFrame))
    this.lastFrame = now

    // Recheck any pending elements waiting for render
    this.processPendingReadiness()

    // Section-aware scrolling
    if (this.autoScrolling && !this.scrollPaused) {
      this.advanceScroll(delta)
    }

    // Update agents
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
            const firstSection = this.getActiveSection()
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
      x: (from.x + to.x) / 2 + Math.sin(index * 1.7 + this.taskSequence) * bend * direction,
      y: (from.y + to.y) / 2 + Math.cos(index * 1.3 + this.taskSequence) * bend * direction,
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
    return this.finished ? 'COMPLETE' : 'WAITING'
  }

  private publishActivity(state: string, force = false) {
    const now = performance.now()
    if (!force && now - this.lastPublish < 180) return
    this.lastPublish = now

    const cursors = this.agents.map((agent) => this.cursorState(agent))
    const active = cursors.filter((cursor) => cursor.active)

    let totalTasksCount = 0
    let completedTasksCount = 0
    for (const tasks of this.sectionTasks.values()) {
      totalTasksCount += tasks.length
      completedTasksCount += tasks.filter((t) => t.status === 'complete').length
    }

    const workingAgents = this.agents.filter((agent) => agent.phase === 'working').length
    const coordinatingAgents = this.agents.filter((agent) => ['entering', 'to-tool', 'pickup', 'moving', 'returning'].includes(agent.phase)).length
    const waitingAgents = this.agents.filter((agent) => agent.phase === 'waiting' || agent.phase === 'hidden').length
    const followingAgents = this.agents.filter((agent) => agent.phase === 'following').length

    const activeSec = this.getActiveSection()
    const activeSecId = activeSec?.id ?? ''

    const sectionRatio = this.sections.length > 0 ? this.completedSections.size / this.sections.length : 0
    const currentSectionTasks = activeSec ? this.sectionTasks.get(activeSec.id) ?? [] : []
    const currentCompleted = currentSectionTasks.filter((t) => t.status === 'complete').length
    const currentRatio = currentSectionTasks.length > 0 ? (currentCompleted / currentSectionTasks.length) / (this.sections.length || 1) : 0
    const progress = this.finished ? 100 : Math.min(100, Math.floor((sectionRatio + currentRatio) * 100))

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
      scrollPaused: this.scrollPaused,
      scrollComplete: this.scrollComplete,
    })
  }

  private restoreAttribute(target: SwarmElement, name: string, value: string | null) {
    if (value === null) target.removeAttribute(name)
    else target.setAttribute(name, value)
  }
}
