import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowRight, ArrowUpRight, BrainCircuit, ClipboardCheck, Cpu, KeyRound, Menu, PanelsTopLeft, Smartphone, UserRound, Wifi, X } from 'lucide-react'
import { profile, projects, skills, type Project } from './data'
import NeuralHero, { TypingText } from './components/NeuralHero'
import ProjectExplorer from './components/ProjectExplorer'
import SkillsNetwork from './components/SkillsNetwork'
import AboutIdentity from './components/AboutIdentity'
import ExperienceEducation from './components/ExperienceEducation'
import { ContactFooter, ContactSection } from './components/ContactExperience'

const nav = [['About', '/about'], ['Skills', '/skills'], ['Projects', '/projects'], ['Experience', '/experience'], ['Contact', '/contact']]
const pageFromPath = (path: string) => path === '/' ? 'home' : path.replace(/^\/+|\/+$/g, '')
function ProjectIcon({ variant }: { variant: Project['visualization'] }) {
  const Icon = variant === 'attendance-flow' ? ClipboardCheck
    : variant === 'ai-processing' ? BrainCircuit
    : variant === 'iot-switchboard' ? Cpu
    : variant === 'android-monitor' ? Smartphone
    : variant === 'corporate-web' ? PanelsTopLeft
    : variant === 'concept-key' ? KeyRound
    : variant === 'iot-hub' ? Wifi
    : PanelsTopLeft
  return <Icon aria-hidden="true" />
}
const reveal: Variants = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: .6, ease: [0.22, 1, 0.36, 1] } } }

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return <div className="section-title"><h2>{title}</h2>{note && <p>{note}</p>}</div>
}

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

  return <section className="home-overview section-pad" id="home-overview" aria-label="Portfolio overview">
    <div className="container">
      <div className="home-overview-heading" ref={overviewRef}><h2>A little<br /><span>about me.</span></h2><h3>Curious by nature, learning through projects</h3><p><TypingText text={`I'm ${profile.name}, based in Bengaluru, India. I enjoy exploring how software and connected devices work, and learning by building projects with Python, Odoo, data workflows, and web technologies.`} active={overviewVisible} delay={350} speed={18} reduceMotion={reduceMotion} /></p></div>
      <div className="home-overview-grid">
        <a className="home-overview-card glass-frosted" href="/about"><h3>About me</h3><p>{profile.role} · Bengaluru</p><span className="home-overview-link">More about me <ArrowRight size={15} /></span></a>
        <a className="home-overview-card glass-frosted" href="/skills"><h3>Skills</h3><p>{skills.slice(0, 3).map((group) => group.name).join(' · ')}</p><span className="home-overview-link">Explore skills <ArrowRight size={15} /></span></a>
        <a className="home-overview-card glass-crystal" href="/projects"><h3>Projects</h3><p>ERP, data, web, and IoT experiments.</p><span className="home-overview-link">Browse projects <ArrowRight size={15} /></span></a>
        <a className="home-overview-card glass-frosted" href="/experience"><h3>Experience & education</h3><p>AutoChip India · Neopraxis · BCA Cyber Security</p><span className="home-overview-link">View my journey <ArrowRight size={15} /></span></a>
      </div>
    </div>
  </section>
}

function ProjectsPage({ reduceMotion, filter, setFilter, onSelect }: { reduceMotion: boolean | null; filter: string; setFilter: (value: string) => void; onSelect: (project: Project) => void }) {
  const categories = ['All', ...new Set(projects.map((project) => project.category))]
  const visibleProjects = projects.filter((project) => filter === 'All' || project.category === filter)
  return <section className="projects section-pad" id="projects"><div className="container"><motion.div className="projects-heading" variants={reveal} initial={reduceMotion ? false : 'hidden'} animate="show"><div><SectionTitle title="Built to solve. Made to learn." note="Software projects, local-network experiments, and clearly labelled hardware concepts." /></div><span className="project-count">{String(visibleProjects.length).padStart(2, '0')} <i>/ {String(projects.length).padStart(2, '0')}</i></span></motion.div>
    <div className="filter-row" role="group" aria-label="Filter projects by category">{categories.map((cat) => <button key={cat} className={filter === cat ? 'filter active' : 'filter'} aria-pressed={filter === cat} onClick={() => setFilter(cat)}>{cat}<span>{cat === 'All' ? projects.length : projects.filter((p) => p.category === cat).length}</span></button>)}</div>
    <div className="project-list">{visibleProjects.map((project, i) => <motion.button id={project.id} key={project.id} layout onClick={() => onSelect(project)} className={`project-row glass-floating project-${project.number}`} initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .4, delay: reduceMotion ? 0 : i * .035 }}>
      <span className="project-number">{project.number}</span><span className="project-visual project-icon-card glass-deep" aria-hidden="true"><ProjectIcon variant={project.visualization} /></span>
      <span className="project-main"><span className="project-category">{project.category} <i>·</i> {project.status}</span><strong>{project.title}</strong><span className="project-summary">{project.description}</span><span className="project-stack">{project.stack.slice(0, 4).map((tech) => <i key={tech}>{tech}</i>)}</span></span><span className="project-open"><ArrowUpRight size={20} /></span>
    </motion.button>)}</div><p className="status-note"><span className="status-dot" /> Project statuses distinguish reported work, concepts, plans, and details awaiting verification.</p>
  </div></section>
}

function App() {
  const [path, setPath] = useState(() => window.location.pathname)
  const page = pageFromPath(path)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(() => window.scrollY > 16)
  const [navHidden, setNavHidden] = useState(false)
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState<Project | null>(null)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const dialogCloseRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()
  const active = page === 'home' ? '' : `/${page}`

  useEffect(() => {
    document.title = page === 'home' ? `${profile.name} | Developer Portfolio` : `${page[0]?.toUpperCase()}${page.slice(1)} | ${profile.name}`
    document.body.style.overflow = selected ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected, page])
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname && destination.hash) return
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
      if (currentY < 80) setNavHidden(false)
      else if (currentY > previousY + 3) setNavHidden(true)
      else if (currentY < previousY - 3) setNavHidden(false)
      previousY = currentY
    }
    window.addEventListener('scroll', updateScrollState, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollState)
  }, [])
  useEffect(() => {
    if (page !== 'projects' || !window.location.hash) return
    const project = projects.find((item) => `#${item.id}` === window.location.hash)
    if (project) setSelected(project)
  }, [page])
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
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className={`nav-shell${isScrolled ? ' scrolled' : ''}${navHidden ? ' nav-hidden' : ''}`}>
      <nav className="nav container glass-frosted" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Christopher Sam Saji home"><span className="brand-mark"><UserRound aria-hidden="true" /></span><span className="brand-name">CHRISTOPHER SAM SAJI</span></a>
       <div className="desktop-nav">{nav.map(([label, href]) => <a className={active === href ? 'active' : ''} aria-current={active === href ? 'page' : undefined} href={href} key={label}>
          {label}{active === href && <span aria-hidden="true" className="nav-active-indicator" />}
        </a>)}</div>
        <div className="nav-actions"><button ref={menuToggleRef} className="menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
      </nav>
      {menuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="mobile-menu">
        {nav.map(([label, href], i) => <a className={active === href ? 'active' : ''} aria-current={active === href ? 'page' : undefined} href={href} key={label} onClick={() => setMenuOpen(false)}><span>0{i + 1}</span>{label}<ArrowUpRight size={17} /></a>)}<p>Bengaluru, India <span>·</span> Open to learning</p>
      </nav>}
    </header>

    <main id="main" className={isHome ? 'site-home' : 'inner-page'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={page} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reduceMotion ? 0 : .3, ease: [0.22, 1, 0.36, 1] }}>
          {!validPage && <NeuralHero name={profile.name} role={profile.role} />}
          {page === 'about' && <AboutIdentity />}
          {page === 'skills' && <SkillsNetwork groups={skills} />}
          {page === 'projects' && <ProjectsPage reduceMotion={reduceMotion} filter={filter} setFilter={setFilter} onSelect={setSelected} />}
          {page === 'experience' && <ExperienceEducation />}
          {page === 'contact' && <ContactSection />}
          {isHome && <section className="home-second-screen" aria-label="Quick introduction and links">
            <HomeOverview reduceMotion={reduceMotion} />
            <ContactFooter />
            <section className="home-contact-strip"><div className="container"><span className="eyebrow">HAVE A PROJECT IN MIND?</span><h2>Let’s make something useful.</h2><a className="button button-primary" href="/contact">Get in touch <ArrowUpRight size={16} /></a></div></section>
          </section>}
        </motion.div>
      </AnimatePresence>
    </main>
    {!isHome && <ContactFooter />}
    <AnimatePresence>{selected && <ProjectExplorer project={selected} dialogRef={dialogRef} closeRef={dialogCloseRef} onClose={() => setSelected(null)} reduceMotion={reduceMotion} />}</AnimatePresence>
  </>
}

export default App
