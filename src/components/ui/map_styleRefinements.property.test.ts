// Property-based test for CARTO basemap style refinement.
//
// Feature: map-tab-ui-improvements, Property 1: Style refinement preserves layers and is idempotent
// Validates: Requirements 1.4
//
// For any valid-ish MapLibre style object, `applyStyleRefinements`:
//   - returns a style with the SAME `version`,
//   - returns a style whose `sources` deep-equal the input `sources`,
//   - preserves the exact set of layer ids in the SAME order (no layer added,
//     removed, or reordered) — only paint/layout properties may be rewritten,
//   - is idempotent: applying it twice deep-equals applying it once.
//
// It is also total/defensive: any unexpected shape (layers not an array, or a
// non-object input) causes the ORIGINAL value to be returned unchanged.

import { describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'

// `map.tsx` imports the maplibre-gl runtime (and its CSS). For a pure unit test
// of the exported `applyStyleRefinements` function we don't need a real map
// engine, so we stub the runtime classes. (The CSS import is neutralized by the
// `css: false` vitest config.) Type-only imports from maplibre-gl are erased at
// compile time and are unaffected by this mock.
vi.mock('maplibre-gl', () => ({
  Map: class {},
  Marker: class {},
  Popup: class {},
  LngLatBounds: class {},
}))

import { applyStyleRefinements } from './map'

// ---------------------------------------------------------------------------
// Local loose types / helpers (we never need the full maplibre type here).
// ---------------------------------------------------------------------------

type StyleArg = Parameters<typeof applyStyleRefinements>[0]

interface LooseStyle {
  version?: unknown
  name?: unknown
  sources?: unknown
  layers?: Array<{ id: string }>
}

const asStyle = (s: unknown): StyleArg => s as StyleArg
const looseLayerIds = (s: unknown): string[] =>
  ((s as LooseStyle).layers ?? []).map((l) => l.id)

// ---------------------------------------------------------------------------
// Arbitraries for a valid-ish MapLibre StyleSpecification.
// ---------------------------------------------------------------------------

// Style names: sometimes containing 'Positron' / 'Dark Matter' (so the
// internal theme inference picks light vs. dark), sometimes arbitrary.
const arbitraryName: fc.Arbitrary<string> = fc.oneof(
  fc.constant('Positron'),
  fc.constant('CARTO Positron'),
  fc.constant('Dark Matter'),
  fc.constant('CARTO Dark Matter'),
  fc.string(),
)

// Layer ids: a curated pool that frequently matches the water/road/land
// regexes inside map.tsx (so refinement actually fires), mixed with arbitrary
// strings that usually don't match.
const arbitraryLayerId: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    'water',
    'waterway',
    'water_shadow',
    'ocean',
    'lake',
    'river',
    'background',
    'road',
    'road_major',
    'road_minor',
    'highway',
    'motorway',
    'bridge',
    'tunnel',
    'rail',
    'landuse',
    'landuse_park',
    'landcover',
    'park',
    'forest',
    'grass',
    'natural_wood',
    'place_label',
    'poi_label',
    'building',
    'boundary',
    'admin',
    'housenumber',
  ),
  fc.string({ minLength: 1 }),
  fc.string(),
)

const arbitraryLayerType: fc.Arbitrary<string> = fc.constantFrom(
  'background',
  'fill',
  'line',
  'symbol',
  'raster',
)

const arbitraryPaintValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: 0, max: 20 }),
  fc.constantFrom('#ffffff', '#000000', 'rgba(0,0,0,0.5)', 'hsl(200,50%,50%)'),
)

const arbitraryPaint: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.constantFrom(
    'fill-color',
    'line-color',
    'background-color',
    'line-width',
    'fill-opacity',
    'line-opacity',
    'text-color',
    'icon-color',
    'background-opacity',
  ),
  arbitraryPaintValue,
  { maxKeys: 5 },
)

const arbitraryLayout: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.constantFrom('visibility', 'line-cap', 'line-join', 'text-field', 'text-size', 'icon-image'),
  fc.oneof(fc.string(), fc.constantFrom('visible', 'none', 'round', 'butt')),
  { maxKeys: 4 },
)

// A single layer object with a unique-able id, a type, and optional
// paint/layout/source/source-layer.
const arbitraryLayer: fc.Arbitrary<Record<string, unknown>> = fc
  .tuple(arbitraryLayerId, arbitraryLayerType)
  .chain(([id, type]) =>
    fc
      .record({
        paint: fc.option(arbitraryPaint, { nil: undefined }),
        layout: fc.option(arbitraryLayout, { nil: undefined }),
        source:
          type === 'background'
            ? fc.constant<string | undefined>(undefined)
            : fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        sourceLayer: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
      })
      .map((body) => {
        const layer: Record<string, unknown> = { id, type }
        if (body.paint !== undefined) layer.paint = body.paint
        if (body.layout !== undefined) layer.layout = body.layout
        if (body.source !== undefined) layer.source = body.source
        if (body.sourceLayer !== undefined && type !== 'background') {
          layer['source-layer'] = body.sourceLayer
        }
        return layer
      }),
  )

// Layers: unique by id (a MapLibre style requires unique layer ids).
const arbitraryLayers: fc.Arbitrary<Array<Record<string, unknown>>> =
  fc.uniqueArray(arbitraryLayer, {
    selector: (l) => l.id as string,
    maxLength: 14,
  })

const arbitrarySource: fc.Arbitrary<Record<string, unknown>> = fc.record(
  {
    type: fc.constantFrom('vector', 'raster', 'geojson', 'raster-dem'),
    url: fc.option(fc.webUrl(), { nil: undefined }),
    tiles: fc.option(fc.array(fc.webUrl(), { maxLength: 2 }), { nil: undefined }),
    attribution: fc.option(fc.string(), { nil: undefined }),
  },
  { requiredKeys: ['type'] },
)

const arbitrarySources: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.string({ minLength: 1 }),
  arbitrarySource,
  { maxKeys: 4 },
)

// A valid-ish StyleSpecification: version 8, optional name, arbitrary sources,
// and a unique-id layer array.
const arbitraryStyle: fc.Arbitrary<Record<string, unknown>> = fc.record(
  {
    version: fc.constant(8),
    name: arbitraryName,
    sources: arbitrarySources,
    layers: arbitraryLayers,
  },
  { requiredKeys: ['version', 'sources', 'layers'] },
)

// ---------------------------------------------------------------------------
// Property 1
// ---------------------------------------------------------------------------

describe('Feature: map-tab-ui-improvements, Property 1: Style refinement preserves layers and is idempotent', () => {
  it('preserves version, sources, and the exact ordered set of layer ids, and is idempotent', () => {
    fc.assert(
      fc.property(arbitraryStyle, (style) => {
        const result = applyStyleRefinements(asStyle(style))
        const resultObj = result as unknown as LooseStyle

        // 1. version preserved.
        expect(resultObj.version).toBe((style as LooseStyle).version)

        // 2. sources deep-equal the input sources (preserved, not rewritten).
        expect(resultObj.sources).toEqual((style as LooseStyle).sources)

        // 3. Layer ids identical in the SAME order (no add / remove / reorder).
        expect(looseLayerIds(result)).toEqual(looseLayerIds(style))

        // 4. Idempotence: applying twice deep-equals applying once.
        const once = applyStyleRefinements(asStyle(style))
        const twice = applyStyleRefinements(asStyle(once))
        expect(twice).toEqual(once)
      }),
      { numRuns: 300 },
    )
  })

  it('returns the original value unchanged for unexpected shapes', () => {
    // layers is not an array -> original object returned by reference.
    const badLayers = { version: 8, name: 'Positron', sources: {}, layers: 'not-an-array' }
    expect(applyStyleRefinements(asStyle(badLayers))).toBe(badLayers)

    // object missing layers entirely -> original object returned by reference.
    const noLayers = { version: 8, sources: {} }
    expect(applyStyleRefinements(asStyle(noLayers))).toBe(noLayers)

    // non-object inputs -> returned unchanged.
    expect(applyStyleRefinements(asStyle(null))).toBe(null)
    expect(applyStyleRefinements(asStyle(undefined))).toBe(undefined)
    expect(applyStyleRefinements(asStyle(42))).toBe(42)
    expect(applyStyleRefinements(asStyle('positron'))).toBe('positron')
  })

  it('returns the original unchanged for arbitrary non-object / malformed-layers inputs', () => {
    const arbitraryBadShape = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.integer(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.string(),
      fc.boolean(),
      // object whose `layers` is present but not an array.
      fc.record({
        version: fc.constant(8),
        sources: arbitrarySources,
        layers: fc.oneof(fc.string(), fc.integer(), fc.dictionary(fc.string(), fc.string())),
      }),
    )

    fc.assert(
      fc.property(arbitraryBadShape, (input) => {
        // The exact same value/reference is returned (no transformation).
        expect(applyStyleRefinements(asStyle(input))).toBe(input)
      }),
      { numRuns: 150 },
    )
  })
})
