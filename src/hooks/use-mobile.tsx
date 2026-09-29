import * as React from "react"

const MOBILE_BREAKPOINT = 768
const XS_BREAKPOINT = 480
/** Phone-landscape CSS heights sit around 360–430px; 500px leaves chrome margin. */
const LANDSCAPE_SHORT_MAX_HEIGHT = 500
/** Cap so short desktop browser windows wider than a tablet stay "desktop". */
const LANDSCAPE_SHORT_MAX_WIDTH = 1024

/**
 * Phones in landscape often clear the 768px width breakpoint (e.g. 844×390)
 * while remaining too short for desktop chrome. Treat those viewports as mobile
 * so layout/scroll shells do not flip to overflow:hidden desktop traps (QA #18).
 */
export const MOBILE_VIEWPORT_QUERY =
  `(max-width: ${MOBILE_BREAKPOINT - 1}px), (max-height: ${LANDSCAPE_SHORT_MAX_HEIGHT}px) and (max-width: ${LANDSCAPE_SHORT_MAX_WIDTH}px)`

export function isMobileViewportSize(width: number, height: number): boolean {
  if (width < MOBILE_BREAKPOINT) return true
  if (height <= LANDSCAPE_SHORT_MAX_HEIGHT && width <= LANDSCAPE_SHORT_MAX_WIDTH) return true
  return false
}

function readIsMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
  }
  return isMobileViewportSize(window.innerWidth, window.innerHeight)
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // Default to false on server (SSR) to prevent layout shifts
    if (typeof window === 'undefined') return false
    return readIsMobileViewport()
  })

  React.useEffect(() => {
    if (typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY)
      const handleChange = () => {
        setIsMobile(mediaQuery.matches)
      }
      handleChange()
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    const handleResize = () => {
      setIsMobile(isMobileViewportSize(window.innerWidth, window.innerHeight))
    }

    let timeoutId: number | null = null
    const debouncedHandleResize = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(handleResize, 150)
    }

    window.addEventListener('resize', debouncedHandleResize)
    window.addEventListener('orientationchange', debouncedHandleResize)
    handleResize()

    return () => {
      window.removeEventListener('resize', debouncedHandleResize)
      window.removeEventListener('orientationchange', debouncedHandleResize)
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  return isMobile
}

export function useIsExtraSmall() {
  const [isXs, setIsXs] = React.useState<boolean>(() => {
    // Default to false on server (SSR) to prevent layout shifts
    if (typeof window === 'undefined') return false
    return window.innerWidth < XS_BREAKPOINT
  })

  React.useEffect(() => {
    // Handler to call on window resize
    const handleResize = () => {
      setIsXs(window.innerWidth < XS_BREAKPOINT)
    }
    
    // Create a debounced version of the resize handler
    let timeoutId: number | null = null
    const debouncedHandleResize = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(handleResize, 150)
    }
    
    // Set up event listener with debounced handler
    window.addEventListener('resize', debouncedHandleResize)
    
    // Call handler right away to set initial state
    handleResize()
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('resize', debouncedHandleResize)
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  return isXs
}
