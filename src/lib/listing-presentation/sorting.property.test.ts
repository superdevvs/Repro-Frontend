// Property-based test for `sortListings`.
//
// Task 3.2 — Property 11: Sorting is an order-respecting permutation.
// Validates: Requirements 4.6.
//
// For any listings and any sort option, `sortListings`:
//   - returns a permutation of the input (the same multiset of listings),
//   - does not mutate the input array,
//   - orders every adjacent pair according to the option's comparator, and
//   - is stable (ties preserve original input order).
//
// The comparator expectations are encoded here (independently of the
// implementation) so the test asserts the SPEC rather than mirroring code:
//   - priceDesc / priceAsc: listings without a valid (positive, finite) price
//     sort last; valid prices are monotonic in the chosen direction.
//   - cityAsc: case-insensitive, trimmed, non-decreasing among compared cities.
//   - mappedFirst: no unmapped listing precedes a mapped one.
//   - newest: permutation only (no date field), so the result is the input
//     order unchanged (pure stability).

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import { sortListings } from './sorting'
import { arbitraryListing, arbitrarySortOption } from './test-arbitraries'
import {
  type ShowcaseListing,
  hasCoords,
} from '../../components/listings/ExclusiveListingsShowcase'
import type { SortOption } from './types'

const NUM_RUNS = 200

// A price is valid for ordering only when positive and finite. Everything else
// (undefined, 0, negative, NaN, Infinity) is treated as "no price" and sorts last.
const hasValidPrice = (price: number | undefined | null): price is number =>
  typeof price === 'number' && Number.isFinite(price) && price > 0

// Spec-side comparator: negative means `a` must come before `b`, positive means
// after, 0 means the pair ties (and stability must then preserve input order).
const expectedCompare = (
  option: SortOption,
  a: ShowcaseListing,
  b: ShowcaseListing,
): number => {
  switch (option) {
    case 'priceDesc': {
      const aHas = hasValidPrice(a.price)
      const bHas = hasValidPrice(b.price)
      if (!aHas && !bHas) return 0
      if (!aHas) return 1
      if (!bHas) return -1
      return Math.sign(b.price! - a.price!)
    }
    case 'priceAsc': {
      const aHas = hasValidPrice(a.price)
      const bHas = hasValidPrice(b.price)
      if (!aHas && !bHas) return 0
      if (!aHas) return 1
      if (!bHas) return -1
      return Math.sign(a.price! - b.price!)
    }
    case 'cityAsc': {
      const aCity = (a.city ?? '').trim().toLowerCase()
      const bCity = (b.city ?? '').trim().toLowerCase()
      return Math.sign(aCity.localeCompare(bCity))
    }
    case 'mappedFirst': {
      const aMapped = hasCoords(a)
      const bMapped = hasCoords(b)
      if (aMapped === bMapped) return 0
      return aMapped ? -1 : 1
    }
    case 'newest':
    default:
      return 0
  }
}

describe('sortListings', () => {
  it('Feature: map-tab-ui-improvements, Property 11: Sorting is an order-respecting permutation', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryListing),
        arbitrarySortOption,
        (listings, option) => {
          // Snapshot input references + order to detect mutation.
          const inputSnapshot = [...listings]

          const result = sortListings(listings, option)

          // --- Not mutated: same array contents (by reference) and order. ---
          expect(listings).toHaveLength(inputSnapshot.length)
          for (let i = 0; i < inputSnapshot.length; i++) {
            expect(listings[i]).toBe(inputSnapshot[i])
          }

          // --- Permutation: same multiset of listing references. ---
          // Generated listings are distinct object references, so a reference
          // set comparison proves the result is a true permutation.
          expect(result).toHaveLength(listings.length)
          const inputRefs = new Set<ShowcaseListing>(listings)
          const resultRefs = new Set<ShowcaseListing>(result)
          expect(resultRefs.size).toBe(result.length) // no duplicates introduced
          expect(resultRefs.size).toBe(inputRefs.size)
          for (const listing of result) {
            expect(inputRefs.has(listing)).toBe(true)
          }

          // Original index lookup for the stability check.
          const originalIndex = new Map<ShowcaseListing, number>()
          listings.forEach((l, i) => originalIndex.set(l, i))

          // --- Ordering + stability for every adjacent pair. ---
          for (let i = 0; i + 1 < result.length; i++) {
            const a = result[i]
            const b = result[i + 1]
            const cmp = expectedCompare(option, a, b)

            // `a` must never be required to come strictly AFTER `b`.
            expect(cmp).toBeLessThanOrEqual(0)

            // Stability: when the pair ties, input order is preserved.
            if (cmp === 0) {
              expect(originalIndex.get(a)!).toBeLessThan(originalIndex.get(b)!)
            }
          }
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('Feature: map-tab-ui-improvements, Property 11: newest preserves input order exactly (pure stability)', () => {
    fc.assert(
      fc.property(fc.array(arbitraryListing), (listings) => {
        const result = sortListings(listings, 'newest')
        expect(result).toHaveLength(listings.length)
        for (let i = 0; i < listings.length; i++) {
          expect(result[i]).toBe(listings[i])
        }
      }),
      { numRuns: NUM_RUNS },
    )
  })
})
