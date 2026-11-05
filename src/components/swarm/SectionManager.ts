import type { SectionPhase, SectionVisualBlueprint, SwarmSectionInfo } from './swarmTypes'
import { restoreTypingText } from './DOMSnapshotEngine'

export interface ManagedSection {
  id: string
  label: string
  element: HTMLElement
  phase: SectionPhase
  blueprint?: SectionVisualBlueprint
  totalOperations: number
  completedOperations: number
  verifiedAt?: number
}

export type SectionStateListener = (section: ManagedSection, phase: SectionPhase) => void

const canonicalLabels: Record<string, string> = {
  hero: 'HERO SECTION',
  overview: 'OVERVIEW SECTION',
  about: 'ABOUT SECTION',
  skills: 'SKILLS SECTION',
  projects: 'PROJECTS SECTION',
  experience: 'EXPERIENCE SECTION',
  contact: 'CONTACT SECTION',
}

export class SectionManager {
  private sections: ManagedSection[] = []
  private currentIndex = 0
  private readonly listeners = new Set<SectionStateListener>()
  private completedSectionIds = new Set<string>()

  constructor(private readonly onSectionChange?: (sectionId: string) => void) {}

  subscribe(listener: SectionStateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(section: ManagedSection, phase: SectionPhase) {
    this.listeners.forEach((listener) => {
      try {
        listener(section, phase)
      } catch (err) {
        console.error('Error in section state listener:', err)
      }
    })
  }

  discoverSections(): ManagedSection[] {
    const sectionEls = Array.from(document.querySelectorAll<HTMLElement>('main [data-swarm-section][id]'))
    if (!sectionEls.length) {
      const main = document.querySelector('main') as HTMLElement | null
      if (main) sectionEls.push(main)
    }

    this.sections = sectionEls.map((element, index) => {
      const id = element.dataset.swarmSection || element.id || `section-${index}`
      const label = canonicalLabels[id] || `${id.toUpperCase()} SECTION`
      return {
        id,
        label,
        element,
        phase: 'PENDING',
        totalOperations: 0,
        completedOperations: 0,
      }
    })

    this.currentIndex = 0
    if (this.sections[0]) {
      this.sections[0].phase = 'ACTIVE'
      this.onSectionChange?.(this.sections[0].id)
      this.notify(this.sections[0], 'ACTIVE')
    }

    return this.sections
  }

  getSections(): ManagedSection[] {
    return this.sections
  }

  getActiveSection(): ManagedSection | null {
    return this.sections[this.currentIndex] ?? null
  }

  getActiveIndex(): number {
    return this.currentIndex
  }

  getCompletedSectionIds(): Set<string> {
    return this.completedSectionIds
  }

  isSectionCompleted(sectionId: string): boolean {
    return this.completedSectionIds.has(sectionId)
  }

  isAllCompleted(): boolean {
    return this.sections.length > 0 && this.sections.every((s) => s.phase === 'COMPLETED')
  }

  transitionToConstructing(sectionId: string, blueprint?: SectionVisualBlueprint): boolean {
    const active = this.getActiveSection()
    if (!active || active.id !== sectionId) return false
    if (active.phase === 'COMPLETED' || active.phase === 'CONSTRUCTING') return false

    active.phase = 'CONSTRUCTING'
    if (blueprint) {
      active.blueprint = blueprint
      active.totalOperations = blueprint.layers.length
    }
    this.onSectionChange?.(active.id)
    this.notify(active, 'CONSTRUCTING')
    return true
  }

  transitionToVerifying(sectionId: string): boolean {
    const active = this.getActiveSection()
    if (!active || active.id !== sectionId) return false
    if (active.phase !== 'CONSTRUCTING') return false

    active.phase = 'VERIFYING'
    this.notify(active, 'VERIFYING')
    return true
  }

  verifyAndComplete(sectionId: string): boolean {
    const active = this.getActiveSection()
    if (!active || active.id !== sectionId) return false
    if (active.phase !== 'CONSTRUCTING' && active.phase !== 'VERIFYING') return false

    // Perform DOM integrity verification
    this.verifySectionDOM(active)

    active.phase = 'COMPLETED'
    active.verifiedAt = performance.now()
    this.completedSectionIds.add(active.id)
    this.notify(active, 'COMPLETED')
    return true
  }

  private verifySectionDOM(section: ManagedSection) {
    const container = section.element
    // Remove all construction tags and restore full visibility
    container.querySelectorAll<HTMLElement>('[data-swarm-building]').forEach((el) => {
      el.removeAttribute('data-swarm-building')
      el.removeAttribute('data-swarm-build-progress')
      el.setAttribute('data-swarm-built', 'true')
      el.style.visibility = 'visible'
      el.style.opacity = '1'
      el.style.clipPath = 'none'
    })

    // Ensure all typing-text spans have full resting text rendered
    container.querySelectorAll<HTMLElement>('.typing-text').forEach((span) => {
      restoreTypingText(span)
    })
  }

  advanceToNext(): ManagedSection | null {
    const current = this.getActiveSection()
    if (current && current.phase !== 'COMPLETED') {
      // Must not advance if current section is not completed
      return null
    }

    if (this.currentIndex >= this.sections.length - 1) {
      return null // No more sections
    }

    this.currentIndex++
    const next = this.sections[this.currentIndex]
    if (next) {
      next.phase = 'ACTIVE'
      this.onSectionChange?.(next.id)
      this.notify(next, 'ACTIVE')
    }
    return next
  }

  handleUserSectionJump(sectionId: string): ManagedSection | null {
    const targetIndex = this.sections.findIndex((s) => s.id === sectionId)
    if (targetIndex === -1) return null

    const targetSection = this.sections[targetIndex]
    if (this.currentIndex === targetIndex) return targetSection

    // If jumping to an already completed section, let it stay completed
    this.currentIndex = targetIndex
    if (targetSection.phase === 'PENDING') {
      targetSection.phase = 'ACTIVE'
    }
    this.onSectionChange?.(targetSection.id)
    this.notify(targetSection, targetSection.phase)
    return targetSection
  }

  toSwarmSectionInfo(section: ManagedSection): SwarmSectionInfo {
    return {
      id: section.id,
      label: section.label,
      phase: section.phase,
      element: section.element,
      blueprint: section.blueprint,
    }
  }

  reset() {
    this.sections = []
    this.currentIndex = 0
    this.completedSectionIds.clear()
    this.listeners.clear()
  }
}
