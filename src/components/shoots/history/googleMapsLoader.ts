export interface GoogleMapsListener {
  remove: () => void
}
export interface GoogleLatLngBounds {
  extend: (position: { lat: number; lng: number }) => void
}

export interface GoogleMapInstance {
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void
  getZoom: () => number | undefined
  panBy: (x: number, y: number) => void
  setCenter: (center: { lat: number; lng: number }) => void
  setOptions: (options: GoogleMapOptions) => void
  setZoom: (zoom: number) => void
}

export interface GoogleMarkerInstance {
  addListener: (eventName: string, handler: () => void) => GoogleMapsListener
  setMap: (map: GoogleMapInstance | null) => void
}

export interface GoogleInfoWindowInstance {
  close: () => void
  open: (options: {
    anchor: GoogleMarkerInstance
    map: GoogleMapInstance
    shouldFocus?: boolean
  }) => void
  setContent: (content: Node) => void
  setHeaderContent?: (content: string | Element | Text | null) => void
}

export interface GoogleMapOptions {
  cameraControl?: boolean
  center?: { lat: number; lng: number }
  clickableIcons?: boolean
  fullscreenControl?: boolean
  gestureHandling?: 'auto' | 'cooperative' | 'greedy' | 'none'
  mapTypeControl?: boolean
  rotateControl?: boolean
  scaleControl?: boolean
  streetViewControl?: boolean
  styles?: ReadonlyArray<Record<string, unknown>> | null
  zoom?: number
  zoomControl?: boolean
}

export interface GoogleInfoWindowOptions {
  ariaLabel?: string
  disableAutoPan?: boolean
  headerContent?: string | Element | Text
  headerDisabled?: boolean
  maxWidth?: number
  pixelOffset?: unknown
  zIndex?: number
}

interface GoogleMarkerOptions {
  icon?: string
  map: GoogleMapInstance
  optimized?: boolean
  position: { lat: number; lng: number }
  title?: string
}

export interface GoogleMapsApi {
  InfoWindow: new (options?: GoogleInfoWindowOptions) => GoogleInfoWindowInstance
  LatLngBounds: new () => GoogleLatLngBounds
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance
  Marker: new (options: GoogleMarkerOptions) => GoogleMarkerInstance
  Size?: new (width: number, height: number) => unknown
  event: {
    addListenerOnce: (
      instance: object,
      eventName: string,
      handler: () => void,
    ) => GoogleMapsListener
    clearInstanceListeners: (instance: object) => void
    trigger: (instance: object, eventName: string) => void
  }
}

declare global {
  interface Window {
    __reproGoogleMapsReady?: () => void
    gm_authFailure?: () => void
    google?: { maps?: GoogleMapsApi }
  }
}

const GOOGLE_MAPS_SCRIPT_ID = 'repro-google-maps-script'
const GOOGLE_MAPS_CALLBACK = '__reproGoogleMapsReady'
const GOOGLE_MAPS_TIMEOUT_MS = 20_000

let pendingGoogleMapsLoad: Promise<GoogleMapsApi> | null = null

const getLoadedGoogleMaps = (): GoogleMapsApi | null => {
  const maps = window.google?.maps
  return maps?.Map ? maps : null
}

/**
 * Loads the Google Maps JavaScript API once for the entire application.
 * Failed attempts are removed and may be retried without refreshing the page.
 */
export const loadGoogleMaps = (apiKey: string): Promise<GoogleMapsApi> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Maps requires a browser environment.'))
  }

  const loadedMaps = getLoadedGoogleMaps()
  if (loadedMaps) return Promise.resolve(loadedMaps)

  const normalizedKey = apiKey.trim()
  if (!normalizedKey) {
    return Promise.reject(new Error('A Google Maps browser API key is required.'))
  }

  if (pendingGoogleMapsLoad) return pendingGoogleMapsLoad

  const loadAttempt = new Promise<GoogleMapsApi>((resolve, reject) => {
    let settled = false
    let script = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null
    const ownsScript = script === null

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      script?.removeEventListener('load', handleLoad)
      script?.removeEventListener('error', handleScriptError)

      if (window.__reproGoogleMapsReady === handleCallback) {
        delete window.__reproGoogleMapsReady
      }

      const maps = getLoadedGoogleMaps()
      if (!error && maps) {
        resolve(maps)
        return
      }

      if (ownsScript) script?.remove()
      reject(error ?? new Error('Google Maps loaded without the Maps library.'))
    }

    const handleCallback = () => finish()
    const handleLoad = () => {
      if (getLoadedGoogleMaps()) finish()
    }
    const handleScriptError = () =>
      finish(new Error('Google Maps could not be downloaded.'))

    const timeoutId = window.setTimeout(
      () => finish(new Error('Google Maps took too long to load.')),
      GOOGLE_MAPS_TIMEOUT_MS,
    )

    if (!script) {
      script = document.createElement('script')
      script.id = GOOGLE_MAPS_SCRIPT_ID
      script.async = true
      script.defer = true
      script.referrerPolicy = 'strict-origin-when-cross-origin'
      script.dataset.reproOwned = 'true'

      const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce
      if (nonce) script.nonce = nonce

      window.__reproGoogleMapsReady = handleCallback
      const params = new URLSearchParams({
        callback: GOOGLE_MAPS_CALLBACK,
        key: normalizedKey,
        loading: 'async',
        v: 'weekly',
      })
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
      document.head.appendChild(script)
    }

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleScriptError)
  })

  pendingGoogleMapsLoad = loadAttempt.catch((error: unknown) => {
    pendingGoogleMapsLoad = null
    throw error
  })

  return pendingGoogleMapsLoad
}
