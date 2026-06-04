import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { Loader2 } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/lib/sonner-toast'
import { buildMarkers, getMapCenter } from '@/lib/listing-presentation/markers'
import { CompactListingRow } from '@/components/listings/CompactListingRow'
import { SelectedPropertyCard } from '@/components/listings/SelectedPropertyCard'
import { SidebarEmptyState } from '@/components/listings/SidebarEmptyState'
import { FloatingMapActions } from '@/components/listings/map/FloatingMapActions'
// Type-only import: erased at build time, so it does NOT pull maplibre-gl into
// the main bundle (the lazy map chunk below remains the only maplibre entry).
import type { MapHandle } from '@/components/ui/map'

const LISTING_BOOKMARKS_KEY = 'exclusive-listing-bookmarks-v1'

const readBookmarkedIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LISTING_BOOKMARKS_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

export interface ShowcaseListing {
  id: string
  address: string
  city: string
  state: string
  zip: string
  fullAddress: string
  heroImage?: string
  client: {
    name: string
    email?: string
  }
  isListingHidden: boolean
  isPrivateListing: boolean
  listing_type?: 'for_sale' | 'for_rent'
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  price?: number
  latitude?: number
  longitude?: number
  coordsSource?: 'api' | 'cache' | 'geocode'
}

/**
 * Props for the Map Tab showcase.
 *
 * `selectedListingId`, `onSelectListing`, and `showMarkerLabels` are OPTIONAL to
 * support a controlled-or-uncontrolled pattern:
 *
 * - Controlled: when `selectedListingId` AND `onSelectListing` are both provided
 *   (e.g. by `PrivateListingPortal` via `useListingPresentation` in task 19),
 *   the component reads/writes the shared selection through them.
 * - Uncontrolled: when they are omitted (the current call site), the component
 *   falls back to internal selection state so existing callers keep working.
 *
 * `showMarkerLabels` seeds the marker-label visibility; the floating "toggle
 * property labels" action flips a local copy so the action stays functional in
 * both modes.
 */
interface ExclusiveListingsShowcaseProps {
  listings: ShowcaseListing[]
  resolveImageUrl: (value: string | null | undefined) => string | null
  formatPrice: (price: number | undefined | null) => string
  onOpenListing: (listing: ShowcaseListing) => void
  selectedListingId?: string | null
  onSelectListing?: (id: string) => void
  showMarkerLabels?: boolean
  controlsOverlay?: ReactNode
}

export const hasCoords = (l: ShowcaseListing): boolean =>
  Number.isFinite(l.latitude) && Number.isFinite(l.longitude)

interface ListingMapCanvasProps {
  listings: ShowcaseListing[]
  selectedListingId: string | null
  onSelectListing: (id: string) => void
  showMarkerLabels: boolean
  onToggleLabels: () => void
  resolveImageUrl: (value: string | null | undefined) => string | null
  formatPrice: (price: number | undefined | null) => string
  onOpenListing: (listing: ShowcaseListing) => void
  theme: 'light' | 'dark'
}

// The maplibre-powered map canvas is code-split so maplibre-gl stays out of the
// main bundle (preserving the original lazy-map pattern). `CustomPinMarkers` and
// the `Map` component both statically import maplibre-gl, so importing them here
// (dynamically) keeps the heavy dependency in this lazy chunk.
const LazyListingMapCanvas = lazy(() =>
  Promise.all([
    import('@/components/ui/map'),
    import('@/components/listings/map/CustomPinMarkers'),
  ]).then(([mapModule, pinModule]) => {
    const { Map, MapControls } = mapModule
    const { CustomPinMarkers } = pinModule

    const ListingMapCanvas: ComponentType<ListingMapCanvasProps> = ({
      listings,
      selectedListingId,
      onSelectListing,
      showMarkerLabels,
      onToggleLabels,
      resolveImageUrl,
      formatPrice,
      onOpenListing,
      theme,
    }) => {
      const mapRef = useRef<MapHandle>(null)
      const canvasRef = useRef<HTMLDivElement>(null)
      const [drawAreaActive, setDrawAreaActive] = useState(false)
      const [isFullscreen, setIsFullscreen] = useState(false)

      const markers = useMemo(() => buildMarkers(listings), [listings])
      const center = useMemo(
        () => getMapCenter(markers, selectedListingId),
        [markers, selectedListingId],
      )
      const zoom = markers.length > 1 ? 10 : 13

      // Recenter on the loaded mapped listings (R8.2).
      const handleRecenter = useCallback(() => {
        const coords = markers.map((marker) => marker.coords)
        if (coords.length === 0) return
        mapRef.current?.recenter(coords)
      }, [markers])

      // Draw-area mode is a local stub toggle for now (R8.1).
      const handleToggleDrawArea = useCallback(() => {
        setDrawAreaActive((prev) => !prev)
      }, [])

      // Fullscreen the map container; restore on exit (R8.4).
      const handleToggleFullscreen = useCallback(() => {
        const container = canvasRef.current
        if (!container) return
        if (typeof document === 'undefined') return
        if (document.fullscreenElement) {
          void document.exitFullscreen?.()
        } else {
          void container.requestFullscreen?.()
        }
      }, [])

      useEffect(() => {
        if (typeof document === 'undefined') return
        const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
        document.addEventListener('fullscreenchange', handleChange)
        return () => document.removeEventListener('fullscreenchange', handleChange)
      }, [])

      return (
        <div ref={canvasRef} className="relative h-full w-full bg-background">
          <Map
            ref={mapRef}
            center={[center.lng, center.lat]}
            zoom={zoom}
            theme={theme}
            showMarkerLabels={showMarkerLabels}
            className="h-full min-h-0 w-full rounded-none"
          >
            <MapControls
              position="bottom-left"
              showZoom
              className="!bottom-[45%] !left-3 rounded-xl border border-white/15 bg-slate-950/72 p-1 text-white shadow-xl backdrop-blur-xl lg:!bottom-4 lg:!left-4 [&_button]:border-white/10 [&_button]:bg-slate-950/55 [&_button:hover]:bg-blue-600"
            />
            {/* Custom pins + hover/selected previews; shared selection (R10). */}
            <CustomPinMarkers
              listings={listings}
              selectedListingId={selectedListingId}
              onSelectListing={onSelectListing}
              showLabels={showMarkerLabels}
              resolveImageUrl={resolveImageUrl}
              formatPrice={formatPrice}
              onOpenListing={onOpenListing}
            />
          </Map>

          {/* Floating map actions: recenter / draw / labels / fullscreen (R8). */}
          <FloatingMapActions
            position="bottom-left"
            onRecenter={handleRecenter}
            onToggleDrawArea={handleToggleDrawArea}
            onToggleLabels={onToggleLabels}
            onToggleFullscreen={handleToggleFullscreen}
            showLabels={showMarkerLabels}
            drawAreaActive={drawAreaActive}
            isFullscreen={isFullscreen}
            className="!bottom-[6.75rem] !left-4 hidden border-white/15 bg-slate-950/72 text-white shadow-xl backdrop-blur-xl lg:flex [&_button]:text-slate-200 [&_button:hover]:bg-blue-600 [&_button:hover]:text-white"
          />

          {markers.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-6">
              <div className="rounded-full border border-border bg-background/90 px-4 py-2 text-center text-sm text-muted-foreground shadow-sm backdrop-blur">
                No mapped listings yet.
              </div>
            </div>
          )}
        </div>
      )
    }

    return { default: ListingMapCanvas }
  }),
)

const MapLoadingFallback = () => (
  <div className="flex h-full min-h-[560px] w-full items-center justify-center bg-slate-950">
    <div className="text-center text-slate-300">
      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
      <p className="text-sm">Loading map...</p>
    </div>
  </div>
)

export function ExclusiveListingsShowcase({
  listings,
  resolveImageUrl,
  formatPrice,
  onOpenListing,
  selectedListingId: selectedListingIdProp,
  onSelectListing: onSelectListingProp,
  showMarkerLabels: showMarkerLabelsProp,
  controlsOverlay,
}: ExclusiveListingsShowcaseProps) {
  // Controlled-or-uncontrolled selection: use the props when both are provided,
  // otherwise fall back to internal state so existing callers keep working.
  const isSelectionControlled =
    selectedListingIdProp !== undefined && typeof onSelectListingProp === 'function'
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    () => listings[0]?.id ?? null,
  )

  useEffect(() => {
    if (isSelectionControlled) return
    if (internalSelectedId && listings.some((listing) => listing.id === internalSelectedId)) {
      return
    }
    setInternalSelectedId(listings[0]?.id ?? null)
  }, [listings, internalSelectedId, isSelectionControlled])

  const selectedListingId = isSelectionControlled
    ? selectedListingIdProp ?? null
    : internalSelectedId

  const handleSelectListing = useCallback(
    (id: string) => {
      if (isSelectionControlled) {
        onSelectListingProp?.(id)
      } else {
        setInternalSelectedId(id)
      }
    },
    [isSelectionControlled, onSelectListingProp],
  )

  useEffect(() => {
    if (selectedListingId || listings.length === 0) return
    handleSelectListing(listings[0].id)
  }, [handleSelectListing, listings, selectedListingId])

  // Marker-label visibility seeded from the (optional) prop; the floating action
  // toggles a local copy so it works in both controlled and uncontrolled modes.
  const [showMarkerLabels, setShowMarkerLabels] = useState<boolean>(
    showMarkerLabelsProp ?? false,
  )
  useEffect(() => {
    if (typeof showMarkerLabelsProp === 'boolean') {
      setShowMarkerLabels(showMarkerLabelsProp)
    }
  }, [showMarkerLabelsProp])
  const handleToggleLabels = useCallback(() => {
    setShowMarkerLabels((prev) => !prev)
  }, [])

  const mappedListingCount = useMemo(
    () => listings.filter(hasCoords).length,
    [listings],
  )
  const hasListings = listings.length > 0
  const hasMappedListings = mappedListingCount > 0
  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) ?? listings[0] ?? null,
    [listings, selectedListingId],
  )
  const otherListings = useMemo(
    () => listings.filter((listing) => listing.id !== selectedListing?.id),
    [listings, selectedListing?.id],
  )
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(readBookmarkedIds)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LISTING_BOOKMARKS_KEY, JSON.stringify(Array.from(bookmarkedIds)))
    } catch {
      // Bookmarking remains available for the current session.
    }
  }, [bookmarkedIds])

  const handleToggleBookmark = useCallback((listing: ShowcaseListing) => {
    setBookmarkedIds((current) => {
      const next = new Set(current)
      if (next.has(listing.id)) {
        next.delete(listing.id)
      } else {
        next.add(listing.id)
      }
      return next
    })
  }, [])

  const handleShareListing = useCallback(async (listing: ShowcaseListing) => {
    const url = `${window.location.origin}/tour/branded?shootId=${encodeURIComponent(listing.id)}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: listing.address || 'Private listing',
          text: listing.fullAddress || listing.address,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('Listing link copied')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('Unable to share listing')
    }
  }, [])

  const handleFocusOnMap = useCallback(
    (listing: ShowcaseListing) => {
      handleSelectListing(listing.id)
    },
    [handleSelectListing],
  )

  return (
    <section
      data-testid="showcase-map-canvas"
      className="relative h-[calc(100svh-11.5rem)] min-h-[600px] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
    >
      <Suspense fallback={<MapLoadingFallback />}>
        <LazyListingMapCanvas
          listings={listings}
          selectedListingId={selectedListingId}
          onSelectListing={handleSelectListing}
          showMarkerLabels={showMarkerLabels}
          onToggleLabels={handleToggleLabels}
          resolveImageUrl={resolveImageUrl}
          formatPrice={formatPrice}
          onOpenListing={onOpenListing}
          theme="dark"
        />
      </Suspense>

      {controlsOverlay ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 lg:left-4 lg:right-[372px] lg:top-4">
          <div className="pointer-events-auto">{controlsOverlay}</div>
        </div>
      ) : null}

      <aside className="absolute inset-x-3 bottom-3 z-20 max-h-[42%] overflow-hidden rounded-2xl border border-white/15 bg-slate-950/78 text-white shadow-2xl backdrop-blur-2xl lg:inset-y-4 lg:left-auto lg:right-4 lg:max-h-none lg:w-[340px]">
        <ScrollArea className="h-full">
          <div className="space-y-4 p-3">
            {!hasListings ? (
              <SidebarEmptyState
                kind="no-listings"
                className="border-white/10 bg-slate-950/35 text-white shadow-none [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-slate-300"
              />
            ) : (
              <>
                {selectedListing ? (
                  <section className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3 px-1">
                      <div>
                        <h2 className="text-sm font-semibold text-white">Featured Listing</h2>
                        <p className="text-[11px] text-slate-300">
                          {mappedListingCount} mapped / {listings.length} total
                        </p>
                      </div>
                      <span className="rounded-md border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-200">
                        Selected
                      </span>
                    </div>
                    <SelectedPropertyCard
                      listing={selectedListing}
                      resolveImageUrl={resolveImageUrl}
                      formatPrice={formatPrice}
                      bookmarked={bookmarkedIds.has(selectedListing.id)}
                      onOpenListing={onOpenListing}
                      onShareListing={handleShareListing}
                      onFocusOnMap={handleFocusOnMap}
                      onToggleBookmark={handleToggleBookmark}
                    />
                  </section>
                ) : null}

                {!hasMappedListings ? (
                  <SidebarEmptyState
                    kind="no-mapped"
                    className="hidden border-white/10 bg-slate-950/35 text-white shadow-none [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-slate-300 lg:block"
                  />
                ) : null}

                <section className="hidden space-y-2.5 lg:block">
                  <h2 className="px-1 text-xs font-semibold text-slate-200">
                    All Private Listings ({otherListings.length})
                  </h2>
                  {otherListings.length > 0 ? (
                    <div className="space-y-2">
                      {otherListings.map((listing) => (
                        <CompactListingRow
                          key={listing.id}
                          listing={listing}
                          resolveImageUrl={resolveImageUrl}
                          selected={selectedListingId === listing.id}
                          bookmarked={bookmarkedIds.has(listing.id)}
                          onSelect={handleSelectListing}
                          onToggleBookmark={handleToggleBookmark}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/15 px-4 py-5 text-center text-xs text-slate-400">
                      No other private listings in this view.
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </aside>
    </section>
  )
}

export default ExclusiveListingsShowcase
