"use client"

import * as React from "react"
import { createRoot } from "react-dom/client"
import { Map as MapLibreMap, Marker as MapLibreMarker, Popup as MapLibrePopup } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { cn } from "@/lib/utils"

interface MapProps extends React.HTMLAttributes<HTMLDivElement> {
  center: [number, number]
  zoom?: number
  theme?: "light" | "dark"
  children?: React.ReactNode
}

const Map = React.forwardRef<HTMLDivElement, MapProps>(
  ({ center, zoom = 12, theme, className, children, ...props }, ref) => {
    const mapContainer = React.useRef<HTMLDivElement>(null)
    const map = React.useRef<MapLibreMap | null>(null)
    const [mounted, setMounted] = React.useState(false)
    const [mapLoaded, setMapLoaded] = React.useState(false)
    const observerRef = React.useRef<MutationObserver | null>(null)

    // Detect theme from document or use provided theme
    React.useEffect(() => {
      setMounted(true)
    }, [])

    React.useEffect(() => {
      if (!mounted || !mapContainer.current || map.current) return

      const detectedTheme = theme || 
        (typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light')

      // CARTO basemap styles - light and dark
      const lightStyle = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      const darkStyle = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

      let timeoutId: NodeJS.Timeout | undefined
      let initTimer: NodeJS.Timeout
      let isMounted = true
      let handleLoad: (() => void) | undefined
      let handleError: ((e: any) => void) | undefined

      // Wait a bit for container to be ready (in case it's not visible yet)
      initTimer = setTimeout(() => {
        if (!mapContainer.current || map.current || !isMounted) return

        try {
          map.current = new MapLibreMap({
            container: mapContainer.current,
            style: detectedTheme === 'dark' ? darkStyle : lightStyle,
            center: center,
            zoom: zoom,
            attributionControl: false,
            antialias: true,
            fadeDuration: 0,
          })

          // Wait for map to load
          handleLoad = () => {
            if (isMounted) {
              if (timeoutId) clearTimeout(timeoutId)
              console.log('Map loaded successfully')
              setMapLoaded(true)
            }
          }

          handleError = (e: any) => {
            console.error('Map error:', e)
            // Don't clear timeout on error - let the fallback timeout handle it
            // Errors during loading are common and might recover
          }

          if (handleLoad) map.current.once('load', handleLoad)
          if (handleError) map.current.on('error', handleError)

          // Fallback: show map after 2 seconds regardless
          // This ensures the map is shown even if the 'load' event doesn't fire
          timeoutId = setTimeout(() => {
            if (isMounted) {
              console.warn('Map loading timeout - showing map anyway after 2s')
              setMapLoaded(true)
            }
          }, 2000)

          // Listen for theme changes
          const observer = new MutationObserver(() => {
            if (!map.current) return
            const shouldBeDark = document.documentElement.classList.contains('dark')
            const lightStyle = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            const darkStyle = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            map.current.setStyle(shouldBeDark ? darkStyle : lightStyle)
          })

          observerRef.current = observer

          if (typeof window !== 'undefined') {
            observer.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['class']
            })
          }
        } catch (error) {
          console.error('Failed to initialize map:', error)
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
          if (handleLoad) map.current.off('load', handleLoad)
          if (handleError) map.current.off('error', handleError)
          map.current.remove()
          map.current = null
        }
        setMapLoaded(false)
      }
    }, [mounted]) // Only re-run if mounted state changes

    // Update theme when it changes
    React.useEffect(() => {
      if (!map.current || !mapLoaded) return

      const detectedTheme = theme || 
        (typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light')

      const lightStyle = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      const darkStyle = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

      map.current.setStyle(detectedTheme === 'dark' ? darkStyle : lightStyle)
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
          ref={ref}
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
        ref={ref}
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
            {children}
          </MapContext.Provider>
        )}
      </div>
    )
  }
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
