// Unit tests for the Map component's basemap theme selection, label-toggle
// plumbing, and imperative recenter behavior.
//
// Feature: map-tab-ui-improvements
// Task 12.3: Write unit test for basemap theme selection and toggles
// Validates: Requirements 1.3 (positron in light / dark-matter in dark),
//            8.2 (recenter on mapped listings), 8.3 (toggle property labels).
//
// maplibre-gl cannot run in jsdom (it needs WebGL + a real canvas), so the
// whole module is mocked with a fake `Map` that records the `style` it was
// constructed with and the methods map.tsx calls. The fake also lets a test
// drive the `load` event that map.tsx awaits via `map.once('load', ...)`.
//
// map.tsx initializes the map behind a `setTimeout(..., 100)`, so the tests
// wait (via `waitFor`) for the fake Map instance to be constructed before
// asserting, and fire `load` inside `act()` to flush the resulting state
// updates (mapLoaded -> children render).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import '@testing-library/jest-dom/vitest'

// The basemap style URLs map.tsx selects from (mirrored here; they are module
// constants in map.tsx, not exported). positron == light, dark-matter == dark.
const LIGHT_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const DARK_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// ---------------------------------------------------------------------------
// maplibre-gl mock
// ---------------------------------------------------------------------------
// A registry of constructed fake maps + fake classes are created in a hoisted
// block so the vi.mock factory (also hoisted) can reference them.
const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstances: any[] = []

  class FakeLngLatBounds {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    points: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(sw?: any, ne?: any) {
      this.points = []
      if (sw !== undefined) this.points.push(sw)
      if (ne !== undefined) this.points.push(ne)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extend(c: any) {
      this.points.push(c)
      return this
    }
  }

  class FakeMap {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    style: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handlers: Record<string, Array<(...a: any[]) => void>>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onceHandlers: Record<string, Array<(...a: any[]) => void>>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fitBoundsCalls: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flyToCalls: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setStyleCalls: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setCenterCalls: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setZoomCalls: any[]
    removed: boolean
    _zoom: number

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(options: any) {
      this.options = options
      this.style = options?.style
      this.handlers = {}
      this.onceHandlers = {}
      this.fitBoundsCalls = []
      this.flyToCalls = []
      this.setStyleCalls = []
      this.setCenterCalls = []
      this.setZoomCalls = []
      this.removed = false
      this._zoom = options?.zoom ?? 12
      mapInstances.push(this)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, handler: (...a: any[]) => void) {
      ;(this.handlers[event] ||= []).push(handler)
      return this
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    once(event: string, handler: (...a: any[]) => void) {
      ;(this.onceHandlers[event] ||= []).push(handler)
      return this
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    off(event: string, handler: (...a: any[]) => void) {
      if (this.handlers[event])
        this.handlers[event] = this.handlers[event].filter((x) => x !== handler)
      if (this.onceHandlers[event])
        this.onceHandlers[event] = this.onceHandlers[event].filter(
          (x) => x !== handler,
        )
      return this
    }
    // Test helper: synchronously dispatch an event to registered handlers.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __fire(event: string, ...args: any[]) {
      ;(this.handlers[event] || []).slice().forEach((x) => x(...args))
      const once = (this.onceHandlers[event] || []).slice()
      this.onceHandlers[event] = []
      once.forEach((x) => x(...args))
    }

    remove() {
      this.removed = true
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setStyle(style: any, opts?: any) {
      this.setStyleCalls.push({ style, opts })
      this.style = style
    }
    getStyle() {
      return this.style
    }
    isStyleLoaded() {
      return true
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fitBounds(bounds: any, opts?: any) {
      this.fitBoundsCalls.push({ bounds, opts })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flyTo(opts: any) {
      this.flyToCalls.push(opts)
    }
    getZoom() {
      return this._zoom
    }
    zoomIn() {
      this._zoom += 1
    }
    zoomOut() {
      this._zoom -= 1
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setCenter(c: any) {
      this.setCenterCalls.push(c)
    }
    setZoom(z: number) {
      this._zoom = z
      this.setZoomCalls.push(z)
    }
    getContainer() {
      return this.options?.container
    }
  }

  class FakeMarker {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public opts?: any) {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLngLat() {
      return this
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPopup() {
      return this
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addTo() {
      return this
    }
    remove() {}
  }

  class FakePopup {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public opts?: any) {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDOMContent() {
      return this
    }
    remove() {}
  }

  return { mapInstances, FakeMap, FakeMarker, FakePopup, FakeLngLatBounds }
})

vi.mock('maplibre-gl', () => ({
  __esModule: true,
  Map: h.FakeMap,
  Marker: h.FakeMarker,
  Popup: h.FakePopup,
  LngLatBounds: h.FakeLngLatBounds,
  default: {
    Map: h.FakeMap,
    Marker: h.FakeMarker,
    Popup: h.FakePopup,
    LngLatBounds: h.FakeLngLatBounds,
  },
}))

// The CSS side-effect import in map.tsx has no behavior to test; stub it out.
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

// Import AFTER the mocks are registered.
import { Map, useShowMarkerLabels, type MapHandle } from './map'

// Wait until map.tsx has constructed its (single) fake map instance behind the
// setTimeout(...,100), then return it.
async function waitForMapInstance() {
  await waitFor(() => expect(h.mapInstances.length).toBeGreaterThan(0))
  return h.mapInstances[h.mapInstances.length - 1]
}

// A probe child that surfaces the plumbed `showMarkerLabels` flag (R8.3 path).
function LabelProbe() {
  const labels = useShowMarkerLabels()
  return <div data-testid="labels">{labels ? 'on' : 'off'}</div>
}

beforeEach(() => {
  h.mapInstances.length = 0
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  cleanup()
  h.mapInstances.length = 0
})

describe('Map basemap theme selection (R1.3)', () => {
  it('selects the CARTO positron basemap when theme is "light"', async () => {
    render(<Map center={[0, 0]} theme="light" />)

    const instance = await waitForMapInstance()

    expect(instance.style).toBe(LIGHT_STYLE_URL)
    expect(instance.style).toContain('positron')
  })

  it('selects the CARTO dark-matter basemap when theme is "dark"', async () => {
    render(<Map center={[0, 0]} theme="dark" />)

    const instance = await waitForMapInstance()

    expect(instance.style).toBe(DARK_STYLE_URL)
    expect(instance.style).toContain('dark-matter')
  })

  it('falls back to the document theme (dark) when no explicit theme prop is set', async () => {
    document.documentElement.classList.add('dark')

    render(<Map center={[0, 0]} />)

    const instance = await waitForMapInstance()

    expect(instance.style).toBe(DARK_STYLE_URL)
  })
})

describe('Map imperative recenter (R8.2)', () => {
  it('fits bounds across multiple mapped-listing coordinates', async () => {
    const ref = React.createRef<MapHandle>()
    render(<Map ref={ref} center={[0, 0]} theme="light" />)

    const instance = await waitForMapInstance()
    // Drive the load event so the component is in its loaded state.
    await act(async () => {
      instance.__fire('load')
    })

    act(() => {
      ref.current?.recenter([
        [-97.74, 30.27],
        [-122.42, 37.77],
      ])
    })

    expect(instance.fitBoundsCalls).toHaveLength(1)
    expect(instance.flyToCalls).toHaveLength(0)
    // The bounds passed to fitBounds covers both supplied coordinates.
    const bounds = instance.fitBoundsCalls[0].bounds
    expect(bounds.points).toEqual(
      expect.arrayContaining([
        [-97.74, 30.27],
        [-122.42, 37.77],
      ]),
    )
  })

  it('flies to a single coordinate rather than fitting bounds', async () => {
    const ref = React.createRef<MapHandle>()
    render(<Map ref={ref} center={[0, 0]} theme="light" />)

    const instance = await waitForMapInstance()
    await act(async () => {
      instance.__fire('load')
    })

    act(() => {
      ref.current?.recenter([-97.74, 30.27])
    })

    expect(instance.flyToCalls).toHaveLength(1)
    expect(instance.flyToCalls[0].center).toEqual([-97.74, 30.27])
    expect(instance.fitBoundsCalls).toHaveLength(0)
  })

  it('recenters on marker objects ({lat,lng}) by fitting their bounds', async () => {
    const ref = React.createRef<MapHandle>()
    render(<Map ref={ref} center={[0, 0]} theme="light" />)

    const instance = await waitForMapInstance()
    await act(async () => {
      instance.__fire('load')
    })

    act(() => {
      ref.current?.recenter([
        { lat: 30.27, lng: -97.74 },
        { lat: 37.77, lng: -122.42 },
      ])
    })

    expect(instance.fitBoundsCalls).toHaveLength(1)
    const bounds = instance.fitBoundsCalls[0].bounds
    // Markers are normalized into [lng, lat] pairs before extending the bounds.
    expect(bounds.points).toEqual(
      expect.arrayContaining([
        [-97.74, 30.27],
        [-122.42, 37.77],
      ]),
    )
  })
})

describe('Map marker-label toggle plumbing (R8.3)', () => {
  it('exposes showMarkerLabels=true to descendants via useShowMarkerLabels', async () => {
    render(
      <Map center={[0, 0]} theme="light" showMarkerLabels>
        <LabelProbe />
      </Map>,
    )

    const instance = await waitForMapInstance()
    await act(async () => {
      instance.__fire('load')
    })

    await waitFor(() =>
      expect(screen.getByTestId('labels')).toHaveTextContent('on'),
    )
  })

  it('exposes showMarkerLabels=false (default) to descendants', async () => {
    render(
      <Map center={[0, 0]} theme="light" showMarkerLabels={false}>
        <LabelProbe />
      </Map>,
    )

    const instance = await waitForMapInstance()
    await act(async () => {
      instance.__fire('load')
    })

    await waitFor(() =>
      expect(screen.getByTestId('labels')).toHaveTextContent('off'),
    )
  })
})
