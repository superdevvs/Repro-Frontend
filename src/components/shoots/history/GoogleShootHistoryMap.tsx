import React from 'react'
import type { MapMarker } from './shootHistoryUtils'
import {
  loadGoogleMaps,
  type GoogleInfoWindowInstance,
  type GoogleMapInstance,
  type GoogleMapOptions,
  type GoogleMapsApi,
  type GoogleMapsListener,
  type GoogleMarkerInstance,
} from './googleMapsLoader'
import './shootHistoryMap.css'

type MapTheme = 'light' | 'dark'

interface GoogleShootHistoryMapProps {
  apiKey: string
  markers: MapMarker[]
  onLoadError: (error: Error) => void
  theme: MapTheme
}

const BLUE_PIN_ICON =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path fill="#3b82f6" stroke="#fff" stroke-width="2" d="M16 1C7.7 1 1 7.7 1 16c0 11 15 25 15 25s15-14 15-25C31 7.7 24.3 1 16 1Z"/><circle cx="16" cy="16" r="5.5" fill="#fff"/></svg>',
  )

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

const createPopupContent = (marker: MapMarker): HTMLDivElement => {
  const content = document.createElement('div')
  content.className = 'repro-google-map-popup'

  const title = document.createElement('p')
  title.className = 'repro-google-map-popup__title'
  title.textContent = marker.title
  content.appendChild(title)

  if (marker.subtitle) {
    const subtitle = document.createElement('p')
    subtitle.className = 'repro-google-map-popup__subtitle'
    subtitle.textContent = marker.subtitle
    content.appendChild(subtitle)
  }

  const address = document.createElement('p')
  address.className = 'repro-google-map-popup__address'
  address.textContent = marker.address
  content.appendChild(address)

  return content
}

const mapOptionsForTheme = (theme: MapTheme): GoogleMapOptions => ({
  clickableIcons: false,
  fullscreenControl: true,
  gestureHandling: 'cooperative',
  mapTypeControl: false,
  rotateControl: false,
  scaleControl: true,
  streetViewControl: false,
  styles: theme === 'dark' ? DARK_MAP_STYLES : null,
  zoomControl: true,
})

const fitMapToMarkers = (
  maps: GoogleMapsApi,
  map: GoogleMapInstance,
  markers: MapMarker[],
) => {
  if (markers.length === 0) return

  if (markers.length === 1) {
    map.setCenter(markers[0].coords)
    map.setZoom(13)
    return
  }

  const bounds = new maps.LatLngBounds()
  markers.forEach((marker) => bounds.extend(marker.coords))
  map.fitBounds(bounds, 56)

  maps.event.addListenerOnce(map, 'idle', () => {
    const zoom = map.getZoom()
    if (typeof zoom === 'number' && zoom > 15) map.setZoom(15)
  })
}

export const GoogleShootHistoryMap = ({
  apiKey,
  markers,
  onLoadError,
  theme,
}: GoogleShootHistoryMapProps) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<GoogleMapInstance | null>(null)
  const infoWindowRef = React.useRef<GoogleInfoWindowInstance | null>(null)
  const markerInstancesRef = React.useRef<GoogleMarkerInstance[]>([])
  const markerListenersRef = React.useRef<GoogleMapsListener[]>([])
  const onLoadErrorRef = React.useRef(onLoadError)
  const themeRef = React.useRef(theme)
  const mapsApiRef = React.useRef<GoogleMapsApi | null>(null)
  const [mapsApi, setMapsApi] = React.useState<GoogleMapsApi | null>(null)
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    onLoadErrorRef.current = onLoadError
  }, [onLoadError])

  themeRef.current = theme

  const clearMarkers = React.useCallback(() => {
    markerListenersRef.current.forEach((listener) => listener.remove())
    markerListenersRef.current = []
    markerInstancesRef.current.forEach((marker) => marker.setMap(null))
    markerInstancesRef.current = []
    infoWindowRef.current?.close()
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const previousAuthFailure = window.gm_authFailure
    const handleAuthFailure = () => {
      previousAuthFailure?.()
      if (!cancelled) {
        onLoadErrorRef.current(
          new Error('Google Maps rejected the browser key or its website restrictions.'),
        )
      }
    }
    window.gm_authFailure = handleAuthFailure

    void loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return

        try {
          const map = new maps.Map(containerRef.current, {
            ...mapOptionsForTheme(themeRef.current),
            center: markers[0]?.coords,
            zoom: markers.length > 0 ? 12 : 4,
          })
          mapRef.current = map
          mapsApiRef.current = maps
          infoWindowRef.current = new maps.InfoWindow({ maxWidth: 320 })
          setMapsApi(maps)
          setIsReady(true)
        } catch (error) {
          onLoadErrorRef.current(
            error instanceof Error ? error : new Error('Google Maps could not be initialized.'),
          )
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onLoadErrorRef.current(
            error instanceof Error ? error : new Error('Google Maps could not be loaded.'),
          )
        }
      })

    return () => {
      cancelled = true
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = previousAuthFailure
      }
      clearMarkers()
      if (mapsApiRef.current && mapRef.current) {
        mapsApiRef.current.event.clearInstanceListeners(mapRef.current)
      }
      mapRef.current = null
      mapsApiRef.current = null
      infoWindowRef.current = null
    }
    // The map instance is intentionally created once per API-key attempt.
    // Marker and theme changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, clearMarkers])

  React.useEffect(() => {
    mapRef.current?.setOptions(mapOptionsForTheme(theme))
  }, [theme])

  React.useEffect(() => {
    const map = mapRef.current
    if (!mapsApi || !map) return

    clearMarkers()
    const infoWindow = infoWindowRef.current ?? new mapsApi.InfoWindow({ maxWidth: 320 })
    infoWindowRef.current = infoWindow

    markers.forEach((markerData) => {
      const marker = new mapsApi.Marker({
        icon: BLUE_PIN_ICON,
        map,
        optimized: true,
        position: markerData.coords,
        title: [markerData.title, markerData.address].filter(Boolean).join(' — '),
      })
      const listener = marker.addListener('click', () => {
        infoWindow.setContent(createPopupContent(markerData))
        infoWindow.open({ anchor: marker, map, shouldFocus: false })
      })
      markerInstancesRef.current.push(marker)
      markerListenersRef.current.push(listener)
    })

    fitMapToMarkers(mapsApi, map, markers)
    return clearMarkers
  }, [clearMarkers, mapsApi, markers])

  React.useEffect(() => {
    const map = mapRef.current
    const element = containerRef.current
    if (!mapsApi || !map || !element) return

    let frame = 0
    const handleResize = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        mapsApi.event.trigger(map, 'resize')
        fitMapToMarkers(mapsApi, map, markers)
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
  }, [mapsApi, markers])

  return (
    <div
      className="relative h-full w-full bg-muted"
      data-map-provider="google"
      aria-busy={!isReady}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label={`Shoot locations map with ${markers.length} ${markers.length === 1 ? 'location' : 'locations'}`}
      />
      {!isReady ? (
        <div
          className="absolute inset-0 grid place-items-center bg-background"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" aria-hidden="true" />
            Loading shoot locations…
          </div>
        </div>
      ) : null}
    </div>
  )
}
