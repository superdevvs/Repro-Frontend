/* eslint-disable react-refresh/only-export-components */
"use client"

import * as React from "react"
import { createRoot } from "react-dom/client"
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  Popup as MapLibrePopup,
  LngLatBounds,
} from "maplibre-gl"
import type {
  StyleSpecification,
  LayerSpecification,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { cn } from "@/lib/utils"

// CARTO basemap styles - light (positron) and dark (dark-matter). No satellite/imagery.
const LIGHT_STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
const DARK_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

// ---------------------------------------------------------------------------
// Pure style refinement (R1.4)
// ---------------------------------------------------------------------------

type MapTheme = "light" | "dark"

// Fixed target tones per theme. Refinements are derived from these FIXED
// constants (absolute assignment, never relative scaling) so the function is
// idempotent: applying it twice yields the same result as applying it once.
const REFINEMENT_TARGETS: Record<
  MapTheme,
  {
    water: string
    background: string
    landFill: string
    landFillOpacity: number
    roadWidth: number
  }
> = {
  light: {
    water: "#9ec9ef", // deeper water tone -> stronger land/water contrast
    background: "#eef0f2", // softened land base
    landFill: "#e6e8ea", // softened land fill tone
    landFillOpacity: 0.65,
    roadWidth: 0.8, // reduced road line weight
  },
  dark: {
    water: "#0a1626", // darker water -> stronger land/water contrast
    background: "#11151c", // softened land base
    landFill: "#1a1f27", // softened land fill tone
    landFillOpacity: 0.65,
    roadWidth: 0.8, // reduced road line weight
  },
}

const WATER_RE = /water|ocean|sea|lake|river|waterway/i
const ROAD_RE =
  /road|street|highway|motorway|trunk|primary|secondary|tertiary|transport|bridge|tunnel|rail|path|pedestrian|aeroway/i
const LAND_RE =
  /land|landuse|landcover|park|forest|wood|grass|earth|natural|sand|rock|wetland|glacier|pitch|cemetery|scrub/i

const matchesId = (id: unknown, re: RegExp): boolean =>
  typeof id === "string" && re.test(id)

// Infer the basemap theme from the style name so a single-argument call is
// deterministic (and therefore idempotent). CARTO names contain "Dark Matter"
// / "Positron"; anything unknown defaults to light.
const inferTheme = (style: StyleSpecification): MapTheme => {
  const name = typeof style?.name === "string" ? style.name : ""
  return /dark/i.test(name) ? "dark" : "light"
}

const refineLayer = (
  layer: LayerSpecification,
  t: (typeof REFINEMENT_TARGETS)[MapTheme],
): LayerSpecification => {
  try {
    const id = (layer as { id?: unknown }).id
    const type = (layer as { type?: string }).type
    const paint: Record<string, unknown> = {
      ...((layer as { paint?: Record<string, unknown> }).paint ?? {}),
    }

    let changed = false

    if (type === "background") {
      // Land base -> softened tone.
      paint["background-color"] = t.background
      changed = true
    } else if (type === "fill" && matchesId(id, WATER_RE)) {
      // Water polygons -> higher contrast tone.
      paint["fill-color"] = t.water
      changed = true
    } else if (type === "line" && matchesId(id, WATER_RE)) {
      // Waterway lines -> match water tone.
      paint["line-color"] = t.water
      changed = true
    } else if (type === "fill" && matchesId(id, LAND_RE)) {
      // Land fills -> softened tone and reduced opacity.
      paint["fill-color"] = t.landFill
      paint["fill-opacity"] = t.landFillOpacity
      changed = true
    } else if (type === "line" && matchesId(id, ROAD_RE)) {
      // Roads -> reduced line weight.
      paint["line-width"] = t.roadWidth
      changed = true
    }

    if (!changed) return layer

    return { ...layer, paint } as LayerSpecification
  } catch {
    return layer
  }
}

/**
 * Pure, total style refinement. Returns a NEW style object that keeps the same
 * `version`, the same `sources`, and the exact same set of layer ids in the
 * same order (no layer added or removed). Only `paint`/`layout` properties are
 * rewritten to increase land-water contrast, reduce road line weight, and
 * soften land fill tones.
 *
 * The function is defensive: any unexpected shape causes the ORIGINAL style to
 * be returned unmodified. It is also idempotent — refinements are absolute
 * assignments derived from fixed per-theme constants, so
 * `applyStyleRefinements(applyStyleRefinements(s))` deep-equals
 * `applyStyleRefinements(s)`.
 */
export function applyStyleRefinements(
  style: StyleSpecification,
): StyleSpecification {
  try {
    if (!style || typeof style !== "object") return style
    const layers = (style as { layers?: unknown }).layers
    if (!Array.isArray(layers)) return style

    const target = REFINEMENT_TARGETS[inferTheme(style)]
    const newLayers = layers.map((layer) =>
      layer && typeof layer === "object"
        ? refineLayer(layer as LayerSpecification, target)
        : layer,
    )

    return { ...style, layers: newLayers } as StyleSpecification
  } catch {
    return style
  }
}

// ---------------------------------------------------------------------------
// Map component
// ---------------------------------------------------------------------------

/** A coordinate target accepted by the imperative recenter method. */
export type RecenterTarget =
  | [number, number] // single [lng, lat]
  | Array<[number, number]> // many [lng, lat]
  | Array<{ lat: number; lng: number }> // markers

/** Imperative handle exposed via ref on the Map component. */
export interface MapHandle {
  /** Recenter / fitBounds on the provided coordinate(s) or markers. */
  recenter: (target: RecenterTarget) => void
  /** Access the underlying MapLibre instance (null until loaded). */
  getMap: () => MapLibreMap | null
  /** Access the outer container element. */
  getContainer: () => HTMLDivElement | null
}

const isLngLatPair = (v: unknown): v is [number, number] =>
  Array.isArray(v) &&
  v.length === 2 &&
  typeof v[0] === "number" &&
  typeof v[1] === "number"

const normalizeRecenterTarget = (target: RecenterTarget): Array<[number, number]> => {
  if (isLngLatPair(target)) return [target]
  if (!Array.isArray(target)) return []
  const out: Array<[number, number]> = []
  for (const item of target) {
    if (isLngLatPair(item)) {
      out.push(item)
    } else if (
      item &&
      typeof item === "object" &&
      typeof (item as { lat?: unknown }).lat === "number" &&
      typeof (item as { lng?: unknown }).lng === "number"
    ) {
      const m = item as { lat: number; lng: number }
      if (Number.isFinite(m.lng) && Number.isFinite(m.lat)) out.push([m.lng, m.lat])
    }
  }
  return out.filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]))
}

interface MapProps extends React.HTMLAttributes<HTMLDivElement> {
  center: [number, number]
  zoom?: number
  theme?: "light" | "dark"
  /**
   * Whether marker labels (e.g. price chips) should be shown. Plumbed through
   * to descendant markers via context; defaults to false. Consumed by marker
   * rendering components (CustomPinMarkers) downstream.
   */
  showMarkerLabels?: boolean
  children?: React.ReactNode
}

const Map = React.forwardRef<MapHandle, MapProps>(
  (
    { center, zoom = 12, theme, showMarkerLabels = false, className, children, ...props },
    ref,
  ) => {
    const rootRef = React.useRef<HTMLDivElement>(null)
    const mapContainer = React.useRef<HTMLDivElement>(null)
    const map = React.useRef<MapLibreMap | null>(null)
    const appliedThemeRef = React.useRef<MapTheme | null>(null)
    const [mounted, setMounted] = React.useState(false)
    const [mapLoaded, setMapLoaded] = React.useState(false)
    const observerRef = React.useRef<MutationObserver | null>(null)

    // Apply refinements to whatever style is currently loaded, in place, using a
    // diff update (no network re-fetch). Used after the initial style loads.
    const refineCurrentStyle = React.useCallback(() => {
      if (!map.current) return
      try {
        if (!map.current.isStyleLoaded()) return
        const current = map.current.getStyle()
        const refined = applyStyleRefinements(current)
        if (refined !== current) {
          map.current.setStyle(refined, { diff: true })
        }
      } catch (error) {
        // Unexpected style shape -> keep the original style, map still renders.
        console.warn("Style refinement skipped:", error)
      }
    }, [])

    // Imperative recenter (R8.2): fit the map to the provided coordinates/markers.
    const recenter = React.useCallback((target: RecenterTarget) => {
      if (!map.current) return
      const coords = normalizeRecenterTarget(target)
      if (coords.length === 0) return
      if (coords.length === 1) {
        map.current.flyTo({ center: coords[0], duration: 600 })
        return
      }
      try {
        const bounds = new LngLatBounds(coords[0], coords[0])
        coords.forEach((c) => bounds.extend(c))
        map.current.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 600 })
      } catch (error) {
        console.warn("Recenter failed:", error)
      }
    }, [])

    React.useImperativeHandle(
      ref,
      (): MapHandle => ({
        recenter,
        getMap: () => map.current,
        getContainer: () => rootRef.current,
      }),
      [recenter],
    )

    // Detect theme from document or use provided theme
    React.useEffect(() => {
      setMounted(true)
    }, [])

    React.useEffect(() => {
      if (!mounted || !mapContainer.current || map.current) return

      const detectedTheme: MapTheme =
        theme ||
        (typeof window !== "undefined" &&
        document.documentElement.classList.contains("dark")
          ? "dark"
          : "light")

      appliedThemeRef.current = detectedTheme

      let timeoutId: NodeJS.Timeout | undefined
      let isMounted = true
      let handleLoad: (() => void) | undefined
      let handleError: ((error: unknown) => void) | undefined

      // Wait a bit for container to be ready (in case it's not visible yet)
      const initTimer: NodeJS.Timeout = setTimeout(() => {
        if (!mapContainer.current || map.current || !isMounted) return

        try {
          map.current = new MapLibreMap({
            container: mapContainer.current,
            style: detectedTheme === "dark" ? DARK_STYLE_URL : LIGHT_STYLE_URL,
            center: center,
            zoom: zoom,
            attributionControl: false,
            fadeDuration: 0,
          })

          // Wait for map to load
          handleLoad = () => {
            if (isMounted) {
              if (timeoutId) clearTimeout(timeoutId)
              console.log("Map loaded successfully")
              // Apply style refinements to the initial basemap (R1.4).
              refineCurrentStyle()
              setMapLoaded(true)
            }
          }

          handleError = (error: unknown) => {
            console.error("Map error:", error)
            // Don't clear timeout on error - let the fallback timeout handle it
            // Errors during loading are common and might recover
          }

          if (handleLoad) map.current.once("load", handleLoad)
          if (handleError) map.current.on("error", handleError)

          // Fallback: show map after 2 seconds regardless
          // This ensures the map is shown even if the 'load' event doesn't fire
          timeoutId = setTimeout(() => {
            if (isMounted) {
              console.warn("Map loading timeout - showing map anyway after 2s")
              setMapLoaded(true)
            }
          }, 2000)

          // Listen for theme changes (class-based dark mode toggles)
          const observer = new MutationObserver(() => {
            if (!map.current) return
            const nextTheme: MapTheme = document.documentElement.classList.contains(
              "dark",
            )
              ? "dark"
              : "light"
            if (appliedThemeRef.current === nextTheme) return
            appliedThemeRef.current = nextTheme
            // Swap basemap and re-apply refinements inline so both
            // positron/dark-matter keep parity (R1.3, R1.4).
            map.current.setStyle(
              nextTheme === "dark" ? DARK_STYLE_URL : LIGHT_STYLE_URL,
              { transformStyle: (_prev, next) => applyStyleRefinements(next) },
            )
          })

          observerRef.current = observer

          if (typeof window !== "undefined") {
            observer.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ["class"],
            })
          }
        } catch (error) {
          console.error("Failed to initialize map:", error)
          if (isMounted) {
            if (timeoutId) clearTimeout(timeoutId)
            // Show map anyway after error - set immediately since initialization failed
            setMapLoaded(true)
          }
        }
      }, 100) // Small delay to ensure container is ready

      return () => {
        isMounted = false
        clearTimeout(initTimer)
        if (timeoutId) clearTimeout(timeoutId)
        if (observerRef.current) {
          observerRef.current.disconnect()
        }
        if (map.current) {
          if (handleLoad) map.current.off("load", handleLoad)
          if (handleError) map.current.off("error", handleError)
          map.current.remove()
          map.current = null
        }
        setMapLoaded(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]) // Only re-run if mounted state changes

    // Update theme when the explicit `theme` prop changes.
    React.useEffect(() => {
      if (!map.current || !mapLoaded) return

      const nextTheme: MapTheme =
        theme ||
        (typeof window !== "undefined" &&
        document.documentElement.classList.contains("dark")
          ? "dark"
          : "light")

      if (appliedThemeRef.current === nextTheme) return
      appliedThemeRef.current = nextTheme

      // Swap basemap and re-apply refinements inline so positron/dark-matter
      // keep parity across theme switches (R1.3, R1.4).
      map.current.setStyle(
        nextTheme === "dark" ? DARK_STYLE_URL : LIGHT_STYLE_URL,
        { transformStyle: (_prev, next) => applyStyleRefinements(next) },
      )
    }, [theme, mapLoaded])

    // Update center and zoom when props change
    React.useEffect(() => {
      if (!map.current || !mapLoaded) return
      map.current.setCenter(center)
      map.current.setZoom(zoom || 12)
    }, [center, zoom, mapLoaded])

    if (!mounted) {
      return (
        <div
          ref={rootRef}
          className={cn("h-full w-full rounded-xl", className)}
          {...props}
        >
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading map...
          </div>
        </div>
      )
    }

    return (
      <div
        ref={rootRef}
        className={cn("h-full w-full rounded-xl overflow-hidden relative", className)}
        {...props}
      >
        <div ref={mapContainer} className="h-full w-full" />
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <div className="text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm">Loading map...</p>
            </div>
          </div>
        )}
        {map.current && mapLoaded && children && (
          <MapContext.Provider value={map.current}>
            <MapLabelsContext.Provider value={showMarkerLabels}>
              {children}
            </MapLabelsContext.Provider>
          </MapContext.Provider>
        )}
      </div>
    )
  },
)
Map.displayName = "Map"

// Context for map instance
const MapContext = React.createContext<MapLibreMap | null>(null)

export const useMap = () => {
  const map = React.useContext(MapContext)
  if (!map) {
    throw new Error("useMap must be used within a Map component")
  }
  return map
}

// Context for the showMarkerLabels flag, plumbed from the Map component to any
// descendant marker renderer.
const MapLabelsContext = React.createContext<boolean>(false)

/** Read the current `showMarkerLabels` flag from the nearest Map. */
export const useShowMarkerLabels = (): boolean =>
  React.useContext(MapLabelsContext)

// MapControls component
interface MapControlsProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  showZoom?: boolean
  showFullscreen?: boolean
}

const MapControls = React.forwardRef<HTMLDivElement, MapControlsProps>(
  ({ position = "top-right", showZoom = true, showFullscreen = false, className, ...props }, ref) => {
    const map = useMap()
    const [zoom, setZoom] = React.useState(map.getZoom())

    React.useEffect(() => {
      const updateZoom = () => setZoom(map.getZoom())
      map.on("zoom", updateZoom)
      map.on("zoomend", updateZoom)
      return () => {
        map.off("zoom", updateZoom)
        map.off("zoomend", updateZoom)
      }
    }, [map])

    const positionClasses = {
      "top-left": "top-2 left-2",
      "top-right": "top-2 right-2",
      "bottom-left": "bottom-2 left-2",
      "bottom-right": "bottom-2 right-2",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-10 flex flex-col gap-1",
          positionClasses[position],
          className
        )}
        {...props}
      >
        {showZoom && (
          <>
            <button
              type="button"
              onClick={() => map.zoomIn()}
              className="bg-background/80 backdrop-blur-sm border border-border rounded-md p-2 hover:bg-background transition-colors"
              aria-label="Zoom in"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => map.zoomOut()}
              className="bg-background/80 backdrop-blur-sm border border-border rounded-md p-2 hover:bg-background transition-colors"
              aria-label="Zoom out"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 12H6"
                />
              </svg>
            </button>
          </>
        )}
      </div>
    )
  }
)
MapControls.displayName = "MapControls"

// Marker component
interface MarkerProps {
  position: [number, number]
  children?: React.ReactNode
}

const Marker: React.FC<MarkerProps> = ({ position, children }) => {
  const map = useMap()
  const markerRef = React.useRef<MapLibreMarker | null>(null)
  const popupRef = React.useRef<MapLibrePopup | null>(null)
  const popupContainerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!map) return

    // Create popup container
    const popupContainer = document.createElement("div")
    popupContainer.className = "p-2"
    popupContainerRef.current = popupContainer

    const popup = new MapLibrePopup({ 
      offset: 25, 
      closeButton: true,
      closeOnClick: true,
      className: "maplibregl-popup-content"
    })

    if (children) {
      popup.setDOMContent(popupContainer)
      
      // Use ReactDOM to render children
      const root = createRoot(popupContainer)
      root.render(<>{children}</>)
      
      popupRef.current = popup
    }

    // Use theme-aware marker color
    const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
    const markerColor = isDark ? "#60a5fa" : "#3b82f6"
    
    const marker = new MapLibreMarker({ 
      color: markerColor,
      scale: 1.2
    })
      .setLngLat(position)
      .setPopup(popup)
      .addTo(map)

    markerRef.current = marker

    return () => {
      marker.remove()
      if (popupRef.current) {
        popupRef.current.remove()
      }
      if (popupContainerRef.current) {
        popupContainerRef.current = null
      }
    }
  }, [map, position, children])

  return null
}

export { Map, MapControls, Marker }
