import React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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
    addListener() { return { remove: () => undefined } }
    setMap() {}
  }

  class InfoWindowInstance {
    close() {}
    open() {}
    setContent() {}
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
  h.loadGoogleMaps.mockReset()
})

afterEach(() => {
  cleanup()
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
})
