import { useCallback, useEffect, useRef, useState } from 'react'
import { assetForEmotion, baseCharacterForSection, type CompanionAssetId } from './companionAssets'

export type BotEmotion = 'idle' | 'happy' | 'excited' | 'curious' | 'thinking' | 'surprised' | 'sad' | 'sleepy' | 'playful' | 'confident' | 'annoyed' | 'dizzy' | 'extremely-dizzy' | 'listening' | 'speaking' | 'relaxed'
export type BotSection = 'hero' | 'overview' | 'about' | 'projects' | 'skills' | 'experience' | 'education' | 'contact' | 'footer'
export type BotAccessory = 'professional-glasses' | 'experience-glasses' | 'project-sunglasses' | 'hud-glasses' | 'education-suit' | 'education-cap'
export type CollisionCategory = 'content' | 'interactive' | 'visual'

export type CompanionEvent =
  | { type: 'welcome' | 'approach' | 'chat-open' | 'chat-close' | 'typing' | 'thinking' | 'idle' | 'surprise-reminder' | 'pin-reminder' }
  | { type: 'click'; count: number }
  | { type: 'background-click'; section?: string }
  | { type: 'section'; section: BotSection }
  | { type: 'reply'; userText: string }
  | { type: 'drag-start' }
  | { type: 'drag-tier'; tier: 'slow' | 'normal' | 'fast' | 'very-fast' | 'extreme' }
  | { type: 'spin-stage' | 'shake-stage'; stage: 1 | 2 | 3 }
  | { type: 'collision'; target: string; category: CollisionCategory }
  | { type: 'collision-exit'; tier: 'slow' | 'normal' | 'fast' | 'very-fast' | 'extreme' | null }
  | { type: 'drag-release'; tier: 'slow' | 'normal' | 'fast' | 'very-fast' | 'extreme' | null; gesture: 'spin' | 'shake' | null; collided: boolean }

export type CompanionState = {
  section: BotSection
  accessories: BotAccessory[]
  baseEmotion: BotEmotion
  baseColor: string
  conversation: 'idle' | 'listening' | 'thinking' | 'speaking'
  emotion: BotEmotion
  message: string
  priority: number
  reactionPriority: number
  reactionColor: string | null
  reactionKind: 'speed' | 'spin' | 'shake' | 'collision' | null
  characterAsset: CompanionAssetId
  id: number
}

type Reaction = { emotion: BotEmotion; message: string; priority: number; duration: number; color?: string }

export const sectionAppearance: Record<BotSection, { accessories: BotAccessory[]; emotion: BotEmotion; color: string; message: string }> = {
  hero: { accessories: [], emotion: 'happy', color: '#2268ed', message: 'Hey! Welcome to my portfolio! 👋' },
  overview: { accessories: ['professional-glasses'], emotion: 'confident', color: '#2859c7', message: 'Want a quick introduction? I can help.' },
  about: { accessories: ['professional-glasses'], emotion: 'confident', color: '#2859c7', message: 'Let me introduce you to my human!' },
  projects: { accessories: ['project-sunglasses'], emotion: 'confident', color: '#153fc1', message: 'Ready to see something cool? 😎' },
  skills: { accessories: ['hud-glasses'], emotion: 'thinking', color: '#087ac0', message: "Let's talk technology!" },
  experience: { accessories: ['experience-glasses'], emotion: 'confident', color: '#2268ed', message: "Let's explore some experience!" },
  education: { accessories: ['education-suit', 'education-cap'], emotion: 'curious', color: '#376dd7', message: 'Knowledge mode activated! 🎓' },
  contact: { accessories: [], emotion: 'happy', color: '#2268ed', message: "Let's get in touch! 👋" },
  footer: { accessories: [], emotion: 'relaxed', color: '#2268ed', message: "That's all for now! See you soon!" },
}

const sectionPrompts: Partial<Record<BotSection, string>> = {
  hero: sectionAppearance.hero.message,
  overview: sectionAppearance.overview.message,
  about: sectionAppearance.about.message,
  projects: sectionAppearance.projects.message,
  skills: sectionAppearance.skills.message,
  experience: sectionAppearance.experience.message,
  education: sectionAppearance.education.message,
  contact: sectionAppearance.contact.message,
  footer: sectionAppearance.footer.message,
}

function replyReaction(userText: string): Reaction {
  const text = userText.toLowerCase().replace(/[’‘]/g, "'")
  if (/\b(thanks|thank you|thx|appreciate it)\b/.test(text)) return { emotion: 'happy', message: "You're always welcome! 😊", priority: 7, duration: 2400, color: '#27c3d7' }
  if (/\b(bye|goodbye|see you|gotta go)\b/.test(text)) return { emotion: 'playful', message: 'See you soon! 👋', priority: 7, duration: 2400, color: '#bb68dc' }
  if (/\b(completed|finished|finally done|i did it|i made it|my project)\b/.test(text)) return { emotion: 'excited', message: "Yay! That's awesome! 🎉", priority: 7, duration: 2600, color: '#1678ff' }
  if (/\b(struggling|stuck|frustrated|difficult|hard time|confused)\b/.test(text)) return { emotion: 'sad', message: "I'm here to help. Let's figure it out together.", priority: 7, duration: 3000, color: '#6489bd' }
  if (/\b(you are awesome|you're awesome|you are great|you're great|love you)\b/.test(text)) return { emotion: 'playful', message: "Aww! You're making me blush! 😊", priority: 7, duration: 2600, color: '#bb68dc' }
  if (/\b(tell me a joke|make me laugh|joke)\b/.test(text)) return { emotion: 'playful', message: "I don't have a joke ready, but I can help you explore the portfolio!", priority: 7, duration: 3000, color: '#bb68dc' }
  if (/\b(wow|really|no way|surprising|unbelievable)\b/.test(text)) return { emotion: 'surprised', message: "Whoa! That's something!", priority: 7, duration: 2400, color: '#a8e8ff' }
  return { emotion: 'speaking', message: "Here's what I found!", priority: 6, duration: 2000, color: '#1678ff' }
}

function reactionFor(event: CompanionEvent): Reaction | null {
  switch (event.type) {
    case 'welcome': return { emotion: 'happy', message: 'Hey! Welcome! I can help you explore the portfolio. 👋', priority: 3, duration: 4200, color: '#27c3d7' }
    case 'approach': return { emotion: 'curious', message: 'Hey! Looking for me?', priority: 2, duration: 2200, color: '#20b9ba' }
    case 'click': return event.count >= 3
      ? { emotion: 'annoyed', message: 'Again? Again?!', priority: 4, duration: 1800, color: '#ef704d' }
      : { emotion: 'happy', message: event.count === 2 ? 'You called again!' : 'You called?', priority: 3, duration: 2000, color: '#bb68dc' }
    case 'chat-open': return { emotion: 'excited', message: "Hey! Let's talk!", priority: 5, duration: 2400, color: '#27c3d7' }
    case 'surprise-reminder': return { emotion: 'playful', message: 'Need Some Surprise! Click On the gear icon ⚙️!', priority: 8, duration: 4200, color: '#bb68dc' }
    case 'pin-reminder': return { emotion: 'happy', message: 'Hey!! Remember the PIN is 2224.', priority: 8, duration: 4200, color: '#27c3d7' }
    case 'chat-close': return { emotion: 'relaxed', message: '', priority: 1, duration: 800 }
    case 'typing': return { emotion: 'listening', message: "I'm listening!", priority: 5, duration: 2200, color: '#20b9ba' }
    case 'thinking': return { emotion: 'thinking', message: 'Hmm... Let me think.', priority: 6, duration: 8000, color: '#3153b9' }
    case 'reply': return replyReaction(event.userText)
    case 'drag-start': return { emotion: 'surprised', message: "Whoa! Where are we going?", priority: 8, duration: 1800, color: '#a8e8ff' }
    case 'drag-tier':
      if (event.tier === 'slow') return { emotion: 'curious', message: 'A gentle trip. Where to?', priority: 6, duration: 1800 }
      if (event.tier === 'normal') return { emotion: 'playful', message: 'Wheee, this is fun!', priority: 7, duration: 1800 }
      if (event.tier === 'fast') return { emotion: 'surprised', message: 'Whoa! Slow down!', priority: 8, duration: 1800, color: '#a8e8ff' }
      if (event.tier === 'very-fast') return { emotion: 'dizzy', message: "Hey! I'm getting dizzy!", priority: 9, duration: 2200, color: '#a45beb' }
      return { emotion: 'extremely-dizzy', message: 'That was way too fast! Give me a second to recover.', priority: 10, duration: 2600, color: '#a45beb' }
    case 'spin-stage':
      if (event.stage === 1) return { emotion: 'surprised', message: "Whoa! What's happening?", priority: 10, duration: 1900, color: '#a8e8ff' }
      if (event.stage === 2) return { emotion: 'dizzy', message: "Don't spin me like that! I'm getting dizzy!", priority: 11, duration: 2400, color: '#a45beb' }
      return { emotion: 'annoyed', message: 'Please stop spinning me!', priority: 12, duration: 2600, color: '#ef704d' }
    case 'shake-stage':
      if (event.stage === 1) return { emotion: 'surprised', message: 'Hey! What are you doing?', priority: 9, duration: 1700, color: '#a8e8ff' }
      if (event.stage === 2) return { emotion: 'dizzy', message: 'My head is spinning!', priority: 10, duration: 2200, color: '#a45beb' }
      return { emotion: 'annoyed', message: 'Stop shaking me!', priority: 11, duration: 2400, color: '#ef704d' }
    case 'collision': return { emotion: 'annoyed', message: "Hey! You're blocking the content!", priority: 10, duration: 2200, color: '#ef563f' }
    case 'collision-exit': return { emotion: 'relaxed', message: '', priority: 2, duration: 500 }
    case 'drag-release': {
      if (event.collided) return { emotion: 'annoyed', message: "Hey! You're covering something important!", priority: 10, duration: 2200, color: '#ef563f' }
      if (event.gesture === 'spin') return { emotion: 'dizzy', message: 'Give me a second to recover...', priority: 12, duration: 2600, color: '#a45beb' }
      if (event.gesture === 'shake') return { emotion: 'dizzy', message: 'Phew... let me steady myself.', priority: 11, duration: 2400, color: '#a45beb' }
      if (event.tier === 'extreme' || event.tier === 'very-fast') return { emotion: 'dizzy', message: 'Give me a second to recover...', priority: 10, duration: 2500, color: '#a45beb' }
      if (event.tier === 'fast') return { emotion: 'surprised', message: 'Phew! That was quick.', priority: 9, duration: 2100, color: '#a8e8ff' }
      return { emotion: 'relaxed', message: 'Thanks for the gentle ride.', priority: 8, duration: 1900, color: '#27c3d7' }
    }
    case 'section': {
      const message = sectionPrompts[event.section]
      return message ? { emotion: sectionAppearance[event.section].emotion, message, priority: 2, duration: 2600 } : null
    }
    case 'background-click': return { emotion: 'curious', message: 'Looking for something? I can help you explore the portfolio.', priority: 1, duration: 2400, color: '#20b9ba' }
    case 'idle': return { emotion: 'sleepy', message: 'Taking a little break...', priority: 0, duration: 3000 }
  }
}

function characterForEvent(event: CompanionEvent, emotion: BotEmotion, section: BotSection, returningAfterIdle = false): CompanionAssetId {
  if (returningAfterIdle) return 'excited'
  switch (event.type) {
    case 'welcome': case 'chat-open': return 'excited'
    case 'surprise-reminder': return 'cool'
    case 'pin-reminder': return 'thumbs-up'
    case 'chat-close': case 'collision-exit': return baseCharacterForSection(section)
    case 'approach': case 'background-click': return 'curious'
    case 'click': return event.count >= 3 ? 'angry' : 'happy'
    case 'typing': return 'typing'
    case 'thinking': return 'thinking-pose'
    case 'idle': return 'sleepy'
    case 'section': return baseCharacterForSection(event.section)
    case 'reply': {
      const text = event.userText.toLowerCase()
      if (/\b(completed|finished|finally done|i did it|i made it|my project|congrat)/.test(text)) return 'victory'
      if (/\b(love you|i love|you are awesome|you're awesome|you are great|you're great)/.test(text)) return 'lovely'
      if (/\b(cute|adorable|sweet|handsome)/.test(text)) return 'shy'
      if (/\b(thanks|thank you|appreciate)/.test(text)) return 'thumbs-up'
      if (/\b(compliment|blush|embarrassed|flattered)/.test(text)) return 'blush'
      if (/\b(stuck|struggling|frustrated|difficult|confused|unclear)/.test(text)) return 'confused'
      if (/\b(call|phone|contact)/.test(text)) return 'calling'
      if (/\b(project|work|cool)/.test(text)) return 'cool'
      if (/\b(education|graduate|degree|school)/.test(text)) return 'graduated'
      if (/\b(skill|study|learn|technology)/.test(text)) return 'topper'
      return assetForEmotion(emotion)
    }
    case 'drag-start': return 'surprised'
    case 'drag-tier':
      if (event.tier === 'slow') return 'curious'
      if (event.tier === 'normal') return 'happy'
      if (event.tier === 'fast') return 'surprised'
      return 'dizzy'
    case 'spin-stage': return event.stage >= 3 ? 'angry' : event.stage === 2 ? 'dizzy' : 'surprised'
    case 'shake-stage': return event.stage >= 3 ? 'angry' : event.stage === 2 ? 'dizzy' : 'surprised'
    case 'collision': return 'annoyed'
    case 'drag-release':
      if (event.collided) return 'annoyed'
      if (event.gesture || event.tier === 'very-fast' || event.tier === 'extreme') return 'dizzy'
      return event.tier === 'fast' ? 'surprised' : 'neutral'
  }
}

function restingCharacter(section: BotSection, conversation: CompanionState['conversation']): CompanionAssetId {
  if (conversation === 'thinking') return 'thinking-pose'
  if (conversation === 'listening') return 'typing'
  if (conversation === 'speaking') return 'happy'
  return baseCharacterForSection(section)
}

const initialState: CompanionState = {
  section: 'hero', accessories: [], baseEmotion: 'happy', baseColor: sectionAppearance.hero.color,
  conversation: 'idle', emotion: 'happy', message: '', priority: 0, reactionPriority: 0, reactionColor: null, reactionKind: null, characterAsset: 'default', id: 0,
}

export function useCompanion(isChatOpen: boolean) {
  const [state, setState] = useState(initialState)
  const stateRef = useRef(state)
  const messageTimer = useRef<number | null>(null)
  const messageToken = useRef(0)
  const sectionTimer = useRef<number | null>(null)
  const sectionToken = useRef(0)
  const reactionTimer = useRef<number | null>(null)
  const colorTimer = useRef<number | null>(null)
  const speakingTimer = useRef<number | null>(null)
  const eventId = useRef(0)
  const lastEventAt = useRef<Record<string, number>>({})
  const lastActivityAt = useRef(Date.now())
  const dragActive = useRef(false)
  const currentMessagePriority = useRef(0)
  const isChatOpenRef = useRef(isChatOpen)
  isChatOpenRef.current = isChatOpen

  const commit = useCallback((next: CompanionState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const dispatch = useCallback((event: CompanionEvent) => {
    const now = Date.now()
    const current = stateRef.current
    const returningAfterIdle = event.type === 'approach' && now - (lastEventAt.current.idle ?? 0) < 12_000
    const environmental = event.type === 'approach' || event.type === 'background-click' || event.type === 'idle'
    if (environmental && now - (lastEventAt.current[event.type] ?? 0) < 7000) return
    if (event.type === 'idle' && (isChatOpenRef.current || dragActive.current || now - lastActivityAt.current < 35_000)) return
    if (environmental) lastEventAt.current[event.type] = now

    if (event.type === 'section') {
      const appearance = sectionAppearance[event.section]
      const hasActiveReaction = Math.max(current.priority, current.reactionPriority) > 2
      const next: CompanionState = { ...current, section: event.section, accessories: appearance.accessories, baseEmotion: appearance.emotion, baseColor: appearance.color, emotion: hasActiveReaction ? current.emotion : appearance.emotion, characterAsset: hasActiveReaction ? current.characterAsset : baseCharacterForSection(event.section), id: ++eventId.current }
      const mayQueueSectionMessage = !isChatOpenRef.current && !dragActive.current && current.priority <= 2 && current.reactionPriority <= 2
      if (sectionTimer.current !== null) window.clearTimeout(sectionTimer.current)
      sectionToken.current++
      if (mayQueueSectionMessage) {
        if (messageTimer.current !== null) window.clearTimeout(messageTimer.current)
        messageTimer.current = null
        messageToken.current++
        currentMessagePriority.current = 0
        next.message = ''
        next.priority = 0
      }
      commit(next)
      if (mayQueueSectionMessage) {
        const sectionMessageToken = ++sectionToken.current
        sectionTimer.current = window.setTimeout(() => {
          const latest = stateRef.current
          if (sectionToken.current !== sectionMessageToken || latest.section !== event.section || isChatOpenRef.current || dragActive.current || latest.reactionPriority > 2 || latest.priority > 2) return
          const reaction = reactionFor(event)
          if (!reaction) return
          commit({ ...latest, emotion: reaction.emotion, characterAsset: baseCharacterForSection(event.section), message: reaction.message, priority: 2, reactionPriority: 0, reactionColor: null, id: ++eventId.current })
          currentMessagePriority.current = 2
          const messageId = ++messageToken.current
          messageTimer.current = window.setTimeout(() => {
            const active = stateRef.current
            if (messageToken.current !== messageId) return
            currentMessagePriority.current = 0
            commit({ ...active, message: '', priority: 0, reactionPriority: 0, emotion: active.conversation === 'idle' ? active.baseEmotion : active.conversation, characterAsset: restingCharacter(active.section, active.conversation), id: ++eventId.current })
            messageTimer.current = null
          }, 2600)
          sectionTimer.current = null
        }, 240)
      }
      return
    }

    if (event.type === 'drag-start') dragActive.current = true
    if (event.type === 'drag-release') dragActive.current = false
    if (event.type === 'collision-exit') {
      if (current.reactionKind === 'spin' || current.reactionKind === 'shake') return
      if (current.reactionKind === 'collision') {
        if (messageTimer.current !== null) window.clearTimeout(messageTimer.current)
        messageTimer.current = null
        messageToken.current++
        currentMessagePriority.current = 0
        const emotion: BotEmotion = event.tier === 'extreme' || event.tier === 'very-fast' ? 'dizzy' : event.tier === 'fast' ? 'surprised' : event.tier === 'normal' ? 'playful' : event.tier === 'slow' ? 'curious' : current.baseEmotion
        commit({ ...current, message: '', priority: 0, reactionPriority: event.tier ? 8 : 0, reactionKind: event.tier ? 'speed' : null, emotion, characterAsset: assetForEmotion(emotion), reactionColor: null, id: ++eventId.current })
      }
      return
    }
    if (event.type === 'chat-close') {
      if (messageTimer.current !== null) window.clearTimeout(messageTimer.current)
      if (speakingTimer.current !== null) window.clearTimeout(speakingTimer.current)
      messageToken.current++
      currentMessagePriority.current = 0
      const preserveReaction = current.reactionPriority >= 8
      commit({ ...current, conversation: 'idle', message: '', priority: 0, emotion: preserveReaction ? current.emotion : current.baseEmotion, characterAsset: preserveReaction ? current.characterAsset : baseCharacterForSection(current.section), reactionPriority: preserveReaction ? current.reactionPriority : 0, reactionColor: preserveReaction ? current.reactionColor : null, reactionKind: preserveReaction ? current.reactionKind : null, id: ++eventId.current })
      return
    }

    const reaction = returningAfterIdle
      ? { emotion: 'happy' as BotEmotion, message: "You're back!", priority: 4, duration: 2000, color: '#27c3d7' }
      : reactionFor(event)
    if (!reaction) return
    if (reaction.priority > 2 && sectionTimer.current !== null) {
      window.clearTimeout(sectionTimer.current)
      sectionTimer.current = null
      sectionToken.current++
    }
    const physical = event.type === 'drag-start' || event.type === 'drag-tier' || event.type === 'spin-stage' || event.type === 'shake-stage' || event.type === 'collision' || event.type === 'drag-release'
    const changingDragSpeed = event.type === 'drag-tier' && dragActive.current && current.reactionPriority < 10
    if (reaction.priority < Math.max(currentMessagePriority.current, current.reactionPriority) && event.type !== 'drag-release' && !changingDragSpeed) {
      if (event.type === 'typing') {
        if (speakingTimer.current !== null) window.clearTimeout(speakingTimer.current)
        commit({ ...current, conversation: 'listening', characterAsset: 'typing' })
      }
      if (event.type === 'thinking') {
        if (speakingTimer.current !== null) window.clearTimeout(speakingTimer.current)
        commit({ ...stateRef.current, conversation: 'thinking', characterAsset: 'thinking-pose' })
      }
      if (event.type === 'reply') {
        commit({ ...current, conversation: 'speaking', characterAsset: characterForEvent(event, current.emotion, current.section) })
        if (speakingTimer.current !== null) window.clearTimeout(speakingTimer.current)
        speakingTimer.current = window.setTimeout(() => {
          const latest = stateRef.current
          if (latest.conversation !== 'speaking') return
          commit({ ...latest, conversation: 'idle', emotion: latest.reactionPriority > 2 ? latest.emotion : latest.baseEmotion, characterAsset: latest.reactionPriority > 2 ? latest.characterAsset : baseCharacterForSection(latest.section), id: ++eventId.current })
          speakingTimer.current = null
        }, reaction.duration)
      }
      return
    }

    const conversation = event.type === 'typing' ? 'listening'
      : event.type === 'thinking' ? 'thinking'
        : event.type === 'reply' ? 'speaking'
          : current.conversation
    const next: CompanionState = {
      ...stateRef.current,
      conversation,
      emotion: reaction.emotion,
      message: reaction.message,
      priority: reaction.priority,
      reactionPriority: reaction.priority,
      reactionColor: reaction.color ?? null,
      characterAsset: characterForEvent(event, reaction.emotion, current.section, returningAfterIdle),
      reactionKind: event.type === 'spin-stage' || event.type === 'drag-release' && event.gesture === 'spin' ? 'spin'
        : event.type === 'shake-stage' || event.type === 'drag-release' && event.gesture === 'shake' ? 'shake'
          : event.type === 'collision' || event.type === 'drag-release' && event.collided ? 'collision'
            : event.type === 'drag-tier' || event.type === 'drag-release' ? 'speed' : stateRef.current.reactionKind,
      id: ++eventId.current,
    }
    commit(next)
    currentMessagePriority.current = reaction.message ? reaction.priority : 0

    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current)
    if (event.type === 'typing' || event.type === 'thinking' || event.type === 'reply') {
      if (speakingTimer.current !== null) window.clearTimeout(speakingTimer.current)
      speakingTimer.current = null
    }
    messageToken.current++
    const token = messageToken.current
    if (reaction.message) {
      messageTimer.current = window.setTimeout(() => {
        const latest = stateRef.current
        if (messageToken.current !== token) return
        currentMessagePriority.current = 0
        const keepPhysical = (physical && (dragActive.current || event.type === 'drag-release'))
        const conversation = latest.conversation === 'speaking' || latest.conversation === 'listening' ? 'idle' : latest.conversation
        commit({ ...latest, conversation, message: '', priority: 0, reactionPriority: keepPhysical ? latest.reactionPriority : 0, reactionKind: keepPhysical ? latest.reactionKind : null, emotion: keepPhysical ? latest.emotion : conversation === 'idle' ? latest.baseEmotion : conversation, characterAsset: keepPhysical ? latest.characterAsset : restingCharacter(latest.section, conversation), id: ++eventId.current })
        messageTimer.current = null
      }, reaction.duration)
    }

    if (physical) {
      if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
      if (colorTimer.current !== null) window.clearTimeout(colorTimer.current)
      if (event.type === 'drag-release') {
        reactionTimer.current = window.setTimeout(() => {
          const latest = stateRef.current
          commit({ ...latest, emotion: latest.conversation === 'idle' ? latest.baseEmotion : latest.conversation, characterAsset: restingCharacter(latest.section, latest.conversation), reactionPriority: 0, reactionColor: null, reactionKind: null, id: ++eventId.current })
          reactionTimer.current = null
        }, 3000)
      }
      if (reaction.color && event.type === 'drag-release') {
        colorTimer.current = window.setTimeout(() => {
          const latest = stateRef.current
          commit({ ...latest, reactionColor: null, id: ++eventId.current })
          colorTimer.current = null
        }, 3000)
      }
    } else if (reaction.color) {
      if (colorTimer.current !== null) window.clearTimeout(colorTimer.current)
      colorTimer.current = window.setTimeout(() => {
        const latest = stateRef.current
        commit({ ...latest, reactionColor: null, id: ++eventId.current })
        colorTimer.current = null
      }, reaction.duration)
    }
  }, [commit])

  useEffect(() => {
    const activity = () => { lastActivityAt.current = Date.now() }
    window.addEventListener('pointerdown', activity, { passive: true })
    window.addEventListener('pointermove', activity, { passive: true })
    window.addEventListener('keydown', activity)
    window.addEventListener('wheel', activity, { passive: true })
    let idleTimer = 0
    const scheduleIdle = () => { idleTimer = window.setTimeout(() => { dispatch({ type: 'idle' }); scheduleIdle() }, 45_000) }
    scheduleIdle()
    return () => {
      window.removeEventListener('pointerdown', activity)
      window.removeEventListener('pointermove', activity)
      window.removeEventListener('keydown', activity)
      window.removeEventListener('wheel', activity)
      window.clearTimeout(idleTimer)
    }
  }, [dispatch])

  useEffect(() => () => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current)
    if (sectionTimer.current !== null) window.clearTimeout(sectionTimer.current)
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
    if (colorTimer.current !== null) window.clearTimeout(colorTimer.current)
    if (speakingTimer.current !== null) window.clearTimeout(speakingTimer.current)
  }, [])

  return { companion: state, dispatch }
}
