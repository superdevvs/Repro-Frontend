import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
const markerInstances: object[] = []
const fitBoundsCalls: unknown[][] = []
const setCenterCalls: Array<{ lat: number; lng: number }> = []
const setZoomCalls: number[] = []
const mapOptionsCalls: GoogleMapOptions[] = []
interface InfoWindowRecord {
  closeCalls: number
  content: Node | null
  headerContent: string | Element | Text | null
  openCalls: Array<{ anchor: object; map: object; shouldFocus?: boolean }>
  options: unknown
}
const infoWindowRecords: InfoWindowRecord[] = []

const createMapsApi = (): GoogleMapsApi => {
  class MapInstance {
    constructor(_element: HTMLElement, options: GoogleMapOptions) {
      mapOptionsCalls.push(options)
    }

    fitBounds(...args: unknown[]) { fitBoundsCalls.push(args) }
    getZoom() { return 12 }
    setCenter(center: { lat: number; lng: number }) { setCenterCalls.push(center) }
    setOptions(options: GoogleMapOptions) { mapOptionsCalls.push(options) }
    setZoom(zoom: number) { setZoomCalls.push(zoom) }
  }

  class MarkerInstance {
    private readonly record: MarkerRecord

    constructor(options: MarkerRecord['options']) {
      this.record = { handlers: new Map(), options }
      markerRecords.push(this.record)
      markerInstances.push(this)
    }

    addListener(eventName: string, handler: () => void): GoogleMapsListener {
      this.record.handlers.set(eventName, handler)
      return { remove: () => this.record.handlers.delete(eventName) }
    }

    setMap() {}
  }

  class InfoWindowInstance {
    private readonly record: InfoWindowRecord

    constructor(options?: unknown) {
      this.record = {
        closeCalls: 0,
        content: null,
        headerContent: null,
        openCalls: [],
        options,
      }
      infoWindowRecords.push(this.record)
    }

    close() {
      this.record.closeCalls += 1
      if (this.record.content instanceof Element) this.record.content.remove()
    }

    open(options: { anchor: object; map: object; shouldFocus?: boolean }) {
      this.record.openCalls.push(options)
      if (this.record.content && !this.record.content.isConnected) {
        document.body.appendChild(this.record.content)
      }
    }

    setContent(content: Node) { this.record.content = content }
    setHeaderContent(content: string | Element | Text | null) {
      this.record.headerContent = content
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
  markerInstances.length = 0
  fitBoundsCalls.length = 0
  setCenterCalls.length = 0
  setZoomCalls.length = 0
  mapOptionsCalls.length = 0
  infoWindowRecords.length = 0
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
    expect(screen.getByRole('region', {
      name: 'Private listings map with 1 mapped location',
    })).toBeInTheDocument()
    expect(markerRecords).toHaveLength(1)
    expect(markerRecords[0].options.position).toEqual({ lat: 30.2672, lng: -97.7431 })
    expect(markerRecords[0].options.icon).toContain('data:image/svg+xml')
    expect(fitBoundsCalls).toHaveLength(1)
    expect(fitBoundsCalls[0][1]).toEqual({ top: 80, right: 372, bottom: 64, left: 64 })

    const selectedPreview = await screen.findByRole('region', {
      name: 'Selected listing 100 Congress Avenue',
    })
    expect(within(selectedPreview).getByText('100 Congress Avenue')).toBeVisible()
    expect(infoWindowRecords).toHaveLength(2)
    expect(infoWindowRecords[1].options).toEqual({
      ariaLabel: 'Selected private listing preview',
      headerDisabled: true,
      maxWidth: 320,
      zIndex: 40,
    })
    expect(infoWindowRecords[1].content).toBeInstanceOf(HTMLElement)
    expect(infoWindowRecords[1].content as HTMLElement).toHaveClass('repro-google-map-popup')
    expect(infoWindowRecords[1].openCalls).toHaveLength(1)
    expect(infoWindowRecords[1].openCalls[0]).toEqual(expect.objectContaining({
      anchor: markerInstances[0],
      shouldFocus: false,
    }))
    expect(setCenterCalls.at(-1)).toEqual({ lat: 30.2672, lng: -97.7431 })
    const selectedImageShell = within(selectedPreview).getByRole('img').parentElement
    expect(selectedImageShell).toHaveClass('h-12', 'lg:h-28')

    act(() => screen.getByRole('button', { name: 'Close selected listing preview' }).click())
    await waitFor(() => expect(screen.queryByRole('region', {
      name: 'Selected listing 100 Congress Avenue',
    })).not.toBeInTheDocument())

    act(() => markerRecords[0].handlers.get('click')?.())
    expect(await screen.findByRole('region', {
      name: 'Selected listing 100 Congress Avenue',
    })).toBeInTheDocument()
    expect(infoWindowRecords[1].openCalls).toHaveLength(2)

    act(() => screen.getByRole('button', { name: 'Zoom in on map' }).click())
    act(() => screen.getByRole('button', { name: 'Zoom out of map' }).click())
    expect(setZoomCalls).toEqual([13, 11])

    expect(onSelectListing).toHaveBeenCalledWith('listing-2')
  })

  it('reanchors the selected card when marker styling recreates the pin', async () => {
    const sharedProps = {
      apiKey: 'browser-key-for-test',
      listings: [listing('listing-1', 30.2672, -97.7431, '100 Congress Avenue')],
      selectedListingId: 'listing-1',
      onSelectListing: vi.fn(),
      onToggleLabels: vi.fn(),
      resolveImageUrl: () => null,
      formatPrice: (price: number | undefined | null) => `$${price ?? 0}`,
      onOpenListing: vi.fn(),
    }
    const { rerender } = render(
      <PrivateListingGoogleMap
        {...sharedProps}
        showMarkerLabels={false}
        theme="light"
      />,
    )

    await screen.findByRole('region', { name: 'Selected listing 100 Congress Avenue' })
    const selectedInfoWindow = infoWindowRecords[1]
    await waitFor(() => expect(selectedInfoWindow.openCalls).toHaveLength(1))
    const originalAnchor = selectedInfoWindow.openCalls[0].anchor

    rerender(
      <PrivateListingGoogleMap
        {...sharedProps}
        showMarkerLabels
        theme="dark"
      />,
    )

    await waitFor(() => expect(selectedInfoWindow.openCalls).toHaveLength(2))
    expect(selectedInfoWindow.openCalls[1].anchor).not.toBe(originalAnchor)
    expect(selectedInfoWindow.openCalls[1].anchor).toBe(markerInstances.at(-1))
  })

  it('keeps hover cards anchored independently from the selected pin preview', async () => {
    renderMap([
      listing('selected', 30.2672, -97.7431, '100 Congress Avenue'),
      listing('hovered', 30.301, -97.71, '200 Brazos Street'),
    ], 'selected')

    await waitFor(() => expect(markerRecords).toHaveLength(2))
    expect(infoWindowRecords).toHaveLength(2)

    const hoveredMarkerIndex = markerRecords.findIndex(
      ({ options }) => options.title?.startsWith('200 Brazos Street'),
    )
    expect(hoveredMarkerIndex).toBeGreaterThanOrEqual(0)
    act(() => markerRecords[hoveredMarkerIndex].handlers.get('mouseover')?.())

    await waitFor(() => expect(infoWindowRecords[0].openCalls).toHaveLength(1))
    expect(infoWindowRecords[0].openCalls[0]).toEqual(expect.objectContaining({
      anchor: markerInstances[hoveredMarkerIndex],
      shouldFocus: false,
    }))
    expect(infoWindowRecords[1].openCalls).toHaveLength(1)
    expect(infoWindowRecords[1].openCalls[0].anchor).not.toBe(
      infoWindowRecords[0].openCalls[0].anchor,
    )
  })

  it('disables obscured Google controls and hides business POIs in both themes', async () => {
    const sharedProps = {
      apiKey: 'browser-key-for-test',
      listings: [listing('listing-1', 30.2672, -97.7431)],
      selectedListingId: null,
      onSelectListing: vi.fn(),
      showMarkerLabels: false,
      onToggleLabels: vi.fn(),
      resolveImageUrl: () => null,
      formatPrice: (price: number | undefined | null) => `$${price ?? 0}`,
      onOpenListing: vi.fn(),
    }
    const { rerender } = render(<PrivateListingGoogleMap {...sharedProps} theme="light" />)

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    const lightOptions = mapOptionsCalls.at(-1) as GoogleMapOptions & { cameraControl?: boolean }
    expect(lightOptions.cameraControl).toBe(false)
    expect(lightOptions.zoomControl).toBe(false)
    expect(lightOptions.styles).toEqual(expect.arrayContaining([
      { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    ]))

    rerender(<PrivateListingGoogleMap {...sharedProps} theme="dark" />)
    const darkOptions = mapOptionsCalls.at(-1) as GoogleMapOptions & { cameraControl?: boolean }
    expect(darkOptions.cameraControl).toBe(false)
    expect(darkOptions.zoomControl).toBe(false)
    expect(darkOptions.styles).toEqual(expect.arrayContaining([
      { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    ]))
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
