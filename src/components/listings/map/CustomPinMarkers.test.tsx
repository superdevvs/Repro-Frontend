// RTL test for CustomPinMarkers.
//
// Feature: map-tab-ui-improvements, Task 13.5: Write RTL test for markers and preview
// Validates: Requirements 10.4, 10.6
//
// CustomPinMarkers renders imperatively: for each mapped listing it creates a
// MapLibre `Marker` whose DOM `element` is populated by a `createRoot(...)`
// React root rendering a custom pin (button + teardrop SVG). Testing it in
// jsdom requires stubbing `maplibre-gl` (so `Marker`/`Popup` are inert and we
// can capture the created marker elements) and the `@/components/ui/map`
// context hooks (so the component does not need a real <Map>).
//
// The test asserts:
//   - exactly one marker is created per mapped listing (unmapped listings get
//     no marker),
//   - the SELECTED pin's rendered markup differs from an unselected pin's:
//     it is recolored to the brand red (#d74432), enlarged (larger SVG size),
//     and elevated (higher container z-index) — R10.6,
//   - clicking an unselected pin invokes `onSelectListing` with that listing's
//     id — R10.4.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// --- maplibre-gl stub --------------------------------------------------------
// Capture every constructed marker so the test can read the DOM `element` that
// CustomPinMarkers renders its pin into. Popups are inert.
const h = vi.hoisted(() => {
  interface CapturedMarker {
    element?: HTMLElement
    lngLat?: [number, number]
  }
  const markerInstances: CapturedMarker[] = []

  class FakeMarker {
    element?: HTMLElement
    lngLat?: [number, number]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(opts?: any) {
      this.element = opts?.element
      markerInstances.push(this)
    }
    setLngLat(v: [number, number]) {
      this.lngLat = v
      return this
    }
    addTo() {
      return this
    }
    setPopup() {
      return this
    }
    remove() {}
  }

  class FakePopup {
    setLngLat() {
      return this
    }
    addTo() {
      return this
    }
    setDOMContent() {
      return this
    }
    remove() {}
  }

  class FakeLngLatBounds {}

  return { markerInstances, FakeMarker, FakePopup, FakeLngLatBounds }
})

vi.mock('maplibre-gl', () => ({
  __esModule: true,
  Marker: h.FakeMarker,
  Popup: h.FakePopup,
  LngLatBounds: h.FakeLngLatBounds,
  default: {
    Marker: h.FakeMarker,
    Popup: h.FakePopup,
    LngLatBounds: h.FakeLngLatBounds,
  },
}))

// --- map context stub --------------------------------------------------------
// Provide a truthy fake map and a fixed label flag so the component does not
// need a real <Map> ancestor.
vi.mock('@/components/ui/map', () => ({
  useMap: () => ({ __fakeMap: true }),
  useShowMarkerLabels: () => false,
}))

// Import AFTER the mocks are registered.
import { CustomPinMarkers } from './CustomPinMarkers'
import { type ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

// Brand colors mirrored from CustomPinMarkers (selected vs unselected light).
const SELECTED_COLOR = '#d74432'
const UNSELECTED_COLOR_LIGHT = '#1f5aa6'

const resolveImageUrl = (value: string | null | undefined): string | null => value ?? null
const formatPrice = (price: number | undefined | null): string =>
  typeof price === 'number' ? `$${price}` : ''

function makeListing(overrides: Partial<ShowcaseListing> = {}): ShowcaseListing {
  return {
    id: 'listing-x',
    address: '1 Test St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    fullAddress: '1 Test St, Austin, TX 78701',
    heroImage: undefined,
    client: { name: 'Agent' },
    isListingHidden: false,
    isPrivateListing: true,
    listing_type: 'for_sale',
    price: 1_000_000,
    latitude: 30.27,
    longitude: -97.74,
    ...overrides,
  }
}

// listing-1 (selected): "$1.5M" label; listing-2 (unselected): "$850K" label.
const selectedListing = makeListing({
  id: 'listing-1',
  price: 1_500_000,
  latitude: 30.27,
  longitude: -97.74,
})
const unselectedListing = makeListing({
  id: 'listing-2',
  address: '2 Other St',
  fullAddress: '2 Other St, Austin, TX 78701',
  price: 850_000,
  latitude: 31.0,
  longitude: -98.0,
})
// An unmapped listing (no coords) must NOT produce a marker.
const unmappedListing = makeListing({
  id: 'listing-3',
  price: 500_000,
  latitude: undefined,
  longitude: undefined,
})
const sameLocationListing = makeListing({
  id: 'listing-4',
  price: 925_000,
  latitude: 30.27,
  longitude: -97.74,
})

function svgOf(element: HTMLElement | undefined): SVGSVGElement {
  const svg = element?.querySelector('svg')
  if (!svg) throw new Error('pin SVG not found in marker element')
  return svg as SVGSVGElement
}

function pinFill(element: HTMLElement | undefined): string | null {
  return svgOf(element).querySelector('path')?.getAttribute('fill') ?? null
}

function pinSize(element: HTMLElement | undefined): number {
  return Number(svgOf(element).getAttribute('width'))
}

async function renderMarkers(onSelectListing = vi.fn()) {
  render(
    <CustomPinMarkers
      listings={[selectedListing, unselectedListing, unmappedListing]}
      selectedListingId={selectedListing.id}
      onSelectListing={onSelectListing}
      showLabels
      resolveImageUrl={resolveImageUrl}
      formatPrice={formatPrice}
      onOpenListing={vi.fn()}
    />,
  )
  // Let the marker effect run and the per-marker createRoot renders commit.
  await act(async () => {
    await Promise.resolve()
  })
  await waitFor(() => {
    expect(h.markerInstances.length).toBeGreaterThan(0)
    expect(h.markerInstances[0].element?.querySelector('button')).not.toBeNull()
  })
  return { onSelectListing }
}

beforeEach(() => {
  h.markerInstances.length = 0
})

afterEach(() => {
  cleanup()
})

describe('CustomPinMarkers', () => {
  it('R10.1: creates exactly one marker per mapped listing (none for unmapped)', async () => {
    await renderMarkers()
    // Two mapped listings → two markers; the unmapped listing is excluded.
    expect(h.markerInstances).toHaveLength(2)
  })

  it('R10.6: the selected pin is recolored, enlarged, and elevated relative to an unselected pin', async () => {
    await renderMarkers()

    const [first, second] = h.markerInstances
    // Marker order follows listing order, so index 0 is the selected listing.
    const selectedEl = first.element
    const unselectedEl = second.element

    // Sanity: the two markers map to the expected listings via their button label.
    expect(selectedEl?.querySelector('button')).toHaveAttribute('aria-label', 'Select $1.5M')
    expect(unselectedEl?.querySelector('button')).toHaveAttribute('aria-label', 'Select $850K')

    // Recolor: selected pin uses brand red; unselected uses brand blue.
    expect(pinFill(selectedEl)).toBe(SELECTED_COLOR)
    expect(pinFill(unselectedEl)).toBe(UNSELECTED_COLOR_LIGHT)
    expect(pinFill(selectedEl)).not.toBe(pinFill(unselectedEl))

    // Enlarge: selected pin SVG is strictly larger than the unselected one.
    expect(pinSize(selectedEl)).toBeGreaterThan(pinSize(unselectedEl))

    // Elevate: selected pin container has a higher stacking order.
    expect(Number(selectedEl?.style.zIndex)).toBeGreaterThan(
      Number(unselectedEl?.style.zIndex),
    )

    // The selected pin is also flagged via aria-pressed.
    expect(selectedEl?.querySelector('button')).toHaveAttribute('aria-pressed', 'true')
    expect(unselectedEl?.querySelector('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('R10.4: clicking an unselected pin invokes onSelectListing with that listing id', async () => {
    const { onSelectListing } = await renderMarkers()

    const unselectedButton = h.markerInstances[1].element?.querySelector('button')
    expect(unselectedButton).not.toBeNull()

    await act(async () => {
      unselectedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onSelectListing).toHaveBeenCalledTimes(1)
    expect(onSelectListing).toHaveBeenCalledWith('listing-2')
  })

  it('renders one counted pin for multiple shoots at the same property', async () => {
    render(
      <CustomPinMarkers
        listings={[selectedListing, sameLocationListing, unselectedListing]}
        selectedListingId={selectedListing.id}
        onSelectListing={vi.fn()}
        showLabels
        resolveImageUrl={resolveImageUrl}
        formatPrice={formatPrice}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(h.markerInstances).toHaveLength(2)
    })

    expect(h.markerInstances[0].element).toHaveTextContent('2')
  })
})
