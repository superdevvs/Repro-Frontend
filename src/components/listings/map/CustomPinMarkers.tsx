// Photo markers and on-demand listing details for the fallback map.
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  divIcon,
  marker as createLeafletMarker,
  popup as createLeafletPopup,
  type Marker as LeafletMarker,
  type Popup as LeafletPopup,
} from 'leaflet'

import { StandardListingPin } from './StandardListingPinMarker'
import { ListingPhotoMarker } from './ListingPhotoMarker'
import { resolveCardImage } from '@/lib/listing-presentation/card'
import './listingPhotoMarkers.css'
import { useMap, useShowMarkerLabels } from '@/components/ui/map'
import {
  buildMarkerLocationGroups,
  markerLabel,
} from '@/lib/listing-presentation/markers'
import { MarkerPreview } from '@/components/listings/map/MarkerPreview'
import { type ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

export interface CustomPinMarkersProps {
  /** The listings to map; one pin is rendered per mapped listing (R10.1). */
  compactMode?: boolean
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

interface PopupHandle {
  popup: LeafletPopup
  container: HTMLDivElement
  root: Root
}

interface MarkerEntry {
  marker: LeafletMarker
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
 * Map_Region. Returns `null`; all rendering happens into Leaflet markers and
 * popups via `createRoot`. Must be used inside a `<Map>`.
 */
export function CustomPinMarkers({
  listings,
  compactMode = true,
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

  // One pin per property location; every shoot at that location remains
  // available through the marker preview carousel.
  const locationGroups = React.useMemo(
    () => buildMarkerLocationGroups(listings),
    [listings],
  )
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
  const [previewRequested, setPreviewRequested] = React.useState(compactMode ? 0 : 1)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const cancelClose = React.useCallback(() => { clearTimeout(closeTimerRef.current) }, [])
  const selectedPopupRef = React.useRef<PopupHandle | null>(null)

  const updatePopup = React.useCallback((handle: PopupHandle) => {
    const rect = handle.container.getBoundingClientRect()
    if (rect.height > 0 && map) {
      const point = map.latLngToContainerPoint(handle.popup.getLatLng())
      const size = map.getSize()
      const left = Math.max(16, Math.min(point.x - rect.width / 2, size.x - rect.width - 16))
      const top = Math.max(120, Math.min(point.y - 74 - rect.height, size.y - rect.height - 24))
      // Keep details inside the viewport without moving the photo out from
      // underneath the pointer, which would dismiss a hover preview.
      handle.popup.options.offset = [left + rect.width / 2 - point.x, top + rect.height - point.y]
    }
    handle.popup.update()
  }, [map])

  const openHoverPopup = React.useCallback(
    (
      listing: ShowcaseListing,
      relatedListings: ShowcaseListing[],
      lngLat: [number, number],
    ) => {
      cancelClose()
      const handle = hoverPopupRef.current
      if (!handle || !map) return
      const { resolveImageUrl: resolve, formatPrice: format, onOpenListing: open } =
        latestRef.current
      handle.root.render(
        <MarkerPreview compact={compactMode}
          onLayout={() => updatePopup(handle)}
          listing={listing}
          resolveImageUrl={resolve}
          formatPrice={format}
          onOpenListing={open}
          relatedListings={relatedListings}
          onSelectListing={(id) => {
            setPreviewRequested((version) => version + 1)
            latestRef.current.onSelectListing(id)
          }}
        />,
      )
      handle.popup.setLatLng([lngLat[1], lngLat[0]]).openOn(map)
    },
    [map, cancelClose, updatePopup, compactMode],
  )

  const closeHoverPopup = React.useCallback(() => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => hoverPopupRef.current?.popup.remove(), 200)
  }, [cancelClose])

  // Create the two shared popups (hover + selected) once per map instance.
  React.useEffect(() => {
    if (!map) return

    const makePopup = (closeButton: boolean): PopupHandle => {
      const container = document.createElement('div')
      const root = createRoot(container)
      const popup = createLeafletPopup({
        offset: [0, compactMode ? -74 : -28],
        closeButton,
        closeOnClick: true,
        autoPan: false,
        autoPanPaddingTopLeft: [16, 120],
        autoPanPaddingBottomRight: [16, 24],
        className: 'listing-marker-popup',
        minWidth: compactMode ? 240 : 256,
        maxWidth: compactMode ? 240 : 320,
      })
      popup.setContent(container)
      return { popup, container, root }
    }

    const hover = makePopup(false)
    const selected = makePopup(true)
    hover.container.addEventListener("mouseenter", cancelClose)
    hover.container.addEventListener("mouseleave", closeHoverPopup)
    hover.container.addEventListener("focusin", cancelClose)
    hover.container.addEventListener("focusout", closeHoverPopup)
    hoverPopupRef.current = hover
    selectedPopupRef.current = selected

    return () => {
      cancelClose()
      hover.popup.remove()
      selected.popup.remove()
      scheduleUnmount(hover.root)
      scheduleUnmount(selected.root)
      hoverPopupRef.current = null
      selectedPopupRef.current = null
    }
  }, [map, cancelClose, closeHoverPopup, compactMode])

  // Render / re-render the pins whenever the marker set, selection, or label
  // visibility changes.
  React.useEffect(() => {
    if (!map) return

    const clearEntries = () => {
      markerEntriesRef.current.forEach(({ marker, root, element, handleEnter, handleLeave }) => {
        element.removeEventListener('mouseenter', handleEnter)
        element.removeEventListener('mouseleave', handleLeave)
        element.removeEventListener('focusin', handleEnter)
        element.removeEventListener('focusout', handleLeave)
        marker.remove()
        scheduleUnmount(root)
      })
      markerEntriesRef.current = []
    }

    clearEntries()

    locationGroups.forEach((group) => {
      const selectedListing =
        group.listings.find((listing) => listing.id === selectedListingId) ??
        group.listings[0]
      const selected = group.listings.some((listing) => listing.id === selectedListingId)
      const lngLat: [number, number] = [group.coords.lng, group.coords.lat]
      const label = markerLabel(selectedListing)

      const element = document.createElement('div')
      // Elevate the selected pin above the others (R10.6).
      element.style.zIndex = selected ? '30' : '10'

      const root = createRoot(element)
      const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        cancelClose()
        hoverPopupRef.current?.popup.remove()
        setPreviewRequested((version) => version + 1)
        latestRef.current.onSelectListing(selectedListing.id)
      }
      root.render(compactMode ? (
        <ListingPhotoMarker
          address={selectedListing.fullAddress || selectedListing.address || 'Private listing'}
          imageUrl={resolveCardImage(selectedListing.heroImage, latestRef.current.resolveImageUrl)}
          label={label} showLabel={showLabelsResolved} selected={selected}
          count={group.listings.length} onClick={handleClick}
        />
      ) : (
        <StandardListingPin label={label} showLabel={showLabelsResolved} selected={selected}
          color={selected ? '#d74432' : '#3b82f6'} count={group.listings.length} onClick={handleClick} />
      ))

      const handleEnter = () => {
        // The selected listing already has its own (persistent) popup.
        const selectedPopup = selectedPopupRef.current?.popup
        if (selected && selectedPopup && map.hasLayer(selectedPopup)) return
        const listing = latestRef.current.listingsById.get(selectedListing.id)
        if (!listing) return
        openHoverPopup(listing, group.listings, lngLat)
      }
      const handleLeave = () => closeHoverPopup()

      element.addEventListener('mouseenter', handleEnter)
      element.addEventListener('mouseleave', handleLeave)
      element.addEventListener('focusin', handleEnter)
      element.addEventListener('focusout', handleLeave)

      const iconHeight = compactMode ? 70 : selected ? 76 : 64
      const mapMarker = createLeafletMarker([lngLat[1], lngLat[0]], {
        icon: divIcon({
          html: element,
          className: 'listing-pin-marker',
          iconSize: [compactMode ? 64 : 160, iconHeight],
          iconAnchor: [compactMode ? 32 : 80, iconHeight],
          popupAnchor: [0, -iconHeight],
        }),
        keyboard: false,
        zIndexOffset: selected ? 1000 : 0,
      }).addTo(map)

      markerEntriesRef.current.push({
        marker: mapMarker,
        root,
        element,
        handleEnter,
        handleLeave,
      })
    })

    return clearEntries
  }, [map, locationGroups, selectedListingId, showLabelsResolved, openHoverPopup, closeHoverPopup, cancelClose, compactMode])

  // Open / update the selected-listing preview popup (R10.8); close it when no
  // listing is selected or the selection is no longer mapped.
  React.useEffect(() => {
    const handle = selectedPopupRef.current
    if (!map || !handle) return

    const { resolveImageUrl: resolve, formatPrice: format, onOpenListing: open } =
      latestRef.current

    if (!previewRequested || !selectedListingId) {
      handle.popup.remove()
      return
    }

    const group = locationGroups.find((candidate) =>
      candidate.listings.some((listing) => listing.id === selectedListingId),
    )
    const listing = listingsById.get(selectedListingId)
    if (!group || !listing) {
      handle.popup.remove()
      return
    }

    handle.root.render(
      <MarkerPreview compact={compactMode}
        onLayout={() => updatePopup(handle)}
        listing={listing}
        resolveImageUrl={resolve}
        formatPrice={format}
        onOpenListing={open}
        relatedListings={group.listings}
        onSelectListing={latestRef.current.onSelectListing}
      />,
    )
    handle.popup
      .setLatLng([group.coords.lat, group.coords.lng])
      .openOn(map)
  }, [map, selectedListingId, locationGroups, listingsById, previewRequested, updatePopup, compactMode])

  return null
}

export default CustomPinMarkers
