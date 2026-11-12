import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { flushSync } from 'react-dom'
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Menu, Moon, Pause, Play, Sun, UserRound, X } from 'lucide-react'
import { profile, projects, skills, type Project } from './data'
import NeuralHero, { TypingText } from './components/NeuralHero'
import ProjectExplorer from './components/ProjectExplorer'
import HorizontalProjects from './components/HorizontalProjects'
import SkillsNetwork from './components/SkillsNetwork'
import AboutIdentity from './components/AboutIdentity'
import ExperienceEducation from './components/ExperienceEducation'
import { ContactFooter, ContactSection } from './components/ContactExperience'
import SwarmController from './components/swarm/SwarmController'
import WebsiteGuide from './components/WebsiteGuide'
import { pageFromPath, sectionFromPath, withBasePath } from './navigation'

const nav = [['About', 'about'], ['Skills', 'skills'], ['Projects', 'projects'], ['Experience', 'experience'], ['Contact', 'contact']]

const smoothStopProgress = (progress: number) => 2 * progress - 5 * progress ** 4 + 6 * progress ** 5 - 2 * progress ** 6

function HomeOverview({ reduceMotion }: { reduceMotion: boolean | null }) {
  const [overviewVisible, setOverviewVisible] = useState(false)
  const overviewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = overviewRef.current
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setOverviewVisible(true)
      observer.disconnect()
    }, { threshold: .3 })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return <section className="home-overview section-pad" id="home-overview" data-swarm-section="overview" aria-label="Portfolio overview">
    <div className="container" data-swarm="container">
      <div className="home-overview-heading" ref={overviewRef}><h2 data-swarm="heading">A little<br /><span>about me.</span></h2><h3 data-swarm="text">Curious by nature, learning through projects</h3><p data-swarm="text"><TypingText text={`I'm ${profile.name}, based in Bengaluru, India. I enjoy exploring how software and connected devices work, and learning by building projects with Python, Odoo, data workflows, and web technologies.`} active={overviewVisible} delay={350} speed={18} reduceMotion={reduceMotion} /></p></div>
      <div className="home-overview-grid">
        <a className="home-overview-card glass-frosted" data-swarm="card" href="#about"><h3>About me</h3><p>{profile.role} · Bengaluru</p><span className="home-overview-link">More about me <ArrowRight size={15} /></span></a>
        <a className="home-overview-card glass-frosted" data-swarm="card" href="#skills"><h3>Skills</h3><p>{skills.slice(0, 3).map((group) => group.name).join(' · ')}</p><span className="home-overview-link">Explore skills <ArrowRight size={15} /></span></a>
        <a className="home-overview-card glass-crystal" data-swarm="card" href="#projects"><h3>Projects</h3><p>ERP, data, web, and IoT experiments.</p><span className="home-overview-link">Browse projects <ArrowRight size={15} /></span></a>
        <a className="home-overview-card glass-frosted" data-swarm="card" href="#experience"><h3>Experience & education</h3><p>AutoChip India · Neopraxis · BCA Cyber Security</p><span className="home-overview-link">View my journey <ArrowRight size={15} /></span></a>
      </div>
    </div>
  </section>
}



function App() {
  const [path, setPath] = useState(() => {
    const currentPath = window.location.pathname
    const section = sectionFromPath(currentPath)
    if (!section) return currentPath
    const homePath = withBasePath('/')
    window.history.replaceState({}, '', `${homePath}${window.location.search}${window.location.hash || `#${section}`}`)
    return homePath
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('portfolio-theme') === 'dark' ? 'dark' : 'light')
  const page = pageFromPath(path)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(() => window.scrollY > 16)
  const [navHidden, setNavHidden] = useState(false)
  const [autoScrollMode, setAutoScrollMode] = useState<'idle' | 'down' | 'paused' | 'down-complete' | 'up'>('idle')
  const [autoScrollCountdown, setAutoScrollCountdown] = useState<number | null>(null)
  const [autoScrollFading, setAutoScrollFading] = useState(false)
  const [autoScrollVisible, setAutoScrollVisible] = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)
  const [swarmCursorEnabled, setSwarmCursorEnabled] = useState(false)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const autoScrollModeRef = useRef(autoScrollMode)
  const autoScrollPausedDirectionRef = useRef<'down' | 'up'>('down')
  const autoScrollRemainingRef = useRef(15_000)
  const autoScrollSpeedRef = useRef(0)
  const autoScrollStartedAtRef = useRef<number | null>(null)
  const autoScrollDurationRef = useRef(0)
  const autoScrollCountdownRef = useRef<number | null>(null)
  const autoScrollCountdownEndRef = useRef<number | null>(null)
  const autoScrollCountdownActionRef = useRef<() => void>(() => {})
  const autoScrollHideTimeoutRef = useRef<number | null>(null)
  const pauseAutoScrollRef = useRef<() => void>(() => {})
  const dialogRef = useRef<HTMLElement>(null)
  const dialogCloseRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()
  const active = page === 'home' ? '' : `/${page}`
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    const transitionDocument = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> }
    }
    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => flushSync(() => setTheme(nextTheme)))
    } else {
      setTheme(nextTheme)
    }
  }

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])
  useEffect(() => {
    localStorage.setItem('portfolio-theme', theme)
  }, [theme])
  useEffect(() => {
    const pausePortfolioAutoScroll = () => {
      if (autoScrollModeRef.current === 'down' || autoScrollModeRef.current === 'up') pauseAutoScrollRef.current()
    }
    window.addEventListener('swarm:activate', pausePortfolioAutoScroll)
    return () => window.removeEventListener('swarm:activate', pausePortfolioAutoScroll)
  }, [])
  useEffect(() => {
    const stopForKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.auto-scroll-toggle')) return
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
        pauseAutoScrollRef.current()
      }
    }
    const stopForScrollbarDrag = (event: PointerEvent) => {
      if (event.clientX >= document.documentElement.clientWidth) pauseAutoScrollRef.current()
    }
    const pause = () => pauseAutoScrollRef.current()
    window.addEventListener('wheel', pause, { passive: true })
    window.addEventListener('touchmove', pause, { passive: true })
    window.addEventListener('pointerdown', stopForScrollbarDrag, { passive: true })
    window.addEventListener('keydown', stopForKey)
    return () => {
      window.removeEventListener('wheel', pause)
      window.removeEventListener('touchmove', pause)
      window.removeEventListener('pointerdown', stopForScrollbarDrag)
      window.removeEventListener('keydown', stopForKey)
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current)
        autoScrollFrameRef.current = null
      }
      if (autoScrollCountdownRef.current !== null) {
        window.clearInterval(autoScrollCountdownRef.current)
      }
      if (autoScrollHideTimeoutRef.current !== null) {
        window.clearTimeout(autoScrollHideTimeoutRef.current)
      }
    }
  }, [])
  useEffect(() => {
    document.title = page === 'home' ? `${profile.name} | Developer Portfolio` : `${page[0]?.toUpperCase()}${page.slice(1)} | ${profile.name}`
    document.body.style.overflow = selected ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected, page])
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const project = projects.find((item) => `#${item.id}` === hash)
    if (project) { setSelected(project); return }
    window.requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant', block: 'start' }))
  }, [])
  useEffect(() => {
    const onPopState = () => {
      const section = sectionFromPath(window.location.pathname)
      if (section) {
        const homePath = withBasePath('/')
        window.history.replaceState({}, '', `${homePath}${window.location.search}${window.location.hash || `#${section}`}`)
        setPath(homePath)
      } else setPath(window.location.pathname)
    }
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname && destination.hash) return
      const destinationSection = sectionFromPath(destination.pathname)
      if (destinationSection) {
        event.preventDefault()
        const homePath = withBasePath('/')
        const hash = destination.hash || `#${destinationSection}`
        window.history.pushState({}, '', `${homePath}${destination.search}${hash}`)
        setPath(homePath)
        setMenuOpen(false)
        setSelected(null)
        window.requestAnimationFrame(() => {
          const project = projects.find((item) => `#${item.id}` === hash)
          if (project) setSelected(project)
          else document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' })
        })
        return
      }
      event.preventDefault()
      if (destination.pathname === window.location.pathname) return
      window.history.pushState({}, '', `${destination.pathname}${destination.search}${destination.hash}`)
      setPath(destination.pathname)
      setMenuOpen(false)
      setSelected(null)
    }
    window.addEventListener('popstate', onPopState)
    document.addEventListener('click', onDocumentClick)
    return () => {
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', onDocumentClick)
    }
  }, [])
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [page])
  useEffect(() => {
    let previousY = window.scrollY
    const updateScrollState = () => {
      const currentY = window.scrollY
      setIsScrolled(currentY > 16)
      if (currentY < 80) {
        setNavHidden(false)
        setAutoScrollVisible(true)
        setAutoScrollFading(false)
        if (autoScrollHideTimeoutRef.current !== null) {
          window.clearTimeout(autoScrollHideTimeoutRef.current)
          autoScrollHideTimeoutRef.current = null
        }
      }
      else if (currentY > previousY + 3) setNavHidden(true)
      else if (currentY < previousY - 3) setNavHidden(false)
      previousY = currentY
    }
    window.addEventListener('scroll', updateScrollState, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollState)
  }, [])
  useEffect(() => {
    const selectProjectFromHash = () => {
      const project = projects.find((item) => `#${item.id}` === window.location.hash)
      if (project) setSelected(project)
    }
    selectProjectFromHash()
    window.addEventListener('hashchange', selectProjectFromHash)
    return () => window.removeEventListener('hashchange', selectProjectFromHash)
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuToggleRef.current?.focus() } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])
  useEffect(() => {
    if (!selected) return
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogCloseRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelected(null); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const lastFocusable = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); lastFocusable.focus() }
      else if (!event.shiftKey && document.activeElement === lastFocusable) { event.preventDefault(); focusable[0].focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); returnFocus?.focus() }
  }, [selected])

  const isHome = page === 'home'
  const validPage = ['about', 'skills', 'projects', 'experience', 'contact'].includes(page)
  const changeAutoScrollMode = (mode: typeof autoScrollMode) => {
    autoScrollModeRef.current = mode
    setAutoScrollMode(mode)
  }
  const clearAutoScrollCountdown = () => {
    if (autoScrollCountdownRef.current !== null) {
      window.clearInterval(autoScrollCountdownRef.current)
      autoScrollCountdownRef.current = null
    }
    autoScrollCountdownEndRef.current = null
    setAutoScrollCountdown(null)
    setAutoScrollFading(false)
  }
  const startAutoScrollCountdown = (onExpire: () => void) => {
    clearAutoScrollCountdown()
    autoScrollCountdownActionRef.current = onExpire
    autoScrollCountdownEndRef.current = performance.now() + 5000
    setAutoScrollCountdown(5)
    autoScrollCountdownRef.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((autoScrollCountdownEndRef.current! - performance.now()) / 1000))
      setAutoScrollCountdown(remaining)
      if (remaining > 0) return
      clearAutoScrollCountdown()
      if (window.scrollY < 80) {
        setAutoScrollVisible(true)
        setAutoScrollFading(false)
        autoScrollCountdownActionRef.current()
        return
      }
      setAutoScrollFading(true)
      autoScrollHideTimeoutRef.current = window.setTimeout(() => {
        if (window.scrollY < 80) {
          setAutoScrollVisible(true)
          setAutoScrollFading(false)
          autoScrollHideTimeoutRef.current = null
          return
        }
        setAutoScrollVisible(false)
        setAutoScrollFading(false)
        autoScrollHideTimeoutRef.current = null
        autoScrollFrameRef.current = null
        autoScrollStartedAtRef.current = null
        autoScrollDurationRef.current = 0
        autoScrollRemainingRef.current = 15_000
        autoScrollSpeedRef.current = Math.max(0, document.documentElement.scrollHeight - window.innerHeight) / 15
        autoScrollPausedDirectionRef.current = 'down'
        autoScrollCountdownActionRef.current = () => {}
        autoScrollCountdownEndRef.current = null
        setAutoScrollCountdown(null)
        changeAutoScrollMode('idle')
      }, 450)
      autoScrollCountdownActionRef.current()
    }, 100)
  }
  const finishAutoScrollDown = () => {
    autoScrollFrameRef.current = null
    autoScrollStartedAtRef.current = null
    autoScrollRemainingRef.current = 0
    changeAutoScrollMode('down-complete')
    startAutoScrollCountdown(() => {})
  }
  const startAutoScrollUp = (speed = 1500) => {
    clearAutoScrollCountdown()
    setAutoScrollVisible(true)
    const startY = window.scrollY
    if (startY <= 1 || reduceMotion) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      changeAutoScrollMode('idle')
      return
    }
    const startTime = performance.now()
    autoScrollSpeedRef.current = speed
    const scrollDuration = startY / speed * 1000
    autoScrollStartedAtRef.current = startTime
    autoScrollDurationRef.current = scrollDuration
    autoScrollRemainingRef.current = scrollDuration
    changeAutoScrollMode('up')
    let activeDuration = scrollDuration
    let decelerationStartTime: number | null = null
    let decelerationStartPosition = 0
    let decelerationDuration = 0
    const scrollFrame = (now: number) => {
      const elapsed = now - startTime
      let target: number
      if (decelerationStartTime !== null) {
        const decelerationElapsed = Math.min(now - decelerationStartTime, decelerationDuration)
        const progress = decelerationElapsed / decelerationDuration
        target = decelerationStartPosition * (1 - smoothStopProgress(progress))
        autoScrollRemainingRef.current = Math.max(0, decelerationDuration - decelerationElapsed)
        if (decelerationElapsed >= decelerationDuration) {
          window.scrollTo({ top: 0, behavior: 'instant' })
          autoScrollFrameRef.current = null
          autoScrollStartedAtRef.current = null
          autoScrollRemainingRef.current = 0
          changeAutoScrollMode('idle')
          return
        }
      } else {
        const frameElapsed = Math.min(elapsed, activeDuration)
        target = startY - autoScrollSpeedRef.current * frameElapsed / 1000
        const remainingDistance = Math.max(0, target)
        if (remainingDistance <= autoScrollSpeedRef.current * .5) {
          decelerationStartTime = now
          decelerationStartPosition = target
          decelerationDuration = Math.max(1, Math.min(1000, remainingDistance * 2000 / autoScrollSpeedRef.current))
          activeDuration = elapsed + decelerationDuration
          autoScrollDurationRef.current = activeDuration
          autoScrollRemainingRef.current = decelerationDuration
        } else {
          autoScrollRemainingRef.current = Math.max(0, activeDuration - elapsed)
        }
      }
      window.scrollTo({ top: target, behavior: 'instant' })
      autoScrollFrameRef.current = window.requestAnimationFrame(scrollFrame)
    }
    autoScrollFrameRef.current = window.requestAnimationFrame(scrollFrame)
  }
  const startAutoScrollDown = (duration: number) => {
    clearAutoScrollCountdown()
    setAutoScrollVisible(true)
    if (reduceMotion) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
      finishAutoScrollDown()
      return
    }
    const startY = window.scrollY
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    if (maxScroll - startY <= 1) {
      finishAutoScrollDown()
      return
    }
    const distance = maxScroll - startY
    const sectionStops = ['home', 'home-overview', 'about', 'skills', 'projects', 'experience', 'contact']
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null)
      .map((section) => {
        const bounds = section.getBoundingClientRect()
        return Math.max(0, Math.min(maxScroll, startY + bounds.top + bounds.height / 2 - window.innerHeight / 2))
      })
      .filter((position) => position > startY + 1 && position < maxScroll - 1)
    const slowdownRadius = window.innerHeight * .35
    const getSpeedFactor = (position: number) => {
      const strongestSlowdown = sectionStops.reduce((slowdown, stop) => {
        const proximity = Math.abs(position - stop)
        if (proximity >= slowdownRadius) return slowdown
        const intensity = (1 + Math.cos(Math.PI * proximity / slowdownRadius)) / 2
        return Math.max(slowdown, intensity)
      }, 0)
      return 1 - .48 * strongestSlowdown
    }
    const sampleCount = Math.max(1, Math.ceil(distance / Math.max(4, Math.min(12, distance / 1200))))
    const positionSamples = Array.from({ length: sampleCount + 1 }, (_, index) => startY + distance * index / sampleCount)
    const timeSamples = [0]
    for (let index = 1; index < positionSamples.length; index += 1) {
      const previousPosition = positionSamples[index - 1]
      const position = positionSamples[index]
      const midpoint = (previousPosition + position) / 2
      const intervalTime = (position - previousPosition) / getSpeedFactor(midpoint)
      timeSamples.push(timeSamples[index - 1] + intervalTime)
    }
    const totalTimeWeight = timeSamples[timeSamples.length - 1]
    autoScrollSpeedRef.current = totalTimeWeight / (duration / 1000)
    const startTime = performance.now()
    autoScrollStartedAtRef.current = startTime
    autoScrollDurationRef.current = duration
    autoScrollRemainingRef.current = duration
    changeAutoScrollMode('down')

    let activeDuration = duration
    let decelerationStartTime: number | null = null
    let decelerationStartPosition = 0
    let decelerationSpeed = 0
    let decelerationDuration = 0
    const scrollFrame = (now: number) => {
      const elapsed = now - startTime
      let target: number
      if (decelerationStartTime !== null) {
        const decelerationElapsed = Math.min(now - decelerationStartTime, decelerationDuration)
        const progress = decelerationElapsed / decelerationDuration
        target = decelerationStartPosition + (maxScroll - decelerationStartPosition) * smoothStopProgress(progress)
        autoScrollRemainingRef.current = Math.max(0, decelerationDuration - decelerationElapsed)
        if (decelerationElapsed >= decelerationDuration) {
          window.scrollTo({ top: maxScroll, behavior: 'instant' })
          finishAutoScrollDown()
          return
        }
      } else {
        const frameElapsed = Math.min(elapsed, activeDuration)
        const targetTimeWeight = totalTimeWeight * frameElapsed / duration
        let low = 0
        let high = timeSamples.length - 1
        while (low + 1 < high) {
          const middle = Math.floor((low + high) / 2)
          if (timeSamples[middle] < targetTimeWeight) low = middle
          else high = middle
        }
        const intervalProgress = (targetTimeWeight - timeSamples[low]) / (timeSamples[high] - timeSamples[low])
        target = positionSamples[low] + (positionSamples[high] - positionSamples[low]) * intervalProgress
        const currentSpeed = totalTimeWeight / (duration / 1000) * getSpeedFactor(target)
        const remainingDistance = Math.max(0, maxScroll - target)
        if (remainingDistance <= currentSpeed * .5) {
          decelerationStartTime = now
          decelerationStartPosition = target
          decelerationSpeed = currentSpeed
          decelerationDuration = Math.max(1, Math.min(1000, remainingDistance * 2000 / decelerationSpeed))
          activeDuration = elapsed + decelerationDuration
          autoScrollDurationRef.current = activeDuration
          autoScrollRemainingRef.current = decelerationDuration
        } else {
          autoScrollRemainingRef.current = Math.max(0, activeDuration - elapsed)
        }
      }
      window.scrollTo({ top: target, behavior: 'instant' })
      autoScrollFrameRef.current = window.requestAnimationFrame(scrollFrame)
    }
    autoScrollFrameRef.current = window.requestAnimationFrame(scrollFrame)
  }
  const pauseAutoScroll = () => {
    const mode = autoScrollModeRef.current
    if (mode !== 'down' && mode !== 'up') return
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
    const startedAt = autoScrollStartedAtRef.current
    if (startedAt !== null) {
      autoScrollRemainingRef.current = Math.max(0, autoScrollDurationRef.current - (performance.now() - startedAt))
    }
    autoScrollPausedDirectionRef.current = mode
    autoScrollStartedAtRef.current = null
    changeAutoScrollMode('paused')
    startAutoScrollCountdown(() => {})
  }
  pauseAutoScrollRef.current = pauseAutoScroll
  const toggleAutoScroll = () => {
    const mode = autoScrollModeRef.current
    if (mode === 'down' || mode === 'up') {
      pauseAutoScroll()
      return
    }
    if (mode === 'paused') {
      const remaining = autoScrollRemainingRef.current
      clearAutoScrollCountdown()
      if (autoScrollPausedDirectionRef.current === 'up') startAutoScrollUp()
      else startAutoScrollDown(remaining)
      return
    }
    if (mode === 'down-complete') {
      startAutoScrollUp()
      return
    }
    autoScrollSpeedRef.current = 0
    startAutoScrollDown(15_000)
  }
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className={`nav-shell${isScrolled ? ' scrolled' : ''}${navHidden ? ' nav-hidden' : ''}`}>
      <nav className="nav container glass-frosted" aria-label="Main navigation">
        <a className="brand" href={isHome ? '#home' : withBasePath('/')} aria-label="Christopher Sam Saji home"><span className="brand-mark"><UserRound aria-hidden="true" /></span><span className="brand-name">CHRISTOPHER SAM SAJI</span></a>
       <div className="desktop-nav">{nav.map(([label, section]) => {
          const href = isHome ? `#${section}` : withBasePath(`/${section}`)
          return <a className={active === `/${section}` ? 'active' : ''} aria-current={active === `/${section}` ? 'page' : undefined} href={href} key={label}>
          {label}{active === `/${section}` && <span aria-hidden="true" className="nav-active-indicator" />}
        </a>
        })}</div>
        <div className="nav-actions">
          <SwarmController enabled={swarmCursorEnabled} />
          <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} aria-pressed={theme === 'dark'} onClick={toggleTheme}>
            {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
          <button ref={menuToggleRef} className="menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </nav>
      {menuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="mobile-menu">
        {nav.map(([label, section], i) => {
          const href = isHome ? `#${section}` : withBasePath(`/${section}`)
          return <a className={active === `/${section}` ? 'active' : ''} aria-current={active === `/${section}` ? 'page' : undefined} href={href} key={label} onClick={() => setMenuOpen(false)}><span>0{i + 1}</span>{label}<ArrowUpRight size={17} /></a>
        })}<p>Bengaluru, India <span>·</span> Open to learning</p>
      </nav>}
    </header>
    {isHome && autoScrollVisible && <button className={`auto-scroll-toggle${autoScrollMode === 'down' || autoScrollMode === 'up' ? ' is-active' : ''}${autoScrollFading ? ' is-fading' : ''}${navHidden && autoScrollCountdown === null && autoScrollMode !== 'down' && autoScrollMode !== 'up' ? ' is-nav-hidden' : ''}`} type="button" aria-label={autoScrollMode === 'paused' ? 'Resume automatic scrolling' : autoScrollMode === 'down-complete' ? 'Scroll to top' : autoScrollMode === 'down' || autoScrollMode === 'up' ? 'Pause automatic scrolling' : 'Start automatic scrolling'} aria-pressed={autoScrollMode === 'down' || autoScrollMode === 'up'} onClick={toggleAutoScroll}>
      {autoScrollMode === 'down' || autoScrollMode === 'up' ? <><Pause aria-hidden="true" />{autoScrollMode === 'down' ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}</> : autoScrollMode === 'down-complete' ? <ArrowUp aria-hidden="true" /> : autoScrollMode === 'paused' ? <Play aria-hidden="true" /> : <><Play aria-hidden="true" /><ArrowDown aria-hidden="true" /></>}
      <span>{autoScrollMode === 'paused' ? 'Paused' : autoScrollMode === 'down-complete' ? 'Scroll to top' : autoScrollMode === 'down' ? 'Scrolling down' : autoScrollMode === 'up' ? 'Scrolling up' : 'Auto-scroll'}</span>
      {autoScrollCountdown !== null && <span className="auto-scroll-countdown" aria-live="polite">{autoScrollCountdown}s</span>}
    </button>}

    <main id="main" className={isHome ? 'site-home' : 'inner-page'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={page} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reduceMotion ? 0 : .3, ease: [0.22, 1, 0.36, 1] }}>
          {!validPage && <NeuralHero name={profile.name} role={profile.role} homePage={isHome} />}
          {isHome && <section className="home-second-screen" aria-label="Quick introduction and links"><HomeOverview reduceMotion={reduceMotion} /></section>}
          {(page === 'about' || isHome) && <AboutIdentity homePage={isHome} />}
          {(page === 'skills' || isHome) && <SkillsNetwork groups={skills} />}
          {(page === 'projects' || isHome) && <HorizontalProjects reduceMotion={reduceMotion} onSelect={setSelected} />}
          {(page === 'experience' || isHome) && <ExperienceEducation homePage={isHome} />}
          {(page === 'contact' || isHome) && <ContactSection />}
          {isHome && <section className="home-contact-strip"><div className="container"><span className="eyebrow">HAVE A PROJECT IN MIND?</span><h2>Let’s make something useful.</h2><a className="button button-primary" href="#contact">Get in touch <ArrowUpRight size={16} /></a></div></section>}
        </motion.div>
      </AnimatePresence>
    </main>
    {isHome && <ContactFooter homePage />}
    {!isHome && <ContactFooter />}
    <AnimatePresence>{selected && <ProjectExplorer project={selected} dialogRef={dialogRef} closeRef={dialogCloseRef} onClose={() => setSelected(null)} reduceMotion={reduceMotion} />}</AnimatePresence>
    <WebsiteGuide path={page === 'home' ? '/' : `/${page}`} onSwarmCursorEnabledChange={setSwarmCursorEnabled} />
  </>
}

export default App
