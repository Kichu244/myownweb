import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import GuideSpriteArt from './GuideSpriteArt'
import type { BotEmotion, BotSection, CollisionCategory, CompanionEvent } from './useCompanion'
import type { CompanionAssetId } from './companionAssets'

type Point = { x: number; y: number }
type DragTier = 'slow' | 'normal' | 'fast' | 'very-fast' | 'extreme'
type CollisionRegion = { id: string; category: CollisionCategory; rect: DOMRect }
type MotionPoint = { x: number; y: number; at: number }
type DragState = {
  pointerId: number; startX: number; startY: number; lastX: number; lastY: number; lastAt: number; startAt: number
  left: number; top: number; x: number; y: number; moved: boolean; tier: DragTier | null; maxTier: DragTier | null
  velocityX: number; velocityY: number; speed: number; maxSpeed: number; samples: number
  directionX: number; directionY: number; reversals: number[]; collision: string | null
  points: MotionPoint[]; spinTurns: number; spinStage: number; shakeStage: number; gesture: 'spin' | 'shake' | null
}

const DRAG_START_DISTANCE = 4
const MIN_VELOCITY_SAMPLE_MS = 8
const COLLISION_REFRESH_MS = 160
// Approximate pointer speed bands in CSS pixels/second. EWMA smoothing and
// hysteresis below keep normal pointer jitter from changing expressions.
const VELOCITY_LIMITS = [260, 720, 1150, 1750]
const COLLISION_RULES: { selector: string; category: CollisionCategory }[] = [
  { selector: 'main [data-swarm="card"], main [data-swarm="text"], main .career-entry, main .cinematic-card, main .contact-interface', category: 'content' },
  { selector: 'main [data-swarm="button"], main a[href], main button', category: 'interactive' },
  { selector: 'main [data-swarm="image"]', category: 'visual' },
]

function classifyVelocity(speed: number, current: DragTier | null): DragTier {
  const tiers: DragTier[] = ['slow', 'normal', 'fast', 'very-fast', 'extreme']
  if (!current) return tiers[VELOCITY_LIMITS.findIndex((limit) => speed <= limit) < 0 ? tiers.length - 1 : VELOCITY_LIMITS.findIndex((limit) => speed <= limit)]
  let index = tiers.indexOf(current)
  while (index < tiers.length - 1 && speed > VELOCITY_LIMITS[index] + 90) index++
  while (index > 0 && speed < VELOCITY_LIMITS[index - 1] - 90) index--
  return tiers[index]
}

function measureCircularMotion(points: MotionPoint[]) {
  if (points.length < 9) return { turns: 0, consistent: false }
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  if (width < 30 || height < 30 || Math.min(width, height) / Math.max(width, height) < .55) return { turns: 0, consistent: false }
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2
  const angles = points.map((point) => Math.atan2(point.y - centerY, point.x - centerX))
  const radii = points.map((point) => Math.hypot(point.x - centerX, point.y - centerY))
  let signed = 0
  let absolute = 0
  for (let index = 1; index < angles.length; index++) {
    let delta = angles[index] - angles[index - 1]
    if (delta > Math.PI) delta -= Math.PI * 2
    if (delta < -Math.PI) delta += Math.PI * 2
    if (Math.abs(delta) < .035 || Math.abs(delta) > 1.25) continue
    signed += delta
    absolute += Math.abs(delta)
  }
  const mean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length
  const variance = radii.reduce((sum, radius) => sum + (radius - mean) ** 2, 0) / radii.length
  const consistent = absolute > Math.PI * 1.35 && Math.abs(signed) / absolute > .72 && mean > 15 && Math.sqrt(variance) / mean < .52
  return { turns: consistent ? Math.abs(signed) / (Math.PI * 2) : 0, consistent }
}

function collisionRegions(): CollisionRegion[] {
  const found = new Map<HTMLElement, CollisionCategory>()
  COLLISION_RULES.forEach(({ selector, category }) => document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    if (!element.matches('[data-swarm-exempt]') && !element.closest('.guide-panel,.guide-sprite-launcher,[data-swarm-exempt]')) found.set(element, category)
  }))
  return Array.from(found).filter(([element]) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
    .map(([element, category], index) => ({
      id: element.id || element.getAttribute('aria-label') || `${element.className.toString().split(' ')[0]}-${index}`,
      category,
      rect: element.getBoundingClientRect(),
    })).filter(({ rect }) => rect.width > 0 && rect.height > 0)
}

function overlappingRegion(x: number, y: number, width: number, height: number, regions: CollisionRegion[]) {
  const area = width * height
  return regions.find(({ rect }) => {
    const overlapWidth = Math.max(0, Math.min(x + width, rect.right) - Math.max(x, rect.left))
    const overlapHeight = Math.max(0, Math.min(y + height, rect.bottom) - Math.max(y, rect.top))
    return (overlapWidth * overlapHeight) / area >= .18
  }) ?? null
}

export default function GuideSprite({ onOpen, buttonRef, isChatOpen, emotion, message, section, characterAsset, onEvent }: {
  onOpen: (bounds: DOMRect) => void
  buttonRef: RefObject<HTMLButtonElement | null>
  isChatOpen: boolean
  emotion: BotEmotion
  message: string
  section: BotSection
  characterAsset: CompanionAssetId
  onEvent: (event: CompanionEvent) => void
}) {
  const [position, setPosition] = useState<Point | null>(null)
  const [dragging, setDragging] = useState(false)
  const [settling, setSettling] = useState(false)
  const [gaze, setGaze] = useState<Point>({ x: 0, y: 0 })
  const [speechSide, setSpeechSide] = useState<'left' | 'right'>('left')
  const drag = useRef<DragState | null>(null)
  const returnTimer = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const clearSuppress = useRef<number | null>(null)
  const gazeIdleTimer = useRef<number | null>(null)
  const approachActive = useRef(false)
  const collisionCache = useRef<CollisionRegion[]>([])
  const lastCollisionScan = useRef(0)
  const moveFrame = useRef<number | null>(null)
  const pendingPosition = useRef<Point | null>(null)
  const inertiaFrame = useRef<number | null>(null)
  const settleTimer = useRef<number | null>(null)
  const gazeFrame = useRef<number | null>(null)
  const pendingGaze = useRef<Point>({ x: 0, y: 0 })
  const speechHeight = useRef(42)
  const clickHistory = useRef({ at: 0, count: 0 })

  const positionBesideChat = () => {
    const panel = document.querySelector<HTMLElement>('.guide-panel')
    const button = buttonRef.current
    if (!panel || !button) return null
    const panelBounds = panel.getBoundingClientRect()
    const textArea = panel.querySelector<HTMLElement>('.guide-log')?.getBoundingClientRect()
    const gap = 12
    let x = panelBounds.left - button.offsetWidth - gap
    let y = (textArea?.top ?? panelBounds.top + 100) + 14
    y = Math.max(8, Math.min(window.innerHeight - button.offsetHeight - 8, y))
    if (x < 8) {
      const abovePanel = panelBounds.top - button.offsetHeight - gap
      x = Math.max(8, Math.min(window.innerWidth - button.offsetWidth - 8, panelBounds.left + 8))
      if (abovePanel >= 8) y = abovePanel
    }
    return { x, y }
  }

  useLayoutEffect(() => {
    if (returnTimer.current !== null) { window.clearTimeout(returnTimer.current); returnTimer.current = null }
    if (!isChatOpen) { setPosition(null); return }
    const placeBesidePanel = () => {
      const target = positionBesideChat()
      if (target) setPosition(target)
    }
    placeBesidePanel()
    window.addEventListener('resize', placeBesidePanel)
    return () => window.removeEventListener('resize', placeBesidePanel)
  }, [isChatOpen, buttonRef])

  const placeSpeech = (left: number, top: number, width: number, height: number) => {
    const leftSpace = Math.max(0, left - 14)
    const rightSpace = Math.max(0, window.innerWidth - left - width - 14)
    const side = leftSpace >= 140 || leftSpace >= rightSpace ? 'left' : 'right'
    const available = Math.max(88, Math.min(250, side === 'left' ? leftSpace : rightSpace))
    setSpeechSide((current) => current === side ? current : side)
    const bubble = buttonRef.current?.querySelector<HTMLElement>('.guide-sprite-speech')
    if (bubble) {
      bubble.style.maxWidth = `${available}px`
      const halfHeight = (speechHeight.current || bubble.offsetHeight || 42) / 2
      const center = top + height / 2
      const clamped = Math.max(halfHeight + 8, Math.min(window.innerHeight - halfHeight - 8, center))
      bubble.style.setProperty('--speech-shift-y', `${clamped - center}px`)
    }
  }

  useEffect(() => {
    if (!message) return
    const placeCurrentSpeech = () => {
      const bounds = buttonRef.current?.getBoundingClientRect()
      if (bounds) placeSpeech(bounds.left, bounds.top, bounds.width, bounds.height)
    }
    placeCurrentSpeech()
    window.addEventListener('resize', placeCurrentSpeech)
    const bubble = buttonRef.current?.querySelector<HTMLElement>('.guide-sprite-speech')
    const observer = bubble && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      if (bubble) speechHeight.current = bubble.getBoundingClientRect().height
      placeCurrentSpeech()
    }) : null
    if (bubble) speechHeight.current = bubble.getBoundingClientRect().height
    if (bubble && observer) observer.observe(bubble)
    return () => { window.removeEventListener('resize', placeCurrentSpeech); observer?.disconnect() }
  }, [message, position, buttonRef])

  useEffect(() => {
    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || drag.current) return
      const face = buttonRef.current?.querySelector<HTMLElement>('.guide-character-frame')
      const bounds = face?.getBoundingClientRect()
      if (!bounds) return
      const dx = event.clientX - (bounds.left + bounds.width / 2)
      const dy = event.clientY - (bounds.top + bounds.height / 2)
      const distance = Math.hypot(dx, dy)
      const strength = Math.min(1, distance / (bounds.width * 1.5))
      pendingGaze.current = distance ? { x: dx / distance * 2.5 * strength, y: dy / distance * 2.5 * strength } : { x: 0, y: 0 }
      if (gazeFrame.current === null) gazeFrame.current = window.requestAnimationFrame(() => { gazeFrame.current = null; setGaze(pendingGaze.current) })
      if (!approachActive.current && distance < bounds.width * 2.8 && !isChatOpen) { approachActive.current = true; onEvent({ type: 'approach' }) }
      else if (approachActive.current && distance > bounds.width * 4) approachActive.current = false
      if (gazeIdleTimer.current !== null) window.clearTimeout(gazeIdleTimer.current)
      gazeIdleTimer.current = window.setTimeout(() => {
        if (gazeFrame.current !== null) { window.cancelAnimationFrame(gazeFrame.current); gazeFrame.current = null }
        pendingGaze.current = { x: 0, y: 0 }
        setGaze({ x: 0, y: 0 })
      }, 1000)
    }
    window.addEventListener('pointermove', trackPointer, { passive: true })
    return () => window.removeEventListener('pointermove', trackPointer)
  }, [buttonRef, isChatOpen, onEvent])

  useEffect(() => () => {
    if (returnTimer.current !== null) window.clearTimeout(returnTimer.current)
    if (clearSuppress.current !== null) window.clearTimeout(clearSuppress.current)
    if (gazeIdleTimer.current !== null) window.clearTimeout(gazeIdleTimer.current)
    if (moveFrame.current !== null) window.cancelAnimationFrame(moveFrame.current)
    if (inertiaFrame.current !== null) window.cancelAnimationFrame(inertiaFrame.current)
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    if (gazeFrame.current !== null) window.cancelAnimationFrame(gazeFrame.current)
  }, [])

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || drag.current) return
    if (returnTimer.current !== null) window.clearTimeout(returnTimer.current)
    if (inertiaFrame.current !== null) window.cancelAnimationFrame(inertiaFrame.current)
    const bounds = event.currentTarget.getBoundingClientRect()
    drag.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY,
      lastAt: performance.now(), startAt: performance.now(), left: bounds.left, top: bounds.top, x: bounds.left, y: bounds.top,
      moved: false, tier: null, maxTier: null, velocityX: 0, velocityY: 0, speed: 0, maxSpeed: 0, samples: 0,
      directionX: 0, directionY: 0, reversals: [], collision: null, points: [], spinTurns: 0, spinStage: 0, shakeStage: 0, gesture: null,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    const totalX = event.clientX - active.startX
    const totalY = event.clientY - active.startY
    if (!active.moved && Math.hypot(totalX, totalY) < DRAG_START_DISTANCE) return
    if (!active.moved) {
      active.moved = true
      setDragging(true)
      setPosition({ x: active.left, y: active.top })
      event.currentTarget.style.left = `${active.left}px`
      event.currentTarget.style.top = `${active.top}px`
      collisionCache.current = collisionRegions()
      lastCollisionScan.current = performance.now()
      onEvent({ type: 'drag-start' })
    }

    const now = performance.now()
    const elapsed = Math.max(MIN_VELOCITY_SAMPLE_MS, now - active.lastAt)
    const deltaX = event.clientX - active.lastX
    const deltaY = event.clientY - active.lastY
    const distance = Math.hypot(deltaX, deltaY)
    if (distance >= 2) {
      const instantX = deltaX / elapsed * 1000
      const instantY = deltaY / elapsed * 1000
      active.velocityX = active.samples ? active.velocityX * .62 + instantX * .38 : instantX * .35
      active.velocityY = active.samples ? active.velocityY * .62 + instantY * .38 : instantY * .35
      active.speed = Math.hypot(active.velocityX, active.velocityY)
      active.samples++
      active.maxSpeed = Math.max(active.maxSpeed, active.speed)
      const maxTier = classifyVelocity(active.maxSpeed, null)
      const tierOrder = ['slow', 'normal', 'fast', 'very-fast', 'extreme']
      if (!active.maxTier || tierOrder.indexOf(maxTier) > tierOrder.indexOf(active.maxTier)) active.maxTier = maxTier
      const directionX = deltaX / distance
      const directionY = deltaY / distance
      if (active.directionX * directionX + active.directionY * directionY < -.55 && distance > 8) {
        active.reversals = active.reversals.filter((time) => now - time <= 1000)
        active.reversals.push(now)
      }
      active.directionX = directionX
      active.directionY = directionY
      active.points.push({ x: active.left + totalX, y: active.top + totalY, at: now })
      // Keep only a bounded path for the active drag so slow circles still
      // accumulate enough arc to be recognised without storing a long trail.
      active.points = active.points.slice(-256)
      const circular = measureCircularMotion(active.points)
      active.spinTurns = Math.max(active.spinTurns, circular.turns)
      const spinStage = active.spinTurns >= 2.2 ? 3 : active.spinTurns >= 1.2 ? 2 : active.spinTurns >= .72 ? 1 : 0
      if (spinStage > active.spinStage) {
        active.spinStage = spinStage
        active.gesture = 'spin'
        onEvent({ type: 'spin-stage', stage: spinStage as 1 | 2 | 3 })
      }
      const trajectoryLooksCircular = circular.consistent && circular.turns >= .35
      const shakeCount = active.reversals.length
      const shakeStage = shakeCount >= 8 ? 3 : shakeCount >= 5 ? 2 : shakeCount >= 2 ? 1 : 0
      if (!trajectoryLooksCircular && spinStage === 0 && shakeStage > active.shakeStage) {
        active.shakeStage = shakeStage
        active.gesture = 'shake'
        onEvent({ type: 'shake-stage', stage: shakeStage as 1 | 2 | 3 })
      }
      if (active.samples >= 2 && now - active.startAt >= 35) {
        const tier = classifyVelocity(active.speed, active.tier)
        if (tier !== active.tier) { active.tier = tier; if (active.spinStage === 0 && active.shakeStage === 0) onEvent({ type: 'drag-tier', tier }) }
      }
      event.currentTarget.style.setProperty('--drag-tilt', `${Math.max(-8, Math.min(8, active.velocityX / 130))}deg`)
    }
    active.lastX = event.clientX
    active.lastY = event.clientY
    active.lastAt = now
    const width = event.currentTarget.offsetWidth
    const height = event.currentTarget.offsetHeight
    active.x = Math.max(0, Math.min(window.innerWidth - width, active.left + totalX))
    active.y = Math.max(0, Math.min(window.innerHeight - height, active.top + totalY))
    if (message) placeSpeech(active.x, active.y, width, height)
    pendingPosition.current = { x: active.x, y: active.y }
    if (moveFrame.current === null) moveFrame.current = window.requestAnimationFrame(() => {
      moveFrame.current = null
      const point = pendingPosition.current
      if (point && buttonRef.current) { buttonRef.current.style.left = `${point.x}px`; buttonRef.current.style.top = `${point.y}px` }
    })

    if (now - lastCollisionScan.current >= COLLISION_REFRESH_MS) {
      collisionCache.current = collisionRegions()
      lastCollisionScan.current = now
    }
    const hit = overlappingRegion(active.x, active.y, width, height, collisionCache.current)
    if ((hit?.id ?? null) !== active.collision) {
      active.collision = hit?.id ?? null
      if (hit) onEvent({ type: 'collision', target: hit.id, category: hit.category })
      else onEvent({ type: 'collision-exit', tier: active.tier })
    }
  }

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!active.moved) return
    const releasePoint = pendingPosition.current ?? { x: active.x, y: active.y }
    setPosition(releasePoint)
    setDragging(false)
    setSettling(true)
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => { setSettling(false); settleTimer.current = null }, 620)
    event.currentTarget.style.setProperty('--drag-tilt', '0deg')
    suppressClick.current = true
    if (clearSuppress.current !== null) window.clearTimeout(clearSuppress.current)
    clearSuppress.current = window.setTimeout(() => { suppressClick.current = false }, 350)
    if (moveFrame.current !== null) { window.cancelAnimationFrame(moveFrame.current); moveFrame.current = null }
    if (pendingPosition.current && buttonRef.current) {
      buttonRef.current.style.left = `${pendingPosition.current.x}px`
      buttonRef.current.style.top = `${pendingPosition.current.y}px`
    }
    onEvent({ type: 'drag-release', tier: active.maxTier, gesture: active.gesture, collided: !!active.collision })
    if (!active.collision && !cancelled && active.maxSpeed > 180) startInertia(active.velocityX, active.velocityY)
    else returnToHome()
  }

  function startInertia(velocityX: number, velocityY: number) {
    const started = performance.now()
    let previous = started
    let vx = velocityX
    let vy = velocityY
    const tick = (time: number) => {
      const button = buttonRef.current
      if (!button) return
      const delta = Math.min(32, time - previous)
      previous = time
      const left = Number.parseFloat(button.style.left) || 0
      const top = Number.parseFloat(button.style.top) || 0
      const x = Math.max(0, Math.min(window.innerWidth - button.offsetWidth, left + vx * delta / 1000))
      const y = Math.max(0, Math.min(window.innerHeight - button.offsetHeight, top + vy * delta / 1000))
      button.style.left = `${x}px`
      button.style.top = `${y}px`
      if (message) placeSpeech(x, y, button.offsetWidth, button.offsetHeight)
      const friction = Math.exp(-5.5 * delta / 1000)
      vx *= friction; vy *= friction
      if (time - started < 480 && Math.hypot(vx, vy) > 45) inertiaFrame.current = window.requestAnimationFrame(tick)
      else { inertiaFrame.current = null; setPosition({ x, y }); returnToHome() }
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { returnToHome(); return }
    inertiaFrame.current = window.requestAnimationFrame(tick)
  }

  function returnToHome() {
    const button = buttonRef.current
    if (isChatOpen) {
      const target = positionBesideChat()
      if (target) setPosition(target)
      return
    }
    if (!button) { setPosition(null); return }
    const x = Math.max(10, window.innerWidth - button.offsetWidth - 24)
    const y = Math.max(10, window.innerHeight - button.offsetHeight - 24)
    setPosition({ x, y })
    if (returnTimer.current !== null) window.clearTimeout(returnTimer.current)
    returnTimer.current = window.setTimeout(() => {
      const target = isChatOpen ? positionBesideChat() : null
      setPosition(target)
      returnTimer.current = null
    }, 560)
  }

  const moveWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    const step = event.shiftKey ? 40 : 16
    const delta = { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 }
    setPosition({ x: Math.max(0, Math.min(window.innerWidth - bounds.width, bounds.left + delta.x)), y: Math.max(0, Math.min(window.innerHeight - bounds.height, bounds.top + delta.y)) })
    if (returnTimer.current !== null) window.clearTimeout(returnTimer.current)
    returnTimer.current = window.setTimeout(() => {
      setPosition(isChatOpen ? positionBesideChat() : null)
      returnTimer.current = null
    }, 560)
  }

  return <button
    ref={buttonRef}
    className={`guide-sprite-launcher${position ? ' is-positioned' : ''}${dragging ? ' is-dragging' : ''}${settling ? ' is-settling' : ''}${isChatOpen ? ' is-chat-open' : ''}`}
    style={position ? { left: position.x, top: position.y } : undefined}
    type="button"
    aria-label="Ask the site guide. Drag to move; it returns when released."
    aria-haspopup="dialog"
    aria-expanded={isChatOpen}
    onClick={(event) => {
      if (suppressClick.current) { suppressClick.current = false; return }
      const now = performance.now()
      clickHistory.current.count = now - clickHistory.current.at < 1600 ? clickHistory.current.count + 1 : 1
      clickHistory.current.at = now
      onEvent({ type: 'click', count: clickHistory.current.count })
      onOpen(event.currentTarget.getBoundingClientRect())
    }}
    onKeyDown={moveWithKeyboard}
    onPointerDown={startDrag}
    onPointerMove={moveDrag}
    onPointerUp={finishDrag}
    onPointerCancel={(event) => finishDrag(event, true)}
    onLostPointerCapture={(event) => finishDrag(event, true)}
  >
    <GuideSpriteArt gaze={gaze} emotion={emotion} section={section} assetId={characterAsset} />
    <span key={message || 'quiet'} className={`guide-sprite-speech is-${speechSide}${message ? ' is-visible' : ''}`} role="status" aria-live="polite">{message}</span>
  </button>
}
