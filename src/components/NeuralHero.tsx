// ============================================================
// NeuralHero.tsx — Hero Section Component
// Rendered by: App.tsx (page === 'home' or !validPage)
// Styles: styles.css → [HERO-01] through [HERO-20]
// ============================================================

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { withBasePath } from '../navigation'
import CircuitGraphic from './CircuitGraphic'

// ------------------------------------------------------------
// Type Definitions
// ------------------------------------------------------------

type NeuralHeroProps = {
  name: string
  role: string
  homePage?: boolean
}

// ============================================================
// [HERO-19] Typing Text — Animated Character-by-Character Text
// Shared utility component used in NeuralHero and AboutIdentity.
// Styles: styles.css → [HERO-19] (.typing-text, .is-typing)
// ============================================================

export function TypingText({ text, active, delay = 0, speed = 22, emphasis, reduceMotion = false }: {
  text: string
  active: boolean
  delay?: number
  speed?: number
  emphasis?: string
  reduceMotion?: boolean | null
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(0)
    if (!active) return
    if (reduceMotion) {
      setCount(text.length)
      return
    }

    let index = 0
    let intervalId: number | undefined
    const startId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1
        setCount(index)
        if (index >= text.length && intervalId !== undefined) window.clearInterval(intervalId)
      }, speed)
    }, delay)
    return () => {
      window.clearTimeout(startId)
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [active, delay, reduceMotion, speed, text])

  const visible = text.slice(0, count)
  const emphasisStart = emphasis ? text.indexOf(emphasis) : -1
  const isTyping = active && !reduceMotion && count < text.length
  return <span className={`typing-text${isTyping ? ' is-typing' : ''}`} aria-label={text} data-emphasis={emphasis || undefined}>
    {emphasisStart < 0 ? visible : <>{visible.slice(0, emphasisStart)}{count > emphasisStart && <strong>{visible.slice(emphasisStart, emphasisStart + emphasis!.length)}</strong>}{visible.length > emphasisStart + emphasis!.length && visible.slice(emphasisStart + emphasis!.length)}</>}
  </span>
}

// ============================================================
// NeuralHero — Default Export
// Renders the full-screen hero section on the home/landing page.
// Styles: styles.css → [HERO-01] through [HERO-20]
// ============================================================

export default function NeuralHero({ name, role, homePage = false }: NeuralHeroProps) {
  const [photoLoaded, setPhotoLoaded] = useState(false)
  const [photoUnavailable, setPhotoUnavailable] = useState(false)
  const [introVisible, setIntroVisible] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      setIntroVisible(true)
      return
    }
    const timer = window.setTimeout(() => setIntroVisible(true), 1000)
    return () => window.clearTimeout(timer)
  }, [reduceMotion])

  return (
    // [HERO-01] Hero Section Wrapper
    // Styles: styles.css → [HERO-01] (.hero, .neural-hero)
    <section className="hero neural-hero" id="home" data-swarm-section="hero">

      {/* [HERO-02] Hero Atmosphere — Decorative Background Layer
          Contains: grid, particles, circuit SVG
          Styles: styles.css → [HERO-02] (.hero-atmosphere) */}
      <div className="hero-atmosphere" data-swarm="style" aria-hidden="true">

        {/* [HERO-03] Hero Grid — Dot/Line Grid Background
            Styles: styles.css → [HERO-03] (.hero-grid, .neural-hero .hero-grid) */}
        <div className="hero-grid" />

        {/* [HERO-04] Hero Particles — Animated Floating Dots
            Styles: styles.css → [HERO-04] (.hero-particles, .hero-particles b) */}
        <div className="hero-particles"><b /><b /><b /><b /><b /><b /></div>

        {/* [HERO-05] Hero Circuit — Decorative SVG Circuit Graphic
            Component: CircuitGraphic (CircuitGraphic.tsx)
            Styles: styles.css → [HERO-05] (.hero-circuit, .hero-circuit-svg) */}
        <div className="hero-circuit">
          <CircuitGraphic variant="hero" className="hero-circuit-svg" />
        </div>
      </div>

      {/* [HERO-06] Neural Hero Layout Container — Two-Column Grid
          Styles: styles.css → [HERO-06] (.neural-hero-layout, .container) */}
      <div className="container neural-hero-layout" data-swarm="container">

        {/* [HERO-07] Hero Copy Block — Left Text Column
            Styles: styles.css → [HERO-07] (.hero-copy, .neural-hero-copy) */}
        <motion.div
          className="hero-copy neural-hero-copy"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : .65, ease: [.22, 1, .36, 1] }}
        >
          {/* [HERO-08] Hero H1 Headline
              Styles: styles.css → [HERO-08] (.neural-hero h1, .hero h1) */}
          <h1 data-swarm="heading">Building intelligent<br /><span>systems that connect.</span></h1>

          {/* [HERO-09] Hero Tech Tags — Pill Badges (Python, Odoo, ERP …)
              Styles: styles.css → [HERO-09] (.hero-tech-tags, .hero-tech-tag) */}
          <div className="hero-tech-tags" data-swarm="style" aria-label="Professional areas and technologies">
            {['Python', 'Odoo', 'ERP', 'Developer', 'IoT', 'ESP32'].map((tag) => <span className="hero-tech-tag" key={tag}>{tag}</span>)}
          </div>

          {/* [HERO-10] Hero Description — Typing Animated Paragraph
              Uses: TypingText component
              Styles: styles.css → [HERO-10] (.hero-description, .neural-hero .hero-description)
              Also: styles.css → [HERO-19] (.typing-text, .is-typing) */}
          <p className="hero-description" data-swarm="text"><TypingText text="Python and Odoo developer based in Bengaluru, focused on building practical software, improving ERP workflows, and exploring data-driven applications and connected devices." active delay={450} speed={15} reduceMotion={reduceMotion} /></p>

          {/* [HERO-11] Hero CTA Buttons — Actions Row (Explore Work / Let's Connect)
              Styles: styles.css → [HERO-11] (.hero-actions, .button, .button-primary, .button-quiet) */}
          <div className="hero-actions" data-swarm="layout">
            <a href={homePage ? '#projects' : withBasePath('/projects')} className="button button-primary">Explore My Work <ArrowRight size={16} /></a>
            <a href={homePage ? '#contact' : withBasePath('/contact')} className="button button-quiet">Let&#39;s Connect <ArrowUpRight size={16} /></a>
          </div>

          {/* [HERO-12] Hero Footnote — Location Label with Decorative Line
              Styles: styles.css → [HERO-12] (.hero-footnote, .footnote-line) */}
          <div className="hero-footnote" data-swarm="style"><span className="footnote-line" /> BENGALURU, INDIA</div>
        </motion.div>

        {/* [HERO-13] Portrait Stage — Right Column (Image + Intro Cards)
            Styles: styles.css → [HERO-13] (.portrait-stage, .portrait-stage::before, .portrait-stage::after)
            State class: .has-intro (added when introVisible = true) */}
        <motion.div
          className={`portrait-stage${introVisible ? ' has-intro' : ''}`}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : .75, delay: reduceMotion ? 0 : .1, ease: [.2, .75, .25, 1] }}
        >
          {/* [HERO-16] Hero Intro Cards — Floating Info Bubbles
              Styles: styles.css → [HERO-16] (.hero-intro-list, .hero-intro-card)
              Styles: styles.css → [HERO-17] (.hero-intro-dots) */}
          <div className="hero-intro-list" aria-label="A short introduction">
            <div className="hero-intro-card" data-swarm="card">
              {/* [HERO-17] Hero Intro Dots — Decorative Status Dots
                  Styles: styles.css → [HERO-17] (.hero-intro-dots) */}
              <span className="hero-intro-dots" aria-hidden="true"><i /><i /><i /></span>
              <p><TypingText text={`Hi there! I'm ${name}. Welcome to my portfolio.`} emphasis={name} active={introVisible} delay={350} speed={28} reduceMotion={reduceMotion} /></p>
            </div>
            <div className="hero-intro-card" data-swarm="card"><span className="hero-intro-dots" aria-hidden="true"><i /><i /><i /></span><p><TypingText text={`Working as ${role} at AutoChip India, Bengaluru.`} emphasis={role} active={introVisible} delay={1350} speed={28} reduceMotion={reduceMotion} /></p></div>
            <div className="hero-intro-card" data-swarm="card"><span className="hero-intro-dots" aria-hidden="true"><i /><i /><i /></span><p><TypingText text="Currently, I'm a trainee at AutoChip India, gaining hands-on experience in Python and Odoo development." active={introVisible} delay={2500} speed={28} reduceMotion={reduceMotion} /></p></div>
          </div>

          {/* [HERO-14] Portrait Media Container — Image Wrapper
              Styles: styles.css → [HERO-14] (.portrait-media, .portrait-image, .portrait-image.is-loaded)
              Animation: styles.css → [HERO-14] (@keyframes portrait-breathe) */}
          <div className="portrait-media" data-swarm="image">
            {!photoUnavailable && <img
              className={`portrait-image${photoLoaded ? ' is-loaded' : ''}`}
              src={`${import.meta.env.BASE_URL}images/mypic2.png`}
              alt={`Portrait of ${name}`}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onLoad={() => setPhotoLoaded(true)}
              onError={() => setPhotoUnavailable(true)}
            />}

            {/* [HERO-15] Portrait Placeholder — Fallback When Image Is Missing
                Styles: styles.css → [HERO-15] (.portrait-placeholder, .portrait-placeholder-index,
                .portrait-placeholder-mark, .portrait-placeholder-path) */}
            {!photoLoaded && <div className="portrait-placeholder">
              <span className="portrait-placeholder-index">PERSONAL IMAGE / 01</span>
              <span className="portrait-placeholder-mark" aria-hidden="true">NO</span>
              <strong>Portrait to be added</strong>
              <span className="portrait-placeholder-path">Place your image at <code>public/images/mypic2.png</code></span>
            </div>}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
