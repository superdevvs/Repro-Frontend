import React from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@/components/ui/map.css'
import { cn } from '@/lib/utils'
import { PhotographerMapBottomStrip } from './PhotographerMapBottomStrip'
import type { PhotographerMapFields } from './photographerMapFields'
import type { PhotographerMapMarker } from './PhotographerPickerGoogleMap'

type PhotographerPickerLeafletMapProps = {
  markers: PhotographerMapMarker[]
  selectedName?: string | null
  fields: PhotographerMapFields
  theme?: 'light' | 'dark'
  className?: string
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const markerIcon = divIcon({
  className: 'repro-map-marker',
  html: '<span aria-hidden="true"></span>',
  iconAnchor: [14, 36],
  iconSize: [28, 36],
  popupAnchor: [0, -34],
})

const FitMarkers = ({ markers }: { markers: PhotographerMapMarker[] }) => {
  const map = useMap()
  React.useEffect(() => {
    if (!markers.length) {
      map.setView([39.8283, -98.5795], 4, { animate: false })
      return
    }
    if (markers.length === 1) {
      map.setView([markers[0].coords.lat, markers[0].coords.lng], 12, { animate: false })
      return
    }
    map.fitBounds(
      markers.map((marker) => [marker.coords.lat, marker.coords.lng] as [number, number]),
      { animate: false, maxZoom: 14, padding: [48, 48] },
    )
  }, [map, markers])
  return null
}

export function PhotographerPickerLeafletMap({
  markers,
  selectedName,
  fields,
  theme = 'dark',
  className,
}: PhotographerPickerLeafletMapProps) {
  const center = markers[0]?.coords ?? { lat: 39.8283, lng: -98.5795 }
  return (
    <div
      data-testid="photographer-picker-leaflet-map"
      className={cn(
        'relative h-full min-h-[220px] w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10',
        className,
      )}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={markers.length ? 11 : 4}
        className="h-full w-full"
        zoomControl={false}
        attributionControl
      >
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url={
            theme === 'dark'
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
        />
        <ZoomControl position="bottomright" />
        <FitMarkers markers={markers} />
        {markers.map((marker) => (
          <Marker key={marker.id} position={[marker.coords.lat, marker.coords.lng]} icon={markerIcon}>
            <Popup>
              <div className="text-sm font-semibold">{marker.label}</div>
              {marker.detail ? <div className="text-xs text-muted-foreground">{marker.detail}</div> : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <PhotographerMapBottomStrip name={selectedName} fields={fields} />
    </div>
  )
}
