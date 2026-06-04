// Property-based test for the recenter map center.
//
// Feature: map-tab-ui-improvements, Property 15: Recenter center lies within the listings' bounds
// Validates: Requirements 8.2
//
// For any non-empty set of mapped listings, `getMapCenter` returns a coordinate
// whose latitude lies within [min.lat, max.lat] and whose longitude lies within
// [min.lng, max.lng] of the markers' coordinates (computed by `computeBounds`),
// and equals the single coordinate when exactly one marker exists. When a
// selected id matches a marker, the center is that marker's coordinate (which is
// itself within bounds). The selected id is exercised as both `null` and an
// existing marker id.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { buildMarkers, computeBounds, getMapCenter } from './markers'
import { arbitraryListing } from './test-arbitraries'
import { hasCoords } from '../../components/listings/ExclusiveListingsShowcase'

// A listing constrained to be MAPPED: finite latitude/longitude. Reuses the
// shared `arbitraryListing` for every other field and only overrides the
// coordinates so `buildMarkers` always emits a marker for it.
const arbitraryFiniteLat = fc.double({
  min: -90,
  max: 90,
  noNaN: true,
  noDefaultInfinity: true,
})
const arbitraryFiniteLng = fc.double({
  min: -180,
  max: 180,
  noNaN: true,
  noDefaultInfinity: true,
})

const arbitraryMappedListing = arbitraryListing.chain((base) =>
  fc
    .record({ latitude: arbitraryFiniteLat, longitude: arbitraryFiniteLng })
    .map((coords) => ({ ...base, ...coords })),
)

// A non-empty marker set built from mapped listings, paired with a selected id
// that is either null, an existing marker id, or a (likely-absent) free string.
const arbitraryMarkersWithSelection = fc
  .array(arbitraryMappedListing, { minLength: 1, maxLength: 30 })
  .chain((listings) => {
    const markers = buildMarkers(listings)
    const ids = markers.map((m) => m.id)
    return fc
      .oneof(
        fc.constant<string | null>(null),
        fc.constantFrom(...ids),
        fc.string().map<string | null>((s) => s),
      )
      .map((selectedId) => ({ markers, selectedId }))
  })

describe("Feature: map-tab-ui-improvements, Property 15: Recenter center lies within the listings' bounds", () => {
  it('returns a center within the markers bounds, equal to the sole coordinate for a single marker, and equal to a selected marker', () => {
    fc.assert(
      fc.property(arbitraryMarkersWithSelection, ({ markers, selectedId }) => {
        // Precondition sanity: every input is mapped, so all become markers.
        expect(markers.length).toBeGreaterThan(0)

        const bounds = computeBounds(markers.map((m) => m.coords))
        expect(bounds).not.toBeNull()
        const { min, max } = bounds as {
          min: { lat: number; lng: number }
          max: { lat: number; lng: number }
        }

        const center = getMapCenter(markers, selectedId)

        // Core property: the center lies within the latitude/longitude bounds.
        expect(center.lat).toBeGreaterThanOrEqual(min.lat)
        expect(center.lat).toBeLessThanOrEqual(max.lat)
        expect(center.lng).toBeGreaterThanOrEqual(min.lng)
        expect(center.lng).toBeLessThanOrEqual(max.lng)

        const selected =
          selectedId !== null
            ? markers.find((m) => m.id === selectedId)
            : undefined

        if (selected) {
          // A matched selection centers exactly on that marker's coordinate
          // (it is within bounds, so clamping is a no-op).
          expect(center).toEqual(selected.coords)
        } else if (markers.length === 1) {
          // Exactly one marker (and no selection match): the sole coordinate.
          expect(center).toEqual(markers[0].coords)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('returns the single coordinate for a one-marker set with selectedId null', () => {
    fc.assert(
      fc.property(arbitraryMappedListing, (listing) => {
        const markers = buildMarkers([listing])
        expect(markers).toHaveLength(1)
        expect(hasCoords(listing)).toBe(true)

        const center = getMapCenter(markers, null)
        expect(center).toEqual(markers[0].coords)
      }),
      { numRuns: 200 },
    )
  })
})
