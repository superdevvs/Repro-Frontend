import { describe, expect, it, vi } from 'vitest'
import {
  buildOsrmRouteUrl,
  fetchOsrmRoadPath,
  flattenDirectionsPath,
  resolvePhotographerRoadPath,
} from './photographerMapRoadRoute'
import type { GoogleMapsApi } from '@/components/shoots/history/googleMapsLoader'

describe('photographerMapRoadRoute', () => {
  const waypoints = [
    { lat: 40.7128, lng: -74.006 },
    { lat: 40.73, lng: -73.99 },
    { lat: 40.758, lng: -73.9855 },
  ]

  it('builds an OSRM driving URL with lng,lat order and all waypoints', () => {
    const url = buildOsrmRouteUrl(waypoints)
    expect(url).toContain('-74.006,40.7128;-73.99,40.73;-73.9855,40.758')
    expect(url).toContain('overview=full')
    expect(url).toContain('geometries=geojson')
  })

  it('flattens Google overview_path LatLng objects', () => {
    const path = flattenDirectionsPath({
      routes: [
        {
          overview_path: [
            { lat: () => 1, lng: () => 2 } as unknown as { lat: number; lng: number },
            { lat: () => 3, lng: () => 4 } as unknown as { lat: number; lng: number },
          ],
        },
      ],
    })
    expect(path).toEqual([
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
    ])
  })

  it('parses OSRM geojson coordinates into lat/lng literals', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            geometry: {
              coordinates: [
                [-74.006, 40.7128],
                [-74.0, 40.72],
                [-73.9855, 40.758],
              ],
            },
          },
        ],
      }),
    })
    await expect(fetchOsrmRoadPath(waypoints, fetchImpl as unknown as typeof fetch)).resolves.toEqual([
      { lat: 40.7128, lng: -74.006 },
      { lat: 40.72, lng: -74.0 },
      { lat: 40.758, lng: -73.9855 },
    ])
  })

  it('falls back to OSRM when Google Directions is denied', async () => {
    const maps = {
      DirectionsService: class {
        route(
          _request: unknown,
          callback: (result: null, status: string) => void,
        ) {
          callback(null, 'REQUEST_DENIED')
        }
      },
      TravelMode: { DRIVING: 'DRIVING' },
    } as unknown as GoogleMapsApi

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            geometry: {
              coordinates: [
                [-74.006, 40.7128],
                [-73.9855, 40.758],
              ],
            },
          },
        ],
      }),
    })

    const result = await resolvePhotographerRoadPath({
      maps,
      waypoints: [waypoints[0], waypoints[2]],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.source).toBe('osrm')
    expect(result.path.length).toBeGreaterThan(1)
    expect(result.detail).toMatch(/REQUEST_DENIED/i)
  })

  it('surfaces a straight-line fallback when Google and OSRM both fail', async () => {
    const maps = {
      DirectionsService: class {
        route(
          _request: unknown,
          callback: (result: null, status: string) => void,
        ) {
          callback(null, 'REQUEST_DENIED')
        }
      },
      TravelMode: { DRIVING: 'DRIVING' },
    } as unknown as GoogleMapsApi

    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    const pair = [waypoints[0], waypoints[2]]
    const result = await resolvePhotographerRoadPath({
      maps,
      waypoints: pair,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.source).toBe('straight')
    expect(result.path).toEqual(pair)
    expect(result.detail).toMatch(/straight-line/i)
  })
})
