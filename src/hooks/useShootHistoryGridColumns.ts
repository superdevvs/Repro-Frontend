import { useLayoutEffect, useState, type RefObject } from 'react'

export function useShootHistoryGridColumns(
  containerRef: RefObject<HTMLDivElement>,
  preferredColumns: 3 | 4,
) {
  const [containerWidth, setContainerWidth] = useState(0)

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
  return Math.min(responsiveColumns, preferredColumns)
}
