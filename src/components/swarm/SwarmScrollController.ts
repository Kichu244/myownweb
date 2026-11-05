import { swarmSettings } from './swarmSettings'

export type ScrollPauseReason = 'construction' | 'user' | 'manual' | 'automatic' | 'complete'

export interface ScrollControllerCallbacks {
  onScrollPaused: (reason: ScrollPauseReason) => void
  onScrollResumed: () => void
  onUserSectionJump?: (sectionId: string) => void
  onScrollPositionChange?: (scrollY: number) => void
}

export class SwarmScrollController {
  private autoScrolling = false
  private scrollPaused = false
  private scrollManuallyPaused = false
  private scrollComplete = false
  private resumeTimer: number | null = null
  private lastScrollY = window.scrollY
  private cachedTargetElement: HTMLElement | null = null
  private cachedTargetTop: number | null = null
  private pauseReason: ScrollPauseReason = 'construction'

  constructor(
    private readonly callbacks: ScrollControllerCallbacks,
    private readonly reducedMotion: boolean = false,
  ) {}

  start() {
    if (this.reducedMotion) {
      this.scrollComplete = true
      return
    }

    this.lastScrollY = window.scrollY
    window.addEventListener('scroll', this.handleScroll, { passive: true })
    window.addEventListener('wheel', this.handleUserInterrupt, { passive: true })
    window.addEventListener('touchmove', this.handleUserInterrupt, { passive: true })
    window.addEventListener('pointerdown', this.handlePointerInterrupt, { passive: true })
    window.addEventListener('keydown', this.handleKeyInterrupt)
  }

  stop() {
    if (this.resumeTimer !== null) {
      window.clearTimeout(this.resumeTimer)
      this.resumeTimer = null
    }

    window.removeEventListener('scroll', this.handleScroll)
    window.removeEventListener('wheel', this.handleUserInterrupt)
    window.removeEventListener('touchmove', this.handleUserInterrupt)
    window.removeEventListener('pointerdown', this.handlePointerInterrupt)
    window.removeEventListener('keydown', this.handleKeyInterrupt)

    this.stopAutoScrollClass()
    this.autoScrolling = false
    this.scrollPaused = false
    this.scrollManuallyPaused = false
    this.cachedTargetElement = null
    this.cachedTargetTop = null
  }

  isScrolling(): boolean {
    return this.autoScrolling && !this.scrollPaused
  }

  isPaused(): boolean {
    return this.scrollPaused
  }

  getPauseReason(): ScrollPauseReason {
    return this.pauseReason
  }

  isCompleted(): boolean {
    return this.scrollComplete
  }

  markCompleted() {
    this.scrollComplete = true
    this.stopAutoScrollClass()
    this.pauseReason = 'complete'
  }

  pauseForConstruction() {
    if (this.resumeTimer !== null) {
      window.clearTimeout(this.resumeTimer)
      this.resumeTimer = null
    }
    this.stopAutoScrollClass()
    this.autoScrolling = false
    this.scrollPaused = true
    this.pauseReason = 'construction'
    this.cachedTargetElement = null
    this.cachedTargetTop = null
    this.callbacks.onScrollPaused('construction')
  }

  resumeAfterConstruction() {
    if (this.reducedMotion || this.scrollComplete || this.scrollManuallyPaused) return
    this.scrollPaused = false
    this.startAutoScroll()
  }

  startAutoScroll() {
    if (this.reducedMotion || this.scrollComplete || this.scrollPaused) return
    this.autoScrolling = true
    this.pauseReason = 'automatic'
    this.cachedTargetElement = null
    this.cachedTargetTop = null
    document.documentElement.classList.add('swarm-auto-scrolling')
    this.callbacks.onScrollResumed()
  }

  private stopAutoScrollClass() {
    document.documentElement.classList.remove('swarm-auto-scrolling')
  }

  toggleAutoScroll() {
    if (this.scrollComplete || this.pauseReason === 'construction') return
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

  pauseForUser(explicit = false) {
    if (this.pauseReason === 'construction') return
    if (this.scrollManuallyPaused && !explicit) return
    if (!this.autoScrolling && !this.scrollPaused && !explicit) return

    if (this.resumeTimer !== null) {
      window.clearTimeout(this.resumeTimer)
      this.resumeTimer = null
    }

    this.stopAutoScrollClass()
    this.autoScrolling = false
    this.scrollPaused = true
    this.scrollManuallyPaused = explicit
    this.pauseReason = explicit ? 'manual' : 'user'
    this.cachedTargetElement = null
    this.cachedTargetTop = null
    this.callbacks.onScrollPaused(this.pauseReason)

    if (explicit) return

    // Auto-resume after user idle delay
    this.resumeTimer = window.setTimeout(() => {
      this.resumeTimer = null
      if (this.reducedMotion || this.scrollComplete || this.scrollManuallyPaused) return
      this.scrollPaused = false
      this.pauseReason = 'automatic'
      this.callbacks.onScrollResumed()
    }, swarmSettings.timing.resumeDelay)
  }

  advance(
    deltaMs: number,
    nextTargetElement: HTMLElement | null,
    onTargetInFocalZone: () => void,
  ) {
    if (!this.autoScrolling || this.scrollPaused || this.scrollComplete || this.reducedMotion) {
      return
    }

    // Check if the next target section is approaching the focal reading zone
    if (nextTargetElement) {
      if (this.cachedTargetElement !== nextTargetElement || this.cachedTargetTop === null) {
        this.cachedTargetElement = nextTargetElement
        this.cachedTargetTop = nextTargetElement.getBoundingClientRect().top
      }
      // Section is considered in the focal zone when its top is within 25% of viewport height or <= 100px
      if (this.cachedTargetTop <= window.innerHeight * 0.25 || this.cachedTargetTop <= 100) {
        this.stopAutoScrollClass()
        this.autoScrolling = false
        this.pauseForConstruction()
        onTargetInFocalZone()
        return
      }
    } else {
      this.cachedTargetElement = null
      this.cachedTargetTop = null
    }

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    // Speed is strictly 150 px/s
    const scrollAmount = (swarmSettings.timing.scrollSpeed * deltaMs) / 1000
    const nextY = Math.min(maxScroll, window.scrollY + scrollAmount)

    const previousY = window.scrollY
    window.scrollTo({ top: nextY, behavior: 'instant' })
    if (this.cachedTargetTop !== null) this.cachedTargetTop -= nextY - previousY
    this.lastScrollY = nextY
    this.callbacks.onScrollPositionChange?.(nextY)

    if (nextY >= maxScroll - 1) {
      this.stopAutoScrollClass()
      this.autoScrolling = false
      if (nextTargetElement) {
        this.pauseForConstruction()
        onTargetInFocalZone()
      } else {
        this.markCompleted()
      }
    }
  }

  private handleUserInterrupt = () => this.pauseForUser()

  private handlePointerInterrupt = (event: PointerEvent) => {
    const target = event.target
    if (target instanceof Element && target.closest('.swarm-studio, .swarm-loader, .swarm-topbar, .swarm-toolbar')) {
      return
    }
    this.pauseForUser()
  }

  private handleKeyInterrupt = (event: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      this.pauseForUser()
    }
  }

  private handleScroll = () => {
    const currentY = window.scrollY
    if (this.autoScrolling && Math.abs(currentY - this.lastScrollY) > 4) {
      this.pauseForUser()
    }
    this.lastScrollY = currentY
    this.callbacks.onScrollPositionChange?.(currentY)
  }
}
