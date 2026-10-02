import type {
  GoogleDirectionsResult,
  GoogleDirectionsStatus,
  GoogleLatLngLiteral,
  GoogleMapsApi,
} from '@/components/shoots/history/googleMapsLoader'

export type RoadRouteSource = 'google' | 'osrm' | 'straight'

export type RoadRouteResult = {
  path: GoogleLatLngLiteral[]
  source: RoadRouteSource
  /** Human-readable reason when not using Google Directions. */
  detail?: string
}

const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving'

export function flattenDirectionsPath(
  result: GoogleDirectionsResult,
): GoogleLatLngLiteral[] {
  const route = result.routes[0]
  if (!route) return []
  if (route.overview_path && route.overview_path.length > 1) {
    return route.overview_path.map((point) => latLngToLiteral(point))
  }
  const path: GoogleLatLngLiteral[] = []
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      for (const point of step.path ?? []) {
        path.push(latLngToLiteral(point))
      }
    }
  }
  return path
}

function latLngToLiteral(point: GoogleLatLngLiteral | { lat: () => number; lng: () => number }): GoogleLatLngLiteral {
  const lat =
    typeof (point as { lat?: unknown }).lat === 'function'
      ? (point as { lat: () => number }).lat()
      : Number((point as GoogleLatLngLiteral).lat)
  const lng =
    typeof (point as { lng?: unknown }).lng === 'function'
      ? (point as { lng: () => number }).lng()
      : Number((point as GoogleLatLngLiteral).lng)
  return { lat, lng }
}

export function buildOsrmRouteUrl(waypoints: GoogleLatLngLiteral[]): string {
  const coords = waypoints.map((point) => `${point.lng},${point.lat}`).join(';')
  return `${OSRM_ROUTE_URL}/${coords}?overview=full&geometries=geojson`
}

export async function fetchOsrmRoadPath(
  waypoints: GoogleLatLngLiteral[],
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleLatLngLiteral[]> {
  if (waypoints.length < 2) return waypoints
  const response = await fetchImpl(buildOsrmRouteUrl(waypoints))
  if (!response.ok) {
    throw new Error(`OSRM HTTP ${response.status}`)
  }
  const payload = (await response.json()) as {
    code?: string
    routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>
  }
  if (payload.code && payload.code !== 'Ok') {
    throw new Error(`OSRM ${payload.code}`)
  }
  const coordinates = payload.routes?.[0]?.geometry?.coordinates
  if (!coordinates || coordinates.length < 2) {
    throw new Error('OSRM returned an empty geometry')
  }
  return coordinates.map(([lng, lat]) => ({ lat, lng }))
}

export function routeWithGoogleDirections(
  maps: GoogleMapsApi,
  waypoints: GoogleLatLngLiteral[],
): Promise<GoogleLatLngLiteral[]> {
  return new Promise((resolve, reject) => {
    if (typeof maps.DirectionsService !== 'function') {
      reject(new Error('DirectionsService unavailable'))
      return
    }
    if (waypoints.length < 2) {
      resolve(waypoints)
      return
    }
    try {
      const service = new maps.DirectionsService()
      const origin = waypoints[0]
      const destination = waypoints[waypoints.length - 1]
      const middle = waypoints.slice(1, -1).map((location) => ({ location, stopover: true }))
      service.route(
        {
          origin,
          destination,
          waypoints: middle.length ? middle : undefined,
          travelMode: maps.TravelMode?.DRIVING ?? 'DRIVING',
        },
        (result: GoogleDirectionsResult | null, status: GoogleDirectionsStatus | string) => {
          if (status === 'OK' && result?.routes?.length) {
            const path = flattenDirectionsPath(result)
            if (path.length > 1) {
              resolve(path)
              return
            }
            reject(new Error('Google Directions returned an empty path'))
            return
          }
          reject(new Error(`Google Directions ${String(status)}`))
        },
      )
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Google Directions failed'))
    }
  })
}

/**
 * Prefer Google Directions road geometry. When the legacy Directions API is
 * denied/unavailable for the browser key, fall back to OSRM so the polyline
 * still follows roads. Only return a straight waypoint polyline as last resort.
 */
export async function resolvePhotographerRoadPath(args: {
  maps: GoogleMapsApi | null
  waypoints: GoogleLatLngLiteral[]
  fetchImpl?: typeof fetch
}): Promise<RoadRouteResult> {
  const { maps, waypoints, fetchImpl = fetch } = args
  if (waypoints.length < 2) {
    return { path: waypoints, source: 'straight' }
  }

  let googleDetail: string | undefined
  if (maps) {
    try {
      const path = await routeWithGoogleDirections(maps, waypoints)
      if (path.length > 1) {
        return { path, source: 'google' }
      }
      googleDetail = 'Google Directions returned an empty path'
    } catch (error) {
      googleDetail = error instanceof Error ? error.message : 'Google Directions failed'
    }
  } else {
    googleDetail = 'Google Maps API not ready'
  }

  try {
    const path = await fetchOsrmRoadPath(waypoints, fetchImpl)
    return {
      path,
      source: 'osrm',
      detail: `Google road Directions unavailable (${googleDetail}). Showing backup road route.`,
    }
  } catch (error) {
    const osrmDetail = error instanceof Error ? error.message : 'backup road routing failed'
    return {
      path: waypoints,
      source: 'straight',
      detail: `Road directions unavailable (${googleDetail}; ${osrmDetail}). Straight-line estimate — not along roads.`,
    }
  }
}
