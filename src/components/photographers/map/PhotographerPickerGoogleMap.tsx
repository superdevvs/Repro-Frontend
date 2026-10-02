import React from 'react'
import { Info, Minus, Plus } from 'lucide-react'
import {
  loadGoogleMaps,
  type GoogleInfoWindowInstance,
  type GoogleLatLngLiteral,
  type GoogleMapInstance,
  type GoogleMapsApi,
  type GoogleMapsListener,
  type GoogleMarkerInstance,
  type GooglePolylineInstance,
} from '@/components/shoots/history/googleMapsLoader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PhotographerMapBottomStrip } from './PhotographerMapBottomStrip'
import {
  photographerMapHasPins,
  type PhotographerMapFields,
  type PhotographerMapPinKind,
} from './photographerMapFields'
import {
  type PhotographerMapMarker,
} from './buildPhotographerMapMarkers'
import {
  jobHomePinIcon,
  PIN_COLORS,
  PROFILE_PIN_SIZE,
  PROFILE_PIN_SIZE_SELECTED,
  profilePinHtml,
  routePinIcon,
} from './photographerMapPinIcons'
import { resolvePhotographerRoadPath, type RoadRouteSource } from './photographerMapRoadRoute'
import { photographerMapOptions } from './photographerMapStyles'

export type { PhotographerMapMarker }

export type PhotographerPickerGoogleMapProps = {
  apiKey?: string
  theme?: 'light' | 'dark'
  markers: PhotographerMapMarker[]
  selectedName?: string | null
  selectedId?: string | null
  fields: PhotographerMapFields
  className?: string
  onLoadError?: (error: Error) => void
  onSelectPhotographer?: (photographerId: string | null) => void
}

const KIND_LABEL: Record<PhotographerMapPinKind | 'home', string> = {
  photographer: 'Photographer',
  last: 'Last stop',
  job: 'Job',
  next: 'Next stop',
  home: 'Photographer',
}

type OverlayHandle = { setMap: (map: GoogleMapInstance | null) => void }

const dimmedDotIcon = (maps: GoogleMapsApi) => ({
  path: maps.SymbolPath?.CIRCLE ?? 0,
  scale: 7,
  fillColor: PIN_COLORS.homeDot,
  fillOpacity: 0.45,
  strokeColor: '#ffffff',
  strokeWeight: 1.5,
})

function resolveMarkerIcon(maps: GoogleMapsApi, entry: PhotographerMapMarker) {
  if (entry.kind === 'job' || entry.appearance === 'home') {
    return jobHomePinIcon(true)
  }
  if (entry.appearance === 'dot' || entry.dimmed) {
    return dimmedDotIcon(maps)
  }
  if (entry.kind === 'last' || entry.kind === 'next' || entry.kind === 'photographer') {
    return routePinIcon(
      entry.kind === 'photographer' ? 'photographer' : entry.kind,
      entry.kind === 'photographer' || Boolean(entry.selected),
    )
  }
  return routePinIcon('photographer', false)
}

function createAvatarOverlay(args: {
  maps: GoogleMapsApi
  map: GoogleMapInstance
  entry: PhotographerMapMarker
  onSelect?: (id: string) => void
  onInfo: (anchor: HTMLElement, entry: PhotographerMapMarker) => void
}): OverlayHandle {
  const { maps, map, entry, onSelect, onInfo } = args
  const overlay = new maps.OverlayView()
  const element = document.createElement('div')
  element.style.cssText = `position:absolute;transform:translate(-50%,-100%);padding-bottom:8px;z-index:${entry.selected ? 40 : 12};cursor:pointer;opacity:1;filter:none`
  element.innerHTML = profilePinHtml({
    avatarUrl: entry.avatarUrl,
    initials: entry.initials || '?',
    selected: Boolean(entry.selected),
    size: entry.selected ? PROFILE_PIN_SIZE_SELECTED : PROFILE_PIN_SIZE,
  })
  element.setAttribute('role', 'button')
  element.setAttribute('aria-label', `Select ${entry.label}`)
  element.tabIndex = 0

  const stop = (event: Event) => event.stopPropagation()
  for (const eventName of ['pointerdown', 'mousedown', 'touchstart', 'dblclick']) {
    element.addEventListener(eventName, stop)
  }
  const activate = (event: Event) => {
    event.stopPropagation()
    if (entry.photographerId && onSelect) onSelect(entry.photographerId)
    onInfo(element, entry)
  }
  element.addEventListener('click', activate)
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate(event)
    }
  })

  overlay.onAdd = () => {
    overlay.getPanes()?.overlayMouseTarget.appendChild(element)
  }
  overlay.draw = () => {
    const point = overlay.getProjection().fromLatLngToDivPixel(
      new maps.LatLng(entry.coords.lat, entry.coords.lng),
    )
    if (point) {
      element.style.left = `${point.x}px`
      element.style.top = `${point.y}px`
    }
  }
  overlay.onRemove = () => {
    element.remove()
  }
  overlay.setMap(map)
  return overlay
}

function collectRouteWaypoints(markers: PhotographerMapMarker[]): GoogleLatLngLiteral[] {
  const last = markers.find((m) => m.kind === 'last')
  const home = markers.find((m) => m.kind === 'photographer')
  const job = markers.find((m) => m.kind === 'job')
  const next = markers.find((m) => m.kind === 'next')
  const points: GoogleLatLngLiteral[] = []
  if (last) points.push(last.coords)
  else if (home) points.push(home.coords)
  if (job) points.push(job.coords)
  if (next) points.push(next.coords)
  return points
}

function pathEquals(a: GoogleLatLngLiteral[], b: GoogleLatLngLiteral[]) {
  if (a.length !== b.length) return false
  return a.every((point, index) => point.lat === b[index].lat && point.lng === b[index].lng)
}

export function PhotographerPickerGoogleMap({
  apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  theme = 'dark',
  markers,
  selectedName,
  selectedId,
  fields,
  className,
  onLoadError,
  onSelectPhotographer,
}: PhotographerPickerGoogleMapProps) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<GoogleMapInstance | null>(null)
  const mapsApiRef = React.useRef<GoogleMapsApi | null>(null)
  const markersRef = React.useRef<Array<{ marker: GoogleMarkerInstance; listeners: GoogleMapsListener[] }>>([])
  const overlaysRef = React.useRef<OverlayHandle[]>([])
  const mapListenersRef = React.useRef<GoogleMapsListener[]>([])
  const infoWindowRef = React.useRef<GoogleInfoWindowInstance | null>(null)
  const routeLineRef = React.useRef<GooglePolylineInstance | null>(null)
  const pulseLineRef = React.useRef<GooglePolylineInstance | null>(null)
  const routeAnimRef = React.useRef<number | null>(null)
  const routeRequestIdRef = React.useRef(0)
  const lastWaypointsRef = React.useRef<GoogleLatLngLiteral[]>([])
  const onLoadErrorRef = React.useRef(onLoadError)
  const onSelectRef = React.useRef(onSelectPhotographer)
  const [ready, setReady] = React.useState(false)
  const [legendOpen, setLegendOpen] = React.useState(false)
  const [routeNotice, setRouteNotice] = React.useState<string | null>(null)
  const [routeSource, setRouteSource] = React.useState<RoadRouteSource | null>(null)
  const stripPad = selectedName ? 72 : 16

  React.useEffect(() => {
    onLoadErrorRef.current = onLoadError
  }, [onLoadError])
  React.useEffect(() => {
    onSelectRef.current = onSelectPhotographer
  }, [onSelectPhotographer])

  const openInfo = React.useCallback((anchor: GoogleMarkerInstance | null, entry: PhotographerMapMarker) => {
    const maps = mapsApiRef.current
    const map = mapRef.current
    const info = infoWindowRef.current
    if (!maps || !map || !info) return
    const detail = entry.detail?.trim()
    const html = document.createElement('div')
    html.className = 'px-1 py-0.5'
    const kind = document.createElement('p')
    kind.className = 'text-[10px] uppercase tracking-wide text-slate-500'
    kind.textContent = KIND_LABEL[entry.kind]
    const title = document.createElement('p')
    title.className = 'text-sm font-semibold text-slate-900'
    title.textContent = entry.label
    html.append(kind, title)
    if (detail) {
      const body = document.createElement('p')
      body.className = 'mt-0.5 text-xs text-slate-600'
      body.textContent = detail
      html.append(body)
    }
    info.setContent(html)
    if (anchor) {
      info.open({ anchor, map, shouldFocus: false })
      return
    }
    const ghost = new maps.Marker({
      map,
      position: entry.coords,
      opacity: 0,
      clickable: false,
    })
    info.open({ anchor: ghost, map, shouldFocus: false })
    window.setTimeout(() => ghost.setMap(null), 0)
  }, [])

  const clearRouteAnimation = React.useCallback(() => {
    if (routeAnimRef.current != null) {
      window.cancelAnimationFrame(routeAnimRef.current)
      routeAnimRef.current = null
    }
    routeLineRef.current?.setMap(null)
    routeLineRef.current = null
    pulseLineRef.current?.setMap(null)
    pulseLineRef.current = null
    lastWaypointsRef.current = []
    setRouteNotice(null)
    setRouteSource(null)
  }, [])

  const animatePath = React.useCallback((maps: GoogleMapsApi, map: GoogleMapInstance, fullPath: GoogleLatLngLiteral[], alongRoads: boolean) => {
    if (routeAnimRef.current != null) {
      window.cancelAnimationFrame(routeAnimRef.current)
      routeAnimRef.current = null
    }
    routeLineRef.current?.setMap(null)
    pulseLineRef.current?.setMap(null)

    const lineSymbol = {
      path: 'M 0,-1 0,1',
      strokeOpacity: 1,
      scale: 3,
      strokeColor: '#93c5fd',
    }
    const base = new maps.Polyline({
      map,
      path: [],
      geodesic: !alongRoads,
      strokeColor: '#60a5fa',
      strokeOpacity: 0.28,
      strokeWeight: 6,
      zIndex: 5,
      icons: alongRoads
        ? [
            {
              icon: lineSymbol,
              offset: '0',
              repeat: '14px',
            },
          ]
        : undefined,
    })
    const pulse = new maps.Polyline({
      map,
      path: [],
      geodesic: !alongRoads,
      strokeColor: alongRoads ? '#38bdf8' : '#fbbf24',
      strokeOpacity: 1,
      strokeWeight: alongRoads ? 4 : 3,
      zIndex: 6,
      icons: [
        {
          icon: {
            path: maps.SymbolPath?.CIRCLE ?? 0,
            scale: 5,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: alongRoads ? '#0284c7' : '#d97706',
            strokeWeight: 2,
          },
          offset: '100%',
        },
      ],
    })
    routeLineRef.current = base
    pulseLineRef.current = pulse

    // Show full faint/dashed path immediately, then draw pulse along it.
    base.setPath(fullPath)
    const total = Math.max(fullPath.length, 2)
    const durationMs = Math.min(2400, Math.max(1000, total * 10))
    const started = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs)
      const count = Math.max(2, Math.floor(t * total))
      pulse.setPath(fullPath.slice(0, count))
      if (t < 1) {
        routeAnimRef.current = window.requestAnimationFrame(tick)
      } else {
        pulse.setPath(fullPath)
        routeAnimRef.current = null
      }
    }
    routeAnimRef.current = window.requestAnimationFrame(tick)
  }, [])

  const drawRoute = React.useCallback((waypoints: GoogleLatLngLiteral[]) => {
    const maps = mapsApiRef.current
    const map = mapRef.current
    if (!maps || !map) return
    if (waypoints.length < 2) {
      clearRouteAnimation()
      return
    }
    if (pathEquals(waypoints, lastWaypointsRef.current) && routeLineRef.current) {
      return
    }
    lastWaypointsRef.current = waypoints
    const requestId = ++routeRequestIdRef.current

    void resolvePhotographerRoadPath({ maps, waypoints })
      .then((resolved) => {
        if (requestId !== routeRequestIdRef.current) return
        setRouteSource(resolved.source)
        if (resolved.source === 'google') {
          setRouteNotice(null)
        } else if (resolved.source === 'osrm') {
          setRouteNotice(
            resolved.detail
              ?? 'Google road Directions unavailable — showing backup road route.',
          )
        } else {
          setRouteNotice(
            resolved.detail
              ?? 'Road directions unavailable — straight-line estimate (not along roads).',
          )
        }
        animatePath(maps, map, resolved.path, resolved.source !== 'straight')
      })
      .catch(() => {
        if (requestId !== routeRequestIdRef.current) return
        setRouteSource('straight')
        setRouteNotice('Road directions unavailable — straight-line estimate (not along roads).')
        animatePath(maps, map, waypoints, false)
      })
  }, [animatePath, clearRouteAnimation])


  React.useEffect(() => {
    let cancelled = false
    const key = apiKey.trim()
    if (!key || !canvasRef.current) {
      onLoadErrorRef.current?.(new Error('A Google Maps browser API key is required.'))
      return
    }

    void loadGoogleMaps(key)
      .then((maps) => {
        if (cancelled || !canvasRef.current) return
        mapsApiRef.current = maps
        const map = new maps.Map(canvasRef.current, {
          ...photographerMapOptions(theme),
          center: markers[0]?.coords ?? { lat: 39.8283, lng: -98.5795 },
          zoom: markers.length ? 11 : 4,
        })
        mapRef.current = map
        infoWindowRef.current = new maps.InfoWindow({
          headerDisabled: true,
          disableAutoPan: false,
          maxWidth: 240,
        })
        mapListenersRef.current.push(
          maps.event.addListener(map, 'click', () => {
            infoWindowRef.current?.close()
            onSelectRef.current?.(null)
          }),
        )
        setReady(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        onLoadErrorRef.current?.(
          error instanceof Error ? error : new Error('Unable to load Google Maps.'),
        )
      })

    return () => {
      cancelled = true
      markersRef.current.forEach(({ marker, listeners }) => {
        listeners.forEach((listener) => listener.remove())
        marker.setMap(null)
      })
      markersRef.current = []
      overlaysRef.current.forEach((overlay) => overlay.setMap(null))
      overlaysRef.current = []
      mapListenersRef.current.forEach((listener) => listener.remove())
      mapListenersRef.current = []
      clearRouteAnimation()
      if (mapsApiRef.current && mapRef.current) {
        mapsApiRef.current.event.clearInstanceListeners(mapRef.current)
      }
      infoWindowRef.current?.close()
      infoWindowRef.current = null
      mapRef.current = null
      mapsApiRef.current = null
      setReady(false)
    }
    // Mount once per apiKey; theme/markers sync in later effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  React.useEffect(() => {
    const maps = mapsApiRef.current
    const map = mapRef.current
    if (!maps || !map || !ready) return

    markersRef.current.forEach(({ marker, listeners }) => {
      listeners.forEach((listener) => listener.remove())
      marker.setMap(null)
    })
    markersRef.current = []
    overlaysRef.current.forEach((overlay) => overlay.setMap(null))
    overlaysRef.current = []
    infoWindowRef.current?.close()

    const hasSelection = Boolean(String(selectedId ?? '').trim())

    markers.forEach((entry) => {
      if (entry.appearance === 'avatar') {
        overlaysRef.current.push(
          createAvatarOverlay({
            maps,
            map,
            entry,
            onSelect: (id) => onSelectRef.current?.(id),
            onInfo: (_el, markerEntry) => openInfo(null, markerEntry),
          }),
        )
        return
      }

      const marker = new maps.Marker({
        map,
        position: entry.coords,
        title: entry.label,
        icon: resolveMarkerIcon(maps, entry),
        zIndex: entry.kind === 'job' ? 30 : entry.dimmed ? 2 : entry.selected ? 20 : 10,
        opacity: entry.dimmed ? 0.75 : 1,
      })
      const listener = marker.addListener('click', () => {
        if (entry.photographerId && (entry.appearance === 'dot' || entry.kind === 'home' || entry.kind === 'photographer')) {
          onSelectRef.current?.(entry.photographerId)
        }
        openInfo(marker, entry)
      })
      markersRef.current.push({ marker, listeners: [listener] })
    })

    if (hasSelection) {
      drawRoute(collectRouteWaypoints(markers))
    } else {
      clearRouteAnimation()
    }

    const fitMarkers = hasSelection
      ? markers.filter((marker) => !marker.dimmed)
      : markers

    if (fitMarkers.length === 0) {
      map.setCenter({ lat: 39.8283, lng: -98.5795 })
      map.setZoom(4)
      return
    }
    if (fitMarkers.length === 1) {
      map.setCenter(fitMarkers[0].coords)
      map.setZoom(12)
      return
    }
    const bounds = new maps.LatLngBounds()
    fitMarkers.forEach((marker) => bounds.extend(marker.coords))
    map.fitBounds(bounds, 56)
  }, [markers, ready, selectedId, openInfo, drawRoute, clearRouteAnimation])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setOptions(photographerMapOptions(theme))
  }, [theme, ready])

  const zoomBy = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    const zoom = map.getZoom()
    if (typeof zoom !== 'number') return
    map.setZoom(Math.max(3, Math.min(20, zoom + delta)))
  }

  const empty = !photographerMapHasPins(fields) && markers.length === 0

  return (
    <div
      data-testid="photographer-picker-google-map"
      className={cn(
        'relative h-full min-h-0 w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950 dark:border-white/10',
        className,
      )}
    >
      <div ref={canvasRef} className="absolute inset-0" />
      {empty ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-slate-950/40 px-4 text-center">
          <p className="max-w-[16rem] text-sm text-slate-200">
            Map pins appear when coordinates are available for this photographer or job.
          </p>
        </div>
      ) : null}

      <div className="absolute right-2 top-2 z-20">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-full border border-slate-200/80 bg-white/90 shadow dark:border-white/10 dark:bg-slate-950/80"
          aria-expanded={legendOpen}
          aria-label="Map legend"
          onClick={() => setLegendOpen((open) => !open)}
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
        {legendOpen ? (
          <div className="mt-1 w-44 rounded-xl border border-slate-200/80 bg-white/95 p-2 text-[11px] shadow-lg dark:border-white/10 dark:bg-slate-950/95">
            {([
              ['photographer', 'Photographer'],
              ['job', 'Job (home)'],
              ['last', 'Last stop'],
              ['next', 'Next stop'],
            ] as const).map(([kind, label]) => (
              <div key={kind} className="flex items-center gap-2 py-0.5 text-slate-700 dark:text-slate-200">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PIN_COLORS[kind] }} />
                {label}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="absolute right-2 z-20 flex flex-col gap-1"
        style={{ bottom: selectedName ? stripPad + 8 : 12 }}
      >
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-md border bg-white/90 shadow dark:bg-slate-950/80"
          aria-label="Zoom in"
          onClick={() => zoomBy(1)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-md border bg-white/90 shadow dark:bg-slate-950/80"
          aria-label="Zoom out"
          onClick={() => zoomBy(-1)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {routeNotice ? (
        <div
          className={cn(
            'absolute left-1/2 top-2 z-30 max-w-[min(28rem,calc(100%-1rem))] -translate-x-1/2 rounded-xl border px-2.5 py-1.5 text-center text-[11px] font-medium shadow-lg',
            routeSource === 'straight'
              ? 'border-amber-400/80 bg-amber-950/90 text-amber-100'
              : 'border-sky-400/70 bg-slate-950/90 text-sky-100',
          )}
          role="status"
          data-testid="photographer-map-route-notice"
        >
          {routeNotice}
        </div>
      ) : null}

      <PhotographerMapBottomStrip name={selectedName} fields={fields} />
    </div>
  )
}
