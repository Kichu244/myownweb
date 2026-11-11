import type {
  BlueprintLayerKind,
  BlueprintLayerOperation,
  ComputedVisualProperties,
  SectionVisualBlueprint,
  SwarmTargetBounds,
  VisualBlueprintElement,
  VisualElementType,
} from './swarmTypes'
import { swarmSettings } from './swarmSettings'

export function restoreTypingText(span: HTMLElement) {
  const fullText = span.getAttribute('aria-label')
  if (!fullText || span.textContent === fullText) return

  const emphasis = span.dataset.emphasis
  const emphasisStart = emphasis ? fullText.indexOf(emphasis) : -1
  if (!emphasis || emphasisStart < 0) {
    span.textContent = fullText
    return
  }

  const emphasizedText = document.createElement('strong')
  emphasizedText.textContent = emphasis
  span.replaceChildren(
    document.createTextNode(fullText.slice(0, emphasisStart)),
    emphasizedText,
    document.createTextNode(fullText.slice(emphasisStart + emphasis.length)),
  )
}

const textTags = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'P',
  'LABEL',
  'SPAN',
  'STRONG',
  'EM',
  'SMALL',
  'CODE',
  'LI',
  'B',
  'I',
])

export class DOMSnapshotEngine {
  private elementIdMap = new WeakMap<Element, string>()
  private elementSequence = 0
  private layerSequence = 0

  /**
   * Resets sequences and maps when starting a fresh session.
   */
  reset() {
    this.elementIdMap = new WeakMap<Element, string>()
    this.elementSequence = 0
    this.layerSequence = 0
  }

  /**
   * Captures a structured visual blueprint for a given portfolio section.
   */
  captureSectionBlueprint(sectionElement: HTMLElement, sectionId: string): SectionVisualBlueprint {
    const sectionRect = sectionElement.getBoundingClientRect()
    const sectionBounds: SwarmTargetBounds = {
      left: sectionRect.left,
      top: sectionRect.top,
      width: Math.max(10, sectionRect.width),
      height: Math.max(10, sectionRect.height),
    }

    const elements = new Map<string, VisualBlueprintElement>()
    const rootElementIds: string[] = []
    const allLayers: BlueprintLayerOperation[] = []

    // 1. Create blueprint element for the section itself
    const sectionBlueprintId = this.getOrCreateElementId(sectionElement, `${sectionId}-root`)
    const sectionVisualProps = this.extractVisualProperties(sectionElement)
    const sectionElementBlueprint: VisualBlueprintElement = {
      id: sectionBlueprintId,
      parentId: null,
      sectionId,
      type: 'section',
      domNode: sectionElement,
      bounds: sectionBounds,
      visualProperties: sectionVisualProps,
      textContent: '',
      imageSource: null,
      childIds: [],
      layerOperations: [],
      eligibility: 'constructible',
      readiness: this.evaluateReadiness(sectionElement),
      status: 'pending',
      dependencies: [],
    }

    elements.set(sectionBlueprintId, sectionElementBlueprint)
    rootElementIds.push(sectionBlueprintId)

    // 2. Scan the section's DOM hierarchy for visual elements
    this.scanSubtree(sectionElement, sectionBlueprintId, sectionId, elements, allLayers)

    // Link parent-child dependencies across elements
    this.linkLayerDependencies(elements, allLayers)

    const isReady = Array.from(elements.values()).every((el) => el.readiness === 'ready')

    return {
      sectionId,
      label: sectionId.toUpperCase(),
      sectionElement,
      bounds: sectionBounds,
      elements,
      rootElementIds,
      layers: allLayers,
      phase: 'PENDING',
      isReady,
      isCompleted: false,
    }
  }

  async waitForVisualReadiness(sectionElement: HTMLElement) {
    const imageWaits = Array.from(sectionElement.querySelectorAll('img')).map((image) => this.waitForImage(image))
    await Promise.all(imageWaits)

    const finiteAnimations = sectionElement.getAnimations({ subtree: true }).filter((animation) => {
      const timing = animation.effect?.getComputedTiming()
      return timing !== undefined && timing.iterations !== Number.POSITIVE_INFINITY && animation.playState !== 'finished'
    })
    if (finiteAnimations.length > 0) {
      let timeoutId = 0
      await Promise.race([
        Promise.all(finiteAnimations.map((animation) => animation.finished.then(() => undefined, () => undefined))),
        new Promise<void>((resolve) => {
          timeoutId = window.setTimeout(resolve, 1800)
        }),
      ])
      window.clearTimeout(timeoutId)
    }

    await this.waitForTypingText(sectionElement)
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    })
  }

  private waitForTypingText(sectionElement: HTMLElement) {
    const spans = Array.from(sectionElement.querySelectorAll<HTMLElement>('.typing-text[aria-label]'))
    const isComplete = () => spans.every((span) => span.textContent === span.getAttribute('aria-label'))
    if (isComplete()) return Promise.resolve()

    return new Promise<void>((resolve) => {
      let timeoutId = 0
      const observer = new MutationObserver(() => {
        if (isComplete()) finish()
      })
      const finish = () => {
        observer.disconnect()
        window.clearTimeout(timeoutId)
        resolve()
      }

      observer.observe(sectionElement, { attributes: true, childList: true, characterData: true, subtree: true })
      timeoutId = window.setTimeout(finish, 10000)
      if (isComplete()) finish()
    })
  }

  private async waitForImage(image: HTMLImageElement) {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        let timeoutId = 0
        const finish = () => {
          window.clearTimeout(timeoutId)
          image.removeEventListener('load', finish)
          image.removeEventListener('error', finish)
          resolve()
        }

        timeoutId = window.setTimeout(finish, 3000)
        image.addEventListener('load', finish, { once: true })
        image.addEventListener('error', finish, { once: true })
        if (image.complete) finish()
      })
    }

    if (image.complete && image.naturalWidth > 0) {
      await image.decode().then(() => undefined, () => undefined)
    }
  }

  /**
   * Traverses DOM elements within a container, creating structured visual blueprint elements.
   */
  private scanSubtree(
    container: HTMLElement,
    parentBlueprintId: string,
    sectionId: string,
    elements: Map<string, VisualBlueprintElement>,
    allLayers: BlueprintLayerOperation[],
  ) {
    const parentBlueprint = elements.get(parentBlueprintId)

    // Discover candidates within this container
    const children = Array.from(container.children) as HTMLElement[]

    for (const child of children) {
      if (!this.isInspectable(child)) continue

      const type = this.detectElementType(child)
      if (type === null) {
        // Transparent structural wrapper: recurse into children keeping same parent
        this.scanSubtree(child, parentBlueprintId, sectionId, elements, allLayers)
        continue
      }

      const rect = child.getBoundingClientRect()
      const bounds: SwarmTargetBounds = {
        left: rect.left,
        top: rect.top,
        width: Math.max(2, rect.width),
        height: Math.max(2, rect.height),
      }

      const elementId = this.getOrCreateElementId(child, `${sectionId}-${type}`)
      const visualProps = this.extractVisualProperties(child)
      const textContent = this.extractFinalText(child)
      const imageSource = child instanceof HTMLImageElement ? child.src : child.querySelector('img')?.src ?? null

      const elementBlueprint: VisualBlueprintElement = {
        id: elementId,
        parentId: parentBlueprintId,
        sectionId,
        type,
        domNode: child,
        bounds,
        visualProperties: visualProps,
        textContent,
        imageSource,
        childIds: [],
        layerOperations: [],
        eligibility: 'constructible',
        readiness: this.evaluateReadiness(child),
        status: 'pending',
        dependencies: [],
      }

      // Decompose this visual element into construction layer operations
      const layers = this.decomposeElement(elementBlueprint)
      elementBlueprint.layerOperations = layers
      allLayers.push(...layers)

      elements.set(elementId, elementBlueprint)

      if (parentBlueprint) {
        parentBlueprint.childIds.push(elementId)
      }

      // If this element has nested visual children (like cards or panels), recurse
      if (type === 'card' || type === 'container' || type === 'button' || child.hasAttribute('data-swarm-container')) {
        this.scanSubtree(child, elementId, sectionId, elements, allLayers)
      }
    }
  }

  /**
   * Determines if a DOM element is eligible for inspection.
   * IMPORTANT: We NEVER exclude elements based on the presence of CSS animations,
   * transitions, Framer Motion, hover effects, transforms, or opacity changes.
   * We only exclude Swarm UI chrome and explicitly marked elements.
   */
  private isInspectable(element: HTMLElement): boolean {
    // Exclude Swarm Studio's own UI controls
    if (element.closest('.swarm-activate, .swarm-studio, .swarm-loader, .theme-toggle, .menu-toggle, .auto-scroll-toggle')) {
      return false
    }
    // Respect explicit opt-out
    if (element.hasAttribute('data-swarm-exempt') || element.closest('[data-swarm-exempt]')) {
      return false
    }
    // Skip closed dialogs (no visible content)
    if (element.tagName === 'DIALOG' && !(element as HTMLDialogElement).open) {
      return false
    }
    // Skip aria-hidden purely decorative subtrees (particles, canvas backdrops)
    if (element.hasAttribute('aria-hidden')) {
      const tag = element.tagName
      // Allow aria-hidden elements that contain real visual constructs (icons, images)
      if (tag !== 'svg' && !element.querySelector('img, svg')) {
        const cls = element.className || ''
        // Skip particle/atmosphere/grid decorations
        if (
          cls.includes('particles') ||
          cls.includes('atmosphere') ||
          cls.includes('hero-grid') ||
          cls.includes('hero-circuit') ||
          cls.includes('hero-particles') ||
          cls.includes('circuit-') ||
          cls.includes('-orbit') ||
          cls.includes('-node')
        ) {
          return false
        }
      }
    }
    return true
  }

  /**
   * Checks whether an element's visual content is reachable despite animations.
   * Framer Motion elements start at opacity:0, so we look through transform/opacity
   * to determine whether the element has actual visual content to construct.
   * Never exclude based on animation presence alone.
   */
  private hasConstructibleContent(element: HTMLElement): boolean {
    // Always include explicit data-swarm marked elements regardless of opacity
    if (element.dataset.swarm) return true

    // Elements with zero layout box and no forced size attribute can be skipped
    const rect = element.getBoundingClientRect()
    if (rect.width < 1 && rect.height < 1) {
      // Check inline dimensions or min-height that keep layout space
      const style = element.style
      if (!style.minHeight && !style.height && !style.width) {
        // Could be a Framer Motion element mid-animation; check CSS
        try {
          const comp = window.getComputedStyle(element)
          const hasMinHeight = comp.minHeight !== '0px' && comp.minHeight !== 'auto'
          if (!hasMinHeight) return false
        } catch {
          return false
        }
      }
    }
    return true
  }

  /**
   * Identifies the visual element type of a DOM element.
   */
  private detectElementType(element: HTMLElement): VisualElementType | null {
    const tag = element.tagName.toUpperCase()
    const marker = element.dataset.swarm

    // Explicit data-swarm markers
    if (marker === 'card') return 'card'
    if (marker === 'heading') return 'heading'
    if (marker === 'text') return 'text'
    if (marker === 'image') return 'image'
    if (marker === 'icon') return 'icon'
    if (marker === 'container') return 'container'
    if (marker === 'layout') return 'container'
    if (marker === 'style') return 'badge'

    // SVGs and Icons
    if (tag === 'SVG' || element.querySelector(':scope > svg:only-child')) {
      return 'icon'
    }

    // Images
    if (tag === 'IMG' || element.classList.contains('portrait-media') || element.classList.contains('identity-visual')) {
      return 'image'
    }

    // Buttons and Action links
    if (
      tag === 'BUTTON' ||
      element.classList.contains('button') ||
      element.classList.contains('contact-primary-action') ||
      element.classList.contains('contact-copy-action') ||
      element.classList.contains('skills-category') ||
      element.classList.contains('skills-tree-leaf')
    ) {
      return 'button'
    }

    // Cards and Components
    if (
      element.classList.contains('career-entry') ||
      element.classList.contains('home-overview-card') ||
      element.classList.contains('project-row') ||
      element.classList.contains('skills-tree-parent') ||
      element.classList.contains('hero-intro-card') ||
      element.classList.contains('glass-frosted') ||
      element.classList.contains('glass-crystal')
    ) {
      return 'card'
    }

    // Headings
    if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
      return 'heading'
    }

    // Text elements
    if (tag === 'P' || element.classList.contains('hero-description') || element.classList.contains('identity-conversation')) {
      return 'text'
    }

    // Badges, chips, tags
    if (
      element.classList.contains('hero-tech-tag') ||
      element.classList.contains('identity-focus-chip') ||
      element.classList.contains('hero-footnote') ||
      element.classList.contains('eyebrow') ||
      element.classList.contains('career-period') ||
      element.classList.contains('project-category')
    ) {
      return 'badge'
    }

    // Decorative dividers / lines
    if (element.classList.contains('footnote-line') || element.classList.contains('status-dot') || tag === 'HR') {
      return 'divider'
    }

    // If it has direct text content and no block children, treat as text
    if (textTags.has(tag) && element.childNodes.length > 0) {
      const hasDirectText = Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
      )
      if (hasDirectText) return 'text'
    }

    // Check computed styles for visible container properties
    try {
      const style = window.getComputedStyle(element)
      const hasBg = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent'
      const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none'
      if (hasBg || hasBorder) {
        return 'container'
      }
    } catch {
      // fallback
    }

    return null
  }

  /**
   * Extracts computed visual properties from a DOM element.
   */
  extractVisualProperties(element: Element): ComputedVisualProperties {
    try {
      const style = window.getComputedStyle(element)
      const backgroundColor = style.backgroundColor || 'transparent'
      const borderColor = style.borderColor || 'transparent'
      const borderWidth = style.borderWidth || '0px'
      const borderRadius = style.borderRadius || '0px'
      const borderStyle = style.borderStyle || 'none'
      const color = style.color || 'inherit'
      const fontFamily = style.fontFamily || 'inherit'
      const fontSize = style.fontSize || 'inherit'
      const fontWeight = style.fontWeight || 'normal'
      const lineHeight = style.lineHeight || 'normal'
      const letterSpacing = style.letterSpacing || 'normal'
      const textAlign = style.textAlign || 'left'
      const opacity = style.opacity || '1'
      const zIndex = style.zIndex || 'auto'
      const boxShadow = style.boxShadow || 'none'

      const hasBackground = backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent'
      const hasBorder = borderWidth !== '0px' && borderStyle !== 'none' && borderColor !== 'transparent'
      const hasShadow = boxShadow !== 'none'

      return {
        backgroundColor,
        borderColor,
        borderWidth,
        borderRadius,
        borderStyle,
        color,
        fontFamily,
        fontSize,
        fontWeight,
        lineHeight,
        letterSpacing,
        textAlign,
        opacity,
        zIndex,
        boxShadow,
        hasBackground,
        hasBorder,
        hasShadow,
      }
    } catch {
      return {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: '0px',
        borderRadius: '0px',
        borderStyle: 'none',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontWeight: 'normal',
        lineHeight: 'normal',
        letterSpacing: 'normal',
        textAlign: 'left',
        opacity: '1',
        zIndex: 'auto',
        boxShadow: 'none',
        hasBackground: false,
        hasBorder: false,
        hasShadow: false,
      }
    }
  }

  /**
   * Extracts the complete resting text content of an element, resolving TypingText instances.
   */
  private extractFinalText(element: HTMLElement): string {
    const typingSpan = element.querySelector('.typing-text') || (element.classList.contains('typing-text') ? element : null)
    if (typingSpan) {
      const fullText = typingSpan.getAttribute('aria-label')
      if (fullText && fullText.trim()) return fullText.trim()
    }

    const ariaLabel = element.getAttribute('aria-label')
    if (ariaLabel && ariaLabel.trim() && ariaLabel.length > (element.textContent?.length ?? 0)) {
      return ariaLabel.trim()
    }

    return element.textContent?.trim() || ''
  }

  /**
   * Evaluates the readiness state of an element before construction.
   *
   * CRITICAL: We NEVER exclude elements because:
   * - Their opacity is 0 (Framer Motion entrance animations start at opacity:0)
   * - They have CSS transitions or animations
   * - They have CSS transforms
   * - They contain hover effects
   *
   * We wait for entrance animations to settle, then capture the resting appearance.
   * Framer Motion elements are always treated as CONSTRUCTIBLE once they have bounds.
   */
  evaluateReadiness(element: Element, _registeredAt = performance.now()): 'ready' | 'waiting_render' | 'temporarily_interactive' {
    // Already marked as built
    if (element.getAttribute('data-swarm-built') === 'true') {
      return 'ready'
    }

    // Currently in a temporary hover/focus interaction state — do not capture
    if (element.matches?.(':hover, :active')) {
      return 'temporarily_interactive'
    }

    // Images: wait until the image asset has loaded
    if (element instanceof HTMLImageElement) {
      if (!element.complete || element.naturalWidth === 0) {
        return 'waiting_render'
      }
    }

    // Check layout bounds — but be lenient with Framer Motion elements which may
    // start with opacity:0 and transform:translateY(N) but DO have layout dimensions.
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      // No visible layout space at all — genuinely not renderable yet
      return 'waiting_render'
    }

    // Element has layout space — it is READY regardless of its current opacity,
    // transform, or animation state. We will capture its resting text/properties
    // from aria-label and computed styles which reflect the final values.
    return 'ready'
  }

  // =========================================================================
  // ELEMENT DECOMPOSITION INTO CONSTRUCTION LAYERS
  // =========================================================================

  /**
   * Decomposes a visual element into independently constructible visual layers.
   */
  decomposeElement(element: VisualBlueprintElement): BlueprintLayerOperation[] {
    const layers: BlueprintLayerOperation[] = []
    const bounds = element.bounds
    const props = element.visualProperties
    const sectionId = element.sectionId
    const elementId = element.id

    switch (element.type) {
      case 'button': {
        // 1. Geometry layer (Shape)
        const geomId = this.nextLayerId(elementId, 'geometry')
        layers.push({
          id: geomId,
          elementId,
          sectionId,
          layer: 'geometry',
          tool: 'Shape',
          description: 'Constructing button shape geometry',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.drawingDuration * 0.7,
          metadata: { borderRadius: props.borderRadius },
        })

        // 2. Background fill layer (Colour)
        const bgId = this.nextLayerId(elementId, 'background')
        layers.push({
          id: bgId,
          elementId,
          sectionId,
          layer: 'background',
          tool: 'Colour',
          description: 'Applying button background and fill',
          bounds,
          status: 'queued',
          dependencies: [geomId],
          duration: swarmSettings.timing.colourApplicationDuration * 0.7,
          metadata: { bgColor: props.backgroundColor },
        })

        // 3. Border layer (Pen)
        const borderId = this.nextLayerId(elementId, 'border')
        layers.push({
          id: borderId,
          elementId,
          sectionId,
          layer: 'border',
          tool: 'Pen',
          description: 'Tracing button border profile',
          bounds,
          status: 'queued',
          dependencies: [bgId],
          duration: swarmSettings.timing.iconSetupDuration * 0.6,
          metadata: { borderColor: props.borderColor, borderRadius: props.borderRadius },
        })

        // 4. Button text layer (Text)
        if (element.textContent) {
          const textId = this.nextLayerId(elementId, 'text')
          layers.push({
            id: textId,
            elementId,
            sectionId,
            layer: 'text',
            tool: 'Text',
            description: `Typing button label "${element.textContent.slice(0, 20)}"`,
            bounds,
            status: 'queued',
            dependencies: [borderId],
            duration: swarmSettings.timing.textSetupDuration + element.textContent.length * swarmSettings.timing.textCharacterDelay,
            metadata: {
              text: element.textContent,
              fontFamily: props.fontFamily,
              fontSize: props.fontSize,
              fontWeight: props.fontWeight,
              textColor: props.color,
            },
          })
        }

        // 5. Alignment layer (Arrange)
        const alignId = this.nextLayerId(elementId, 'alignment')
        layers.push({
          id: alignId,
          elementId,
          sectionId,
          layer: 'alignment',
          tool: 'Arrange',
          description: 'Verifying button layout and alignment',
          bounds,
          status: 'queued',
          dependencies: layers.map((l) => l.id),
          duration: swarmSettings.timing.alignmentDuration * 0.5,
        })
        break
      }

      case 'card': {
        // 1. Card geometry (Shape / Frame)
        const geomId = this.nextLayerId(elementId, 'geometry')
        layers.push({
          id: geomId,
          elementId,
          sectionId,
          layer: 'geometry',
          tool: 'Shape',
          description: 'Constructing card boundary geometry',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.drawingDuration,
          metadata: { borderRadius: props.borderRadius },
        })

        // 2. Card background & glass styling (Colour)
        const bgId = this.nextLayerId(elementId, 'background')
        layers.push({
          id: bgId,
          elementId,
          sectionId,
          layer: 'background',
          tool: 'Colour',
          description: 'Applying card background styling',
          bounds,
          status: 'queued',
          dependencies: [geomId],
          duration: swarmSettings.timing.colourApplicationDuration,
          metadata: { bgColor: props.backgroundColor },
        })

        // 3. Card border outline (Pen)
        const borderId = this.nextLayerId(elementId, 'border')
        layers.push({
          id: borderId,
          elementId,
          sectionId,
          layer: 'border',
          tool: 'Pen',
          description: 'Tracing card edge borders',
          bounds,
          status: 'queued',
          dependencies: [bgId],
          duration: swarmSettings.timing.iconSetupDuration * 0.8,
          metadata: { borderColor: props.borderColor, borderRadius: props.borderRadius },
        })

        // 4. Alignment verification (Arrange)
        const alignId = this.nextLayerId(elementId, 'alignment')
        layers.push({
          id: alignId,
          elementId,
          sectionId,
          layer: 'alignment',
          tool: 'Arrange',
          description: 'Verifying card proportions and spacing',
          bounds,
          status: 'queued',
          dependencies: [borderId],
          duration: swarmSettings.timing.alignmentDuration * 0.6,
        })
        break
      }

      case 'heading': {
        // 1. Heading frame & insertion point (Frame)
        const frameId = this.nextLayerId(elementId, 'geometry')
        layers.push({
          id: frameId,
          elementId,
          sectionId,
          layer: 'geometry',
          tool: 'Frame',
          description: 'Establishing heading text insertion frame',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.textSetupDuration * 0.6,
        })

        // 2. Character typing (Text)
        const textId = this.nextLayerId(elementId, 'text')
        layers.push({
          id: textId,
          elementId,
          sectionId,
          layer: 'text',
          tool: 'Text',
          description: `Typing heading "${element.textContent.slice(0, 24)}..."`,
          bounds,
          status: 'queued',
          dependencies: [frameId],
          duration: swarmSettings.timing.textSetupDuration + element.textContent.length * swarmSettings.timing.textCharacterDelay,
          metadata: {
            text: element.textContent,
            fontFamily: props.fontFamily,
            fontSize: props.fontSize,
            fontWeight: props.fontWeight,
            textColor: props.color,
          },
        })

        // 3. Heading typography & styling pass (Colour)
        const styleId = this.nextLayerId(elementId, 'styling')
        layers.push({
          id: styleId,
          elementId,
          sectionId,
          layer: 'styling',
          tool: 'Colour',
          description: 'Applying heading typography weight and color',
          bounds,
          status: 'queued',
          dependencies: [textId],
          duration: swarmSettings.timing.colourApplicationDuration * 0.6,
          metadata: { textColor: props.color },
        })

        // 4. Heading alignment & tracking (Arrange)
        const alignId = this.nextLayerId(elementId, 'alignment')
        layers.push({
          id: alignId,
          elementId,
          sectionId,
          layer: 'alignment',
          tool: 'Arrange',
          description: 'Adjusting heading line-height and letter-spacing',
          bounds,
          status: 'queued',
          dependencies: [styleId],
          duration: swarmSettings.timing.alignmentDuration * 0.5,
        })
        break
      }

      case 'text': {
        // 1. Text insertion point (Frame)
        const frameId = this.nextLayerId(elementId, 'geometry')
        layers.push({
          id: frameId,
          elementId,
          sectionId,
          layer: 'geometry',
          tool: 'Frame',
          description: 'Setting paragraph baseline and bounds',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.textSetupDuration * 0.5,
        })

        // 2. Character typing (Text)
        const textId = this.nextLayerId(elementId, 'text')
        layers.push({
          id: textId,
          elementId,
          sectionId,
          layer: 'text',
          tool: 'Text',
          description: `Typing paragraph "${element.textContent.slice(0, 24)}..."`,
          bounds,
          status: 'queued',
          dependencies: [frameId],
          duration: swarmSettings.timing.textSetupDuration + element.textContent.length * swarmSettings.timing.textCharacterDelay,
          metadata: {
            text: element.textContent,
            fontFamily: props.fontFamily,
            fontSize: props.fontSize,
            fontWeight: props.fontWeight,
            textColor: props.color,
          },
        })

        // 3. Alignment & spacing pass (Arrange)
        const alignId = this.nextLayerId(elementId, 'alignment')
        layers.push({
          id: alignId,
          elementId,
          sectionId,
          layer: 'alignment',
          tool: 'Arrange',
          description: 'Aligning paragraph layout and line breaks',
          bounds,
          status: 'queued',
          dependencies: [textId],
          duration: swarmSettings.timing.alignmentDuration * 0.5,
        })
        break
      }

      case 'image': {
        // 1. Image frame (Frame)
        const frameId = this.nextLayerId(elementId, 'geometry')
        layers.push({
          id: frameId,
          elementId,
          sectionId,
          layer: 'geometry',
          tool: 'Frame',
          description: 'Constructing image container frame',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.drawingDuration * 0.8,
          metadata: { borderRadius: props.borderRadius },
        })

        // 2. Progressive image reveal (Image)
        const imgId = this.nextLayerId(elementId, 'image')
        layers.push({
          id: imgId,
          elementId,
          sectionId,
          layer: 'image',
          tool: 'Image',
          description: 'Progressively rendering image content',
          bounds,
          status: 'queued',
          dependencies: [frameId],
          duration: swarmSettings.timing.imageConstructionDuration,
          metadata: { imageSrc: element.imageSource ?? undefined },
        })

        // 3. Border & corner radius pass (Shape)
        const borderId = this.nextLayerId(elementId, 'border')
        layers.push({
          id: borderId,
          elementId,
          sectionId,
          layer: 'border',
          tool: 'Shape',
          description: 'Applying image border and corner radii',
          bounds,
          status: 'queued',
          dependencies: [imgId],
          duration: swarmSettings.timing.drawingDuration * 0.5,
        })
        break
      }

      case 'icon': {
        // 1. Vector path drawing (Pen)
        const pathId = this.nextLayerId(elementId, 'icon')
        layers.push({
          id: pathId,
          elementId,
          sectionId,
          layer: 'icon',
          tool: 'Pen',
          description: 'Drawing icon vector paths',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.iconSetupDuration + 280,
        })

        // 2. Vector color & stroke pass (Colour)
        const colorId = this.nextLayerId(elementId, 'styling')
        layers.push({
          id: colorId,
          elementId,
          sectionId,
          layer: 'styling',
          tool: 'Colour',
          description: 'Applying icon stroke color and fill',
          bounds,
          status: 'queued',
          dependencies: [pathId],
          duration: swarmSettings.timing.colourApplicationDuration * 0.6,
          metadata: { textColor: props.color },
        })
        break
      }

      case 'badge': {
        // 1. Badge geometry (Shape)
        const geomId = this.nextLayerId(elementId, 'geometry')
        layers.push({
          id: geomId,
          elementId,
          sectionId,
          layer: 'geometry',
          tool: 'Shape',
          description: 'Drawing badge shape boundary',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.drawingDuration * 0.5,
          metadata: { borderRadius: props.borderRadius },
        })

        // 2. Badge text / styling (Colour / Text)
        if (element.textContent) {
          const textId = this.nextLayerId(elementId, 'text')
          layers.push({
            id: textId,
            elementId,
            sectionId,
            layer: 'text',
            tool: 'Text',
            description: `Typing badge text "${element.textContent.slice(0, 16)}"`,
            bounds,
            status: 'queued',
            dependencies: [geomId],
            duration: swarmSettings.timing.textSetupDuration * 0.8,
            metadata: { text: element.textContent, textColor: props.color },
          })
        }
        break
      }

      case 'divider': {
        // 1. Divider line (Pen)
        const lineId = this.nextLayerId(elementId, 'geometry')
        layers.push({
          id: lineId,
          elementId,
          sectionId,
          layer: 'geometry',
          tool: 'Pen',
          description: 'Drawing decorative divider line',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.drawingDuration * 0.6,
          metadata: { borderColor: props.borderColor },
        })

        // 2. Alignment pass (Arrange)
        const alignId = this.nextLayerId(elementId, 'alignment')
        layers.push({
          id: alignId,
          elementId,
          sectionId,
          layer: 'alignment',
          tool: 'Arrange',
          description: 'Aligning divider rule',
          bounds,
          status: 'queued',
          dependencies: [lineId],
          duration: swarmSettings.timing.alignmentDuration * 0.4,
        })
        break
      }

      default: {
        // General container: boundary frame
        const frameId = this.nextLayerId(elementId, 'geometry')
        layers.push({
          id: frameId,
          elementId,
          sectionId,
          layer: 'geometry',
          tool: 'Frame',
          description: 'Constructing layout frame boundary',
          bounds,
          status: 'queued',
          dependencies: [],
          duration: swarmSettings.timing.drawingDuration * 0.7,
        })
        break
      }
    }

    return layers
  }

  /**
   * Links parent-child layer dependencies so nested elements wait for their parent container.
   */
  private linkLayerDependencies(elements: Map<string, VisualBlueprintElement>, allLayers: BlueprintLayerOperation[]) {
    const layerMap = new Map<string, BlueprintLayerOperation>()
    allLayers.forEach((l) => layerMap.set(l.id, l))

    for (const element of elements.values()) {
      if (!element.parentId) continue
      const parent = elements.get(element.parentId)
      if (!parent || parent.type === 'section') continue

      // Find parent's initial geometry or border layer
      const parentBaseLayer = parent.layerOperations.find((l) => l.layer === 'geometry' || l.layer === 'border')
      if (parentBaseLayer) {
        // First layer of child element must wait for parent's base layer
        const childFirstLayer = element.layerOperations[0]
        if (childFirstLayer && !childFirstLayer.dependencies.includes(parentBaseLayer.id)) {
          childFirstLayer.dependencies.push(parentBaseLayer.id)
        }
      }
    }
  }

  /**
   * Refreshes cached bounds on scroll or window resize without re-allocating blueprint elements.
   */
  refreshMeasurements(blueprint: SectionVisualBlueprint) {
    for (const element of blueprint.elements.values()) {
      if (!element.domNode.isConnected) continue
      const rect = element.domNode.getBoundingClientRect()
      element.bounds.left = rect.left
      element.bounds.top = rect.top
      element.bounds.width = Math.max(2, rect.width)
      element.bounds.height = Math.max(2, rect.height)

      // Update layer bounds
      element.layerOperations.forEach((layer) => {
        layer.bounds = element.bounds
      })
    }
  }

  translateMeasurements(blueprint: SectionVisualBlueprint, deltaX: number, deltaY: number) {
    blueprint.bounds.left += deltaX
    blueprint.bounds.top += deltaY
    for (const element of blueprint.elements.values()) {
      element.bounds.left += deltaX
      element.bounds.top += deltaY
      element.layerOperations.forEach((layer) => {
        layer.bounds = element.bounds
      })
    }
  }

  private getOrCreateElementId(element: Element, prefix: string): string {
    const existing = this.elementIdMap.get(element)
    if (existing) return existing
    const id = `${prefix}-${++this.elementSequence}`
    this.elementIdMap.set(element, id)
    return id
  }

  private nextLayerId(elementId: string, layerKind: BlueprintLayerKind): string {
    return `layer-${elementId}-${layerKind}-${++this.layerSequence}`
  }
}
