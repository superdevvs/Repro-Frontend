"use client"

import * as React from "react"
import { divIcon, type Map as LeafletMap } from "leaflet"
import {
  MapContainer,
  Marker as LeafletMarker,
  Popup as LeafletPopup,
  TileLayer,
  useMap as useLeafletMap,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "./map.css"

import { cn } from "@/lib/utils"

type MapTheme = "light" | "dark"

// This map is retained as the provider-independent emergency fallback. CARTO's
// anonymous basemap endpoint now watermarks tiles with "API KEY REQUIRED", so
// the fallback must use a genuinely keyless source instead of failing in the
// same way as the primary provider.
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const detectDocumentTheme = (): MapTheme =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"

/** A coordinate target accepted by the imperative recenter method. */
export type RecenterTarget =
  | [number, number]
  | Array<[number, number]>
  | Array<{ lat: number; lng: number }>

export type RecenterPadding =
  | number
  | { top: number; right: number; bottom: number; left: number }

export interface RecenterOptions {
  padding?: RecenterPadding
  maxZoom?: number
}

/** Vendor-neutral map controls exposed to callers. */
export interface MapHandle {
  recenter: (target: RecenterTarget, options?: RecenterOptions) => void
  isReady: () => boolean
}

const isLngLatPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number" &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1])

const normalizeRecenterTarget = (
  target: RecenterTarget,
): Array<[number, number]> => {
  if (isLngLatPair(target)) return [target]
  if (!Array.isArray(target)) return []

  return target.flatMap((item): Array<[number, number]> => {
    if (isLngLatPair(item)) return [item]
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { lat?: unknown }).lat === "number" &&
      typeof (item as { lng?: unknown }).lng === "number"
    ) {
      const { lat, lng } = item as { lat: number; lng: number }
      return Number.isFinite(lat) && Number.isFinite(lng) ? [[lng, lat]] : []
    }
    return []
  })
}

interface MapProps extends React.HTMLAttributes<HTMLDivElement> {
  center: [number, number]
  zoom?: number
  theme?: MapTheme
  showMarkerLabels?: boolean
  children?: React.ReactNode
}

interface MapLifecycleProps {
  center: [number, number]
  zoom: number
  onReady: (map: LeafletMap | null) => void
}

function MapLifecycle({ center, zoom, onReady }: MapLifecycleProps) {
  const map = useLeafletMap()

  React.useEffect(() => {
    onReady(map)
    const frame = window.requestAnimationFrame(() => map.invalidateSize())
    return () => {
      window.cancelAnimationFrame(frame)
      onReady(null)
    }
  }, [map, onReady])

  React.useEffect(() => {
    map.setView([center[1], center[0]], zoom, { animate: false })
  }, [center, map, zoom])

  return null
}

const MapLabelsContext = React.createContext(false)

export const useShowMarkerLabels = (): boolean =>
  React.useContext(MapLabelsContext)

/** Internal Leaflet map access for marker renderers contained by this module. */
export const useMap = useLeafletMap

const Map = React.forwardRef<MapHandle, MapProps>(
  (
    {
      center,
      zoom = 12,
      theme,
      showMarkerLabels = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const mapRef = React.useRef<LeafletMap | null>(null)
    const [documentTheme, setDocumentTheme] = React.useState<MapTheme>(() =>
      detectDocumentTheme(),
    )
    const resolvedTheme = theme ?? documentTheme

    React.useEffect(() => {
      if (theme || typeof MutationObserver === "undefined") return

      const observer = new MutationObserver(() => {
        setDocumentTheme(detectDocumentTheme())
      })
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      })
      return () => observer.disconnect()
    }, [theme])

    const handleReady = React.useCallback((map: LeafletMap | null) => {
      mapRef.current = map
    }, [])

    const recenter = React.useCallback(
      (target: RecenterTarget, options?: RecenterOptions) => {
        const map = mapRef.current
        const coordinates = normalizeRecenterTarget(target)
        if (!map || coordinates.length === 0) return

        const padding = options?.padding ?? 64
        const fitOptions = {
          animate: true,
          duration: 0.6,
          maxZoom: options?.maxZoom ?? 14,
          ...(typeof padding === "number"
            ? { padding: [padding, padding] as [number, number] }
            : {
                paddingTopLeft: [padding.left, padding.top] as [number, number],
                paddingBottomRight: [
                  padding.right,
                  padding.bottom,
                ] as [number, number],
              }),
        }

        const bounds = coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        )
        map.fitBounds(bounds, fitOptions)
      },
      [],
    )

    React.useImperativeHandle(
      ref,
      () => ({
        recenter,
        isReady: () => mapRef.current !== null,
      }),
      [recenter],
    )

    return (
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-xl",
          className,
        )}
        {...props}
      >
        <MapContainer
          center={[center[1], center[0]]}
          zoom={zoom}
          zoomControl={false}
          attributionControl
          className="h-full w-full"
        >
          <TileLayer
            key={resolvedTheme}
            attribution={OSM_ATTRIBUTION}
            url={OSM_TILE_URL}
            className={resolvedTheme === "dark" ? "map-tiles-dark" : undefined}
            maxZoom={19}
          />
          <MapLifecycle center={center} zoom={zoom} onReady={handleReady} />
          <MapLabelsContext.Provider value={showMarkerLabels}>
            {children}
          </MapLabelsContext.Provider>
        </MapContainer>
      </div>
    )
  },
)
Map.displayName = "Map"

interface MapControlsProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  showZoom?: boolean
  showFullscreen?: boolean
}

const MapControls = React.forwardRef<HTMLDivElement, MapControlsProps>(
  (
    {
      position = "top-right",
      showZoom = true,
      showFullscreen = false,
      className,
      ...props
    },
    ref,
  ) => {
    const map = useLeafletMap()
    const positionClasses = {
      "top-left": "top-2 left-2",
      "top-right": "top-2 right-2",
      "bottom-left": "bottom-2 left-2",
      "bottom-right": "bottom-2 right-2",
    }

    const toggleFullscreen = React.useCallback(() => {
      const container = map.getContainer()
      if (document.fullscreenElement) {
        void document.exitFullscreen?.()
      } else {
        void container.requestFullscreen?.()
      }
    }, [map])

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-[500] flex flex-col gap-1",
          positionClasses[position],
          className,
        )}
        {...props}
      >
        {showZoom ? (
          <>
            <button
              type="button"
              onClick={() => map.zoomIn()}
              className="rounded-md border border-border bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background"
              aria-label="Zoom in"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => map.zoomOut()}
              className="rounded-md border border-border bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background"
              aria-label="Zoom out"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
              </svg>
            </button>
          </>
        ) : null}
        {showFullscreen ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md border border-border bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background"
            aria-label="Toggle fullscreen map"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5" />
            </svg>
          </button>
        ) : null}
      </div>
    )
  },
)
MapControls.displayName = "MapControls"

interface MarkerProps {
  position: [number, number]
  children?: React.ReactNode
}

const markerIcon = divIcon({
  className: "repro-map-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -34],
})

const Marker: React.FC<MarkerProps> = ({ position, children }) => (
  <LeafletMarker position={[position[1], position[0]]} icon={markerIcon}>
    {children ? <LeafletPopup>{children}</LeafletPopup> : null}
  </LeafletMarker>
)

export { Map, MapControls, Marker }
