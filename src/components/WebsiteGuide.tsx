import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigation2, Send, Settings2, X } from 'lucide-react'
import { intents, matchIntent, normalizeMessage, type ChatIntent } from '../chatbotIntents'
import { withBasePath } from '../navigation'
import AxisCursor from './AxisCursor'
import ClickEffect from './ClickEffect'
import GuideSprite from './GuideSprite'
import GuideSpriteArt from './GuideSpriteArt'
import { useCompanion } from './useCompanion'

type Message = { id: number; role: 'user' | 'assistant'; text: string; link?: ChatIntent['link'] }
type Flight = { from: DOMRect; to: { x: number; y: number } | null }

const welcome: Message = { id: 0, role: 'assistant', text: 'Hi! I’m the portfolio guide. Ask me about Christopher’s projects, skills, experience, education, or contact options.' }
const sectionPaths: Record<string, string> = { about: '/about', skills: '/skills', projects: '/projects', experience: '/experience', contact: '/contact' }

export default function WebsiteGuide({ path, onSwarmCursorEnabledChange }: { path: string; onSwarmCursorEnabledChange: (enabled: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [suggestions, setSuggestions] = useState(['Show me the projects', 'Tell me about his experience', 'How can I get in touch?'])
  const [status, setStatus] = useState('')
  const [tour, setTour] = useState<string[] | null>(null)
  const [tourIndex, setTourIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<DOMRect | null>(null)
  const [tourPath, setTourPath] = useState('')
  const [context, setContext] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [developerOption, setDeveloperOption] = useState(false)
  const [developerPin, setDeveloperPin] = useState('')
  const [axisCursorEnabled, setAxisCursorEnabled] = useState(false)
  const [clickEffectEnabled, setClickEffectEnabled] = useState(false)
  const [swarmCursorEnabled, setSwarmCursorEnabled] = useState(false)
  const { companion, dispatch: companionEvent } = useCompanion(open)
  const passwordValidated = developerPin === '2224'
  const spriteLauncherRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([])
  const logRef = useRef<HTMLDivElement>(null)
  const messageId = useRef(1)
  const closeTimer = useRef<number | null>(null)
  const surpriseReminderTimer = useRef<number | null>(null)
  const swarmNavigationTimers = useRef<number[]>([])

  function updatePinDigit(index: number, rawValue: string) {
    const digits = rawValue.replace(/\D/g, '')
    if (!digits) {
      const next = developerPin.split('')
      next[index] = ''
      setDeveloperPin(next.join('').slice(0, 4))
      return
    }
    const next = developerPin.split('')
    const entered = digits.slice(-4)
    entered.split('').forEach((digit, offset) => { if (index + offset < 4) next[index + offset] = digit })
    const value = next.join('').slice(0, 4)
    setDeveloperPin(value)
    pinInputRefs.current[Math.min(index + entered.length, 3)]?.focus()
    if (value !== '2224') {
      setAxisCursorEnabled(false); setClickEffectEnabled(false); setSwarmCursorEnabled(false); onSwarmCursorEnabledChange(false)
    }
  }

  function handlePinKeyDown(index: number, key: string) {
    if (key === 'Backspace' && !developerPin[index] && index > 0) pinInputRefs.current[index - 1]?.focus()
    if (key === 'ArrowLeft' && index > 0) pinInputRefs.current[index - 1]?.focus()
    if (key === 'ArrowRight' && index < 3) pinInputRefs.current[index + 1]?.focus()
  }

  useEffect(() => {
    if (!open || !flight || flight.to) return
    const frame = window.requestAnimationFrame(() => {
      const avatar = document.querySelector<HTMLElement>('.guide-avatar')
      if (!avatar) { setFlight(null); return }
      const bounds = avatar.getBoundingClientRect()
      setFlight({ from: flight.from, to: { x: bounds.left + bounds.width / 2 - 27, y: bounds.top + bounds.height / 2 - 27 } })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, flight])

  useEffect(() => {
    if (!flight?.to) return
    const timer = window.setTimeout(() => setFlight(null), 700)
    return () => window.clearTimeout(timer)
  }, [flight?.to])

  useEffect(() => () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); if (surpriseReminderTimer.current !== null) window.clearTimeout(surpriseReminderTimer.current); swarmNavigationTimers.current.forEach(window.clearTimeout) }, [])

  useEffect(() => {
    const log = logRef.current
    if (!log) return
    log.scrollTo({ top: log.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    if (!settingsOpen || !developerOption) return
    const frame = window.requestAnimationFrame(() => pinInputRefs.current[0]?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [settingsOpen, developerOption])

  function navigateToSwarmButton() {
    setSettingsOpen(false)
    const closeChatTimer = window.setTimeout(close, 240)
    const highlightTimer = window.setTimeout(() => {
      const button = document.querySelector<HTMLButtonElement>('.swarm-activate')
      if (!button) return
      button.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest', inline: 'nearest' })
      button.classList.remove('is-guide-highlight')
      void button.offsetWidth
      button.classList.add('is-guide-highlight')
      window.setTimeout(() => button.classList.remove('is-guide-highlight'), 1000)
    }, 700)
    swarmNavigationTimers.current.push(closeChatTimer, highlightTimer)
  }

  useEffect(() => { companionEvent({ type: 'welcome' }) }, [])

  useEffect(() => {
    const sectionForId: Record<string, 'hero' | 'overview' | 'about' | 'skills' | 'projects' | 'experience' | 'education' | 'contact' | 'footer'> = {
      home: 'hero', 'home-overview': 'overview', about: 'about', skills: 'skills', projects: 'projects', experience: 'experience',
      'journey-education-heading': 'education', contact: 'contact',
    }
    const sectionElements = Array.from(document.querySelectorAll<HTMLElement>('main [data-swarm-section][id], #journey-education-heading'))
    const footer = document.querySelector<HTMLElement>('.contact-footer')
    const elements = footer ? [...sectionElements, footer] : sectionElements
    const sectionForElement = (element: HTMLElement) => element === footer ? 'footer' : sectionForId[element.id]
    const educationTarget = elements.find((element) => element.id === 'journey-education-heading')
    let educationInActiveBand = false
    let currentSection = ''
    const observer = new IntersectionObserver((entries) => {
      const educationEntry = entries.find((entry) => entry.target === educationTarget)
      if (educationEntry) educationInActiveBand = educationEntry.isIntersecting
      const centerY = window.innerHeight / 2
      const active = elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { element, containsCenter: rect.top <= centerY && rect.bottom >= centerY, distance: Math.abs((rect.top + rect.bottom) / 2 - centerY), section: sectionForElement(element) }
      }).filter((item) => item.section && item.element.getBoundingClientRect().bottom > 0 && item.element.getBoundingClientRect().top < window.innerHeight)
        .sort((a, b) => Number(b.containsCenter) - Number(a.containsCenter) || a.distance - b.distance)
      const next = educationInActiveBand ? 'education' : active[0]?.section
      if (!next || next === currentSection) return
      currentSection = next
      companionEvent({ type: 'section', section: next })
    }, { threshold: 0, rootMargin: '-35% 0px -35% 0px' })
    elements.forEach((element) => observer.observe(element))
    const backgroundClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || target.closest('a,button,input,textarea,select,[role="button"],[role="link"],.guide-panel,.guide-sprite-launcher')) return
      companionEvent({ type: 'background-click', section: target.closest('section[id]')?.id })
    }
    document.addEventListener('click', backgroundClick)
    return () => { observer.disconnect(); document.removeEventListener('click', backgroundClick) }
  }, [companionEvent, path])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (settingsOpen) { setSettingsOpen(false); return }
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, settingsOpen])

  function close() {
    companionEvent({ type: 'chat-close' })
    setOpen(false); setContext(null); setTour(null); setSpotlight(null); setStatus(''); setFlight(null)
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setPanelVisible(false), 300)
    window.setTimeout(() => returnFocusRef.current?.focus(), 300)
  }

  function openFromSprite(bounds: DOMRect) {
    if (open) return
    companionEvent({ type: 'chat-open' })
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    returnFocusRef.current = spriteLauncherRef.current
    setFlight({ from: bounds, to: null })
    setPanelVisible(true)
    setOpen(true)
    if (surpriseReminderTimer.current !== null) window.clearTimeout(surpriseReminderTimer.current)
    surpriseReminderTimer.current = window.setTimeout(() => {
      companionEvent({ type: 'surprise-reminder' })
      surpriseReminderTimer.current = null
    }, 3000)
  }

  useEffect(() => {
    if (!tour || tourPath !== path) return
    let cancelled = false
    let timer = 0
    let attempts = 0
    const locate = () => {
      if (cancelled) return
      const point = tour[tourIndex]
      const headings = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3'))
      const heading = headings.find((item) => normalizeMessage(item.innerText).includes(normalizeMessage(point)))
      if (heading) {
        heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })
        timer = window.setTimeout(() => {
          if (cancelled) return
          const rect = heading.getBoundingClientRect()
          setSpotlight(new DOMRect(rect.x - 8, rect.y - 8, rect.width + 16, rect.height + 16))
          setStatus(`Tour point ${tourIndex + 1} of ${tour.length}: ${point}`)
          timer = window.setTimeout(() => {
            if (cancelled) return
            if (tourIndex + 1 < tour.length) setTourIndex((i) => i + 1)
            else { setTour(null); setSpotlight(null); setStatus('') }
          }, 1700)
        }, 450)
      } else if (attempts++ < 12) timer = window.setTimeout(locate, 250)
      else { setTour(null); setSpotlight(null); setStatus('') }
    }
    locate()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [tour, tourIndex, tourPath, path])

  useEffect(() => {
    if (!spotlight) return
    const update = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3'))
      const point = tour?.[tourIndex]
      const heading = candidates.find((item) => normalizeMessage(item.innerText).includes(normalizeMessage(point ?? '')))
      if (heading) { const r = heading.getBoundingClientRect(); setSpotlight(new DOMRect(r.x - 8, r.y - 8, r.width + 16, r.height + 16)) }
    }
    window.addEventListener('resize', update); window.addEventListener('scroll', update, { passive: true })
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update) }
  }, [spotlight, tour, tourIndex])

  function navigate(intent: ChatIntent) {
    if (!intent.link) return
    const pathTarget = sectionPaths[intent.link.path.replace('/', '')] ?? intent.link.path
    const homePath = withBasePath('/')
    const section = pathTarget.replace(/^\/+/, '')
    const destination = `${homePath}#${section}`
    if (intent.tour?.length) {
      setTour(intent.tour); setTourIndex(0); setTourPath(path); setStatus(`Opening ${intent.link.label}…`)
    } else setStatus(`Opening ${intent.link.label}…`)
    window.history.pushState({}, '', destination)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }))
  }

  function submit(event?: FormEvent, suggested?: string) {
    event?.preventDefault()
    const value = (suggested ?? input).trim()
    if (!value || typing) return
    const user: Message = { id: messageId.current++, role: 'user', text: value }
    companionEvent({ type: 'typing' })
    setMessages((items) => [...items, user]); setInput(''); setTyping(true); setStatus('Guide is preparing a reply…')
    window.setTimeout(() => {
      const intent = matchIntent(value)
      const clearWords = normalizeMessage(value)
      const gibberish = clearWords.length < 2 || /^[^aeiouys]+$/i.test(clearWords.replace(/[^a-z]/g, '')) || /(.)\1{5,}/.test(clearWords)
      let reply: ChatIntent | null = intent
      const contextualTopics = intents.find((item) => item.id === context)?.followUps ?? []
      if (!reply && contextualTopics.includes('pricing') && ['pricing', 'price', 'cost', 'how much'].some((word) => clearWords === word || clearWords.startsWith(`${word} `))) reply = matchIntent('pricing')
      if (!reply && matchIntent(value)?.id === 'navigation') {
        const target = Object.keys(sectionPaths).find((name) => clearWords.includes(name))
        if (target) {
          const points: Record<string, string> = { about: 'Who am I', skills: 'technologies', projects: 'Built to Solve', experience: 'My Journey', contact: 'Let’s make' }
          reply = { id: 'navigation', category: 'navigation', priority: 5, reply: `I’ll open ${target}.`, link: { label: target[0].toUpperCase() + target.slice(1), path: sectionPaths[target] }, tour: [points[target] ?? target] }
        }
      }
      const answer = reply?.reply ?? (gibberish ? 'I’m not sure I understood that. Could you try a short question about the portfolio, such as projects, skills, experience, or contact?' : 'I couldn’t find that in the portfolio information I have. Try asking about projects, skills, experience, education, or contact options.')
      companionEvent({ type: 'reply', userText: value })
      const response: Message = { id: messageId.current++, role: 'assistant', text: answer, link: reply?.link }
      setMessages((items) => [...items, response]); setSuggestions(reply?.suggestions ?? ['Show me the projects', 'What skills are listed?', 'Open contact options'])
      if (reply?.category === 'work') setContext(reply.id)
      else if (reply?.category === 'social') { /* preserve context for a natural follow-up */ }
      else setContext(null)
      setTyping(false); setStatus('')
      if (reply?.link) navigate(reply)
    }, 2000)
  }

  const style = spotlight ? { left: spotlight.x, top: spotlight.y, width: spotlight.width, height: spotlight.height } : undefined
  return <>
    <GuideSprite buttonRef={spriteLauncherRef} onOpen={openFromSprite} isChatOpen={open} emotion={companion.emotion} message={companion.message} section={companion.section} characterAsset={companion.characterAsset} onEvent={companionEvent} />
    {flight && <span className={`guide-flight${flight.to ? ' is-moving' : ''}`} style={{ left: flight.from.left + (flight.from.width - 54) / 2, top: flight.from.top + (flight.from.height - 54) / 2, transform: flight.to ? `translate(${flight.to.x - (flight.from.left + (flight.from.width - 54) / 2)}px, ${flight.to.y - (flight.from.top + (flight.from.height - 54) / 2)}px) scale(.72)` : undefined }}><GuideSpriteArt emotion="excited" section={companion.section} assetId="excited" /></span>}
    {panelVisible && <section className={`guide-panel${open ? ' is-opening' : ' is-closing'}${flight ? ' is-flight' : ''}`} role="dialog" aria-modal="false" aria-labelledby="guide-title" aria-describedby="guide-description" aria-hidden={!open}>
      <header className="guide-header"><div className="guide-avatar"><GuideSpriteArt emotion="confident" section={companion.section} assetId="cool" /></div><div><h2 id="guide-title">Portfolio guide</h2><p id="guide-description">Local answers from this website</p></div><div className="guide-header-actions"><div className="guide-settings-wrap"><button type="button" className="guide-close guide-settings-button" aria-label="Guide settings" aria-expanded={settingsOpen} aria-controls="guide-settings" onClick={() => setSettingsOpen((value) => !value)}><Settings2 size={18} aria-hidden="true" /></button>{settingsOpen && <section className="guide-settings" id="guide-settings" aria-label="Guide settings"><label className="guide-switch-row" htmlFor="developer-option"><span>Developer option</span><input id="developer-option" type="checkbox" role="switch" checked={developerOption} onChange={(event) => { const checked = event.target.checked; setDeveloperOption(checked); if (checked) companionEvent({ type: 'pin-reminder' }); if (!checked) { setDeveloperPin(''); setAxisCursorEnabled(false); setClickEffectEnabled(false); setSwarmCursorEnabled(false); onSwarmCursorEnabledChange(false) } }} /></label>{developerOption && <div className="guide-password-wrap"><label id="developer-pin-label">Developer option PIN</label><div className="guide-pin-inputs" role="group" aria-labelledby="developer-pin-label" aria-describedby="developer-pin-hint">{Array.from({ length: 4 }, (_, index) => <input key={index} ref={(element) => { pinInputRefs.current[index] = element }} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete={index === 0 ? 'one-time-code' : 'off'} aria-label={`PIN digit ${index + 1} of 4`} value={developerPin[index] ?? ''} placeholder="•" onChange={(event) => updatePinDigit(index, event.target.value)} onKeyDown={(event) => handlePinKeyDown(index, event.key)} />)}</div><small className="guide-password-hint" id="developer-pin-hint">PIN: 2224</small><label className={`guide-switch-row guide-axis-switch${passwordValidated ? '' : ' is-disabled'}`} htmlFor="axis-cursor-option"><span>Axis cursor</span><input id="axis-cursor-option" type="checkbox" role="switch" checked={axisCursorEnabled && passwordValidated} disabled={!passwordValidated} onChange={(event) => setAxisCursorEnabled(event.target.checked)} /></label><label className={`guide-switch-row guide-axis-switch${passwordValidated ? '' : ' is-disabled'}`} htmlFor="click-effect-option"><span>Click effect</span><input id="click-effect-option" type="checkbox" role="switch" checked={clickEffectEnabled && passwordValidated} disabled={!passwordValidated} onChange={(event) => setClickEffectEnabled(event.target.checked)} /></label><div className={`guide-swarm-row${passwordValidated ? '' : ' is-disabled'}`}><span id="swarm-cursor-label">Swarm Cursor</span><button type="button" className="guide-swarm-navigate" aria-label="Close panels and highlight Swarm Cursor button" title="Go to Swarm Cursor button" disabled={!passwordValidated} onClick={navigateToSwarmButton}><Navigation2 size={15} aria-hidden="true" /></button><input className="guide-switch-input" id="swarm-cursor-option" type="checkbox" role="switch" aria-labelledby="swarm-cursor-label" checked={swarmCursorEnabled && passwordValidated} disabled={!passwordValidated} onChange={(event) => { const enabled = event.target.checked; setSwarmCursorEnabled(enabled); onSwarmCursorEnabledChange(enabled) }} /></div></div>}</section>}</div><button type="button" className="guide-close" aria-label="Close site guide" onClick={close}><X size={18} /></button></div></header>
      <div ref={logRef} className="guide-log" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
        {messages.map((message) => <div className={`guide-message guide-${message.role}`} key={message.id}><p>{message.text}</p>{message.link && <a href={withBasePath(message.link.path)} onClick={(event) => { event.preventDefault(); const target = (message.link?.path ?? '/').replace('/', ''); const tourPoints = target === 'contact' ? ['Let’s make'] : target === 'experience' ? ['My Journey', 'Education'] : target === 'about' ? ['Who am I'] : target === 'skills' ? ['technologies'] : ['Built to Solve']; navigate({ id: 'navigation', category: 'navigation', priority: 5, reply: '', link: message.link, tour: tourPoints }) }}>{message.link.label} →</a>}</div>)}
        {typing && <div className="guide-message guide-assistant guide-typing-message" role="status" aria-label="Guide is typing"><GuideSpriteArt emotion="listening" section={companion.section} assetId="typing" /></div>}
      </div>
      <div className="guide-suggestions" aria-label="Suggested questions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => submit(undefined, suggestion)}>{suggestion}</button>)}</div>
      <form className="guide-form" onSubmit={(event) => submit(event)}><label className="sr-only" htmlFor="guide-input">Ask a question about this portfolio</label><input id="guide-input" ref={inputRef} value={input} onChange={(event) => { if (!input.trim() && event.target.value.trim()) companionEvent({ type: 'typing' }); setInput(event.target.value) }} placeholder="Ask about this portfolio…" autoComplete="off" /><button type="submit" aria-label="Send message" disabled={!input.trim() || typing}><Send size={17} aria-hidden="true" /></button></form>
      <div className="sr-only" role="status" aria-live="polite">{status}</div>
    </section>}
    {spotlight && <div className="guide-spotlight" style={style} aria-hidden="true" />}
    <AxisCursor enabled={developerOption && passwordValidated && axisCursorEnabled} />
    <ClickEffect enabled={developerOption && passwordValidated && clickEffectEnabled} />
  </>
}
