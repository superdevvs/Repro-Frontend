// Custom pin markers for the Exclusive Listings Map Tab.
//
// `CustomPinMarkers` replaces the old `ListingPillMarkers`. For each mapped
// listing it renders a custom teardrop/location-pin SVG (NOT a rounded pill)
// as a MapLibre `Marker`, with:
//   - an optional price/short label chip attached to the pin (R10.2)
//   - a hover `MarkerPreview` popup summarizing the listing (R10.3)
//   - a click that selects the listing via `onSelectListing` (R10.4)
//   - a recolored + enlarged pin for the selected listing relative to the
//     unselected pins (R10.6)
//   - a `MarkerPreview` popup opened for the currently selected listing (R10.8)
//
// It imperatively manages MapLibre markers/popups (rendering React into each
// via `createRoot`) and therefore returns `null`. It MUST be used inside a
// `<Map>` because it consumes `useMap()`.
//
// Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6

import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Marker as MapLibreMarker, Popup as MapLibrePopup } from 'maplibre-gl'

import { cn } from '@/lib/utils'
import { useMap, useShowMarkerLabels } from '@/components/ui/map'
import { buildMarkers } from '@/lib/listing-presentation/markers'
import { MarkerPreview } from '@/components/listings/map/MarkerPreview'
import { type ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

export interface CustomPinMarkersProps {
  /** The listings to map; one pin is rendered per mapped listing (R10.1). */
  listings: ShowcaseListing[]
  /** The currently selected listing id, shared across map + sidebar. */
  selectedListingId: string | null
  /** Invoked with the marker/listing id when a pin is clicked (R10.4). */
  onSelectListing: (id: string) => void
  /**
   * When true, the marker label (price or short fallback) is rendered as a chip
   * on the pin (R10.2). When omitted, the value from `useShowMarkerLabels()`
   * (plumbed from the parent `<Map>`) is used as a fallback; the explicit prop
   * is always the source of truth when provided.
   */
  showLabels?: boolean
  /** Resolves a stored image reference to a usable URL (for the preview). */
  resolveImageUrl: (value: string | null | undefined) => string | null
  /** Formats a numeric price into a display string (for the preview). */
  formatPrice: (price: number | undefined | null) => string
  /** Optional call-to-action invoked from a preview's "View Details" action. */
  onOpenListing?: (listing: ShowcaseListing) => void
}

// Brand colors (consistent with the previous ListingPillMarkers component).
const SELECTED_COLOR = '#d74432' // brand red for the selected pin (R10.6)
const UNSELECTED_COLOR_LIGHT = '#1f5aa6' // brand blue (light theme)
const UNSELECTED_COLOR_DARK = '#3b82f6' // brand blue (dark theme)

// Pin sizes (px). The selected pin is enlarged relative to the others (R10.6).
const PIN_SIZE_UNSELECTED = 34
const PIN_SIZE_SELECTED = 46

interface CustomPinProps {
  label: string
  showLabel: boolean
  selected: boolean
  color: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * Presentational custom pin: a teardrop/location-pin SVG with an optional label
 * chip above it. Rendered imperatively into each MapLibre marker element.
 */
function CustomPin({ label, showLabel, selected, color, onClick }: CustomPinProps) {
  const size = selected ? PIN_SIZE_SELECTED : PIN_SIZE_UNSELECTED

  return (
    <div className="flex select-none flex-col items-center" style={{ pointerEvents: 'auto' }}>
      {showLabel && (
        <span
          className="mb-1 max-w-[140px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-md"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        aria-label={`Select ${label}`}
        aria-pressed={selected}
        onClick={onClick}
        className={cn(
          'group relative block cursor-pointer border-0 bg-transparent p-0 leading-none outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5',
        )}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            filter: 'drop-shadow(0 6px 10px rgba(15, 23, 42, 0.35))',
            display: 'block',
          }}
        >
          {/* Teardrop / location-pin body */}
          <path
            d="M12 1.5c-4.14 0-7.5 3.36-7.5 7.5 0 5.34 6.43 12.31 6.71 12.6a1.08 1.08 0 0 0 1.58 0c.28-.29 6.71-7.26 6.71-12.6 0-4.14-3.36-7.5-7.5-7.5Z"
            fill={color}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
          {/* Inner dot */}
          <circle cx="12" cy="9" r="3" fill="#ffffff" />
        </svg>
      </button>
    </div>
  )
}

interface PopupHandle {
  popup: MapLibrePopup
  container: HTMLDivElement
  root: Root
}

interface MarkerEntry {
  marker: MapLibreMarker
  root: Root
  element: HTMLDivElement
  handleEnter: () => void
  handleLeave: () => void
}

/**
 * Defer `root.unmount()` to a microtask so we never synchronously unmount a
 * React root while React is mid-render (avoids the React 18 root warning).
 */
function scheduleUnmount(root: Root) {
  Promise.resolve().then(() => {
    try {
      root.unmount()
    } catch {
      /* already unmounted */
    }
  })
}

/**
 * Imperatively manages custom pin markers + hover/selected previews for the
 * Map_Region. Returns `null`; all rendering happens into MapLibre markers and
 * popups via `createRoot`. Must be used inside a `<Map>`.
 */
export function CustomPinMarkers({
  listings,
  selectedListingId,
  onSelectListing,
  showLabels,
  resolveImageUrl,
  formatPrice,
  onOpenListing,
}: CustomPinMarkersProps) {
  const map = useMap()
  const labelsFromContext = useShowMarkerLabels()
  // The explicit prop is the source of truth; fall back to the Map context.
  const showLabelsResolved = showLabels ?? labelsFromContext

  // One marker per mapped listing (R10.1); recomputed when listings change.
  const markers = React.useMemo(() => buildMarkers(listings), [listings])
  const listingsById = React.useMemo(
    () => new Map(listings.map((listing) => [listing.id, listing])),
    [listings],
  )

  // Latest-value ref so event handlers (which fire after render) always read
  // current props without forcing the marker effect to re-run on every change.
  const latestRef = React.useRef({
    listingsById,
    resolveImageUrl,
    formatPrice,
    onOpenListing,
    onSelectListing,
  })
  React.useEffect(() => {
    latestRef.current = {
      listingsById,
      resolveImageUrl,
      formatPrice,
      onOpenListing,
      onSelectListing,
    }
  })

  const markerEntriesRef = React.useRef<MarkerEntry[]>([])
  const hoverPopupRef = React.useRef<PopupHandle | null>(null)
  const selectedPopupRef = React.useRef<PopupHandle | null>(null)

  const openHoverPopup = React.useCallback(
    (listing: ShowcaseListing, lngLat: [number, number]) => {
      const handle = hoverPopupRef.current
      if (!handle || !map) return
      const { resolveImageUrl: resolve, formatPrice: format, onOpenListing: open } =
        latestRef.current
      handle.root.render(
        <MarkerPreview
          listing={listing}
          resolveImageUrl={resolve}
          formatPrice={format}
          onOpenListing={open}
        />,
      )
      handle.popup.setLngLat(lngLat).addTo(map)
    },
    [map],
  )

  const closeHoverPopup = React.useCallback(() => {
    hoverPopupRef.current?.popup.remove()
  }, [])

  // Create the two shared popups (hover + selected) once per map instance.
  React.useEffect(() => {
    if (!map) return

    const makePopup = (closeButton: boolean): PopupHandle => {
      const container = document.createElement('div')
      const root = createRoot(container)
      const popup = new MapLibrePopup({
        offset: 28,
        closeButton,
        closeOnClick: false,
        className: 'listing-marker-popup',
        maxWidth: 'none',
      })
      popup.setDOMContent(container)
      return { popup, container, root }
    }

    const hover = makePopup(false)
    const selected = makePopup(true)
    hoverPopupRef.current = hover
    selectedPopupRef.current = selected

    return () => {
      hover.popup.remove()
      selected.popup.remove()
      scheduleUnmount(hover.root)
      scheduleUnmount(selected.root)
      hoverPopupRef.current = null
      selectedPopupRef.current = null
    }
  }, [map])

  // Render / re-render the pins whenever the marker set, selection, or label
  // visibility changes.
  React.useEffect(() => {
    if (!map) return

    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    const unselectedColor = isDark ? UNSELECTED_COLOR_DARK : UNSELECTED_COLOR_LIGHT

    const clearEntries = () => {
      markerEntriesRef.current.forEach(({ marker, root, element, handleEnter, handleLeave }) => {
        element.removeEventListener('mouseenter', handleEnter)
        element.removeEventListener('mouseleave', handleLeave)
        marker.remove()
        scheduleUnmount(root)
      })
      markerEntriesRef.current = []
    }

    clearEntries()

    markers.forEach((marker) => {
      const selected = marker.id === selectedListingId
      const color = selected ? SELECTED_COLOR : unselectedColor
      const lngLat: [number, number] = [marker.coords.lng, marker.coords.lat]

      const element = document.createElement('div')
      // Elevate the selected pin above the others (R10.6).
      element.style.zIndex = selected ? '30' : '10'

      const root = createRoot(element)
      root.render(
        <CustomPin
          label={marker.label}
          showLabel={showLabelsResolved}
          selected={selected}
          color={color}
          onClick={(event) => {
            event.stopPropagation()
            latestRef.current.onSelectListing(marker.id)
          }}
        />,
      )

      const handleEnter = () => {
        // The selected listing already has its own (persistent) popup.
        if (selected) return
        const listing = latestRef.current.listingsById.get(marker.id)
        if (!listing) return
        openHoverPopup(listing, lngLat)
      }
      const handleLeave = () => closeHoverPopup()

      element.addEventListener('mouseenter', handleEnter)
      element.addEventListener('mouseleave', handleLeave)

      const mapMarker = new MapLibreMarker({ element, anchor: 'bottom' })
        .setLngLat(lngLat)
        .addTo(map)

      markerEntriesRef.current.push({
        marker: mapMarker,
        root,
        element,
        handleEnter,
        handleLeave,
      })
    })

    return clearEntries
  }, [map, markers, selectedListingId, showLabelsResolved, openHoverPopup, closeHoverPopup])

  // Open / update the selected-listing preview popup (R10.8); close it when no
  // listing is selected or the selection is no longer mapped.
  React.useEffect(() => {
    const handle = selectedPopupRef.current
    if (!map || !handle) return

    const { resolveImageUrl: resolve, formatPrice: format, onOpenListing: open } =
      latestRef.current

    if (!selectedListingId) {
      handle.popup.remove()
      return
    }

    const marker = markers.find((m) => m.id === selectedListingId)
    const listing = listingsById.get(selectedListingId)
    if (!marker || !listing) {
      handle.popup.remove()
      return
    }

    handle.root.render(
      <MarkerPreview
        listing={listing}
        resolveImageUrl={resolve}
        formatPrice={format}
        onOpenListing={open}
      />,
    )
    handle.popup.setLngLat([marker.coords.lng, marker.coords.lat]).addTo(map)
  }, [map, selectedListingId, markers, listingsById])

  return null
}

export default CustomPinMarkers
