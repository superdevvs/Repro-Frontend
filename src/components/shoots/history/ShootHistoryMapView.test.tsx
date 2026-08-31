import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapMarker } from './shootHistoryUtils'

const h = vi.hoisted(() => ({
  leafletShouldThrow: false,
  googleProps: null as null | {
    apiKey: string
    markers: MapMarker[]
    onLoadError: (error: Error) => void
  },
}))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark' }),
}))

vi.mock('./GoogleShootHistoryMap', () => ({
  GoogleShootHistoryMap: (props: {
    apiKey: string
    markers: MapMarker[]
    onLoadError: (error: Error) => void
  }) => {
    h.googleProps = props
    return (
      <button
        type="button"
        data-testid="google-map"
        data-marker-count={props.markers.length}
        onClick={() => props.onLoadError(new Error('load failed'))}
      >
        Google map
      </button>
    )
  },
}))

vi.mock('./ShootHistoryLeafletMap', () => ({
  ShootHistoryLeafletMap: ({ markers }: { markers: MapMarker[] }) => {
    if (h.leafletShouldThrow) throw new Error('backup map chunk failed')

    return (
      <div data-testid="osm-map" data-marker-count={markers.length}>
        OpenStreetMap
      </div>
    )
  },
}))

import { ShootMapView } from './ShootHistoryMapView'

let expectedWindowErrorHandler: ((event: ErrorEvent) => void) | null = null

const validMarker = (id: string, lat = 30.2672, lng = -97.7431): MapMarker => ({
  id,
  title: `Shoot ${id}`,
  address: `${id} Main Street`,
  coords: { lat, lng },
})

beforeEach(() => {
  h.leafletShouldThrow = false
  h.googleProps = null
})

afterEach(() => {
  if (expectedWindowErrorHandler) {
    window.removeEventListener('error', expectedWindowErrorHandler)
    expectedWindowErrorHandler = null
  }
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('ShootMapView', () => {
  it('uses the keyless OpenStreetMap fallback and drops invalid coordinates', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    const markers = [
      validMarker('a'),
      validMarker('b', 37.7749, -122.4194),
      validMarker('bad-latitude', 120, -97),
      validMarker('bad-longitude', 30, Number.NaN),
    ]

    render(<ShootMapView markers={markers} />)

    const fallback = await screen.findByTestId('osm-map')
    expect(fallback).toHaveAttribute('data-marker-count', '2')
    expect(screen.getByText('2 addresses are missing a valid location')).toBeInTheDocument()
    expect(screen.queryByTestId('google-map')).not.toBeInTheDocument()
  })

  it('switches to the backup map when Google fails and allows a retry', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-key-for-test')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    render(<ShootMapView markers={[validMarker('a')]} />)

    const googleMap = await screen.findByTestId('google-map')
    expect(googleMap).toHaveAttribute('data-marker-count', '1')
    expect(h.googleProps?.apiKey).toBe('browser-key-for-test')

    fireEvent.click(googleMap)
    expect(await screen.findByTestId('osm-map')).toBeInTheDocument()
    expect(screen.getByText('Backup map active')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry Google Maps' }))
    await waitFor(() => expect(screen.getByTestId('google-map')).toBeInTheDocument())
  })

  it('shows an accessible empty state when no valid locations exist', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-key-for-test')

    render(<ShootMapView markers={[validMarker('bad', -91, 20)]} />)

    expect(screen.getByRole('status')).toHaveTextContent('No mapped addresses')
    expect(screen.queryByTestId('google-map')).not.toBeInTheDocument()
    expect(screen.queryByTestId('osm-map')).not.toBeInTheDocument()
  })

  it('contains backup map failures and can retry without crashing the route', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expectedWindowErrorHandler = (event) => {
      if (event.error instanceof Error && event.error.message === 'backup map chunk failed') {
        event.preventDefault()
      }
    }
    window.addEventListener('error', expectedWindowErrorHandler)
    h.leafletShouldThrow = true

    render(<ShootMapView markers={[validMarker('a')]} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The backup map could not open',
    )
    expect(screen.getByRole('button', { name: 'Try backup map again' })).toBeInTheDocument()

    h.leafletShouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Try backup map again' }))

    expect(await screen.findByTestId('osm-map')).toBeInTheDocument()
  })
})
