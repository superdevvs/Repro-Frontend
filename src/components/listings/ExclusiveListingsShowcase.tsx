import React, { Suspense, lazy, useEffect, useMemo, useRef } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { Bath, BedDouble, ExternalLink, Loader2, MapPin, Ruler } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { getBathroomMetricDisplay } from '@/utils/shootPropertyDisplay'

const DEFAULT_LISTING_CENTER = { lat: 39.8283, lng: -98.5795 }

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
  listing_type?: 'for_sale' | 'for_rent'
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  price?: number
  latitude?: number
  longitude?: number
  coordsSource?: 'api' | 'cache' | 'geocode'
}

interface ExclusiveListingsShowcaseProps {
  listings: ShowcaseListing[]
  resolveImageUrl: (value: string | null | undefined) => string | null
  formatPrice: (price: number | undefined | null) => string
  onOpenListing: (listing: ShowcaseListing) => void
}

interface ListingMarker {
  id: string
  label: string
  coords: { lat: number; lng: number }
}

interface ListingMapCanvasProps {
  markers: ListingMarker[]
  selectedMarkerId: string | null
  onSelectMarker: (listingId: string) => void
  theme: 'light' | 'dark'
}

const formatShortPrice = (price?: number | null) => {
  if (!price) return 'Listing'
  if (price >= 1_000_000) {
    const compact = price / 1_000_000
    return `$${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)}M`
  }
  return `$${Math.round(price / 1000)}K`
}

const getMapCenter = (markers: ListingMarker[], selectedMarkerId: string | null) => {
  const selectedMarker = markers.find((marker) => marker.id === selectedMarkerId)
  if (selectedMarker) return selectedMarker.coords
  if (markers.length === 0) return DEFAULT_LISTING_CENTER
  if (markers.length === 1) return markers[0].coords

  const totals = markers.reduce(
    (acc, marker) => ({
      lat: acc.lat + marker.coords.lat,
      lng: acc.lng + marker.coords.lng,
    }),
    { lat: 0, lng: 0 },
  )

  return {
    lat: totals.lat / markers.length,
    lng: totals.lng / markers.length,
  }
}

const hasCoords = (listing: ShowcaseListing) =>
  Number.isFinite(listing.latitude) && Number.isFinite(listing.longitude)

const LazyListingMap = lazy(() =>
  import('@/components/ui/map').then((module) => {
    const { Map, MapControls, useMap } = module

    const ListingPillMarkers = ({
      markers,
      selectedMarkerId,
      onSelectMarker,
    }: {
      markers: ListingMarker[]
      selectedMarkerId: string | null
      onSelectMarker: (listingId: string) => void
    }) => {
      const map = useMap()
      const markerRefs = useRef<Array<{ marker: { remove: () => void }; root: Root }>>([])

      useEffect(() => {
        let cancelled = false

        const clearMarkers = () => {
          markerRefs.current.forEach(({ marker, root }) => {
            root.unmount()
            marker.remove()
          })
          markerRefs.current = []
        }

        const renderMarkers = async () => {
          clearMarkers()
          const { Marker } = await import('maplibre-gl')
          if (cancelled) return

          markers.forEach((marker) => {
            const element = document.createElement('div')
            const root = createRoot(element)
            root.render(
              <button
                type="button"
                aria-label={`Select ${marker.label}`}
                className={cn(
                  'inline-flex h-10 min-w-[72px] items-center justify-center rounded-full px-4 text-sm font-semibold shadow-[0_14px_32px_rgba(15,23,42,0.28)] transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600',
                  selectedMarkerId === marker.id
                    ? 'bg-[#d74432] text-white'
                    : 'bg-[#1f5aa6] text-white hover:bg-[#174982]',
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelectMarker(marker.id)
                }}
              >
                {marker.label}
              </button>,
            )

            const mapMarker = new Marker({
              element,
              anchor: 'center',
            })
              .setLngLat([marker.coords.lng, marker.coords.lat])
              .addTo(map)

            markerRefs.current.push({ marker: mapMarker, root })
          })
        }

        renderMarkers()

        return () => {
          cancelled = true
          clearMarkers()
        }
      }, [map, markers, onSelectMarker, selectedMarkerId])

      return null
    }

    const ListingMapCanvas = ({
      markers,
      selectedMarkerId,
      onSelectMarker,
      theme,
    }: ListingMapCanvasProps) => {
      const center = getMapCenter(markers, selectedMarkerId)
      const zoom = markers.length > 1 ? 10 : 13

      return (
        <div className="relative min-h-[360px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:min-h-[620px]">
          <Map
            center={[center.lng, center.lat]}
            zoom={zoom}
            theme={theme}
            className="h-full min-h-[360px] w-full lg:min-h-[620px]"
          >
            <MapControls position="top-right" showZoom />
            <ListingPillMarkers
              markers={markers}
              selectedMarkerId={selectedMarkerId}
              onSelectMarker={onSelectMarker}
            />
          </Map>
          {markers.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-lg border border-white/70 bg-white/90 px-4 py-3 text-center text-sm text-slate-600 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-300">
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

export function ExclusiveListingsShowcase({
  listings,
  resolveImageUrl,
  formatPrice,
  onOpenListing,
}: ExclusiveListingsShowcaseProps) {
  const { theme } = useTheme()
  const [selectedListingId, setSelectedListingId] = React.useState<string | null>(() => listings[0]?.id ?? null)

  useEffect(() => {
    if (selectedListingId && listings.some((listing) => listing.id === selectedListingId)) return
    setSelectedListingId(listings[0]?.id ?? null)
  }, [listings, selectedListingId])

  const markers = useMemo<ListingMarker[]>(
    () =>
      listings
        .filter(hasCoords)
        .map((listing) => ({
          id: listing.id,
          label: formatShortPrice(listing.price),
          coords: {
            lat: listing.latitude as number,
            lng: listing.longitude as number,
          },
        })),
    [listings],
  )

  const mappedListingCount = markers.length

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Suspense
        fallback={
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-border bg-muted/30 lg:min-h-[620px]">
            <div className="text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
              <p className="text-sm">Loading map...</p>
            </div>
          </div>
        }
      >
        <LazyListingMap
          markers={markers}
          selectedMarkerId={selectedListingId}
          onSelectMarker={setSelectedListingId}
          theme={theme === 'dark' ? 'dark' : 'light'}
        />
      </Suspense>

      <aside className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Showcase</p>
            <p className="text-xs text-muted-foreground">
              {mappedListingCount} mapped / {listings.length} total
            </p>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 lg:block lg:max-h-[620px] lg:space-y-3 lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
          {listings.map((listing) => {
            const heroUrl = resolveImageUrl(listing.heroImage) || '/placeholder.svg'
            const bathroomDisplay = getBathroomMetricDisplay(listing.bathrooms)
            const selected = selectedListingId === listing.id
            const locationLine = [listing.city, listing.state, listing.zip].filter(Boolean).join(' ')
            const listingTypeLabel =
              listing.listing_type === 'for_rent'
                ? 'For Rent'
                : listing.listing_type === 'for_sale'
                  ? 'For Sale'
                  : 'Active'

            return (
              <button
                key={listing.id}
                type="button"
                className={cn(
                  'group w-[300px] flex-shrink-0 overflow-hidden rounded-lg border bg-background text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md lg:w-full',
                  selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border/70',
                  listing.isListingHidden && 'opacity-70',
                )}
                onMouseEnter={() => setSelectedListingId(listing.id)}
                onFocus={() => setSelectedListingId(listing.id)}
                onClick={() => onOpenListing(listing)}
              >
                <div className="flex gap-3 p-3">
                  <div className="relative h-24 w-28 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                    <img
                      src={heroUrl}
                      alt={listing.address}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                      {formatShortPrice(listing.price)}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold leading-tight text-foreground">
                          {formatPrice(listing.price) || 'Private Listing'}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
                          {listing.address}
                        </p>
                      </div>
                      <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                    </div>

                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{locationLine || listing.fullAddress}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {listing.bedrooms && (
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" />
                          {listing.bedrooms} bd
                        </span>
                      )}
                      {bathroomDisplay && (
                        <span className="inline-flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" />
                          {bathroomDisplay.value} ba
                        </span>
                      )}
                      {listing.sqft && (
                        <span className="inline-flex items-center gap-1">
                          <Ruler className="h-3.5 w-3.5" />
                          {listing.sqft.toLocaleString()} sf
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                        {listingTypeLabel}
                      </Badge>
                      {!hasCoords(listing) && (
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-300">
                          No map pin
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {listings.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No listings match this area.
          </div>
        )}
      </aside>
    </section>
  )
}

export default ExclusiveListingsShowcase
