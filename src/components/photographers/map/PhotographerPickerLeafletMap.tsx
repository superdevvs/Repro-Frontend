import React from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap, ZoomControl, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@/components/ui/map.css'
import { cn } from '@/lib/utils'
import { PhotographerMapBottomStrip } from './PhotographerMapBottomStrip'
import type { PhotographerMapFields } from './photographerMapFields'
import type { PhotographerMapMarker } from './buildPhotographerMapMarkers'
import { jobHomePinIcon, profilePinHtml, routePinIcon } from './photographerMapPinIcons'

type PhotographerPickerLeafletMapProps = {
  markers: PhotographerMapMarker[]
  selectedName?: string | null
  selectedId?: string | null
  fields: PhotographerMapFields
  theme?: 'light' | 'dark'
  className?: string
  onSelectPhotographer?: (photographerId: string | null) => void
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function markerDivIcon(entry: PhotographerMapMarker) {
  if (entry.appearance === 'avatar') {
    return divIcon({
      className: 'photographer-picker-avatar-marker',
      html: profilePinHtml({
        avatarUrl: entry.avatarUrl,
        initials: entry.initials || '?',
        selected: Boolean(entry.selected),
      }),
      iconAnchor: [20, 46],
      iconSize: [40, 46],
      popupAnchor: [0, -40],
    })
  }
  if (entry.appearance === 'dot' || entry.dimmed) {
    return divIcon({
      className: 'photographer-picker-dot-marker',
      html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:#3b82f6;opacity:.45;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
      iconAnchor: [7, 7],
      iconSize: [14, 14],
      popupAnchor: [0, -8],
    })
  }
  if (entry.kind === 'job' || entry.appearance === 'home') {
    return divIcon({
      className: 'photographer-picker-job-marker',
      html: `<img src="${jobHomePinIcon(true)}" alt="" width="36" height="46" />`,
      iconAnchor: [18, 46],
      iconSize: [36, 46],
      popupAnchor: [0, -40],
    })
  }
  const kind = entry.kind === 'last' || entry.kind === 'next' ? entry.kind : 'photographer'
  return divIcon({
    className: 'photographer-picker-route-marker',
    html: `<img src="${routePinIcon(kind, Boolean(entry.selected || entry.kind === 'photographer'))}" alt="" width="30" height="40" />`,
    iconAnchor: [15, 40],
    iconSize: [30, 40],
    popupAnchor: [0, -36],
  })
}

const FitMarkers = ({
  markers,
  selectedId,
}: {
  markers: PhotographerMapMarker[]
  selectedId?: string | null
}) => {
  const map = useMap()
  React.useEffect(() => {
    const hasSelection = Boolean(String(selectedId ?? '').trim())
    const fit = hasSelection ? markers.filter((marker) => !marker.dimmed) : markers
    if (!fit.length) {
      map.setView([39.8283, -98.5795], 4, { animate: false })
      return
    }
    if (fit.length === 1) {
      map.setView([fit[0].coords.lat, fit[0].coords.lng], 12, { animate: false })
      return
    }
    map.fitBounds(
      fit.map((marker) => [marker.coords.lat, marker.coords.lng] as [number, number]),
      { animate: false, maxZoom: 14, padding: [48, 48] },
    )
  }, [map, markers, selectedId])
  return null
}

function straightRoute(markers: PhotographerMapMarker[]): [number, number][] {
  const last = markers.find((m) => m.kind === 'last')
  const home = markers.find((m) => m.kind === 'photographer')
  const job = markers.find((m) => m.kind === 'job')
  const next = markers.find((m) => m.kind === 'next')
  const points: [number, number][] = []
  if (last) points.push([last.coords.lat, last.coords.lng])
  else if (home) points.push([home.coords.lat, home.coords.lng])
  if (job) points.push([job.coords.lat, job.coords.lng])
  if (next) points.push([next.coords.lat, next.coords.lng])
  return points
}

export function PhotographerPickerLeafletMap({
  markers,
  selectedName,
  selectedId,
  fields,
  theme = 'dark',
  className,
  onSelectPhotographer,
}: PhotographerPickerLeafletMapProps) {
  const center = markers[0]?.coords ?? { lat: 39.8283, lng: -98.5795 }
  const hasSelection = Boolean(String(selectedId ?? '').trim())
  const route = hasSelection ? straightRoute(markers) : []

  return (
    <div
      data-testid="photographer-picker-leaflet-map"
      className={cn(
        'relative h-full min-h-[560px] w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10',
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
        <FitMarkers markers={markers} selectedId={selectedId} />
        {route.length > 1 ? (
          <Polyline
            positions={route}
            pathOptions={{ color: '#60a5fa', weight: 4, opacity: 0.9 }}
          />
        ) : null}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.coords.lat, marker.coords.lng]}
            icon={markerDivIcon(marker)}
            eventHandlers={{
              click: () => {
                if (marker.photographerId) onSelectPhotographer?.(marker.photographerId)
              },
            }}
          >
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
