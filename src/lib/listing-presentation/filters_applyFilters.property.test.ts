// Property-based test for `applyFilters`.
//
// Feature: map-tab-ui-improvements, Property 8: Filtering returns a satisfying subset
// Validates: Requirements 4.3
//
// For any set of listings and any set of active filters, `applyFilters` returns
// a subset of the input in which every listing satisfies every active filter;
// an empty filter set returns all input listings.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { applyFilters, listingMatchesFilter } from './filters'
import { arbitraryFilter, arbitraryListing } from './test-arbitraries'

describe('Feature: map-tab-ui-improvements, Property 8: Filtering returns a satisfying subset', () => {
  it('returns a subset whose every listing satisfies every active filter', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryListing),
        fc.array(arbitraryFilter),
        (listings, filters) => {
          const result = applyFilters(listings, filters)

          // 1. Subset: every returned listing is one of the input listings
          //    (by reference identity — applyFilters never clones listings).
          for (const item of result) {
            expect(listings).toContain(item)
          }

          // 2. Satisfaction: every returned listing satisfies EVERY active filter.
          for (const item of result) {
            for (const f of filters) {
              expect(listingMatchesFilter(item, f)).toBe(true)
            }
          }

          // 3. Completeness: no input listing that satisfies all filters is
          //    dropped (the result is exactly the satisfying subset).
          const expected = listings.filter((l) =>
            filters.every((f) => listingMatchesFilter(l, f)),
          )
          expect(result).toEqual(expected)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('returns all input listings when the filter set is empty', () => {
    fc.assert(
      fc.property(fc.array(arbitraryListing), (listings) => {
        const result = applyFilters(listings, [])
        // Empty filter set returns the input unchanged.
        expect(result).toEqual(listings)
        expect(result).toHaveLength(listings.length)
      }),
      { numRuns: 100 },
    )
  })
})
