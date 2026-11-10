// ============================================================
// AboutIdentity.tsx — About Section Component
// Rendered by: App.tsx (page === 'about' || isHome)
// Styles: styles.css → [ABOUT-01] through [ABOUT-17]
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { withBasePath } from '../navigation'
import { profile, skills } from '../data'
import { TypingText } from './NeuralHero'

// ============================================================
// AboutIdentity — Default Export
// Renders the animated personal introduction (About) section.
// Styles: styles.css → [ABOUT-01] through [ABOUT-17]
// ============================================================

export default function AboutIdentity({ homePage = false }: { homePage?: boolean }) {
  const reduceMotion = useReducedMotion()
  const focusGroups = [skills[0], skills[1], skills[3]]
  const [conversationVisible, setConversationVisible] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [conversationComplete, setConversationComplete] = useState(false)
  const conversationRef = useRef<HTMLDivElement>(null)

  // ------------------------------------------------------------
  // Conversation Lines — Sequential animated intro text
  // Used by: [ABOUT-08] Identity Conversation Box
  // ------------------------------------------------------------
  const conversation = [
    { text: '👋 Hey there! Hearty Welcome, You Came Here to Know More About Me! Right?', className: 'identity-lead' },
    { text: `Okay Fine, I'll tell you! I'm ${profile.name}. Glad you're here! 😊`, className: 'identity-lead' },
    { text: `So, a little about me… I'm a developer who loves turning ideas into practical, working applications.`, className: 'identity-body' },
    { text: 'Python is my thing! I enjoy building backend systems, working with web technologies, and finding better ways to solve problems.', className: 'identity-body' },
    { text: `Oh, and there's more! I'm really interested in AI, automation, and cybersecurity — especially how technology can make everyday tasks smarter and easier.`, className: 'identity-body' },
    { text: `And when I'm away from the screen? I love experimenting with hardware and connecting software to real-world devices.`, className: 'identity-body' },
    { text: `I've explored quite a few things, from smart attendance systems and AI-assisted workflows to offline smart devices and creative automation projects.`, className: 'identity-body' },
    { text: `A little about my background — I'm a BCA Cyber Security graduate, and during my internship at Neopraxis Private Limited, I worked with AI-assisted customer-support data processing.`, className: 'identity-body' },
    { text: `But hey, I'm still learning! Every project teaches me something new, and I enjoy discovering, experimenting, and improving along the way.`, className: 'identity-body' },
    { text: `Right now, I'm focused on growing as a developer, gaining hands-on experience, and building things that make a real difference.`, className: 'identity-body' },
    { text: `Curious about what I've built?\nFeel free to explore my projects and skills, and see what I've been working on!`, className: 'identity-body' },
    { text: `Thanks for stopping by. It's great to have you here!`, className: 'identity-body' },
    { text: `Who knows? Maybe you'll find something interesting along the way. 😉`, className: 'identity-body' },
  ] 
  const typingSpeed = 18

  // ------------------------------------------------------------
  // Final Summary Lines — Shown after conversation completes
  // Used by: [ABOUT-10] Identity Conversation Complete
  // ------------------------------------------------------------
  const finalSummaryLines = [
    `${profile.name}, a BCA Cyber Security graduate and developer passionate about building practical, technology-driven solutions.`,
    'I work with Python, Odoo, backend development, and web technologies, while exploring AI, automation, and cybersecurity.',
    "Through personal projects and my internship at Neopraxis Private Limited, I've gained hands-on exposure to AI-assisted customer-support data processing, smart attendance systems, and connected-device experiments.",
    "I'm always eager to learn, experiment with new technologies, and turn ideas into useful applications.",
    'My goal is to grow as a developer, strengthen my technical skills, and build innovative solutions that make a meaningful difference.',
  ]

  // ------------------------------------------------------------
  // Intersection Observer — Triggers conversation animation
  // when the section scrolls into view
  // ------------------------------------------------------------
  useEffect(() => {
    const target = conversationRef.current
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setConversationVisible(true)
      observer.disconnect()
    }, { threshold: .2 })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  // ------------------------------------------------------------
  // Conversation line progression timer
  // Advances lineIndex after each line's typing duration
  // ------------------------------------------------------------
  useEffect(() => {
    if (!conversationVisible || conversationComplete) return
    if (reduceMotion) {
      setConversationComplete(true)
      return
    }
    const isLastLine = lineIndex === conversation.length - 1
    const timer = window.setTimeout(() => {
      if (isLastLine) setConversationComplete(true)
      else setLineIndex((index) => index + 1)
    }, conversation[lineIndex].text.length * typingSpeed + 1500)
    return () => window.clearTimeout(timer)
  }, [conversationVisible, conversationComplete, lineIndex, reduceMotion])

  return (
    // [ABOUT-01] About Section Wrapper
    // Styles: styles.css → [ABOUT-01] (.about, .section-pad)
    <section className="about section-pad" id="about" data-swarm-section="about">

      {/* [ABOUT-02] Identity Layout Grid — Two-Column Layout
          Styles: styles.css → [ABOUT-02] (.identity-layout, .container) */}
      <div className="container identity-layout" data-swarm="container">

        {/* [ABOUT-03] Identity Visual Column — Left Column (Photo + Buttons)
            Styles: styles.css → [ABOUT-03] (.identity-visual-column) */}
        <div className="identity-visual-column">

          {/* [ABOUT-04] Identity Photo Image — Profile Photo Card
              Styles: styles.css → [ABOUT-04] (.identity-visual.glass-crystal, .identity-photo) */}
          <aside className="identity-visual glass-crystal" data-swarm="image">
            <img
              className="identity-photo"
              src={`${import.meta.env.BASE_URL}images/mypic2.png`}
              alt={`${profile.name}, portrait`}
            />      
          </aside>

          {/* [ABOUT-16] Identity Actions Buttons — View Skills / View Experience
              Styles: styles.css → [ABOUT-16] (.identity-actions, .button, .button-primary, .button-quiet) */}
          <nav className="identity-actions" data-swarm="layout" aria-label="Explore more about me">
            <a className="button button-primary" href={homePage ? '#skills' : withBasePath('/skills')}>View my skills <ArrowRight size={15} aria-hidden="true" /></a>
            <a className="button button-quiet" href={homePage ? '#experience' : withBasePath('/experience')}>View my experience <ArrowRight size={15} aria-hidden="true" /></a>
          </nav>
        </div>

        {/* [ABOUT-06] Identity Copy Column — Right Column (Text Content)
            Styles: styles.css → [ABOUT-06] (.identity-copy) */}
        <motion.div className="identity-copy" initial={reduceMotion ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: reduceMotion ? 0 : .55 }}>

          {/* [ABOUT-07] Identity H2 Heading — "Who am I?"
              Styles: styles.css → [ABOUT-07] (.identity-copy h2) */}
          <h2 data-swarm="heading">Who am <span>I&nbsp;?&nbsp;</span></h2>

          {/* [ABOUT-08] Identity Conversation Box — Animated Sequential Chat Lines
              Animates height from 190px to auto on completion.
              Styles: styles.css → [ABOUT-08] (.identity-conversation) */}
          <motion.div
            className="identity-conversation"
            data-swarm="text"
            ref={conversationRef}
            aria-label="A personal introduction"
            aria-live="polite"
            initial={false}
            animate={{ height: conversationComplete ? 'auto' : 190 }}
            transition={{ height: { duration: reduceMotion ? 0 : .9, ease: 'easeInOut' } }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {/* [ABOUT-09] Identity Conversation Lines — Animated Lead and Body Lines
                  Classes: .identity-lead (larger), .identity-body (normal)
                  Styles: styles.css → [ABOUT-09] (.identity-conversation-line, .identity-lead, .identity-body) */}
              {conversationVisible && !conversationComplete && conversation.slice(Math.max(0, lineIndex - 1), lineIndex + 1).map((line, index) => {
                const currentLineIndex = Math.max(0, lineIndex - 1) + index
                return <motion.p
                  className={`identity-conversation-line ${line.className}`}
                  key={currentLineIndex}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -32 }}
                  transition={{ duration: reduceMotion ? 0 : .7, ease: 'easeInOut', layout: { duration: .7, ease: 'easeInOut' } }}
                ><TypingText text={line.text} active={conversationVisible && !conversationComplete} speed={typingSpeed} reduceMotion={reduceMotion} /></motion.p>
              })}

              {/* [ABOUT-10] Identity Conversation Complete — Final Summary Paragraph
                  Shown after all conversation lines finish.
                  Styles: styles.css → [ABOUT-10] (.identity-conversation-complete) */}
              {conversationComplete && <motion.p
                className="identity-conversation-complete"
                key="complete"
                aria-label={finalSummaryLines.join(' ')}
                initial={false}
              >{finalSummaryLines.map((line, index) => <motion.span
                // [ABOUT-11] Identity Summary Line — Individual Fade-In Spans
                // Styles: styles.css → [ABOUT-11] (.identity-summary-line)
                className="identity-summary-line"
                key={line}
                aria-hidden="true"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : .7, delay: reduceMotion ? 0 : index * .24, ease: 'easeInOut' }}
              >{line} </motion.span>)}</motion.p>}
            </AnimatePresence>
          </motion.div>

          {/* [ABOUT-13] Identity Focus Section — Current Areas of Focus
              Styles: styles.css → [ABOUT-13] (.identity-focus) */}
          <div className="identity-focus" data-swarm="style">

            {/* [ABOUT-12] Identity Skip Button — Skip Intro Animation
                Only visible while conversation is in progress.
                Styles: styles.css → [ABOUT-12] (.identity-skip) */}
            {!conversationComplete && <motion.button
              className="identity-skip"
              type="button"
              onClick={() => { setConversationVisible(true); setConversationComplete(true) }}
              initial={reduceMotion ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduceMotion ? 0 : 1.5, delay: reduceMotion ? 0 : 3, ease: [0.22, 1, 0.36, 1] }}
            >Skip intro <ArrowRight size={12} aria-hidden="true" /></motion.button>}

            <span className="eyebrow">CURRENT AREAS OF FOCUS</span>

            {/* [ABOUT-14] Identity Focus Chips — Technology Area Tags
                Styles: styles.css → [ABOUT-14] (.identity-focus-chip) */}
            <div>{focusGroups.map((group) => <span className="identity-focus-chip" key={group.name}><i aria-hidden="true" />{group.name}</span>)}</div>
          </div>

          {/* [ABOUT-15] Identity Location Badge — Location Label
              Styles: styles.css → [ABOUT-15] (.identity-location, .location-dot) */}
          <div className="identity-location" data-swarm="style"><span className="location-dot" />BENGALURU, KARNATAKA, INDIA</div>
        </motion.div>
      </div>
    </section>
  )
}
