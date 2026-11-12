import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { BotEmotion, BotSection } from './useCompanion'
import { companionAssets, preloadCompanionAssets, type CompanionAssetId } from './companionAssets'

type Gaze = { x: number; y: number }

export default function GuideSpriteArt({
  gaze = { x: 0, y: 0 }, emotion = 'relaxed', section = 'hero', assetId = 'default',
}: {
  gaze?: Gaze
  emotion?: BotEmotion
  section?: BotSection
  assetId?: CompanionAssetId
}) {
  const [outgoingId, setOutgoingId] = useState<CompanionAssetId | null>(null)
  const [crossfading, setCrossfading] = useState(false)
  const currentId = useRef(assetId)
  const next = companionAssets[assetId]

  useEffect(() => { preloadCompanionAssets() }, [])

  useLayoutEffect(() => {
    if (currentId.current === assetId) return
    const previous = currentId.current
    currentId.current = assetId
    setOutgoingId(previous)
    setCrossfading(true)
    const frame = window.requestAnimationFrame(() => setCrossfading(false))
    const timer = window.setTimeout(() => setOutgoingId((current) => current === previous ? null : current), next.transitionMs)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer) }
  }, [assetId, next.transitionMs])

  const portraitStyle = {
    '--portrait-transition': `${next.transitionMs}ms`,
    '--gaze-x': `${gaze.x * 0.16}px`,
    '--gaze-y': `${gaze.y * 0.16}px`,
    '--gaze-rotate': `${Math.max(-3, Math.min(3, gaze.x * 0.24))}deg`,
  } as CSSProperties

  return <span className={`guide-sprite-float is-${emotion} section-${section}`} aria-hidden="true">
    <span className="guide-sprite-capsule">
      <span className="guide-sprite-character">
        <span className={`guide-character-frame is-animation-${next.animation}`} style={portraitStyle}>
          {outgoingId && <img className={`guide-character-image is-outgoing${crossfading ? ' is-visible' : ''}`} src={companionAssets[outgoingId].src} alt="" draggable="false" />}
          <img
            key={assetId}
            className={`guide-character-image${crossfading ? ' is-entering' : ' is-active'}`}
            src={next.src}
            alt=""
            draggable="false"
            data-companion-asset={assetId}
          />
        </span>
      </span>
    </span>
  </span>
}
