import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export function useShootHistoryGridColumns(
  containerRef: RefObject<HTMLDivElement>,
  preferredColumns: 3 | 4,
) {
  const [containerWidth, setContainerWidth] = useState(0)
  const reducedMotion = useReducedMotion()
  const previousLayout = useRef<string | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = () => setContainerWidth(container.clientWidth)
    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef])

  // Preserve the existing narrow-screen layout in both grid modes.
  const responsiveColumns = containerWidth <= 479 ? 1 : containerWidth <= 719 ? 2 : containerWidth <= 960 ? 3 : 4
  const columns = Math.min(responsiveColumns, preferredColumns)
  const hasWidth = containerWidth > 0
  const layout = `${columns}-${preferredColumns === 3 && columns === 3 ? 'compact' : 'standard'}`

  useLayoutEffect(() => {
    if (!hasWidth) return
    const previous = previousLayout.current
    previousLayout.current = layout
    if (previous === null || previous === layout || reducedMotion) return

    const animations = Array.from(containerRef.current?.querySelectorAll('.masonry-grid') ?? []).map((grid) =>
      grid.animate?.(
        [{ opacity: 0.7, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 180, easing: 'ease-out' },
      ),
    )
    return () => animations.forEach((animation) => animation?.cancel())
  }, [containerRef, hasWidth, layout, reducedMotion])

  return columns
}
