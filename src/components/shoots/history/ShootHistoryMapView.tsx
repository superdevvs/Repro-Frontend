import React, { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { DEFAULT_GEO_CENTER, MapMarker } from './shootHistoryUtils'

const LazyMapView = lazy(() =>
  import('@/components/ui/map')
    .then((module) => {
      const Map = module.Map
      const MapControls = module.MapControls
      const Marker = module.Marker

      return {
        default: ({ markers, theme }: { markers: MapMarker[]; theme: 'light' | 'dark' }) => {
          const center = markers[0]?.coords ?? DEFAULT_GEO_CENTER
          const centerCoords: [number, number] = [center.lng, center.lat]
          const zoom = markers.length > 1 ? 6 : 12

          return (
            <div className="h-[520px] overflow-hidden rounded-xl border relative">
              <Map
                center={centerCoords}
                zoom={zoom}
                theme={theme}
                className="h-full w-full"
              >
                <MapControls position="top-right" showZoom />
                {markers.map((marker) => (
                  <Marker
                    key={marker.id}
                    position={[marker.coords.lng, marker.coords.lat]}
                  >
                    <div className="space-y-1 p-2">
                      <p className="font-semibold text-sm">{marker.title}</p>
                      {marker.subtitle && (
                        <p className="text-xs text-muted-foreground">{marker.subtitle}</p>
                      )}
                      <p className="text-xs">{marker.address}</p>
                    </div>
                  </Marker>
                ))}
              </Map>
              {!markers.length && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-4 text-center text-muted-foreground">
                    <p className="font-medium">No geocoded addresses yet</p>
                    <p className="text-sm mt-1">Open shoots in the list view to ensure addresses are valid.</p>
                  </div>
                </div>
              )}
            </div>
          )
        },
      }
    })
    .catch((error) => {
      console.error('Failed to load map component:', error)
      return {
        default: ({ markers }: { markers: MapMarker[]; theme: 'light' | 'dark' }) => (
          <div className="h-[520px] rounded-xl border flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="font-medium">Failed to load map</p>
              <p className="text-sm mt-1">Please refresh the page to try again.</p>
            </div>
          </div>
        ),
      }
    }),
)

export const ShootMapView = ({ markers }: { markers: MapMarker[] }) => {
  const { theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (typeof window === 'undefined' || !mounted) {
    return (
      <div className="h-[520px] rounded-xl border flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p>Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="h-[520px] rounded-xl border flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Loading map...</p>
          </div>
        </div>
      }
    >
      <LazyMapView markers={markers} theme={theme} />
    </Suspense>
  )
}
