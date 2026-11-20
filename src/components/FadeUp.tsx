import { createElement, useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type ElementType, type ReactNode, type Ref } from 'react'

type RevealCallback = () => void

let sharedObserver: IntersectionObserver | null = null
const observedElements = new Map<Element, RevealCallback>()

function getSharedObserver() {
  if (sharedObserver || typeof IntersectionObserver === 'undefined') return sharedObserver

  sharedObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      const reveal = observedElements.get(entry.target)
      if (!reveal) return
      sharedObserver?.unobserve(entry.target)
      observedElements.delete(entry.target)
      reveal()
    })
    if (observedElements.size === 0) {
      sharedObserver?.disconnect()
      sharedObserver = null
    }
  }, { threshold: 0.12 })

  return sharedObserver
}

export function useFadeUp(enabled = true) {
  const elementRef = useRef<HTMLElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const revealRef = useRef<RevealCallback>(() => setIsVisible(true))

  useEffect(() => {
    if (!enabled) return
    const element = elementRef.current
    if (!element) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = getSharedObserver()
    if (!observer) {
      setIsVisible(true)
      return
    }

    observedElements.set(element, revealRef.current)
    observer.observe(element)

    return () => {
      observedElements.delete(element)
      observer.unobserve(element)
      if (observedElements.size === 0) {
        observer.disconnect()
        if (sharedObserver === observer) sharedObserver = null
      }
    }
  }, [enabled])

  const ref = useCallback((element: HTMLElement | null) => {
    elementRef.current = element
  }, [])

  return { ref, isVisible }
}

type FadeUpProps<T extends ElementType> = {
  as?: T
  delay?: number
  enabled?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'ref' | 'className' | 'style' | 'children'>

export function FadeUp<T extends ElementType = 'div'>({
  as,
  delay = 0,
  enabled = true,
  className = '',
  style,
  children,
  ...props
}: FadeUpProps<T>) {
  const Component = as ?? 'div'
  const { ref, isVisible } = useFadeUp(enabled)

  const elementProps = {
    ...props,
    ref: ref as Ref<HTMLElement>,
    className: `fade-up${isVisible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`,
    style: { ...style, transitionDelay: `${delay}ms` }
  }

  return createElement(Component, elementProps, children)
}
