import React, { lazy, Suspense } from 'react'
import { AlertTriangle, Loader2, MapPin } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { GoogleShootHistoryMap } from './GoogleShootHistoryMap'
import type { MapMarker } from './shootHistoryUtils'

const createLazyLeafletMap = () => lazy(() =>
  import('./ShootHistoryLeafletMap').then((module) => ({
    default: module.ShootHistoryLeafletMap,
  })),
)

const MAP_FRAME_CLASSES =
  'relative h-[520px] min-h-[360px] w-full overflow-hidden rounded-xl border bg-muted'

const isValidCoordinate = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180

const sanitizeShootMapMarkers = (markers: MapMarker[]): MapMarker[] =>
  markers.filter(
    (marker) =>
      marker?.coords &&
      isValidCoordinate(marker.coords.lat, marker.coords.lng),
  )

const MapLoadingState = ({ label = 'Loading map…' }: { label?: string }) => (
  <div className={`${MAP_FRAME_CLASSES} grid place-items-center`} aria-busy="true">
    <div
      className="flex items-center gap-2 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
      {label}
    </div>
  </div>
)

const EmptyMapState = () => (
  <div className={`${MAP_FRAME_CLASSES} grid place-items-center`}>
    <div className="max-w-sm px-6 text-center" role="status">
      <MapPin className="mx-auto h-7 w-7 text-muted-foreground/70" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-foreground">No mapped addresses</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Locations will appear here as soon as valid coordinates are available.
      </p>
    </div>
  </div>
)

const BackupMapFailureState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="grid h-full w-full place-items-center bg-background">
    <div className="max-w-sm px-6 text-center" role="alert">
      <AlertTriangle className="mx-auto h-7 w-7 text-amber-500" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-foreground">The backup map could not open</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Your shoot history is still available. Try loading the map again.
      </p>
      <button
        type="button"
        className="mt-3 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onRetry}
      >
        Try backup map again
      </button>
    </div>
  </div>
)

interface GoogleMapBoundaryProps {
  children: React.ReactNode
  onError: (error: Error) => void
  resetKey: number
}

class GoogleMapBoundary extends React.Component<
  GoogleMapBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  componentDidUpdate(previousProps: GoogleMapBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? (
      <MapLoadingState label="Opening backup map…" />
    ) : (
      this.props.children
    )
  }
}

interface LeafletMapBoundaryProps {
  children: React.ReactNode
  onError: (error: Error) => void
  onRetry: () => void
}

class LeafletMapBoundary extends React.Component<
  LeafletMapBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? (
      <BackupMapFailureState onRetry={this.props.onRetry} />
    ) : (
      this.props.children
    )
  }
}

export const ShootMapView = ({ markers }: { markers: MapMarker[] }) => {
  const { theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [googleError, setGoogleError] = React.useState<Error | null>(null)
  const [retryVersion, setRetryVersion] = React.useState(0)
  const [leafletAttempt, setLeafletAttempt] = React.useState(() => ({
    component: createLazyLeafletMap(),
    version: 0,
  }))
  const LazyLeafletMap = leafletAttempt.component
  const validMarkers = React.useMemo(() => sanitizeShootMapMarkers(markers), [markers])
  const invalidMarkerCount = markers.length - validMarkers.length
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim()
  const shouldUseGoogle = Boolean(apiKey) && !googleError

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleGoogleError = React.useCallback((error: Error) => {
    console.warn('Google Maps is unavailable; using the backup map.', error)
    setGoogleError(error)
  }, [])

  const retryGoogleMaps = () => {
    setGoogleError(null)
    setRetryVersion((version) => version + 1)
  }

  const handleLeafletError = React.useCallback((error: Error) => {
    console.warn('The backup shoot history map could not be rendered.', error)
  }, [])

  const retryLeafletMap = React.useCallback(() => {
    setLeafletAttempt((attempt) => ({
      component: createLazyLeafletMap(),
      version: attempt.version + 1,
    }))
  }, [])

  if (validMarkers.length === 0) return <EmptyMapState />
  if (typeof window === 'undefined' || !mounted) return <MapLoadingState />

  return (
    <div className={MAP_FRAME_CLASSES}>
      {shouldUseGoogle ? (
        <GoogleMapBoundary
          key={retryVersion}
          onError={handleGoogleError}
          resetKey={retryVersion}
        >
          <GoogleShootHistoryMap
            key={`google-${retryVersion}`}
            apiKey={apiKey}
            markers={validMarkers}
            onLoadError={handleGoogleError}
            theme={theme}
          />
        </GoogleMapBoundary>
      ) : (
        <LeafletMapBoundary
          key={`leaflet-${leafletAttempt.version}`}
          onError={handleLeafletError}
          onRetry={retryLeafletMap}
        >
          <Suspense fallback={<MapLoadingState label="Opening backup map…" />}>
            <LazyLeafletMap markers={validMarkers} theme={theme} />
          </Suspense>
        </LeafletMapBoundary>
      )}

      {googleError ? (
        <div
          className="absolute left-3 top-3 z-[600] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-amber-300/70 bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <span className="text-foreground">Backup map active</span>
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={retryGoogleMaps}
          >
            Retry Google Maps
          </button>
        </div>
      ) : null}

      {invalidMarkerCount > 0 ? (
        <div
          className="absolute bottom-3 left-3 z-[600] rounded-md border bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur"
          role="status"
        >
          {invalidMarkerCount} {invalidMarkerCount === 1 ? 'address is' : 'addresses are'} missing a valid location
        </div>
      ) : null}
    </div>
  )
}
