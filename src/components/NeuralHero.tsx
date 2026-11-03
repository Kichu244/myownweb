import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { withBasePath } from '../navigation'
import CircuitGraphic from './CircuitGraphic'

type NeuralHeroProps = {
  name: string
  role: string
  homePage?: boolean
}

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
  return <span className={`typing-text${isTyping ? ' is-typing' : ''}`} aria-label={text}>
    {emphasisStart < 0 ? visible : <>{visible.slice(0, emphasisStart)}{count > emphasisStart && <strong>{visible.slice(emphasisStart, emphasisStart + emphasis!.length)}</strong>}{visible.length > emphasisStart + emphasis!.length && visible.slice(emphasisStart + emphasis!.length)}</>}
  </span>
}

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
    <section className="hero neural-hero" id="home">
      <div className="hero-atmosphere" aria-hidden="true">
        <div className="hero-grid" />
        <div className="hero-particles"><b /><b /><b /><b /><b /><b /></div>
        <div className="hero-circuit">
          <CircuitGraphic variant="hero" className="hero-circuit-svg" />
        </div>
      </div>

      <div className="container neural-hero-layout">
        <motion.div
          className="hero-copy neural-hero-copy"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : .65, ease: [.22, 1, .36, 1] }}
        >
          <h1>Building intelligent<br /><span>systems that connect.</span></h1>
          <div className="hero-tech-tags" aria-label="Professional areas and technologies">
            {['Python', 'Odoo', 'ERP', 'Developer', 'IoT', 'ESP32'].map((tag) => <span className="hero-tech-tag" key={tag}>{tag}</span>)}
          </div>
          <p className="hero-description"><TypingText text="Python and Odoo developer based in Bengaluru, focused on building practical software, improving ERP workflows, and exploring data-driven applications and connected devices." active delay={450} speed={15} reduceMotion={reduceMotion} /></p>
          <div className="hero-actions">
            <a href={homePage ? '#projects' : withBasePath('/projects')} className="button button-primary">Explore My Work <ArrowRight size={16} /></a>
            <a href={homePage ? '#contact' : withBasePath('/contact')} className="button button-quiet">Let&#39;s Connect <ArrowUpRight size={16} /></a>
          </div>
          <div className="hero-footnote"><span className="footnote-line" /> BENGALURU, INDIA</div>
        </motion.div>

        <motion.div
          className={`portrait-stage${introVisible ? ' has-intro' : ''}`}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : .75, delay: reduceMotion ? 0 : .1, ease: [.2, .75, .25, 1] }}
        >
          <div className="hero-intro-list" aria-label="A short introduction">
            <div className="hero-intro-card"><span className="hero-intro-dots" aria-hidden="true"><i /><i /><i /></span><p><TypingText text={`Hi there! I'm ${name}. Welcome to my portfolio.`} emphasis={name} active={introVisible} delay={350} speed={28} reduceMotion={reduceMotion} /></p></div>
            <div className="hero-intro-card"><span className="hero-intro-dots" aria-hidden="true"><i /><i /><i /></span><p><TypingText text={`Working as ${role} at AutoChip India, Bengaluru.`} emphasis={role} active={introVisible} delay={1350} speed={28} reduceMotion={reduceMotion} /></p></div>
            <div className="hero-intro-card"><span className="hero-intro-dots" aria-hidden="true"><i /><i /><i /></span><p><TypingText text="Currently, I'm a trainee at AutoChip India, gaining hands-on experience in Python and Odoo development." active={introVisible} delay={2500} speed={28} reduceMotion={reduceMotion} /></p></div>
          </div>
          <div className="portrait-media">
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
