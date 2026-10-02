import React from 'react'
import { Info, Minus, Plus } from 'lucide-react'
import {
  loadGoogleMaps,
  type GoogleInfoWindowInstance,
  type GoogleMapInstance,
  type GoogleMapsApi,
  type GoogleMapsListener,
  type GoogleMarkerInstance,
} from '@/components/shoots/history/googleMapsLoader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PhotographerMapBottomStrip } from './PhotographerMapBottomStrip'
import {
  photographerMapHasPins,
  type PhotographerMapFields,
  type PhotographerMapPinKind,
} from './photographerMapFields'
import { photographerMapOptions } from './photographerMapStyles'

export type PhotographerMapMarker = {
  id: string
  kind: PhotographerMapPinKind
  coords: { lat: number; lng: number }
  label: string
  detail?: string | null
}

export type PhotographerPickerGoogleMapProps = {
  apiKey?: string
  theme?: 'light' | 'dark'
  markers: PhotographerMapMarker[]
  selectedName?: string | null
  fields: PhotographerMapFields
  className?: string
  onLoadError?: (error: Error) => void
}

const PIN_COLORS: Record<PhotographerMapPinKind, string> = {
  photographer: '#3b82f6',
  last: '#94a3b8',
  job: '#22c55e',
  next: '#a855f7',
}

const pinIcon = (kind: PhotographerMapPinKind, selected = false) => {
  const fill = PIN_COLORS[kind]
  const size = selected ? 36 : 30
  const height = selected ? 46 : 40
  return (
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 32 42"><path fill="${fill}" stroke="#fff" stroke-width="2" d="M16 1C7.7 1 1 7.7 1 16c0 11 15 25 15 25s15-14 15-25C31 7.7 24.3 1 16 1Z"/><circle cx="16" cy="16" r="5.5" fill="#fff"/></svg>`,
    )
  )
}

const KIND_LABEL: Record<PhotographerMapPinKind, string> = {
  photographer: 'Photographer',
  last: 'Last stop',
  job: 'Job',
  next: 'Next stop',
}

export function PhotographerPickerGoogleMap({
  apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  theme = 'dark',
  markers,
  selectedName,
  fields,
  className,
  onLoadError,
}: PhotographerPickerGoogleMapProps) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<GoogleMapInstance | null>(null)
  const mapsApiRef = React.useRef<GoogleMapsApi | null>(null)
  const markersRef = React.useRef<Array<{ marker: GoogleMarkerInstance; listeners: GoogleMapsListener[] }>>([])
  const mapListenersRef = React.useRef<GoogleMapsListener[]>([])
  const infoWindowRef = React.useRef<GoogleInfoWindowInstance | null>(null)
  const onLoadErrorRef = React.useRef(onLoadError)
  const [ready, setReady] = React.useState(false)
  const [legendOpen, setLegendOpen] = React.useState(false)
  const stripPad = selectedName ? 72 : 16

  React.useEffect(() => {
    onLoadErrorRef.current = onLoadError
  }, [onLoadError])

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
          maps.event.addListenerOnce(map, 'idle', () => undefined),
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
      mapListenersRef.current.forEach((listener) => listener.remove())
      mapListenersRef.current = []
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
    infoWindowRef.current?.close()

    markers.forEach((entry) => {
      const marker = new maps.Marker({
        map,
        position: entry.coords,
        title: entry.label,
        icon: pinIcon(entry.kind, entry.kind === 'photographer'),
      })
      const listener = marker.addListener('click', () => {
        const info = infoWindowRef.current
        if (!info) return
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
        info.open({ anchor: marker, map, shouldFocus: false })
      })
      markersRef.current.push({ marker, listeners: [listener] })
    })

    if (markers.length === 0) {
      map.setCenter({ lat: 39.8283, lng: -98.5795 })
      map.setZoom(4)
      return
    }
    if (markers.length === 1) {
      map.setCenter(markers[0].coords)
      map.setZoom(12)
      return
    }
    const bounds = new maps.LatLngBounds()
    markers.forEach((marker) => bounds.extend(marker.coords))
    map.fitBounds(bounds, 56)
  }, [markers, ready])

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
        'relative h-full min-h-[220px] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950 dark:border-white/10',
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
          <div className="mt-1 w-40 rounded-xl border border-slate-200/80 bg-white/95 p-2 text-[11px] shadow-lg dark:border-white/10 dark:bg-slate-950/95">
            {(['photographer', 'job', 'last', 'next'] as PhotographerMapPinKind[]).map((kind) => (
              <div key={kind} className="flex items-center gap-2 py-0.5 text-slate-700 dark:text-slate-200">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PIN_COLORS[kind] }} />
                {KIND_LABEL[kind]}
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

      <PhotographerMapBottomStrip name={selectedName} fields={fields} />
    </div>
  )
}
