import React from 'react'
import { divIcon, type Map as LeafletMap } from 'leaflet'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@/components/ui/map.css'
import type { MapMarker } from './shootHistoryUtils'

interface ShootHistoryLeafletMapProps {
  markers: MapMarker[]
  theme: 'light' | 'dark'
}
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const fallbackMarkerIcon = divIcon({
  className: 'repro-map-marker',
  html: '<span aria-hidden="true"></span>',
  iconAnchor: [14, 36],
  iconSize: [28, 36],
  popupAnchor: [0, -34],
})

const fitLeafletMap = (map: LeafletMap, markers: MapMarker[]) => {
  if (markers.length === 0) return
  if (markers.length === 1) {
    map.setView([markers[0].coords.lat, markers[0].coords.lng], 13, {
      animate: false,
    })
    return
  }

  map.fitBounds(
    markers.map((marker) => [marker.coords.lat, marker.coords.lng] as [number, number]),
    { animate: false, maxZoom: 15, padding: [56, 56] },
  )
}

const LeafletLifecycle = ({ markers }: { markers: MapMarker[] }) => {
  const map = useMap()

  React.useEffect(() => {
    fitLeafletMap(map, markers)
  }, [map, markers])

  React.useEffect(() => {
    const element = map.getContainer()
    let frame = 0
    const handleResize = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false })
        fitLeafletMap(map, markers)
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
  }, [map, markers])

  return null
}

export const ShootHistoryLeafletMap = ({
  markers,
  theme,
}: ShootHistoryLeafletMapProps) => {
  const initialCenter = markers[0]?.coords ?? { lat: 39.8283, lng: -98.5795 }

  return (
    <div
      className={`h-full w-full ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'}`}
      data-map-provider="openstreetmap"
      role="region"
      aria-label={`Backup shoot locations map with ${markers.length} ${markers.length === 1 ? 'location' : 'locations'}`}
    >
      <MapContainer
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={markers.length === 1 ? 13 : 4}
        zoomControl={false}
        attributionControl
        className="h-full w-full"
      >
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ZoomControl position="topright" />
        <LeafletLifecycle markers={markers} />
        {markers.map((marker, index) => (
          <Marker
            key={`${marker.id}-${marker.coords.lat}-${marker.coords.lng}-${index}`}
            position={[marker.coords.lat, marker.coords.lng]}
            icon={fallbackMarkerIcon}
            title={[marker.title, marker.address].filter(Boolean).join(' — ')}
          >
            <Popup>
              <div className="space-y-1 p-2">
                <p className="text-sm font-semibold">{marker.title}</p>
                {marker.subtitle ? (
                  <p className="text-xs text-muted-foreground">{marker.subtitle}</p>
                ) : null}
                <p className="text-xs">{marker.address}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
