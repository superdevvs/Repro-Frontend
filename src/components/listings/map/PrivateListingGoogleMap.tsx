import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Loader2, Minus, Plus } from 'lucide-react'

import { FloatingMapActions } from '@/components/listings/map/FloatingMapActions'
import { MarkerPreview } from '@/components/listings/map/MarkerPreview'
import type { ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'
import {
  loadGoogleMaps,
  type GoogleInfoWindowInstance,
  type GoogleMapInstance,
  type GoogleMapOptions,
  type GoogleMapsApi,
  type GoogleMapsListener,
  type GoogleMarkerInstance,
} from '@/components/shoots/history/googleMapsLoader'
import { toValidMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_MAP_CENTER,
  buildMarkerLocationGroups,
  buildMarkers,
  getMapCenter,
  markerLabel,
  type MarkerLocationGroup,
} from '@/lib/listing-presentation/markers'
import { cn } from '@/lib/utils'

export type PrivateListingMapTheme = 'light' | 'dark'

interface MapPadding {
  bottom: number
  left: number
  right: number
  top: number
}

interface GoogleMapWithEdgePadding extends GoogleMapInstance {
  fitBounds: (
    bounds: Parameters<GoogleMapInstance['fitBounds']>[0],
    padding?: number | MapPadding,
  ) => void
}

interface PopupHandle {
  container: HTMLDivElement
  infoWindow: GoogleInfoWindowInstance
  root: Root
}

interface ListingMarkerEntry {
  group: MarkerLocationGroup
  listeners: GoogleMapsListener[]
  marker: GoogleMarkerInstance
}

export interface PrivateListingGoogleMapProps {
  apiKey?: string
  className?: string
  formatPrice: (price: number | undefined | null) => string
  listings: ShowcaseListing[]
  onLoadError?: (error: Error) => void
  onOpenListing: (listing: ShowcaseListing) => void
  onSelectListing: (id: string) => void
  onToggleLabels: () => void
  resolveImageUrl: (value: string | null | undefined) => string | null
  selectedListingId: string | null
  showMarkerLabels: boolean
  theme: PrivateListingMapTheme
}

const SELECTED_PIN_COLOR = '#d74432'
const LIGHT_PIN_COLOR = '#1f5aa6'
const DARK_PIN_COLOR = '#3b82f6'

const DARK_MAP_STYLES: ReadonlyArray<Record<string, unknown>> = [
  { elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#374151' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#172033' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#13281f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#263244' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#071827' }] },
]

const mapOptionsForTheme = (theme: PrivateListingMapTheme): GoogleMapOptions => ({
  clickableIcons: false,
  fullscreenControl: false,
  gestureHandling: 'cooperative',
  mapTypeControl: false,
  rotateControl: false,
  scaleControl: true,
  streetViewControl: false,
  styles: theme === 'dark' ? DARK_MAP_STYLES : null,
  zoomControl: false,
})

const getFitPadding = (): MapPadding => {
  if (typeof window === 'undefined') {
    return { top: 80, right: 372, bottom: 64, left: 64 }
  }
  if (window.innerWidth >= 1024) {
    return { top: 80, right: 372, bottom: 64, left: 64 }
  }
  return {
    top: 72,
    right: 32,
    bottom: Math.round(window.innerHeight * 0.42) + 24,
    left: 32,
  }
}

const createPinIcon = (
  label: string,
  count: number,
  selected: boolean,
  showLabel: boolean,
  theme: PrivateListingMapTheme,
): string => {
  const color = selected
    ? SELECTED_PIN_COLOR
    : theme === 'dark'
      ? DARK_PIN_COLOR
      : LIGHT_PIN_COLOR
  const pinSize = selected ? 46 : 36
  const width = showLabel ? 168 : 64
  const height = showLabel ? 78 : 58
  const pinTop = showLabel ? 28 : 4
  const pinLeft = (width - pinSize) / 2
  const scale = pinSize / 24
  const chipWidth = Math.min(152, Math.max(58, label.length * 7 + 20))
  const chipLeft = (width - chipWidth) / 2
  const countMarkup = count > 1
    ? `<circle cx="${pinLeft + pinSize - 3}" cy="${pinTop + 5}" r="10" fill="#2563eb" stroke="#fff" stroke-width="2"/><text x="${pinLeft + pinSize - 3}" y="${pinTop + 8.5}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="700" fill="#fff">${count}</text>`
    : ''
  const labelMarkup = showLabel
    ? `<rect x="${chipLeft}" y="1" width="${chipWidth}" height="23" rx="11.5" fill="${color}"/><text x="${width / 2}" y="16.5" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">${label}</text>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${labelMarkup}<g transform="translate(${pinLeft} ${pinTop}) scale(${scale})" style="filter:drop-shadow(0 6px 8px rgba(15,23,42,.36))"><path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 1.5c-4.14 0-7.5 3.36-7.5 7.5 0 5.34 6.43 12.31 6.71 12.6a1.08 1.08 0 0 0 1.58 0c.28-.29 6.71-7.26 6.71-12.6 0-4.14-3.36-7.5-7.5-7.5Z"/><circle cx="12" cy="9" r="3" fill="#fff"/></g>${countMarkup}</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const scheduleUnmount = (root: Root) => {
  Promise.resolve().then(() => {
    try {
      root.unmount()
    } catch {
      // The popup root may already have been released during map teardown.
    }
  })
}

const createPopup = (maps: GoogleMapsApi): PopupHandle => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const infoWindow = new maps.InfoWindow({ maxWidth: 320 })
  infoWindow.setContent(container)
  return { container, infoWindow, root }
}

const normalizeMappedListings = (listings: ShowcaseListing[]): ShowcaseListing[] =>
  listings.flatMap((listing) => {
    const coords = toValidMapCoordinates(listing.latitude, listing.longitude)
    return coords ? [{ ...listing, latitude: coords.lat, longitude: coords.lng }] : []
  })

export function PrivateListingGoogleMap({
  apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  className,
  formatPrice,
  listings,
  onLoadError,
  onOpenListing,
  onSelectListing,
  onToggleLabels,
  resolveImageUrl,
  selectedListingId,
  showMarkerLabels,
  theme,
}: PrivateListingGoogleMapProps) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null)
  const mapElementRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<GoogleMapInstance | null>(null)
  const mapsApiRef = React.useRef<GoogleMapsApi | null>(null)
  const markersRef = React.useRef<ListingMarkerEntry[]>([])
  const hoverPopupRef = React.useRef<PopupHandle | null>(null)
  const selectedPopupRef = React.useRef<PopupHandle | null>(null)
  const idleListenerRef = React.useRef<GoogleMapsListener | null>(null)
  const onLoadErrorRef = React.useRef(onLoadError)
  const themeRef = React.useRef(theme)
  const latestRef = React.useRef({ formatPrice, onOpenListing, onSelectListing, resolveImageUrl })
  const [mapsApi, setMapsApi] = React.useState<GoogleMapsApi | null>(null)
  const [isReady, setIsReady] = React.useState(false)
  const [loadError, setLoadError] = React.useState<Error | null>(null)
  const [retryVersion, setRetryVersion] = React.useState(0)
  const [drawAreaActive, setDrawAreaActive] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  onLoadErrorRef.current = onLoadError
  themeRef.current = theme
  latestRef.current = { formatPrice, onOpenListing, onSelectListing, resolveImageUrl }

  const mappedListings = React.useMemo(() => normalizeMappedListings(listings), [listings])
  const markerGroups = React.useMemo(
    () => buildMarkerLocationGroups(mappedListings),
    [mappedListings],
  )
  const initialCenter = React.useMemo(
    () => getMapCenter(buildMarkers(mappedListings), selectedListingId),
    [mappedListings, selectedListingId],
  )

  const clearMarkers = React.useCallback(() => {
    markersRef.current.forEach(({ listeners, marker }) => {
      listeners.forEach((listener) => listener.remove())
      marker.setMap(null)
    })
    markersRef.current = []
    hoverPopupRef.current?.infoWindow.close()
    selectedPopupRef.current?.infoWindow.close()
  }, [])

  const reportLoadError = React.useCallback((error: Error) => {
    setLoadError(error)
    setIsReady(false)
    onLoadErrorRef.current?.(error)
  }, [])

  const fitAllLocations = React.useCallback(() => {
    const map = mapRef.current
    const maps = mapsApiRef.current
    if (!map || !maps) return
    idleListenerRef.current?.remove()
    idleListenerRef.current = null
    if (markerGroups.length === 0) {
      map.setCenter(DEFAULT_MAP_CENTER)
      map.setZoom(4)
      return
    }

    const bounds = new maps.LatLngBounds()
    markerGroups.forEach((group) => bounds.extend(group.coords))
    ;(map as GoogleMapWithEdgePadding).fitBounds(bounds, getFitPadding())
    idleListenerRef.current = maps.event.addListenerOnce(map, 'idle', () => {
      const zoom = map.getZoom()
      const maximumZoom = markerGroups.length === 1 ? 13 : 15
      if (typeof zoom === 'number' && zoom > maximumZoom) map.setZoom(maximumZoom)
      idleListenerRef.current = null
    })
  }, [markerGroups])

  React.useEffect(() => {
    let cancelled = false
    const previousAuthFailure = window.gm_authFailure
    const handleAuthFailure = () => {
      previousAuthFailure?.()
      if (!cancelled) {
        reportLoadError(
          new Error('Google Maps rejected the browser key or its website restrictions.'),
        )
      }
    }
    window.gm_authFailure = handleAuthFailure
    setLoadError(null)
    setIsReady(false)

    void loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !mapElementRef.current) return
        try {
          const map = new maps.Map(mapElementRef.current, {
            ...mapOptionsForTheme(themeRef.current),
            center: initialCenter,
            zoom: markerGroups.length > 0 ? 10 : 4,
          })
          mapRef.current = map
          mapsApiRef.current = maps
          hoverPopupRef.current = createPopup(maps)
          selectedPopupRef.current = createPopup(maps)
          setMapsApi(maps)
          setIsReady(true)
        } catch (error) {
          reportLoadError(
            error instanceof Error ? error : new Error('Google Maps could not be initialized.'),
          )
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          reportLoadError(
            error instanceof Error ? error : new Error('Google Maps could not be loaded.'),
          )
        }
      })

    return () => {
      cancelled = true
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = previousAuthFailure
      }
      idleListenerRef.current?.remove()
      idleListenerRef.current = null
      clearMarkers()
      if (mapsApiRef.current && mapRef.current) {
        mapsApiRef.current.event.clearInstanceListeners(mapRef.current)
      }
      if (hoverPopupRef.current) scheduleUnmount(hoverPopupRef.current.root)
      if (selectedPopupRef.current) scheduleUnmount(selectedPopupRef.current.root)
      hoverPopupRef.current = null
      selectedPopupRef.current = null
      mapRef.current = null
      mapsApiRef.current = null
      setMapsApi(null)
    }
    // Map construction is intentionally tied only to the key/retry attempt.
    // Listings and theme are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, clearMarkers, reportLoadError, retryVersion])

  React.useEffect(() => {
    mapRef.current?.setOptions(mapOptionsForTheme(theme))
  }, [theme])

  React.useEffect(() => {
    const map = mapRef.current
    if (!mapsApi || !map) return
    clearMarkers()

    const orderedGroups = [...markerGroups].sort((left, right) => {
      const leftSelected = left.listings.some((listing) => listing.id === selectedListingId)
      const rightSelected = right.listings.some((listing) => listing.id === selectedListingId)
      return Number(leftSelected) - Number(rightSelected)
    })

    orderedGroups.forEach((group) => {
      const selected = group.listings.some((listing) => listing.id === selectedListingId)
      const listing =
        group.listings.find((candidate) => candidate.id === selectedListingId) ?? group.listings[0]
      const marker = new mapsApi.Marker({
        icon: createPinIcon(
          markerLabel(listing),
          group.listings.length,
          selected,
          showMarkerLabels,
          theme,
        ),
        map,
        optimized: false,
        position: group.coords,
        title: listing.fullAddress || listing.address || 'Private Listing',
      })
      const listeners = [
        marker.addListener('click', () => {
          hoverPopupRef.current?.infoWindow.close()
          latestRef.current.onSelectListing(listing.id)
        }),
        marker.addListener('mouseover', () => {
          if (selected) return
          const popup = hoverPopupRef.current
          if (!popup) return
          popup.root.render(
            <MarkerPreview
              listing={listing}
              relatedListings={group.listings}
              resolveImageUrl={latestRef.current.resolveImageUrl}
              formatPrice={latestRef.current.formatPrice}
              onOpenListing={latestRef.current.onOpenListing}
              onSelectListing={latestRef.current.onSelectListing}
            />,
          )
          popup.infoWindow.open({ anchor: marker, map, shouldFocus: false })
        }),
        marker.addListener('mouseout', () => hoverPopupRef.current?.infoWindow.close()),
      ]
      markersRef.current.push({ group, listeners, marker })
    })

    fitAllLocations()
    return clearMarkers
  }, [
    clearMarkers,
    fitAllLocations,
    mapsApi,
    markerGroups,
    selectedListingId,
    showMarkerLabels,
    theme,
  ])

  React.useEffect(() => {
    const map = mapRef.current
    const popup = selectedPopupRef.current
    if (!mapsApi || !map || !popup) return
    if (!selectedListingId) {
      popup.infoWindow.close()
      return
    }

    const entry = markersRef.current.find(({ group }) =>
      group.listings.some((listing) => listing.id === selectedListingId),
    )
    const listing = entry?.group.listings.find(
      (candidate) => candidate.id === selectedListingId,
    )
    if (!entry || !listing) {
      popup.infoWindow.close()
      return
    }

    popup.root.render(
      <MarkerPreview
        listing={listing}
        relatedListings={entry.group.listings}
        resolveImageUrl={latestRef.current.resolveImageUrl}
        formatPrice={latestRef.current.formatPrice}
        onOpenListing={latestRef.current.onOpenListing}
        onSelectListing={latestRef.current.onSelectListing}
      />,
    )
    popup.infoWindow.open({ anchor: entry.marker, map, shouldFocus: false })
  }, [mapsApi, markerGroups, selectedListingId])

  React.useEffect(() => {
    const map = mapRef.current
    const element = mapElementRef.current
    if (!mapsApi || !map || !element) return
    let frame = 0
    const handleResize = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        mapsApi.event.trigger(map, 'resize')
        fitAllLocations()
      })
    }
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(handleResize)
      observer.observe(element)
      return () => {
        window.cancelAnimationFrame(frame)
        observer.disconnect()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [fitAllLocations, mapsApi])

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleToggleFullscreen = React.useCallback(() => {
    if (typeof document === 'undefined' || !canvasRef.current) return
    if (document.fullscreenElement) {
      void document.exitFullscreen?.()
    } else {
      void canvasRef.current.requestFullscreen?.()
    }
  }, [])

  const changeZoom = React.useCallback((delta: number) => {
    const map = mapRef.current
    if (!map) return
    const currentZoom = map.getZoom()
    map.setZoom(Math.max(2, Math.min(20, (currentZoom ?? 10) + delta)))
  }, [])

  return (
    <div
      ref={canvasRef}
      className={cn('relative h-full w-full bg-background', className)}
      data-map-provider="google"
      aria-busy={!isReady}
    >
      <div
        ref={mapElementRef}
        className="h-full w-full"
        role="region"
        aria-label={`Private listings map with ${markerGroups.length} mapped ${markerGroups.length === 1 ? 'location' : 'locations'}`}
      />

      {!isReady && !loadError ? (
        <div className="absolute inset-0 grid place-items-center bg-background" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading private listings map…
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 grid place-items-center bg-background/95 px-6" role="alert">
          <div className="max-w-sm space-y-3 text-center">
            <p className="text-sm font-medium text-foreground">Google Maps is unavailable.</p>
            <p className="text-xs text-muted-foreground">{loadError.message}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setRetryVersion((value) => value + 1)}>
              Retry map
            </Button>
          </div>
        </div>
      ) : null}

      {isReady ? (
        <>
          <div className="absolute bottom-[45%] left-3 z-10 flex flex-col rounded-xl border border-slate-300/80 bg-white/82 p-1 text-slate-700 shadow-xl backdrop-blur-xl lg:bottom-4 lg:left-4 dark:border-white/15 dark:bg-slate-950/72 dark:text-white">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-blue-600 hover:text-white"
              aria-label="Zoom in on map"
              onClick={() => changeZoom(1)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-blue-600 hover:text-white"
              aria-label="Zoom out of map"
              onClick={() => changeZoom(-1)}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <FloatingMapActions
            position="bottom-left"
            onRecenter={fitAllLocations}
            onToggleDrawArea={() => setDrawAreaActive((value) => !value)}
            onToggleLabels={onToggleLabels}
            onToggleFullscreen={handleToggleFullscreen}
            showLabels={showMarkerLabels}
            drawAreaActive={drawAreaActive}
            isFullscreen={isFullscreen}
            className="!bottom-[6.75rem] !left-4 hidden border-slate-300/80 bg-white/82 text-slate-700 shadow-xl backdrop-blur-xl lg:flex dark:border-white/15 dark:bg-slate-950/72 dark:text-white [&_button]:text-slate-700 [&_button:hover]:bg-blue-600 [&_button:hover]:text-white dark:[&_button]:text-slate-200"
          />
        </>
      ) : null}

      {isReady && markerGroups.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-6">
          <div className="rounded-full border border-border bg-background/90 px-4 py-2 text-center text-sm text-muted-foreground shadow-sm backdrop-blur">
            No mapped listings yet.
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PrivateListingGoogleMap
