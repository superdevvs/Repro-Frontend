import { describe, expect, it } from 'vitest'
import { isMobileViewportSize, MOBILE_VIEWPORT_QUERY } from './use-mobile'

describe('isMobileViewportSize', () => {
  it('treats classic portrait phones as mobile', () => {
    expect(isMobileViewportSize(390, 844)).toBe(true)
    expect(isMobileViewportSize(767, 1000)).toBe(true)
  })

  it('treats phone landscape as mobile even when width clears 768', () => {
    // Pixel 5 / iPhone-class landscape used by QA #18
    expect(isMobileViewportSize(844, 390)).toBe(true)
    expect(isMobileViewportSize(851, 393)).toBe(true)
    expect(isMobileViewportSize(1024, 500)).toBe(true)
  })

  it('keeps tablets and desktops with usable height as not-mobile', () => {
    expect(isMobileViewportSize(768, 1024)).toBe(false)
    expect(isMobileViewportSize(1024, 768)).toBe(false)
    expect(isMobileViewportSize(1280, 800)).toBe(false)
    expect(isMobileViewportSize(1440, 480)).toBe(false)
  })
})

describe('MOBILE_VIEWPORT_QUERY', () => {
  it('matches width-or-short-landscape media query shape', () => {
    expect(MOBILE_VIEWPORT_QUERY).toContain('max-width: 767px')
    expect(MOBILE_VIEWPORT_QUERY).toContain('max-height: 500px')
    expect(MOBILE_VIEWPORT_QUERY).toContain('max-width: 1024px')
  })
})
