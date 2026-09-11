import { createRoot } from 'react-dom/client'
import type { GoogleMapInstance, GoogleMapsApi } from '@/components/shoots/history/googleMapsLoader'
import type { ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'
import { ListingPhotoMarker } from './ListingPhotoMarker'
import { resolveCardImage } from '@/lib/listing-presentation/card'
import { markerLabel } from '@/lib/listing-presentation/markers'
import './listingPhotoMarkers.css'

export function createGooglePhotoMarker({ maps, map, listing, count, selected, showLabel,
  resolveImageUrl, onClick, onEnter, onLeave,
}: {
  maps: GoogleMapsApi
  map: GoogleMapInstance
  listing: ShowcaseListing
  count: number
  selected: boolean
  showLabel: boolean
  resolveImageUrl: (value: string | null | undefined) => string | null
  onClick: () => void
  onEnter: () => void
  onLeave: () => void
}) {
  const overlay = new maps.OverlayView()
  const element = document.createElement('div')
  element.style.cssText = `position:absolute;transform:translate(-50%,-100%);padding-bottom:6px;z-index:${selected ? 30 : 10}`
  const root = createRoot(element)
  root.render(<ListingPhotoMarker
    address={listing.fullAddress || listing.address || 'Private listing'}
    imageUrl={resolveCardImage(listing.heroImage, resolveImageUrl)}
    label={markerLabel(listing)} selected={selected} showLabel={showLabel} count={count}
    onClick={(event) => { event.stopPropagation(); onClick() }}
    onMouseEnter={() => { element.style.zIndex = '50'; onEnter() }}
    onMouseLeave={() => { element.style.zIndex = selected ? '30' : '10'; onLeave() }}
    onFocus={onEnter} onBlur={onLeave}
    onKeyDown={(event) => { if (event.key === 'Escape') onLeave() }}
  />)
  // Keep map drag/zoom gestures from swallowing interactions with the photo.
  const stopPropagation = (event: Event) => event.stopPropagation()
  for (const event of ['pointerdown', 'mousedown', 'touchstart', 'dblclick']) {
    element.addEventListener(event, stopPropagation)
  }
  overlay.onAdd = () => { overlay.getPanes()?.overlayMouseTarget.appendChild(element) }
  overlay.draw = () => {
    const point = overlay.getProjection().fromLatLngToDivPixel(new maps.LatLng(listing.latitude!, listing.longitude!))
    if (point) { element.style.left = `${point.x}px`; element.style.top = `${point.y}px` }
  }
  overlay.onRemove = () => { element.remove(); queueMicrotask(() => root.unmount()) }
  overlay.setMap(map)
  return () => overlay.setMap(null)
}
