import { useEffect, useState, type CSSProperties } from 'react'
import type { BotAccessory, BotEmotion, BotSection } from './useCompanion'
import professionalGlasses from '../../resource/glass-svgrepo-com.svg'
import projectGlasses from '../../resource/eye-glass-svgrepo-com.svg'
import educationSuit from '../../resource/costume-suit-tie-tuxedo-svgrepo-com.svg'
import educationCap from '../../resource/education-svgrepo-com.svg'

const accessoryImages: Partial<Record<BotAccessory, string>> = {
  'professional-glasses': professionalGlasses,
  'experience-glasses': projectGlasses,
  'project-sunglasses': projectGlasses,
  'hud-glasses': projectGlasses,
  'education-suit': educationSuit,
  'education-cap': educationCap,
}

export default function GuideSpriteArt({
  gaze = { x: 0, y: 0 }, emotion = 'relaxed', section = 'hero', accessories = [], color = '#2268ed', reactionColor = null,
}: {
  gaze?: { x: number; y: number }
  emotion?: BotEmotion
  section?: BotSection
  accessories?: BotAccessory[]
  color?: string
  reactionColor?: string | null
}) {
  const [blinking, setBlinking] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = 0
    let cancelled = false
    const scheduleBlink = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return
        setBlinking(true)
        timer = window.setTimeout(() => {
          if (cancelled) return
          setBlinking(false)
          if (Math.random() < .16) {
            timer = window.setTimeout(() => { setBlinking(true); timer = window.setTimeout(() => { setBlinking(false); scheduleBlink() }, 110) }, 150)
          } else scheduleBlink()
        }, 110)
      }, 2200 + Math.random() * 3800)
    }
    scheduleBlink()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])

  const eyeStyle = { '--eye-x': `${gaze.x * .14}px`, '--eye-y': `${gaze.y * .2}px` } as CSSProperties
  const pupilStyle = { '--pupil-x': `${gaze.x * .55}px`, '--pupil-y': `${gaze.y * .8}px` } as CSSProperties
  const artStyle = { '--sprite-base': color, '--sprite-reaction': reactionColor ?? color } as CSSProperties

  return <span className={`guide-sprite-float is-${emotion} section-${section}${blinking ? ' is-blinking' : ''}`} style={artStyle} aria-hidden="true">
    <span className="guide-sprite-capsule">
      <span className="guide-sprite-character">
        <img className={`guide-sprite-suit${accessories.includes('education-suit') ? ' is-active' : ''}`} src={accessoryImages['education-suit']} alt="" />
        <span className="guide-sprite-body">
          <i className="guide-sprite-eye" style={eyeStyle}><b className="guide-sprite-pupil" style={pupilStyle} /></i>
          <i className="guide-sprite-eye" style={eyeStyle}><b className="guide-sprite-pupil" style={pupilStyle} /></i>
          <i className="guide-sprite-mouth" />
        </span>
        {(Object.keys(accessoryImages) as BotAccessory[]).filter((item) => item !== 'education-suit').map((item) => <span key={item} className={`guide-sprite-accessory is-${item}${accessories.includes(item) ? ' is-active' : ''}`}>
          <img src={accessoryImages[item]} alt="" />
        </span>)}
      </span>
    </span>
  </span>
}
