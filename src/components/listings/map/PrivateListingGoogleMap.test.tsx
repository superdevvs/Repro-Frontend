import React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'
import type {
  GoogleMapOptions,
  GoogleMapsApi,
  GoogleMapsListener,
} from '@/components/shoots/history/googleMapsLoader'

const h = vi.hoisted(() => ({
  loadGoogleMaps: vi.fn(),
}))

vi.mock('@/components/shoots/history/googleMapsLoader', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('@/components/shoots/history/googleMapsLoader')
  >()
  return { ...original, loadGoogleMaps: h.loadGoogleMaps }
})

import { PrivateListingGoogleMap } from './PrivateListingGoogleMap'

interface MarkerRecord {
  handlers: Map<string, () => void>
  options: {
    icon?: string
    position: { lat: number; lng: number }
    title?: string
  }
}

const markerRecords: MarkerRecord[] = []
const fitBoundsCalls: unknown[][] = []
const setCenterCalls: Array<{ lat: number; lng: number }> = []
const setZoomCalls: number[] = []

const createMapsApi = (): GoogleMapsApi => {
  class MapInstance {
    constructor(_element: HTMLElement, _options: GoogleMapOptions) {}

    fitBounds(...args: unknown[]) { fitBoundsCalls.push(args) }
    getZoom() { return 12 }
    setCenter(center: { lat: number; lng: number }) { setCenterCalls.push(center) }
    setOptions() {}
    setZoom(zoom: number) { setZoomCalls.push(zoom) }
  }

  class MarkerInstance {
    private readonly record: MarkerRecord

    constructor(options: MarkerRecord['options']) {
      this.record = { handlers: new Map(), options }
      markerRecords.push(this.record)
    }

    addListener(eventName: string, handler: () => void): GoogleMapsListener {
      this.record.handlers.set(eventName, handler)
      return { remove: () => this.record.handlers.delete(eventName) }
    }

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

const listing = (
  id: string,
  latitude: number,
  longitude: number,
  address = `${id} Main Street`,
): ShowcaseListing => ({
  id,
  address,
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  fullAddress: `${address}, Austin, TX 78701`,
  client: { name: 'Example Client' },
  isListingHidden: false,
  isPrivateListing: true,
  latitude,
  longitude,
  price: 750_000,
})

const renderMap = (
  listings: ShowcaseListing[],
  selectedListingId: string | null,
  onSelectListing = vi.fn(),
) => render(
  <PrivateListingGoogleMap
    apiKey="browser-key-for-test"
    listings={listings}
    selectedListingId={selectedListingId}
    onSelectListing={onSelectListing}
    showMarkerLabels={false}
    onToggleLabels={vi.fn()}
    resolveImageUrl={() => null}
    formatPrice={(price) => `$${price ?? 0}`}
    onOpenListing={vi.fn()}
    theme="light"
  />,
)

beforeEach(() => {
  markerRecords.length = 0
  fitBoundsCalls.length = 0
  setCenterCalls.length = 0
  setZoomCalls.length = 0
  h.loadGoogleMaps.mockReset()
  h.loadGoogleMaps.mockResolvedValue(createMapsApi())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PrivateListingGoogleMap', () => {
  it('discards invalid coordinates, groups a shared location, and selects the active listing', async () => {
    const onSelectListing = vi.fn()
    const listings = [
      listing('listing-1', 30.2672, -97.7431, '100 Congress Avenue'),
      listing('listing-2', 30.2672, -97.7431, '100 Congress Avenue'),
      listing('invalid-latitude', 91, -97.7431),
      listing('invalid-longitude', 30.2672, -181),
    ]

    renderMap(listings, 'listing-2', onSelectListing)

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.getByRole('region')).toHaveAccessibleName(
      'Private listings map with 1 mapped location',
    )
    expect(markerRecords).toHaveLength(1)
    expect(markerRecords[0].options.position).toEqual({ lat: 30.2672, lng: -97.7431 })
    expect(markerRecords[0].options.icon).toContain('data:image/svg+xml')
    expect(fitBoundsCalls).toHaveLength(1)
    expect(fitBoundsCalls[0][1]).toEqual({ top: 80, right: 372, bottom: 64, left: 64 })

    act(() => screen.getByRole('button', { name: 'Zoom in on map' }).click())
    act(() => screen.getByRole('button', { name: 'Zoom out of map' }).click())
    expect(setZoomCalls).toEqual([13, 11])

    act(() => markerRecords[0].handlers.get('click')?.())
    expect(onSelectListing).toHaveBeenCalledWith('listing-2')
  })

  it('keeps the empty-map framing and empty state when no coordinates are valid', async () => {
    renderMap([listing('invalid', Number.NaN, -97.7431)], null)

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(markerRecords).toHaveLength(0)
    expect(screen.getByText('No mapped listings yet.')).toBeInTheDocument()
    expect(setCenterCalls).toContainEqual({ lat: 39.8283, lng: -98.5795 })
    expect(setZoomCalls).toContain(4)
  })

  it('surfaces a load failure and permits a retry', async () => {
    const onLoadError = vi.fn()
    h.loadGoogleMaps.mockRejectedValueOnce(new Error('Network unavailable'))
    h.loadGoogleMaps.mockResolvedValueOnce(createMapsApi())

    render(
      <PrivateListingGoogleMap
        apiKey="browser-key-for-test"
        listings={[]}
        selectedListingId={null}
        onSelectListing={vi.fn()}
        showMarkerLabels={false}
        onToggleLabels={vi.fn()}
        resolveImageUrl={() => null}
        formatPrice={(price) => `$${price ?? 0}`}
        onOpenListing={vi.fn()}
        onLoadError={onLoadError}
        theme="dark"
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    expect(onLoadError).toHaveBeenCalledTimes(1)
    act(() => screen.getByRole('button', { name: 'Retry map' }).click())
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(h.loadGoogleMaps).toHaveBeenCalledTimes(2)
  })
})
