import { afterEach, describe, expect, it } from 'vitest'
import { loadGoogleMaps, type GoogleMapsApi } from './googleMapsLoader'

afterEach(() => {
  document.getElementById('repro-google-maps-script')?.remove()
  delete window.__reproGoogleMapsReady
  delete window.google
})

describe('loadGoogleMaps', () => {
  it('shares one safe script load between concurrent callers', async () => {
    const firstLoad = loadGoogleMaps('browser-key-for-test')
    const secondLoad = loadGoogleMaps('browser-key-for-test')
    expect(secondLoad).toBe(firstLoad)

    const scripts = document.querySelectorAll<HTMLScriptElement>(
      '#repro-google-maps-script',
    )
    expect(scripts).toHaveLength(1)
    expect(scripts[0].async).toBe(true)
    expect(scripts[0].referrerPolicy).toBe('strict-origin-when-cross-origin')

    const url = new URL(scripts[0].src)
    expect(url.origin).toBe('https://maps.googleapis.com')
    expect(url.searchParams.get('loading')).toBe('async')
    expect(url.searchParams.get('v')).toBe('weekly')

    const maps = { Map: class {} } as unknown as GoogleMapsApi
    window.google = { maps }
    window.__reproGoogleMapsReady?.()

    await expect(firstLoad).resolves.toBe(maps)
  })
})
