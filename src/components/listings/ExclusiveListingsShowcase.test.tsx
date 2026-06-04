// RTL test for ExclusiveListingsShowcase (the Map_Tab showcase).
//
// Feature: map-tab-ui-improvements, Task 18.2: RTL test for showcase layout and
// selection sync.
// Validates: Requirements 2.2, 10.7, 10.9, 7.1
//
// The showcase renders a code-split, maplibre-gl-backed map canvas (lazy import
// of `@/components/ui/map` + `CustomPinMarkers`, both pulling in maplibre-gl,
// which needs WebGL that jsdom lacks) alongside a sidebar of `ListingCard`s and
// `SidebarEmptyState`. To keep this an RTL test focused on layout + selection
// sync + the empty state, we MOCK the heavy/async map pieces so the lazy import
// resolves without maplibre:
//
//   - `@/components/ui/map`            → a fake `Map` that renders its children
//                                        synchronously inside a <div>, plus inert
//                                        `MapControls`/`useMap`/`useShowMarkerLabels`.
//   - `CustomPinMarkers`               → a fake that renders one clickable button
//                                        per listing exposing `data-selected` and
//                                        calling `onSelectListing(id)` on click,
//                                        so we can read/drive the marker selection.
//   - `FloatingMapActions`             → null, to avoid tooltip/portal noise.
//
// We render the showcase in CONTROLLED mode via a small stateful wrapper holding
// `selectedListingId` in `useState` and passing `selectedListingId` +
// `onSelectListing={setSelectedId}`, so a single shared selection propagates to
// BOTH the (mocked) pins and the real `ListingCard`s.

import * as React from 'react'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// --- jsdom polyfills ---------------------------------------------------------
// The sidebar uses a Radix `ScrollArea` (needs `ResizeObserver`) and the
// showcase reads the theme via `ThemeProvider` (which calls `matchMedia`).
// Neither is implemented by jsdom, so polyfill them before any render.
beforeAll(() => {
  if (!('ResizeObserver' in window)) {
    ;(window as unknown as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (typeof window.matchMedia !== 'function') {
    ;(window as unknown as Record<string, unknown>).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
  }
})

// --- map module stub ---------------------------------------------------------
// A fake `Map` that renders its children synchronously (so `CustomPinMarkers`
// renders inside it without maplibre/WebGL). `MapControls` is inert; the map
// context hooks return harmless defaults. The lazy canvas destructures
// `{ Map, MapControls }` from this module, so both must be exported.
vi.mock('@/components/ui/map', () => {
  const Map = React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(
    ({ children }, ref) => (
      <div ref={ref} data-testid="map">{children}</div>
    ),
  )
  Map.displayName = 'MockMap'
  const MapControls = () => null
  return {
    __esModule: true,
    Map,
    MapControls,
    useMap: () => ({}),
    useShowMarkerLabels: () => false,
  }
})

// --- custom pin markers stub -------------------------------------------------
// A fake that renders one clickable button per listing. Each button exposes
// `data-selected` (so the test can assert which marker is selected) and calls
// `onSelectListing(id)` on click (so the test can drive selection from the map).
interface MockPinProps {
  listings: Array<{ id: string }>
  selectedListingId: string | null
  onSelectListing: (id: string) => void
}
vi.mock('@/components/listings/map/CustomPinMarkers', () => {
  const CustomPinMarkers = ({
    listings,
    selectedListingId,
    onSelectListing,
  }: MockPinProps) => (
    <div data-testid="pins">
      {listings.map((l) => (
        <button
          key={l.id}
          type="button"
          data-testid={`pin-${l.id}`}
          data-selected={String(selectedListingId === l.id)}
          onClick={() => onSelectListing(l.id)}
        >
          {l.id}
        </button>
      ))}
    </div>
  )
  return { __esModule: true, CustomPinMarkers, default: CustomPinMarkers }
})

// --- floating map actions stub -----------------------------------------------
// Rendered inside the lazy canvas; stubbed to null to avoid tooltip/portal noise.
vi.mock('@/components/listings/map/FloatingMapActions', () => {
  const FloatingMapActions = () => null
  return { __esModule: true, FloatingMapActions, default: FloatingMapActions }
})

// Import AFTER the mocks are registered.
import {
  ExclusiveListingsShowcase,
  type ShowcaseListing,
} from '@/components/listings/ExclusiveListingsShowcase'
import { ThemeProvider } from '@/hooks/useTheme'

afterEach(() => {
  cleanup()
})

const resolveImageUrl = (v: string | null | undefined): string | null => v ?? null
const formatPrice = (p: number | undefined | null): string =>
  typeof p === 'number' && p > 0 ? `$${p}` : ''
const onOpenListing = vi.fn()

function makeListing(overrides: Partial<ShowcaseListing> = {}): ShowcaseListing {
  return {
    id: 'A',
    address: '123 Maple Street',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    fullAddress: '123 Maple Street, Austin, TX 78701',
    heroImage: undefined,
    client: { name: 'Jane Client' },
    isListingHidden: false,
    isPrivateListing: true,
    listing_type: 'for_sale',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1800,
    price: 1_250_000,
    latitude: 30.2672,
    longitude: -97.7431,
    ...overrides,
  }
}

// Two MAPPED listings (finite coords) for the selection-sync test.
const listingA = makeListing({ id: 'A', latitude: 30.2672, longitude: -97.7431 })
const listingB = makeListing({
  id: 'B',
  address: '456 Oak Avenue',
  latitude: 31.0,
  longitude: -98.0,
  price: 850_000,
})

/**
 * Renders the showcase in CONTROLLED mode: a single shared `selectedListingId`
 * lives here in `useState` and is passed to the showcase together with
 * `onSelectListing={setSelectedId}`, so the selection propagates to BOTH the
 * (mocked) pins and the `ListingCard`s.
 */
function ControlledShowcase({
  listings,
  initialSelectedId = null,
}: {
  listings: ShowcaseListing[]
  initialSelectedId?: string | null
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSelectedId)
  return (
    <ThemeProvider>
      <ExclusiveListingsShowcase
        listings={listings}
        resolveImageUrl={resolveImageUrl}
        formatPrice={formatPrice}
        onOpenListing={onOpenListing}
        selectedListingId={selectedId}
        onSelectListing={setSelectedId}
      />
    </ThemeProvider>
  )
}

/** Returns the outer Card element carrying the given listing id. */
function getCard(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-listing-id="${id}"]`)
  if (!el) throw new Error(`Listing card "${id}" not found`)
  return el
}

describe('ExclusiveListingsShowcase', () => {
  it('R10.9 + R10.7 + R2.2: selection is a single shared identity synced marker↔card both ways', async () => {
    const { container } = render(<ControlledShowcase listings={[listingA, listingB]} />)

    // Wait for the lazy (Suspense) map canvas to resolve and render the pins.
    const pinA = await screen.findByTestId('pin-A')

    // Pre-condition: the first visible property is selected by default so the
    // Selected Property inspector is populated immediately.
    await waitFor(() => {
      expect(screen.getByTestId('pin-A')).toHaveAttribute('data-selected', 'true')
    })
    expect(getCard(container, 'A')).toHaveAttribute('data-selected', 'true')
    expect(getCard(container, 'B')).toHaveAttribute('data-selected', 'false')

    // (1) Marker → card (R10.9): clicking pin B moves the selected-property
    // inspector to B and the matching marker is flagged.
    fireEvent.click(screen.getByTestId('pin-B'))

    await waitFor(() => {
      expect(screen.getByTestId('pin-B')).toHaveAttribute('data-selected', 'true')
    })
    const cardB = getCard(container, 'B')
    expect(cardB).toHaveAttribute('data-selected', 'true')
    expect(cardB.className).toContain('border-blue-500')
    // The other region's listing stays unselected (single shared selection).
    expect(screen.getByTestId('pin-A')).toHaveAttribute('data-selected', 'false')
    expect(getCard(container, 'A')).toHaveAttribute('data-selected', 'false')
    expect(getCard(container, 'A').className).not.toContain('border-blue-500')

    // (2) Card → marker, vice-versa (R10.9): selecting compact row A moves the
    // shared selection to A; pin A reflects it and the previously-selected B is dropped
    // in BOTH regions (selection is single + shared).
    fireEvent.click(getCard(container, 'A'))

    await waitFor(() => {
      expect(screen.getByTestId('pin-A')).toHaveAttribute('data-selected', 'true')
    })
    expect(getCard(container, 'A')).toHaveAttribute('data-selected', 'true')
    expect(getCard(container, 'A').className).toContain('border-blue-500')

    expect(screen.getByTestId('pin-B')).toHaveAttribute('data-selected', 'false')
    expect(getCard(container, 'B')).toHaveAttribute('data-selected', 'false')
    expect(getCard(container, 'B').className).not.toContain('border-blue-500')
  })

  it('R7.1: renders the no-mapped empty state when listings exist but none are mapped', async () => {
    const unmappedA = makeListing({ id: 'A', latitude: undefined, longitude: undefined })
    const unmappedB = makeListing({
      id: 'B',
      address: '456 Oak Avenue',
      latitude: undefined,
      longitude: undefined,
    })

    render(<ControlledShowcase listings={[unmappedA, unmappedB]} />)

    // R7.1: the styled "no mapped listings" sidebar card with its note.
    expect(
      await screen.findByText('Nearby listings will appear here'),
    ).toBeInTheDocument()
  })

  it('R7: renders the no-listings empty state for an empty listing set', async () => {
    render(<ControlledShowcase listings={[]} />)

    expect(
      await screen.findByText(/no listings in this view yet/i),
    ).toBeInTheDocument()
  })
})
