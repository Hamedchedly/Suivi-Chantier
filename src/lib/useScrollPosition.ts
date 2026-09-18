import { useEffect, useRef } from 'react'

export function useScrollPosition(key: string, elementRef?: React.RefObject<HTMLDivElement>) {
  const hasRestored = useRef(false)

  useEffect(() => {
    if (hasRestored.current) return

    const target = elementRef?.current || (typeof window !== 'undefined' ? document.documentElement : null)
    if (!target) return

    const params = new URLSearchParams(window.location.search)
    const scrollKey = `scroll_${key}`
    const savedPos = params.get(scrollKey)

    if (savedPos) {
      const pos = parseInt(savedPos, 10)
      setTimeout(() => {
        target.scrollTop = pos
        hasRestored.current = true
      }, 50)
    } else {
      hasRestored.current = true
    }
  }, [key, elementRef])

  const saveScrollPosition = () => {
    const target = elementRef?.current || document.documentElement
    const pos = target.scrollTop
    const params = new URLSearchParams(window.location.search)
    const scrollKey = `scroll_${key}`

    if (pos === 0) {
      params.delete(scrollKey)
    } else {
      params.set(scrollKey, pos.toString())
    }

    const newUrl = params.toString() ? `?${params}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  }

  useEffect(() => {
    const target = elementRef?.current || window

    if (elementRef?.current) {
      elementRef.current.addEventListener('scroll', saveScrollPosition)
      return () => elementRef.current?.removeEventListener('scroll', saveScrollPosition)
    } else {
      target.addEventListener('scroll', saveScrollPosition)
      return () => target.removeEventListener('scroll', saveScrollPosition)
    }
  }, [key])
}
