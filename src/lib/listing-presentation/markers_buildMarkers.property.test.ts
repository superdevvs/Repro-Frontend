// Property-based test for marker / mapped-listing correspondence.
//
// Feature: map-tab-ui-improvements, Property 16: Markers correspond one-to-one with mapped listings
// Validates: Requirements 10.1
//
// For any set of listings, `buildMarkers` returns exactly one marker per mapped
// listing (a listing with finite coordinates, per `hasCoords`) and none for
// unmapped listings. Each marker preserves its source listing's id and takes
// its coordinates from that listing's latitude/longitude, so the resulting set
// bijects (as a multiset) with the mapped subset of the input.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { buildMarkers } from './markers'
import { arbitraryListing } from './test-arbitraries'
import { hasCoords } from '../../components/listings/ExclusiveListingsShowcase'

/** Multiset (counts) of a list of strings, for order-independent comparison. */
function counts(ids: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
  return m
}

describe('Feature: map-tab-ui-improvements, Property 16: Markers correspond one-to-one with mapped listings', () => {
  it('produces exactly one marker per mapped listing (and none for unmapped), preserving ids and coords', () => {
    fc.assert(
      fc.property(fc.array(arbitraryListing), (listings) => {
        const markers = buildMarkers(listings)
        const mapped = listings.filter(hasCoords)

        // 1. Count bijection: exactly one marker per mapped listing, none for unmapped.
        expect(markers).toHaveLength(mapped.length)

        // 2. The marker ids form the same multiset as the mapped listings' ids
        //    (a bijection that tolerates duplicate ids in the input).
        expect(counts(markers.map((m) => m.id))).toEqual(
          counts(mapped.map((l) => l.id)),
        )

        // 3. Every marker corresponds to a mapped listing whose lat/lng it carries.
        //    We consume each mapped listing at most once to enforce one-to-one.
        const remaining = [...mapped]
        for (const marker of markers) {
          const idx = remaining.findIndex(
            (l) =>
              l.id === marker.id &&
              l.latitude === marker.coords.lat &&
              l.longitude === marker.coords.lng,
          )
          expect(idx).toBeGreaterThanOrEqual(0)
          remaining.splice(idx, 1)
        }
        // Every mapped listing was matched to exactly one marker.
        expect(remaining).toHaveLength(0)

        // 4. No marker is emitted for an unmapped listing: every marker's coords
        //    are finite numbers.
        for (const marker of markers) {
          expect(Number.isFinite(marker.coords.lat)).toBe(true)
          expect(Number.isFinite(marker.coords.lng)).toBe(true)
        }
      }),
      { numRuns: 200 },
    )
  })
})
