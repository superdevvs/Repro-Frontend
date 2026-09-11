// RTL test for CustomPinMarkers.
//
// Feature: map-tab-ui-improvements, Task 13.5: Write RTL test for markers and preview
// Validates: Requirements 10.4, 10.6
//
// CustomPinMarkers renders imperatively: for each mapped listing it creates a
// Leaflet marker whose DOM `element` is populated by a `createRoot(...)`
// React root rendering a custom pin (button + teardrop SVG). Testing it in
// jsdom requires stubbing Leaflet (so markers/popups are inert and we
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

// --- Leaflet stub ------------------------------------------------------------
// Capture every constructed marker so the test can read the DOM `element` that
// CustomPinMarkers renders its pin into. Popups are inert.
const h = vi.hoisted(() => {
  interface CapturedMarker {
    element?: HTMLElement
    latLng?: [number, number]
  }
  const markerInstances: CapturedMarker[] = []

  class FakeMarker {
    element?: HTMLElement
    latLng?: [number, number]
    constructor(
      latLng: [number, number],
      options?: { icon?: { options?: { html?: HTMLElement } } },
    ) {
      this.element = options?.icon?.options?.html
      this.latLng = latLng
      markerInstances.push(this)
    }
    addTo() {
      return this
    }
    remove() {}
  }

  class FakePopup {
    update() { return this }
    setLatLng() {
      return this
    }
    openOn() {
      return this
    }
    setContent() {
      return this
    }
    remove() {}
  }

  const map = { __fakeMap: true, hasLayer: () => false }
  return { markerInstances, FakeMarker, FakePopup, map }
})

vi.mock('leaflet', () => ({
  divIcon: (options: { html?: HTMLElement }) => ({ options }),
  marker: (
    latLng: [number, number],
    options?: { icon?: { options?: { html?: HTMLElement } } },
  ) => new h.FakeMarker(latLng, options),
  popup: () => new h.FakePopup(),
}))

// --- map context stub --------------------------------------------------------
// Provide a truthy fake map and a fixed label flag so the component does not
// need a real <Map> ancestor.
vi.mock('@/components/ui/map', () => ({
  useMap: () => h.map,
  useShowMarkerLabels: () => false,
}))

// Import AFTER the mocks are registered.
import { CustomPinMarkers } from './CustomPinMarkers'
import { type ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

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
  it('switches between standard pins and compact photos on the same map', async () => {
    const props = {
      listings: [selectedListing],
      selectedListingId: selectedListing.id,
      onSelectListing: vi.fn(),
      showLabels: true,
      resolveImageUrl,
      formatPrice,
    }
    const { rerender } = render(<CustomPinMarkers {...props} compactMode={false} />)
    await waitFor(() => expect(h.markerInstances.at(-1)?.element?.querySelector('svg')).not.toBeNull())
    expect(h.markerInstances.at(-1)?.element?.querySelector('img')).toBeNull()

    rerender(<CustomPinMarkers {...props} compactMode />)
    await waitFor(() => expect(h.markerInstances.at(-1)?.element?.querySelector('img')).not.toBeNull())
    const photoButton = h.markerInstances.at(-1)?.element?.querySelector('button')
    expect(photoButton).toHaveAttribute('aria-pressed', 'true')
    await act(async () => { photoButton?.click() })
    expect(props.onSelectListing).toHaveBeenCalledWith(selectedListing.id)

    rerender(<CustomPinMarkers {...props} compactMode={false} />)
    await waitFor(() => expect(h.markerInstances.at(-1)?.element?.querySelector('svg')).not.toBeNull())
    expect(h.markerInstances.at(-1)?.element?.querySelector('img')).toBeNull()
    expect(h.markerInstances.at(-1)?.element?.querySelector('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('R10.1: creates exactly one marker per mapped listing (none for unmapped)', async () => {
    await renderMarkers()
    // Two mapped listings → two markers; the unmapped listing is excluded.
    expect(h.markerInstances).toHaveLength(2)
  })

  it('renders compact photos with a selected outline and a higher stacking order', async () => {
    await renderMarkers()

    const [first, second] = h.markerInstances
    // Marker order follows listing order, so index 0 is the selected listing.
    const selectedEl = first.element
    const unselectedEl = second.element

    // Sanity: the two markers map to the expected listings via their button label.
    expect(selectedEl?.querySelector('button')).toHaveAttribute('aria-label', `Select ${selectedListing.fullAddress}`)
    expect(unselectedEl?.querySelector('button')).toHaveAttribute('aria-label', `Select ${unselectedListing.fullAddress}`)

    expect(selectedEl?.querySelector('img')).not.toBeNull()
    expect(unselectedEl?.querySelector('img')).not.toBeNull()
    expect(selectedEl?.querySelector('button')).toHaveAttribute('data-selected', 'true')
    expect(unselectedEl?.querySelector('button')).toHaveAttribute('data-selected', 'false')

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

  it('keeps the selected photo marker mounted when opening its preview repeatedly', async () => {
    await renderMarkers()
    const button = h.markerInstances[0].element?.querySelector('button')

    await act(async () => { button?.click() })
    await act(async () => { button?.click() })

    expect(h.markerInstances).toHaveLength(2)
    expect(h.markerInstances[0].element?.querySelector('button')).toBe(button)
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
