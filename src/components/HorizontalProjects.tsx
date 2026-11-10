// ============================================================
// HorizontalProjects.tsx — Cinematic Horizontal-Scrolling Project Showcase
//
// Awwwards-inspired horizontal project showcase with:
// - Pinned sticky track on desktop translated via natural scroll
// - Native touch scroll-snap on mobile/tablet
// - Interactive SVG architectural diagrams in preview
// - Live Project Counter, Progress Indicator, and Nav Arrows
// - Accessible keyboard, mouse-wheel, and touch controls
//
// Styles: styles.css → [PROJECTS-CINEMATIC]
// ============================================================

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Cpu,
  Code2
} from 'lucide-react'
import { projects, type Project } from '../data'
import ProjectVisualization from './ProjectVisualization'

interface HorizontalProjectsProps {
  onSelect: (project: Project) => void
  reduceMotion?: boolean | null
}

function GithubIcon({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export default function HorizontalProjects({ onSelect, reduceMotion = false }: HorizontalProjectsProps) {
  const [filter, setFilter] = useState('All')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)

  const sectionRef = useRef<HTMLElement>(null)
  const trackContainerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const rafIdRef = useRef<number | null>(null)

  // Categories list derived from existing projects
  const categories = useMemo(() => ['All', ...new Set(projects.map((p) => p.category))], [])

  // Filtered projects
  const visibleProjects = useMemo(
    () => projects.filter((project) => filter === 'All' || project.category === filter),
    [filter]
  )

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 900)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile, { passive: true })
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Desktop Scroll Height & Horizontal Translation Setup
  const updateDesktopScroll = useCallback(() => {
    if (isMobile || !sectionRef.current || !trackRef.current) return

    const track = trackRef.current
    const section = sectionRef.current
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    // Calculate maximum horizontal translation distance
    const trackWidth = track.scrollWidth
    const padding = 120
    const maxTranslateX = Math.max(0, trackWidth - windowWidth + padding)

    // Set the section height so that natural vertical scrolling covers the horizontal distance
    const totalSectionHeight = windowHeight + maxTranslateX
    section.style.height = `${totalSectionHeight}px`

    // Determine current scroll progress through this section
    const rect = section.getBoundingClientRect()
    const scrolledPx = -rect.top
    const rawProgress = maxTranslateX > 0 ? scrolledPx / maxTranslateX : 0
    const clampedProgress = Math.min(1, Math.max(0, rawProgress))

    const currentX = clampedProgress * maxTranslateX
    track.style.transform = `translate3d(-${currentX}px, 0, 0)`

    setScrollProgress(clampedProgress)
    if (clampedProgress > 0.05) setHasScrolled(true)

    // Calculate active project index based on scroll position
    const cardElements = Array.from(track.querySelectorAll<HTMLElement>('.cinematic-card'))
    if (cardElements.length > 0) {
      let activeIdx = 0
      let minDistance = Infinity
      const viewportCenter = windowWidth / 2

      cardElements.forEach((el, index) => {
        const cardRect = el.getBoundingClientRect()
        const cardCenter = cardRect.left + cardRect.width / 2
        const distance = Math.abs(cardCenter - viewportCenter)
        if (distance < minDistance) {
          minDistance = distance
          activeIdx = index
        }
      })
      setCurrentIndex(activeIdx)
    }
  }, [isMobile])

  // Window scroll event listener for desktop
  useEffect(() => {
    if (isMobile) return

    const handleScroll = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      rafIdRef.current = requestAnimationFrame(updateDesktopScroll)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    // Initial calculation
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [isMobile, updateDesktopScroll, visibleProjects])

  // Mobile scroll tracking (using native touch container onScroll)
  const handleMobileScroll = useCallback(() => {
    const container = trackContainerRef.current
    if (!container || !isMobile) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    const maxScroll = scrollWidth - clientWidth
    const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0
    setScrollProgress(progress)
    if (progress > 0.05) setHasScrolled(true)

    // Determine current card based on scrollLeft
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.cinematic-card'))
    if (cards.length > 0) {
      let activeIdx = 0
      let minDistance = Infinity
      const center = scrollLeft + clientWidth / 2

      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2
        const distance = Math.abs(cardCenter - center)
        if (distance < minDistance) {
          minDistance = distance
          activeIdx = index
        }
      })
      setCurrentIndex(activeIdx)
    }
  }, [isMobile])

  // Navigate to a specific project index
  const scrollToIndex = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(visibleProjects.length - 1, index))
    const behavior = reduceMotion ? 'auto' : 'smooth'

    if (isMobile) {
      const container = trackContainerRef.current
      const track = trackRef.current
      if (!container || !track) return
      const cards = track.querySelectorAll<HTMLElement>('.cinematic-card')
      const targetCard = cards[clampedIndex]
      if (targetCard) {
        targetCard.scrollIntoView({ behavior, inline: 'center', block: 'nearest' })
      }
    } else {
      const section = sectionRef.current
      const track = trackRef.current
      if (!section || !track) return

      const windowWidth = window.innerWidth
      const trackWidth = track.scrollWidth
      const padding = 120
      const maxTranslateX = Math.max(0, trackWidth - windowWidth + padding)

      if (maxTranslateX <= 0) return

      const fraction = visibleProjects.length > 1 ? clampedIndex / (visibleProjects.length - 1) : 0
      const targetScrollOffset = fraction * maxTranslateX
      const sectionTop = window.scrollY + section.getBoundingClientRect().top
      const targetWindowY = sectionTop + targetScrollOffset

      window.scrollTo({ top: targetWindowY, behavior })
    }
  }, [isMobile, reduceMotion, visibleProjects.length])

  // Navigation button handlers
  const handlePrev = () => scrollToIndex(currentIndex - 1)
  const handleNext = () => scrollToIndex(currentIndex + 1)

  return (
    // [PROJECT-01] Projects Section Wrapper — Full screen cinematic section
    // Desktop: Pinned sticky track controlled by page scroll
    // Mobile: Native touch scroll-snap container
    <section
      className="projects-cinematic-section"
      id="projects"
      ref={sectionRef}
      data-swarm-section="projects"
      aria-label="Cinematic project showcase"
    >
      <div className="projects-sticky-viewport">
        {/* ============================================================
            PROJECT SECTION HEADER & NAVIGATION CONTROLS
            ============================================================ */}
        <div className="projects-cinematic-header container">
          {/* [PROJECT-02] Section Title & Tagline */}
          <div className="projects-header-info">
            <span className="projects-cinematic-eyebrow" data-swarm="style">
              <Sparkles size={13} className="eyebrow-sparkle" aria-hidden="true" />
              PORTFOLIO / SHOWCASE
            </span>
            <h2 className="projects-cinematic-heading" data-swarm="heading">
              Built to Solve. <span>Made to Learn.</span>
            </h2>
            <p className="projects-cinematic-subtext" data-swarm="text">
              Horizontal engineering showcase. Explore architecture, system workflows, and connected concepts.
            </p>
          </div>

          {/* [PROJECT-04] Category Filter Pills */}
          <div
            className="projects-cinematic-filters"
            role="tablist"
            aria-label="Filter projects by category"
            data-swarm="style"
          >
            {categories.map((cat) => {
              const count = cat === 'All' ? projects.length : projects.filter((p) => p.category === cat).length
              const isActive = filter === cat
              return (
                <button
                  key={cat}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  className={`cinematic-filter-pill${isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    setFilter(cat)
                    setCurrentIndex(0)
                    scrollToIndex(0)
                  }}
                >
                  <span>{cat}</span>
                  <span className="pill-count">{count}</span>
                </button>
              )
            })}
          </div>

          {/* [PROJECT-06] Header Controls: Counter, Arrows, and Scroll Cue */}
          <div className="projects-header-controls">
            {/* Project Counter: e.g. 01 / 04 */}
            <div className="projects-cinematic-counter" aria-live="polite" aria-atomic="true">
              <span className="counter-current">{String(currentIndex + 1).padStart(2, '0')}</span>
              <span className="counter-divider">/</span>
              <span className="counter-total">{String(visibleProjects.length).padStart(2, '0')}</span>
            </div>

            {/* Navigation Arrows */}
            <div className="projects-cinematic-arrows" role="group" aria-label="Project slide navigation">
              <button
                type="button"
                className="cinematic-nav-btn"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                aria-label="Previous project"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="cinematic-nav-btn"
                onClick={handleNext}
                disabled={currentIndex >= visibleProjects.length - 1}
                aria-label="Next project"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Subtle Scroll Instruction Cue */}
            <div
              className={`projects-scroll-instruction${hasScrolled ? ' is-dimmed' : ''}`}
              aria-hidden="true"
            >
              <span>SCROLL TO EXPLORE</span>
              <ArrowRight size={14} className="instruction-arrow" />
            </div>
          </div>
        </div>

        {/* ============================================================
            [PROJECT-PROGRESS] HORIZONTAL PROGRESS INDICATOR
            Sapphire Blue active bar reflecting horizontal scroll progress
            ============================================================ */}
        <div className="projects-cinematic-progress-bar" role="progressbar" aria-valuenow={Math.round(scrollProgress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Project showcase progress">
          <div
            className="cinematic-progress-fill"
            style={{ width: `${Math.max(5, scrollProgress * 100)}%` }}
          />
        </div>

        {/* ============================================================
            [PROJECT-TRACK] HORIZONTAL SCROLL TRACK CONTAINER
            ============================================================ */}
        <div
          className="projects-track-viewport"
          ref={trackContainerRef}
          onScroll={handleMobileScroll}
        >
          <div className="projects-horizontal-track" ref={trackRef}>
            {visibleProjects.map((project, idx) => {
              const isCurrent = idx === currentIndex

              return (
                // [PROJECT-CARD] Large Project Card
                <article
                  key={project.id}
                  id={`project-card-${project.id}`}
                  className={`cinematic-card glass-deep project-theme-${project.number}${isCurrent ? ' is-active' : ''}`}
                  data-swarm="card"
                >
                  {/* Card Header Bar: Project Number & Category Badge */}
                  <div className="cinematic-card-topbar">
                    <div className="cinematic-card-id">
                      <span className="card-mono-prefix">// PROJECT</span>
                      <strong className="card-number">{project.number}</strong>
                    </div>

                    <div className="cinematic-card-badges">
                      <span className="cinematic-category-badge">{project.category}</span>
                      <span className="cinematic-status-pill">
                        <span className="status-live-dot" aria-hidden="true" />
                        {project.status.split('·')[0].trim()}
                      </span>
                    </div>
                  </div>

                  {/* [PROJECT-PREVIEW] Project Visual Showcase */}
                  <div
                    className="cinematic-preview-frame"
                    onClick={() => onSelect(project)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open detailed architecture view for ${project.title}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(project)
                      }
                    }}
                  >
                    <div className="preview-ambient-glow" aria-hidden="true" />
                    
                    {/* Architectural SVG Diagram */}
                    <div className="preview-diagram-wrap">
                      <ProjectVisualization
                        variant={project.visualization}
                        interactive={false}
                        className="cinematic-diagram-svg"
                      />
                    </div>

                    {/* Hover Inspect Overlay */}
                    <div className="preview-hover-overlay" aria-hidden="true">
                      <span className="preview-inspect-pill">
                        <Layers size={14} />
                        <span>Inspect Architecture</span>
                        <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </div>

                  {/* [PROJECT-INFO] Project Details & Typography */}
                  <div className="cinematic-card-content">
                    <h3 className="cinematic-project-title" data-swarm="heading">
                      {project.title}
                    </h3>

                    <p className="cinematic-project-desc" data-swarm="text">
                      {project.description}
                    </p>

                    {/* [PROJECT-STACK] Technology Badges */}
                    <div className="cinematic-tech-stack" aria-label="Technology stack">
                      {project.stack.map((tech) => (
                        <span key={tech} className="cinematic-tech-tag">
                          {tech}
                        </span>
                      ))}
                    </div>

                    {/* [PROJECT-ACTIONS] Action Buttons Row */}
                    <div className="cinematic-action-row" data-swarm="layout">
                      {/* Primary Detail Action */}
                      <button
                        type="button"
                        className="cinematic-btn cinematic-btn-primary"
                        onClick={() => onSelect(project)}
                      >
                        <span>Explore Details</span>
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </button>

                      {/* Live Demo or Interactive View */}
                      {project.liveUrl ? (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cinematic-btn cinematic-btn-secondary"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          <span>Live Demo</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="cinematic-btn cinematic-btn-secondary"
                          onClick={() => onSelect(project)}
                        >
                          <Cpu size={14} aria-hidden="true" />
                          <span>Architecture</span>
                        </button>
                      )}

                      {/* GitHub Button */}
                      {project.githubUrl ? (
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cinematic-btn cinematic-btn-ghost"
                          aria-label={`View ${project.title} source on GitHub`}
                        >
                          <GithubIcon size={15} />
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="cinematic-btn cinematic-btn-ghost"
                          onClick={() => onSelect(project)}
                          aria-label={`View code details for ${project.title}`}
                        >
                          <Code2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        {/* Footer Status Annotation */}
        <div className="projects-cinematic-footer container">
          <p className="status-note" data-swarm="text">
            <span className="status-dot" aria-hidden="true" />
            Project statuses distinguish verified production modules, ongoing trainee implementations, and hardware experiments.
          </p>
        </div>
      </div>
    </section>
  )
}
