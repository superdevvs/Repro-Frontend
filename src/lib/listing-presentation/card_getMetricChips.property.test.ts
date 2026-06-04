// Property-based test for `getMetricChips` (sidebar card bed/bath/sqft chips).
//
// Feature: map-tab-ui-improvements, Property 5: Metric chips correspond exactly
// to present metrics.
//
// For any listing, `getMetricChips` includes:
//   - a beds chip  iff `bedrooms`  is present and positive,
//   - a baths chip iff `bathrooms` is present and positive,
//   - a sqft chip  iff `sqft`      is present and positive.
// The set of chip kinds matches exactly the set of present-and-positive metrics.
//
// Validates: Requirements 3.5

import fc from 'fast-check'
import { describe, it, expect } from 'vitest'

import { getMetricChips } from './card'
import { arbitraryListing } from './test-arbitraries'

/** Oracle: a present, positive, finite number. */
function isPositiveFinite(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

describe('Feature: map-tab-ui-improvements, Property 5: Metric chips correspond exactly to present metrics', () => {
  it('produces a chip for each present-and-positive metric and none otherwise', () => {
    fc.assert(
      fc.property(arbitraryListing, (listing) => {
        const chips = getMetricChips(listing)
        const kinds = chips.map((c) => c.kind)
        const kindSet = new Set(kinds)

        // Expected presence per metric.
        const expectBeds = isPositiveFinite(listing.bedrooms)
        const expectBaths = isPositiveFinite(listing.bathrooms)
        const expectSqft = isPositiveFinite(listing.sqft)

        expect(kindSet.has('beds')).toBe(expectBeds)
        expect(kindSet.has('baths')).toBe(expectBaths)
        expect(kindSet.has('sqft')).toBe(expectSqft)

        // The kind set matches exactly the expected set (no extras / duplicates).
        const expected = [
          expectBeds ? 'beds' : null,
          expectBaths ? 'baths' : null,
          expectSqft ? 'sqft' : null,
        ].filter((k): k is string => k !== null)

        expect(kinds.length).toBe(expected.length)
        expect([...kindSet].sort()).toEqual([...new Set(expected)].sort())

        // Every chip carries a non-empty label.
        for (const chip of chips) {
          expect(typeof chip.text).toBe('string')
          expect(chip.text.trim().length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 200 },
    )
  })
})
