import React, { lazy, Suspense } from 'react'
import { AlertTriangle } from 'lucide-react'
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner'
import { useOptionalTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { buildPhotographerMapMarkers } from './buildPhotographerMapMarkers'
import { PhotographerPickerGoogleMap } from './PhotographerPickerGoogleMap'
import {
  readPhotographerMapFields,
  type PhotographerMapFields,
} from './photographerMapFields'
import type { ShootMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'

const LazyLeafletMap = lazy(() =>
  import('./PhotographerPickerLeafletMap').then((module) => ({
    default: module.PhotographerPickerLeafletMap,
  })),
)

export type PhotographerPickerMapProps = {
  photographer?: unknown
  photographerName?: string | null
  photographerId?: string | null
  jobCoords?: ShootMapCoordinates | null
  className?: string
}

const MapFrame = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    data-testid="photographer-picker-map"
    className={cn('relative h-full min-h-[560px] w-full', className)}
  >
    {children}
  </div>
)

class GoogleMapBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void; resetKey: number },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  componentDidUpdate(previousProps: { resetKey: number }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function PhotographerPickerMap({
  photographer,
  photographerName,
  photographerId,
  jobCoords = null,
  className,
}: PhotographerPickerMapProps) {
  const themeContext = useOptionalTheme()
  const resolvedTheme: 'light' | 'dark' = React.useMemo(() => {
    if (themeContext?.theme === 'dark' || themeContext?.theme === 'light') return themeContext.theme
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'dark'
    return 'light'
  }, [themeContext?.theme])
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim()
  const [googleError, setGoogleError] = React.useState<Error | null>(null)
  const [attempt, setAttempt] = React.useState(0)

  const fields: PhotographerMapFields = React.useMemo(
    () => readPhotographerMapFields(photographer, jobCoords),
    [photographer, jobCoords],
  )
  const markers = React.useMemo(
    () =>
      buildPhotographerMapMarkers({
        fields,
        photographerName,
        photographerId,
      }),
    [fields, photographerName, photographerId],
  )

  const useGoogle = Boolean(apiKey) && !googleError

  return (
    <MapFrame className={className}>
      <Suspense
        fallback={
          <div className="grid h-full min-h-[560px] place-items-center rounded-2xl border bg-muted text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4" /> Loading map…
            </span>
          </div>
        }
      >
        {useGoogle ? (
          <GoogleMapBoundary
            resetKey={attempt}
            onError={(error) => {
              setGoogleError(error)
            }}
          >
            <PhotographerPickerGoogleMap
              apiKey={apiKey}
              theme={resolvedTheme}
              markers={markers}
              selectedName={photographerName}
              fields={fields}
              onLoadError={(error) => setGoogleError(error)}
            />
          </GoogleMapBoundary>
        ) : (
          <LazyLeafletMap
            markers={markers}
            selectedName={photographerName}
            fields={fields}
            theme={resolvedTheme}
          />
        )}
      </Suspense>

      {googleError && apiKey ? (
        <div
          className="absolute left-1/2 top-2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-300/70 bg-background/95 px-2.5 py-1.5 text-[11px] shadow"
          role="status"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>Backup map active</span>
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setGoogleError(null)
              setAttempt((value) => value + 1)
            }}
          >
            Retry Google
          </button>
        </div>
      ) : null}
    </MapFrame>
  )
}
