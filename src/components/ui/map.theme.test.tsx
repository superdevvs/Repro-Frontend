import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

interface TileProps {
  className?: string
  url: string
}

const h = vi.hoisted(() => {
  const tileProps: TileProps[] = []
  const fakeMap = {
    fitBounds: vi.fn(),
    getContainer: vi.fn(() => document.createElement('div')),
    invalidateSize: vi.fn(),
    setView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }
  return { fakeMap, tileProps }
})

vi.mock('leaflet', () => ({
  divIcon: (options: unknown) => options,
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('./map.css', () => ({}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => children,
  Marker: ({ children }: { children?: React.ReactNode }) => children,
  Popup: ({ children }: { children?: React.ReactNode }) => children,
  TileLayer: (props: TileProps) => {
    h.tileProps.push(props)
    return null
  },
  useMap: () => h.fakeMap,
}))

import { Map, type MapHandle, useShowMarkerLabels } from './map'

function LabelProbe() {
  return (
    <div data-testid="labels">
      {useShowMarkerLabels() ? 'on' : 'off'}
    </div>
  )
}

beforeEach(() => {
  h.tileProps.length = 0
  Object.values(h.fakeMap).forEach((value) => {
    if ('mockClear' in value) value.mockClear()
  })
  document.documentElement.classList.remove('dark')
})

afterEach(cleanup)

describe('Leaflet map theme selection', () => {
  it('uses keyless OpenStreetMap tiles for the light theme', () => {
    render(<Map center={[0, 0]} theme="light" />)
    expect(h.tileProps.at(-1)?.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(h.tileProps.at(-1)?.className).toBeUndefined()
  })

  it('uses the dark treatment with the same keyless fallback tiles', () => {
    render(<Map center={[0, 0]} theme="dark" />)
    expect(h.tileProps.at(-1)?.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(h.tileProps.at(-1)?.className).toBe('map-tiles-dark')
  })

  it('tracks the document theme when no explicit theme is provided', () => {
    document.documentElement.classList.add('dark')
    render(<Map center={[0, 0]} />)
    expect(h.tileProps.at(-1)?.className).toBe('map-tiles-dark')
  })
})

describe('Leaflet map imperative handle', () => {
  it('exposes readiness and fits all mapped coordinates', async () => {
    const ref = React.createRef<MapHandle>()
    render(<Map ref={ref} center={[0, 0]} theme="light" />)

    await waitFor(() => expect(ref.current?.isReady()).toBe(true))

    act(() => {
      ref.current?.recenter([
        [-97.74, 30.27],
        [-122.42, 37.77],
      ])
    })

    expect(h.fakeMap.fitBounds).toHaveBeenCalledWith(
      [
        [30.27, -97.74],
        [37.77, -122.42],
      ],
      expect.objectContaining({ maxZoom: 14, padding: [64, 64] }),
    )
  })

  it('maps asymmetric overlay padding to Leaflet fit options', async () => {
    const ref = React.createRef<MapHandle>()
    render(<Map ref={ref} center={[0, 0]} theme="light" />)
    await waitFor(() => expect(ref.current?.isReady()).toBe(true))

    act(() => {
      ref.current?.recenter([-97.74, 30.27], {
        padding: { top: 80, right: 372, bottom: 64, left: 64 },
      })
    })

    expect(h.fakeMap.fitBounds).toHaveBeenCalledWith(
      [[30.27, -97.74]],
      expect.objectContaining({
        paddingTopLeft: [64, 80],
        paddingBottomRight: [372, 64],
      }),
    )
  })
})

describe('Map marker-label context', () => {
  it('provides the current label toggle to descendants', () => {
    const { rerender } = render(
      <Map center={[0, 0]} showMarkerLabels>
        <LabelProbe />
      </Map>,
    )
    expect(screen.getByTestId('labels')).toHaveTextContent('on')

    rerender(
      <Map center={[0, 0]} showMarkerLabels={false}>
        <LabelProbe />
      </Map>,
    )
    expect(screen.getByTestId('labels')).toHaveTextContent('off')
  })
})
