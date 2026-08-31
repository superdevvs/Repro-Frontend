import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GoogleMapOptions, GoogleMapsApi } from './googleMapsLoader'
import type { MapMarker } from './shootHistoryUtils'

const h = vi.hoisted(() => ({
  loadGoogleMaps: vi.fn(),
}))

vi.mock('./googleMapsLoader', async (importOriginal) => {
  const original = await importOriginal<typeof import('./googleMapsLoader')>()
  return {
    ...original,
    loadGoogleMaps: h.loadGoogleMaps,
  }
})

import { GoogleShootHistoryMap } from './GoogleShootHistoryMap'

const mapOptions: GoogleMapOptions[] = []
const markerClickHandlers: Array<() => void> = []
const infoWindowContents: Node[] = []
const infoWindowOptions: unknown[] = []
let infoWindowCloseCalls = 0

const createMapsApi = (): GoogleMapsApi => {
  class MapInstance {
    constructor(_element: HTMLElement, options: GoogleMapOptions) {
      mapOptions.push(options)
    }

    fitBounds() {}
    getZoom() { return 12 }
    setCenter() {}
    setOptions() {}
    setZoom() {}
  }

  class MarkerInstance {
    addListener(eventName: string, handler: () => void) {
      if (eventName === 'click') markerClickHandlers.push(handler)
      return { remove: () => undefined }
    }
    setMap() {}
  }

  class InfoWindowInstance {
    private content: Node | null = null

    constructor(options?: unknown) { infoWindowOptions.push(options) }
    close() {
      infoWindowCloseCalls += 1
      this.content?.parentNode?.removeChild(this.content)
    }
    open() {}
    setContent(content: Node) {
      this.content = content
      infoWindowContents.push(content)
      document.body.appendChild(content)
    }
  }

  class LatLngBounds {
    extend() {}
  }

  return {
    InfoWindow: InfoWindowInstance,
    LatLngBounds,
    Map: MapInstance,
    Marker: MarkerInstance,
    event: {
      addListenerOnce: () => ({ remove: () => undefined }),
      clearInstanceListeners: () => undefined,
      trigger: () => undefined,
    },
  } as unknown as GoogleMapsApi
}

const marker: MapMarker = {
  id: 'shoot-1',
  title: 'Shoot 1',
  address: '1 Main Street',
  coords: { lat: 30.2672, lng: -97.7431 },
}

const deferredMaps = () => {
  let resolve!: (maps: GoogleMapsApi) => void
  const promise = new Promise<GoogleMapsApi>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

beforeEach(() => {
  mapOptions.length = 0
  markerClickHandlers.length = 0
  infoWindowContents.length = 0
  infoWindowOptions.length = 0
  infoWindowCloseCalls = 0
  h.loadGoogleMaps.mockReset()
})

afterEach(async () => {
  cleanup()
  await act(async () => Promise.resolve())
  vi.restoreAllMocks()
})

describe('GoogleShootHistoryMap', () => {
  it('removes the loading status after the map is ready', async () => {
    const deferred = deferredMaps()
    h.loadGoogleMaps.mockReturnValue(deferred.promise)

    render(
      <GoogleShootHistoryMap
        apiKey="browser-key-for-test"
        markers={[marker]}
        onLoadError={vi.fn()}
        theme="light"
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Loading shoot locations…')

    await act(async () => {
      deferred.resolve(createMapsApi())
    })

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.getByRole('region').parentElement).toHaveAttribute('aria-busy', 'false')
  })

  it('uses the latest theme when it changes while the script is loading', async () => {
    const deferred = deferredMaps()
    h.loadGoogleMaps.mockReturnValue(deferred.promise)

    const { rerender } = render(
      <GoogleShootHistoryMap
        apiKey="browser-key-for-test"
        markers={[marker]}
        onLoadError={vi.fn()}
        theme="light"
      />,
    )

    rerender(
      <GoogleShootHistoryMap
        apiKey="browser-key-for-test"
        markers={[marker]}
        onLoadError={vi.fn()}
        theme="dark"
      />,
    )

    await act(async () => {
      deferred.resolve(createMapsApi())
    })

    await waitFor(() => expect(mapOptions).toHaveLength(1))
    expect(mapOptions[0].styles).not.toBeNull()
  })

  it('keeps roads visible while hiding business details', async () => {
    h.loadGoogleMaps.mockResolvedValue(createMapsApi())

    render(
      <GoogleShootHistoryMap
        apiKey="browser-key-for-test"
        markers={[marker]}
        onLoadError={vi.fn()}
        theme="light"
      />,
    )

    await waitFor(() => expect(mapOptions).toHaveLength(1))
    const styles = mapOptions[0].styles ?? []

    expect(mapOptions[0].cameraControl).toBe(false)
    expect(styles).toContainEqual({
      featureType: 'poi.business',
      stylers: [{ visibility: 'off' }],
    })
    expect(styles).not.toContainEqual({
      featureType: 'road',
      stylers: [{ visibility: 'off' }],
    })
    expect(styles).not.toContainEqual({
      featureType: 'poi',
      stylers: [{ visibility: 'off' }],
    })
  })

  it('opens the marker card and forwards View Overview to the existing handler', async () => {
    const onOpen = vi.fn()
    h.loadGoogleMaps.mockResolvedValue(createMapsApi())

    render(
      <GoogleShootHistoryMap
        apiKey="browser-key-for-test"
        markers={[{
          ...marker,
          imageUrl: 'https://images.example.test/property.jpg',
          status: 'scheduled',
          subtitle: 'Aug 31, 2026 · 2:30 PM',
          onOpen,
        }]}
        onLoadError={vi.fn()}
        theme="light"
      />,
    )

    await waitFor(() => expect(markerClickHandlers).toHaveLength(1))
    await act(async () => {
      markerClickHandlers[0]()
      await Promise.resolve()
    })

    await waitFor(() => expect(infoWindowContents).toHaveLength(1))
    expect(infoWindowOptions).toContainEqual({
      ariaLabel: 'Shoot property preview',
      headerDisabled: true,
      maxWidth: 320,
    })
    const card = await screen.findByRole('button', {
      name: `View Overview for ${marker.address}`,
    })
    expect(screen.getByText(marker.address)).toBeInTheDocument()
    expect(screen.getByText('Scheduled')).toBeInTheDocument()

    fireEvent.click(card)
    expect(onOpen).toHaveBeenCalledTimes(1)

    const closeCallsBeforeDismiss = infoWindowCloseCalls
    fireEvent.click(screen.getByRole('button', { name: 'Close property preview' }))
    expect(infoWindowCloseCalls).toBe(closeCallsBeforeDismiss + 1)
  })
})
