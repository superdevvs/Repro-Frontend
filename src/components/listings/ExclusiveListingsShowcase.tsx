import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { Loader2 } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { buildMarkers, getMapCenter } from '@/lib/listing-presentation/markers'
import { ListingCard } from '@/components/listings/ListingCard'
import { SidebarEmptyState } from '@/components/listings/SidebarEmptyState'
import { FloatingMapActions } from '@/components/listings/map/FloatingMapActions'
// Type-only import: erased at build time, so it does NOT pull maplibre-gl into
// the main bundle (the lazy map chunk below remains the only maplibre entry).
import type { MapHandle } from '@/components/ui/map'

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
            className="h-full min-h-[420px] w-full lg:min-h-[600px]"
          >
            {/* Floating control card with zoom (R1.6). */}
            <MapControls
              position="bottom-left"
              showZoom
              className="rounded-xl border border-border bg-background/80 p-1 shadow-md backdrop-blur-sm"
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
            position="top-right"
            onRecenter={handleRecenter}
            onToggleDrawArea={handleToggleDrawArea}
            onToggleLabels={onToggleLabels}
            onToggleFullscreen={handleToggleFullscreen}
            showLabels={showMarkerLabels}
            drawAreaActive={drawAreaActive}
            isFullscreen={isFullscreen}
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
  <div className="flex h-full min-h-[420px] w-full items-center justify-center lg:min-h-[600px]">
    <div className="text-center text-muted-foreground">
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
}: ExclusiveListingsShowcaseProps) {
  const { theme } = useTheme()

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

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      {/* Map_Region: 70-75% width, sticky, >=600px, single radius/border + shadow. */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-lg lg:sticky lg:top-4 lg:self-start">
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
            theme={theme === 'dark' ? 'dark' : 'light'}
          />
        </Suspense>
      </div>

      {/* Sidebar_Region: 25-30% width, equal height, top-aligned, internal scroll. */}
      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Showcase</p>
            <p className="text-xs text-muted-foreground">
              {mappedListingCount} mapped / {listings.length} total
            </p>
          </div>
        </div>

        <ScrollArea className="lg:h-[600px]">
          <div className="space-y-3 lg:pr-3">
            {!hasListings ? (
              <SidebarEmptyState kind="no-listings" />
            ) : (
              <>
                {!hasMappedListings && <SidebarEmptyState kind="no-mapped" />}
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    resolveImageUrl={resolveImageUrl}
                    formatPrice={formatPrice}
                    onOpenListing={onOpenListing}
                    selected={selectedListingId === listing.id}
                    onSelect={handleSelectListing}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </aside>
    </section>
  )
}

export default ExclusiveListingsShowcase
