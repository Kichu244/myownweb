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

type AgentPhase = 'hidden' | 'entering' | 'waiting' | 'to-tool' | 'pickup' | 'moving' | 'working' | 'returning'
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
  characters: TextCharacter[]
  revealedCharacters: number
  paths: SVGPathElement[]
  pathLengths: number[]
  guide: HTMLElement | null
}

type OriginalTargetState = {
  building: string | null
  built: string | null
  progress: string | null
  clipPath: string
}

const speedProfiles = [.82, 1.08, .95, 1.24, .9, 1.16, 1.02, .87, 1.2, .99, .9, 1.14, .85, 1.05, 1.21]
const accelerationProfiles = [2.6, 3.2, 2.2, 3.7, 2.8, 2.4, 3.4, 2.5, 3.1, 2.3, 3.6, 2.7, 3.3, 2.1, 2.9]
const pauseProfiles = [70, 0, 130, 35, 95, 20, 150, 55, 110, 40, 125, 15, 80, 45, 105]
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
  private readonly knownTargets = new WeakSet<SwarmElement>()
  private readonly targetStates = new Map<SwarmElement, OriginalTargetState>()
  private readonly managedTargets = new Set<SwarmElement>()
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
  private activeSection = ''
  private taskSequence = 0

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
        characters: [],
        revealedCharacters: 0,
        paths: [],
        pathLengths: [],
        guide: null,
      }
    })
  }

  start() {
    if (this.running) return
    this.running = true
    this.discoverTargets()
    this.observer = new MutationObserver(() => this.discoverTargets())
    const root = document.querySelector('#root') ?? document.querySelector('main')
    if (root) this.observer.observe(root, { childList: true, subtree: true })
    window.addEventListener('scroll', this.handleScroll, { passive: true })
    window.addEventListener('resize', this.handleResize, { passive: true })
    window.addEventListener('wheel', this.handleUserInterrupt, { passive: true })
    window.addEventListener('touchmove', this.handleUserInterrupt, { passive: true })
    window.addEventListener('pointerdown', this.handlePointerInterrupt, { passive: true })
    window.addEventListener('keydown', this.handleKeyInterrupt)

    if (this.reducedMotion) {
      this.scrollComplete = true
      this.tasks.forEach((task) => this.completeTarget(task.target))
      this.finished = true
      this.publishActivity('COMPLETE')
      return
    }

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
    window.removeEventListener('keydown', this.handleKeyInterrupt)
    document.documentElement.classList.remove('swarm-auto-scrolling')
    this.autoScrolling = false
    this.agents.forEach((agent) => this.clearAgentOperation(agent))
    for (const [target, state] of this.targetStates) {
      this.restoreAttribute(target, 'data-swarm-building', state.building)
      this.restoreAttribute(target, 'data-swarm-built', state.built)
      this.restoreAttribute(target, 'data-swarm-build-progress', state.progress)
      target.style.clipPath = state.clipPath
    }
    this.targetStates.clear()
    this.managedTargets.clear()
    this.tasks.length = 0
    this.agents.forEach((agent) => {
      agent.cursor.removeAttribute('data-tool')
      agent.cursor.removeAttribute('data-state')
      agent.cursor.removeAttribute('data-active')
      agent.cursor.style.opacity = '0'
      agent.cursor.style.transform = 'translate3d(-100px, -100px, 0) scale(.5)'
      agent.frame.style.visibility = 'hidden'
      agent.frame.style.removeProperty('--frame-colour')
    })
    this.onActivity({
      cursors: this.agents.map((agent) => ({ ...agent.identity, tool: null, operation: 'Waiting for task', active: false, state: 'waiting' })),
      operation: 'Waiting for task',
      runningTasks: 0,
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
    if (!this.running) return
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
      const task = this.createTask(target)
      if (!task) return
      this.knownTargets.add(target)
      this.rememberTarget(target)
      target.setAttribute('data-swarm-building', 'true')
      this.tasks.push(task)
      this.finished = false
    })
    if (this.entered) this.dispatchTasks()
  }

  private createTask(target: SwarmElement): BuildTask | null {
    const tag = target.tagName
    const marker = target.dataset.swarm as SwarmTask['kind'] | undefined
    const isSvg = tag.toLowerCase() === 'svg'
    const text = marker === 'heading' || marker === 'text' || (!marker && textTags.has(tag) && Boolean(target.textContent?.trim()))
    const kind = marker ?? (isSvg ? 'icon' : text ? 'text' : tag === 'BUTTON' ? 'button' : 'decoration')
    const operation = text ? 'type'
      : kind === 'image' ? 'image'
        : kind === 'style' ? 'colour'
          : kind === 'layout' ? 'align'
            : isSvg ? 'icon'
              : 'draw'
    const tool: SwarmTool = operation === 'type' ? 'Text'
      : operation === 'image' ? 'Image'
        : operation === 'colour' ? 'Colour'
          : operation === 'align' ? 'Arrange'
            : operation === 'icon' ? 'Pen'
              : kind === 'container' ? 'Frame' : 'Shape'
    const description = operation === 'type' ? 'Typing characters'
      : operation === 'image' ? 'Constructing image'
        : operation === 'colour' ? 'Applying colour'
          : operation === 'align' ? 'Measuring and aligning'
            : operation === 'icon' ? 'Drawing icon paths'
              : kind === 'card' || kind === 'button' ? 'Drawing component geometry' : 'Drawing a frame'
    const textLength = text ? Math.max(1, target.textContent?.length ?? 1) : 0
    const duration = text
      ? 500 + textLength * swarmSettings.timing.textCharacterDelay
      : operation === 'icon' ? 1000 + (target.querySelectorAll('path').length || 1) * 280
        : operation === 'image' ? 2100
          : operation === 'align' ? 1550
            : operation === 'colour' ? 1350
              : 1650 + Math.min(1400, Math.hypot(target.getBoundingClientRect().width, target.getBoundingClientRect().height) * 1.4)
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
    })
    this.managedTargets.add(target)
  }

  private enterFromSpawn() {
    const now = performance.now()
    const gateway = this.elementCenter(this.moveTool)
    this.agents.forEach((agent, index) => {
      const angle = index * 2.4
      agent.phase = 'entering'
      agent.phaseStart = now + pauseProfiles[index] * 2 * swarmSettings.speed.idleDelay
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
    this.agents.forEach((agent) => {
      if (agent.phase !== 'waiting') return
      const task = this.findAvailableTask(agent)
      if (task) this.assignTask(agent, task)
      else if (agent.tool && this.tasks.every((pending) => pending.status === 'complete')) this.returnToGateway(agent)
    })
    if (!this.finished && this.tasks.length > 0 && this.tasks.every((task) => task.status === 'complete')) {
      this.finished = true
      this.agents.forEach((agent) => {
        if (agent.phase === 'waiting' && agent.tool) this.returnToGateway(agent)
      })
      this.publishActivity('COMPLETE')
    }
  }

  private findAvailableTask(agent: AgentRuntime) {
    const viewportHeight = window.innerHeight
    const queued = this.tasks.filter((task) => {
      if (task.status !== 'queued' || !task.target.isConnected) return false
      const parent = task.target.closest<HTMLElement>('[data-swarm="card"], [data-swarm="button"], [data-swarm="container"], [data-swarm="image"]')
      if (parent && parent !== task.target) {
        const prerequisite = this.tasks.find((candidate) => candidate.target === parent)
        if (prerequisite && prerequisite.status !== 'complete') return false
      }
      return true
    })
    const available = queued.filter((task) => {
      const rect = task.target.getBoundingClientRect()
      return rect.bottom > -viewportHeight * .35 && rect.top < viewportHeight * 1.35
    })
    const atBottom = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2
    return (available.length || !atBottom ? available : queued).sort((a, b) => {
      const aCenter = this.elementCenter(a.target)
      const bCenter = this.elementCenter(b.target)
      return Math.hypot(aCenter.x - agent.position.x, aCenter.y - agent.position.y) - Math.hypot(bCenter.x - agent.position.x, bCenter.y - agent.position.y)
    })[0]
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
    agent.task.status = 'working'
    agent.cursor.dataset.state = agent.task.operation === 'type' ? 'typing' : 'working'
    agent.cursor.dataset.tool = agent.task.tool.toLowerCase()
    agent.cursor.dataset.active = 'true'
    const point = this.elementCenter(agent.task.target)
    this.startTravel(agent, point, 'moving')
    this.publishActivity(agent.task.operation === 'type' ? 'TYPING' : 'WORKING')
  }

  private startTravel(agent: AgentRuntime, point: SwarmPoint, phase: 'to-tool' | 'moving') {
    const index = this.agents.indexOf(agent)
    const distance = Math.hypot(point.x - agent.position.x, point.y - agent.position.y)
    agent.phase = phase
    agent.phaseStart = performance.now()
    const movementMultiplier = swarmSettings.speed.cursorMovement
    agent.phaseDuration = Math.max(
      swarmSettings.timing.minimumTravelDuration / movementMultiplier,
      distance / (speedProfiles[index] * swarmSettings.timing.travelSpeedScale * movementMultiplier),
    )
    this.setPath(agent, agent.position, point, index)
  }

  private startOperation(agent: AgentRuntime, now: number) {
    const task = agent.task
    if (!task || !task.target.isConnected) {
      this.finishTask(agent)
      return
    }
    agent.phase = 'working'
    agent.phaseStart = now
    const distance = Math.hypot(task.target.getBoundingClientRect().width, task.target.getBoundingClientRect().height)
    const baseDuration = task.duration + (task.operation === 'type' ? 0 : Math.min(2400, distance * .8))
    const operationMultiplier = task.operation === 'type'
      ? swarmSettings.speed.typingInterval
      : task.operation === 'colour' || task.operation === 'align'
        ? swarmSettings.speed.stylingDuration
        : swarmSettings.speed.drawingDuration
    agent.phaseDuration = baseDuration * operationMultiplier
    agent.cursor.dataset.state = task.operation === 'type' ? 'typing'
      : task.operation === 'colour' ? 'styling'
        : task.operation === 'align' ? 'aligning'
          : 'drawing'
    agent.cursor.dataset.active = 'true'
    task.status = 'working'

    if (task.operation === 'type' && task.target instanceof HTMLElement) this.createTextProxy(agent, task.target)
    else if (task.operation === 'icon' && task.target instanceof SVGSVGElement) this.createIconProxy(agent, task.target)
    else {
      task.target.removeAttribute('data-swarm-building')
      task.target.style.clipPath = 'inset(0 100% 0 0)'
      if (task.operation === 'align') this.createGuides(agent, task.target)
      if (task.operation === 'colour') this.createColourPass(agent)
      if ((task.kind === 'card' || task.kind === 'button') && task.target instanceof HTMLElement) {
        this.createDuplicateProxy(agent, task.target)
      }
    }
    this.publishActivity(agent.cursor.dataset.state.toUpperCase())
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

  private createGuides(agent: AgentRuntime, target: SwarmElement) {
    const guide = document.createElement('div')
    guide.className = 'swarm-alignment-guides'
    guide.style.setProperty('--guide-colour', agent.identity.colour)
    const bounds = target.getBoundingClientRect()
    guide.style.left = `${bounds.left}px`
    guide.style.top = `${bounds.top}px`
    guide.style.width = `${bounds.width}px`
    guide.style.height = `${bounds.height}px`
    this.overlay.append(guide)
    agent.guide = guide
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

  private updateOperation(agent: AgentRuntime, now: number) {
    const task = agent.task
    if (!task || !task.target.isConnected) {
      this.finishTask(agent)
      return
    }
    const elapsed = now - agent.phaseStart
    const progress = Math.min(1, elapsed / agent.phaseDuration)
    const eased = 1 - (1 - progress) ** 3
    const rect = task.target.getBoundingClientRect()

    if (agent.proxy) {
      agent.proxy.style.left = `${rect.left}px`
      agent.proxy.style.top = `${rect.top}px`
      agent.proxy.style.width = `${rect.width}px`
      if (task.operation === 'type') {
        const characterDelay = swarmSettings.timing.textCharacterDelay * swarmSettings.speed.typingInterval
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
        agent.paths.forEach((path, index) => {
          const localProgress = Math.min(1, Math.max(0, pathProgress - index))
          path.style.strokeDashoffset = `${agent.pathLengths[index] * (1 - localProgress)}`
        })
        this.setAgentPosition(agent, {
          x: rect.left + rect.width * progress,
          y: rect.top + rect.height * (.5 + Math.sin(now / 170 + this.agents.indexOf(agent)) * .2),
        })
      }
    } else {
      const reveal = task.operation === 'image'
        ? `inset(0 0 ${(1 - eased) * 100}% 0)`
        : `inset(0 ${(1 - eased) * 100}% 0 0)`
      task.target.style.clipPath = reveal
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
      }
      if (agent.duplicate && agent.duplicateOrigin) {
        agent.duplicate.style.left = `${agent.duplicateOrigin.x + (rect.left - agent.duplicateOrigin.x) * eased}px`
        agent.duplicate.style.top = `${agent.duplicateOrigin.y + (rect.top - agent.duplicateOrigin.y) * eased}px`
        agent.duplicate.style.width = `${agent.duplicateOrigin.width + (rect.width - agent.duplicateOrigin.width) * eased}px`
        agent.duplicate.style.height = `${agent.duplicateOrigin.height + (rect.height - agent.duplicateOrigin.height) * eased}px`
      }
      const edgeX = rect.left + rect.width * eased
      this.setAgentPosition(agent, { x: edgeX, y: rect.top + rect.height * progress })
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
    agent.cursor.removeAttribute('data-active')
    if (this.finished) {
      agent.phase = 'waiting'
      agent.cursor.dataset.state = 'complete'
    } else {
      agent.phase = 'waiting'
      agent.cursor.dataset.state = 'waiting'
      this.dispatchTasks()
    }
    this.publishActivity(this.finished ? 'COMPLETE' : 'COLLABORATING')
  }

  private completeTarget(target: SwarmElement) {
    target.removeAttribute('data-swarm-building')
    target.removeAttribute('data-swarm-build-progress')
    target.setAttribute('data-swarm-built', 'true')
    const original = this.targetStates.get(target)
    if (original) target.style.clipPath = original.clipPath
  }

  private clearAgentOperation(agent: AgentRuntime) {
    agent.proxy?.remove()
    agent.proxy = null
    agent.caret?.remove()
    agent.caret = null
    agent.duplicate?.remove()
    agent.duplicate = null
    agent.duplicateOrigin = null
    agent.characters = []
    agent.revealedCharacters = 0
    agent.paths = []
    agent.pathLengths = []
    agent.guide?.remove()
    agent.guide = null
    agent.frame.style.visibility = 'hidden'
    agent.frame.style.removeProperty('--frame-colour')
  }

  private returnToGateway(agent: AgentRuntime) {
    if (agent.phase === 'hidden' || agent.phase === 'returning' || agent.phase === 'to-tool' || agent.phase === 'moving' || agent.phase === 'working') return
    const gateway = this.elementCenter(this.moveTool)
    agent.phase = 'returning'
    agent.cursor.dataset.state = 'returning'
    agent.cursor.removeAttribute('data-tool')
    agent.cursor.removeAttribute('data-active')
    const index = this.agents.indexOf(agent)
    const stagger = (index % 5) * swarmSettings.timing.returnStagger * swarmSettings.speed.idleDelay
    this.startTravel(agent, {
      x: gateway.x + Math.cos(index * 2.4) * 6,
      y: gateway.y + Math.sin(index * 2.4) * 6,
    }, 'moving')
    agent.phase = 'returning'
    agent.phaseStart += stagger
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
      if (agent.phase === 'entering') {
        if (now < agent.phaseStart) return
        const progress = this.updatePosition(agent, now)
        if (progress >= 1) {
          this.arriveAtGateway(agent)
          if (this.agents.every((item) => item.phase !== 'entering')) {
            this.entered = true
            this.startAutoScroll()
            this.dispatchTasks()
          }
        }
        return
      }
      if (agent.phase === 'to-tool' || agent.phase === 'moving' || agent.phase === 'returning') {
        if (now < agent.phaseStart) return
        const progress = this.updatePosition(agent, now)
        if (progress >= 1) {
          if (agent.phase === 'to-tool') {
            agent.phase = 'pickup'
            agent.phaseStart = now
            agent.phaseDuration = (swarmSettings.timing.toolPickupDuration + (index % 4) * swarmSettings.timing.toolPickupStagger)
              * swarmSettings.speed.toolCollectionDuration
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
    const power = accelerationProfiles[this.agents.indexOf(agent)] * swarmSettings.speed.acceleration
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
      if (this.tasks.length > 0 && this.tasks.every((task) => task.status === 'complete')) {
        this.finished = true
        this.publishActivity('COMPLETE')
      }
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
    if (this.entered) this.dispatchTasks()
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

  private cursorState(agent: AgentRuntime) {
    const active = !['hidden', 'waiting'].includes(agent.phase)
    const task = agent.task
    const state = agent.phase === 'hidden' ? (this.finished ? 'complete' : 'waiting')
      : agent.phase === 'entering' ? 'entering'
        : agent.phase === 'to-tool' || agent.phase === 'pickup' ? 'collecting tool'
          : agent.phase === 'returning' ? 'returning'
            : agent.phase === 'waiting' ? (this.finished ? 'complete' : 'waiting')
              : task?.operation === 'type' ? 'typing'
                : task?.operation === 'colour' ? 'styling'
                  : task?.operation === 'align' ? 'aligning'
                    : task?.operation === 'icon' || task?.operation === 'draw' || task?.operation === 'image' ? 'drawing'
                      : 'working'
    return {
      ...agent.identity,
      tool: active ? agent.tool ?? (agent.phase === 'to-tool' || agent.phase === 'pickup' ? agent.task?.tool ?? null : null) : null,
      operation: task?.description ?? 'Waiting for task',
      active,
      state,
    }
  }

  private activityState() {
    if (this.scrollPaused) return 'PAUSED BY VISITOR'
    if (this.autoScrolling) return 'AUTO SCROLLING'
    if (this.agents.some((agent) => agent.phase === 'entering')) return 'ENTERING'
    if (this.agents.some((agent) => agent.phase === 'to-tool' || agent.phase === 'pickup')) return 'COLLECTING TOOL'
    if (this.agents.some((agent) => agent.phase === 'working')) {
      const operations = this.agents.filter((agent) => agent.phase === 'working').map((agent) => agent.task?.operation)
      return operations.includes('type') ? 'TYPING'
        : operations.includes('colour') ? 'STYLING'
          : operations.includes('align') ? 'ALIGNING'
            : 'DRAWING'
    }
    if (this.agents.some((agent) => agent.phase === 'returning')) return 'RETURNING'
    return this.finished ? 'COMPLETE' : 'WAITING'
  }

  private publishActivity(state: string) {
    const cursors = this.agents.map((agent) => this.cursorState(agent))
    const active = cursors.filter((cursor) => cursor.active)
    const completedTasks = this.tasks.filter((task) => task.status === 'complete').length
    const totalTasks = this.tasks.length
    const activeProgress = this.agents.reduce((sum, agent) => {
      if (agent.phase !== 'working') return sum
      return sum + Math.min(1, (performance.now() - agent.phaseStart) / agent.phaseDuration)
    }, 0)
    const progress = totalTasks === 0 ? (this.finished ? 100 : 0)
      : Math.min(100, Math.floor((completedTasks + activeProgress) / totalTasks * 100))
    const operation = active.map((cursor) => cursor.operation).filter((value, index, list) => list.indexOf(value) === index).slice(0, 2).join(' · ') || (this.finished ? 'Construction complete' : state)
    const signature = `${state}:${this.activeSection}:${Math.floor(progress / 2)}:${active.length}:${operation}:${totalTasks}`
    const now = performance.now()
    if (signature === this.activitySignature || now - this.lastPublish < 90) return
    this.activitySignature = signature
    this.lastPublish = now
    this.onActivity({
      cursors,
      operation,
      runningTasks: active.length,
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
