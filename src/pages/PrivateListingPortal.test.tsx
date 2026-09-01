// RTL integration test for PrivateListingPortal (the Map Tab portal shell).
//
// Feature: map-tab-ui-improvements, Task 19.2: RTL integration test for the portal.
// Validates: Requirements 4.3, 5.1, 5.3, 4.9
//
// PrivateListingPortal is a heavy integration page: it fetches listings from
// `/api/shoots` on mount, renders inside `DashboardLayout`, reads auth/toast/
// router context, talks to TanStack Query, and (in `showcase` mode) renders the
// new `SummaryCards` + `MapTabToolbar` ABOVE the Leaflet-backed Map Tab
// (`ExclusiveListingsShowcase`). To keep this test hermetic and focused on the
// Map Tab INTEGRATION (not the network), we mock aggressively:
//
//   - `global.fetch`                         → resolves a controlled private-listing
//                                              payload; call count is tracked so we
//                                              can prove filtering issues NO request.
//   - `@/components/auth/AuthProvider`       → useAuth() → { role: 'admin' }.
//   - `@/hooks/use-toast`                    → useToast() → { toast: noop }.
//   - `react-router-dom`                     → real module + useNavigate() → noop.
//   - `@/components/layout/DashboardLayout`  → passthrough (<>{children}</>).
//   - `@/components/layout/DashboardRouteSkeleton` → null (loading placeholder).
//   - `@/components/layout/PageHeader`       → null.
//   - `@/components/ui/map`                  → fake Map rendering children + inert
//                                              MapControls/useMap/useShowMarkerLabels
//                                              (so Leaflet/layout code never loads).
//   - `@/components/listings/map/CustomPinMarkers` → fake clickable pins.
//   - `@/components/listings/map/FloatingMapActions` → null.
//
// Real, un-mocked pieces (the integration surface under test): the presentation
// hook `useListingPresentation`, the pure `lib/listing-presentation/*` logic,
// `SummaryCards`, `MapTabToolbar` (CommandBar/ViewSwitcher/FilterMenu/SortMenu/
// SavedViewsMenu/FilterChipBar), `ListingCard`, and the showcase wiring. We wrap
// the portal in a REAL `QueryClientProvider` + `ThemeProvider` for fidelity.

import * as React from 'react'

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import {
  SAVED_VIEWS_KEY,
  serializeSavedViews,
} from '@/lib/listing-presentation/saved-views'
import type { SavedView } from '@/lib/listing-presentation/types'

// --- context / layout module stubs ------------------------------------------
// Auth: default to admin, with individual tests able to exercise client-only
// controls without rebuilding the module mock.
const authState = vi.hoisted(() => ({ role: 'admin' }))

vi.mock('@/components/auth/AuthProvider', () => ({
  __esModule: true,
  useAuth: () => ({ role: authState.role }),
}))

// Toast: a no-op so portal toasts don't require the toaster provider.
vi.mock('@/hooks/use-toast', () => ({
  __esModule: true,
  useToast: () => ({ toast: () => {} }),
  toast: () => {},
}))

// Router: keep the real module but make `useNavigate` a no-op so the portal
// doesn't need a <Router> in the tree.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => () => {} }
})

// Layout: passthrough/null so we avoid unrelated provider dependencies (sidebar,
// navbar, route skeletons, page header) that aren't part of this feature.
vi.mock('@/components/layout/DashboardLayout', () => ({
  __esModule: true,
  DashboardLayout: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/layout/DashboardRouteSkeleton', () => ({
  __esModule: true,
  DashboardRouteSkeleton: () => <div data-testid="route-skeleton" />,
}))
vi.mock('@/components/layout/PageHeader', () => ({
  __esModule: true,
  PageHeader: () => null,
}))

// --- map module stub ---------------------------------------------------------
// The showcase code-splits a Leaflet-backed canvas (lazy import of
// `@/components/ui/map` + `CustomPinMarkers`). Leaflet needs browser layout
// APIs that jsdom lacks, so we replace the map module with a fake `Map` that renders its
// children synchronously inside a <div data-testid="map">, plus inert controls
// and harmless context-hook defaults.
vi.mock('@/components/ui/map', () => {
  // `forwardRef` so the canvas's `mapRef` attaches cleanly (the real Map exposes
  // an imperative handle); the ref is never dereferenced here since the floating
  // actions that call it are stubbed to null.
  const Map = React.forwardRef<unknown, { children?: React.ReactNode }>(
    ({ children }, _ref) => <div data-testid="map">{children}</div>,
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
// One clickable button per listing; calls `onSelectListing(id)` on click. Keeps
// the lazy canvas resolvable without a browser map runtime.
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
vi.mock('@/components/listings/map/FloatingMapActions', () => {
  const FloatingMapActions = () => null
  return { __esModule: true, FloatingMapActions, default: FloatingMapActions }
})

// Import AFTER the mocks are registered.
import PrivateListingPortal from '@/pages/PrivateListingPortal'
import { ThemeProvider } from '@/hooks/useTheme'

// --- jsdom polyfills ---------------------------------------------------------
// Radix popovers (FilterMenu / SavedViewsMenu) + cmdk + the sidebar ScrollArea
// rely on DOM APIs jsdom doesn't implement. Polyfill them so portal-rendered
// menus open under userEvent and the ScrollArea/ThemeProvider don't crash.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>
  if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn()
  if (!proto.hasPointerCapture) proto.hasPointerCapture = vi.fn(() => false)
  if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn()
  if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn()
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

// --- controlled private-listing payload --------------------------------------
// Four PRIVATE listings, all non-hidden and all MAPPED (finite coords) so the
// portal's Nominatim geocoding effect never fires — keeping the network surface
// to exactly the single `/api/shoots` load. Two are `for_sale` (ids 1, 2), so
// toggling the "For Sale" filter changes the displayed/summary count 4 -> 2.
const SHOOTS = [
  {
    id: 1,
    address: '123 Maple Street',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    is_private_listing: true,
    is_listing_hidden: false,
    listing_type: 'for_sale',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1800,
    price: 1_250_000,
    latitude: 30.2672,
    longitude: -97.7431,
    client: { name: 'Jane Client' },
  },
  {
    id: 2,
    address: '456 Oak Avenue',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    is_private_listing: true,
    is_listing_hidden: false,
    listing_type: 'for_sale',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2400,
    price: 850_000,
    latitude: 32.7767,
    longitude: -96.797,
    client: { name: 'Bob Client' },
  },
  {
    id: 3,
    address: '789 Pine Road',
    city: 'Austin',
    state: 'TX',
    zip: '78704',
    is_private_listing: true,
    is_listing_hidden: false,
    listing_type: 'for_rent',
    bedrooms: 2,
    bathrooms: 1,
    sqft: 1100,
    price: 3000,
    latitude: 30.25,
    longitude: -97.75,
    client: { name: 'Carol Client' },
  },
  {
    id: 4,
    address: '321 Elm Boulevard',
    city: 'Houston',
    state: 'TX',
    zip: '77002',
    is_private_listing: true,
    is_listing_hidden: false,
    listing_type: 'for_rent',
    bedrooms: 1,
    bathrooms: 1,
    sqft: 700,
    price: 0,
    latitude: 29.7604,
    longitude: -95.3698,
    client: { name: 'Dave Client' },
  },
]

// The mock fetch: resolves the shoots payload for `/api/shoots` and a benign
// empty payload for anything else. Reassigned per-test so call counts reset.
let fetchMock: ReturnType<typeof vi.fn>

/** Number of fetch calls made to the listings endpoint. */
function shootFetchCount(): number {
  return fetchMock.mock.calls.filter(([input]) =>
    String(input).includes('/api/shoots'),
  ).length
}

function renderPortal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PrivateListingPortal />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

/** Waits for the initial load to settle: the summary cards + Map Tab render. */
async function waitForLoaded() {
  // Summary cards render once `loading` flips to false after the fetch resolves.
  await screen.findByTestId('summary-cards')
  // The lazy (Suspense) map canvas resolves to the mocked <div data-testid="map">.
  await screen.findByTestId('map')
}

beforeEach(() => {
  authState.role = 'admin'
  // Keep this portal-shell suite independent from local browser credentials;
  // the Google map renderer is covered by its dedicated provider tests.
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
  window.localStorage.clear()
  // Pin a theme so ThemeProvider's initializer doesn't depend on matchMedia.
  window.localStorage.setItem('theme', 'light')

  fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/shoots')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: SHOOTS }),
      } as Response)
    }
    // Defensive default so any unexpected call resolves harmlessly.
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)
  })
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('PrivateListingPortal — Map Tab integration', () => {
  it('keeps client scope, a restrained search, and view controls in one browse row', async () => {
    const user = userEvent.setup()
    authState.role = 'client'
    renderPortal()
    await waitForLoaded()

    await user.click(screen.getByRole('radio', { name: 'Grid view' }))

    const toolbar = screen.getByTestId('listing-browse-toolbar')
    const scope = within(toolbar).getByTestId('listing-scope-control')
    const search = within(toolbar).getByTestId('listing-browse-search')
    const viewSwitcher = within(toolbar).getByTestId('listing-browse-view-switcher')

    expect(toolbar).toHaveClass('md:flex-nowrap')
    expect(toolbar).toContainElement(scope)
    expect(toolbar).toContainElement(search)
    expect(toolbar).toContainElement(viewSwitcher)
    expect(search).toHaveClass('flex-1', 'md:min-w-0', 'md:max-w-xl', 'xl:max-w-2xl')
    expect(within(scope).getByText('All Listings')).toBeVisible()
    expect(within(scope).getByText('My Listings')).toBeVisible()
    expect(
      scope.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      search.compareDocumentPosition(viewSwitcher) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(within(viewSwitcher).getByRole('button', { name: 'List view' }))
    expect(screen.getByTestId('listing-browse-toolbar')).toContainElement(
      screen.getByTestId('listing-scope-control'),
    )
  })

  it('keeps secondary grid-card text readable in dark mode', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('theme', 'dark')
    renderPortal()
    await waitForLoaded()

    await user.click(screen.getByRole('radio', { name: 'Grid view' }))

    const location = await screen.findByText('Austin, TX 78701')
    expect(location).toHaveClass('dark:text-white')

    const sqftLabel = screen.getAllByText('Sq Ft')[0]
    expect(sqftLabel).toHaveClass('dark:text-white/80')

    const clientName = screen.getByText('Jane Client')
    expect(clientName.parentElement?.parentElement).toHaveClass('dark:text-white')

    const listingType = screen.getAllByText('For Sale')[0]
    expect(listingType).toHaveClass('dark:text-white/80')
  })

  it('R5.1 + R6.1: renders the summary cards and toolbar over the Map Tab canvas', async () => {
    renderPortal()
    await waitForLoaded()

    // The compact overlay keeps only the total inventory metric and places it
    // in the same non-wrapping command row as search and filters.
    const summaryCards = screen.getByTestId('summary-cards')
    expect(within(summaryCards).getByTestId('summary-card-total')).toHaveTextContent(
      'Total Listings',
    )
    expect(within(summaryCards).queryByTestId('summary-card-mapped')).not.toBeInTheDocument()
    expect(within(summaryCards).queryByTestId('summary-card-unmapped')).not.toBeInTheDocument()
    expect(within(summaryCards).queryByTestId('summary-card-private')).not.toBeInTheDocument()
    expect(within(summaryCards).queryByTestId('summary-card-hidden')).not.toBeInTheDocument()

    // The four listings yield total=4; the Mapped statistic is not rendered.
    expect(screen.getByTestId('summary-value-total')).toHaveTextContent('4')
    expect(screen.queryByTestId('summary-value-mapped')).not.toBeInTheDocument()

    // R6.1: the MapTabToolbar keeps Filters and the Map/Grid/List ViewSwitcher,
    // while Saved views lives in the header immediately before Add Listing.
    const filtersButton = screen.getByRole('button', { name: /Filters/i })
    expect(filtersButton).toBeInTheDocument()
    expect(within(filtersButton).getByText('Filters')).toHaveClass('lg:max-2xl:hidden')
    const sortButton = screen.getByRole('button', { name: 'Sort: Newest' })
    expect(within(sortButton).getByText('Newest')).toHaveClass('lg:max-2xl:hidden')
    const savedViewsButton = screen.getByRole('button', { name: /Saved views/i })
    const addListingButton = screen.getByRole('button', { name: 'Add Listing' })
    const headerActions = screen.getByTestId('listing-header-actions')
    expect(headerActions).toContainElement(savedViewsButton)
    expect(headerActions).toContainElement(addListingButton)
    expect(
      savedViewsButton.compareDocumentPosition(addListingButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Saved views/i })).toHaveLength(1)
    expect(screen.getByRole('radio', { name: 'Map view' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Grid view' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'List view' })).toBeInTheDocument()

    // The redesigned Map Tab keeps the summary cards and toolbar inside the
    // same full-canvas map workspace as floating overlays.
    const map = screen.getByTestId('map')
    const canvas = screen.getByTestId('showcase-map-canvas')
    const toolbar = within(canvas).getByTestId('map-tab-toolbar')
    const primaryRow = within(toolbar).getByTestId('map-toolbar-primary-row')
    const commandBar = within(primaryRow).getByTestId('listing-command-bar')
    const searchShell = within(commandBar).getByTestId('listing-search-shell')
    const mapControls = within(canvas).getByTestId('map-controls-overlay')
    expect(canvas).toContainElement(map)
    expect(canvas).toContainElement(summaryCards)
    expect(canvas).toContainElement(filtersButton)
    expect(primaryRow).toContainElement(summaryCards)
    expect(summaryCards.querySelector('dt')).toHaveTextContent('Total listings')
    expect(primaryRow).toHaveClass('min-w-0', 'flex-nowrap')
    expect(commandBar).toHaveClass('min-w-0', 'flex-nowrap')
    expect(searchShell).toHaveClass('min-w-[6rem]', 'flex-1')
    expect(mapControls).toHaveClass('lg:right-[332px]', '2xl:right-[372px]')
    expect(within(canvas).queryByRole('button', { name: /Saved views/i })).not.toBeInTheDocument()
  })

  it('R4.3 + R5.3: applying a filter updates the summary and listings without a network call', async () => {
    const user = userEvent.setup()
    renderPortal()
    await waitForLoaded()

    // Baseline: 4 listings shown, and exactly one network load has occurred.
    expect(screen.getByTestId('summary-value-total')).toHaveTextContent('4')
    expect(screen.getByTestId('pins')).toBeInTheDocument()
    // One pin per displayed listing (the mocked CustomPinMarkers).
    expect(screen.getAllByTestId(/^pin-/)).toHaveLength(4)

    const loadFetchCount = shootFetchCount()
    const totalFetchCalls = fetchMock.mock.calls.length
    expect(loadFetchCount).toBe(1)

    // Open the Filters popover and toggle "For Sale" on (client-side filter).
    await user.click(screen.getByRole('button', { name: /Filters/i }))
    const forSale = await screen.findByRole('menuitemcheckbox', { name: 'For Sale' })
    await user.click(forSale)

    // R4.3 + R5.3: the displayed set and the summary recompute to the 2 for_sale
    // listings — entirely client-side.
    await waitFor(() => {
      expect(screen.getByTestId('summary-value-total')).toHaveTextContent('2')
    })
    await waitFor(() => {
      expect(screen.getAllByTestId(/^pin-/)).toHaveLength(2)
    })

    // R4.3: NO additional network request was issued for the filter — both the
    // listings-endpoint count and the overall fetch count are unchanged.
    expect(shootFetchCount()).toBe(loadFetchCount)
    expect(fetchMock.mock.calls.length).toBe(totalFetchCalls)
  })

  it('R4.9: saved views are loaded from localStorage on mount', async () => {
    const user = userEvent.setup()

    // Seed a valid serialized Saved_View under the canonical key BEFORE render,
    // so the portal's mount-time `parseSavedViews(localStorage.getItem(...))`
    // picks it up.
    const seeded: SavedView = {
      id: 'v_seed_1',
      name: 'Austin For Sale',
      filters: [{ kind: 'city', value: 'Austin' }, { kind: 'forSale' }],
      sort: 'priceDesc',
    }
    window.localStorage.setItem(SAVED_VIEWS_KEY, serializeSavedViews([seeded]))

    renderPortal()
    await waitForLoaded()

    // Open the Saved-views menu; the seeded view is listed by name (proving the
    // load-on-mount path via parseSavedViews).
    await user.click(screen.getByRole('button', { name: /Saved views/i }))
    expect(
      await screen.findByRole('button', { name: 'Austin For Sale' }),
    ).toBeInTheDocument()
  })
})
