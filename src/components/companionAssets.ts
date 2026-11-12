export type CompanionAssetId =
  | 'default' | 'neutral' | 'happy' | 'excited' | 'curious' | 'surprised'
  | 'confused' | 'annoyed' | 'angry' | 'blush' | 'sad' | 'shy' | 'sleepy' | 'dizzy'
  | 'calling' | 'cool' | 'graduated' | 'lovely' | 'suit' | 'thinking-pose'
  | 'thumbs-up' | 'topper' | 'typing' | 'victory'

type CompanionAnimation =
  | 'idle' | 'happy' | 'excited' | 'curious' | 'surprised' | 'confused'
  | 'annoyed' | 'angry' | 'blush' | 'sad' | 'shy' | 'sleepy' | 'dizzy'
  | 'calling' | 'cool' | 'graduated' | 'lovely' | 'suit' | 'thinking'
  | 'thumbs-up' | 'topper' | 'typing' | 'victory'

type CompanionAsset = {
  src: string
  category: 'default' | 'expression' | 'pose'
  animation: CompanionAnimation
  transitionMs: number
  autoReturnToIdle: boolean
}

const image = (path: string) => `${import.meta.env.BASE_URL}images/companion/processed/${path}.png`

// The supplied PNGs are retained in public/images/companion; processed copies
// only remove their opaque near-white background so they work over the site.
export const companionAssets: Record<CompanionAssetId, CompanionAsset> = {
  default: { src: image('idle/default'), category: 'default', animation: 'idle', transitionMs: 260, autoReturnToIdle: false },
  neutral: { src: image('expression/neutral'), category: 'expression', animation: 'idle', transitionMs: 240, autoReturnToIdle: true },
  happy: { src: image('expression/happy'), category: 'expression', animation: 'happy', transitionMs: 220, autoReturnToIdle: true },
  excited: { src: image('expression/excited'), category: 'expression', animation: 'excited', transitionMs: 190, autoReturnToIdle: true },
  curious: { src: image('expression/curious'), category: 'expression', animation: 'curious', transitionMs: 240, autoReturnToIdle: true },
  surprised: { src: image('expression/surprised'), category: 'expression', animation: 'surprised', transitionMs: 170, autoReturnToIdle: true },
  confused: { src: image('expression/confused'), category: 'expression', animation: 'confused', transitionMs: 240, autoReturnToIdle: true },
  annoyed: { src: image('expression/annoyed'), category: 'expression', animation: 'annoyed', transitionMs: 220, autoReturnToIdle: true },
  angry: { src: image('expression/angry'), category: 'expression', animation: 'angry', transitionMs: 180, autoReturnToIdle: true },
  blush: { src: image('expression/blush'), category: 'expression', animation: 'blush', transitionMs: 300, autoReturnToIdle: true },
  sad: { src: image('expression/sad'), category: 'expression', animation: 'sad', transitionMs: 320, autoReturnToIdle: true },
  shy: { src: image('expression/shy'), category: 'expression', animation: 'shy', transitionMs: 300, autoReturnToIdle: true },
  sleepy: { src: image('expression/sleepy'), category: 'expression', animation: 'sleepy', transitionMs: 340, autoReturnToIdle: true },
  dizzy: { src: image('expression/dizzy'), category: 'expression', animation: 'dizzy', transitionMs: 170, autoReturnToIdle: true },
  calling: { src: image('poses/calling'), category: 'pose', animation: 'calling', transitionMs: 260, autoReturnToIdle: true },
  cool: { src: image('poses/cool'), category: 'pose', animation: 'cool', transitionMs: 260, autoReturnToIdle: true },
  graduated: { src: image('poses/graduated'), category: 'pose', animation: 'graduated', transitionMs: 300, autoReturnToIdle: true },
  lovely: { src: image('poses/lovely'), category: 'pose', animation: 'lovely', transitionMs: 300, autoReturnToIdle: true },
  suit: { src: image('poses/suit'), category: 'pose', animation: 'suit', transitionMs: 260, autoReturnToIdle: true },
  'thinking-pose': { src: image('poses/thinking'), category: 'pose', animation: 'thinking', transitionMs: 250, autoReturnToIdle: true },
  'thumbs-up': { src: image('poses/thumbs_up'), category: 'pose', animation: 'thumbs-up', transitionMs: 220, autoReturnToIdle: true },
  topper: { src: image('poses/topper'), category: 'pose', animation: 'topper', transitionMs: 260, autoReturnToIdle: true },
  typing: { src: image('poses/typing'), category: 'pose', animation: 'typing', transitionMs: 240, autoReturnToIdle: true },
  victory: { src: image('poses/victory'), category: 'pose', animation: 'victory', transitionMs: 190, autoReturnToIdle: true },
}

export const sectionCharacter: Record<string, CompanionAssetId> = {
  hero: 'default', overview: 'suit', about: 'suit', projects: 'cool', skills: 'topper',
  experience: 'suit', education: 'graduated', contact: 'calling', footer: 'neutral',
}

const emotionCharacter: Record<string, CompanionAssetId> = {
  idle: 'neutral', relaxed: 'neutral', happy: 'happy', excited: 'excited', curious: 'curious',
  thinking: 'thinking-pose', surprised: 'surprised', sad: 'sad', sleepy: 'sleepy',
  playful: 'blush', confident: 'cool', annoyed: 'annoyed', angry: 'angry', dizzy: 'dizzy',
  'extremely-dizzy': 'dizzy', listening: 'typing', speaking: 'happy',
}

export function assetForEmotion(emotion: string): CompanionAssetId {
  return emotionCharacter[emotion] ?? 'neutral'
}

export function baseCharacterForSection(section: string): CompanionAssetId {
  return sectionCharacter[section] ?? 'default'
}

let preloaded = false

export function preloadCompanionAssets() {
  if (preloaded) return
  preloaded = true
  const frequent: CompanionAssetId[] = ['default', 'neutral', 'happy', 'excited', 'curious', 'surprised', 'thinking-pose', 'typing', 'sleepy', 'dizzy']
  frequent.forEach((id) => { const preload = new Image(); preload.src = companionAssets[id].src })
}
