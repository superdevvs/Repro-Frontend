// Property-based test for marker label derivation.
//
// Feature: map-tab-ui-improvements, Property 17: Marker label reflects price presence
// Validates: Requirements 10.2
//
// For any listing, `markerLabel` returns a non-empty string. When the listing
// has a positive finite price it returns a compact price string (starting with
// '$'); otherwise (missing / zero / negative / non-finite price) it returns the
// non-empty short fallback label.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { markerLabel } from './markers'
import { arbitraryListing } from './test-arbitraries'

/** Mirror of `markers.ts` semantics: positive, finite price. */
function hasPositivePrice(price: number | undefined | null): price is number {
  return typeof price === 'number' && Number.isFinite(price) && price > 0
}

describe('Feature: map-tab-ui-improvements, Property 17: Marker label reflects price presence', () => {
  it('returns a compact price label for positive prices and a non-empty fallback otherwise', () => {
    fc.assert(
      fc.property(arbitraryListing, (listing) => {
        const label = markerLabel(listing)

        // The label is always a non-empty string.
        expect(typeof label).toBe('string')
        expect(label.length).toBeGreaterThan(0)

        if (hasPositivePrice(listing.price)) {
          // Positive finite price -> compact price string beginning with '$'
          // and carrying at least one digit.
          expect(label.startsWith('$')).toBe(true)
          expect(/\d/.test(label)).toBe(true)
        } else {
          // Missing / zero / negative / non-finite price -> the short fallback.
          // The fallback is a fixed, non-empty, non-price label.
          expect(label).toBe('Private Listing')
        }
      }),
      { numRuns: 200 },
    )
  })

  it('uses the non-empty fallback for undefined, zero, negative, and NaN prices (explicit edge cases)', () => {
    const fallbackPrices: Array<number | undefined> = [
      undefined,
      0,
      -1,
      -1000,
      NaN,
    ]
    fc.assert(
      fc.property(
        arbitraryListing,
        fc.constantFrom(...fallbackPrices),
        (base, price) => {
          const label = markerLabel({ ...base, price })
          expect(label.length).toBeGreaterThan(0)
          expect(label).toBe('Private Listing')
        },
      ),
      { numRuns: 200 },
    )
  })

  it('uses a compact "$" price label for positive prices (explicit positive case)', () => {
    fc.assert(
      fc.property(
        arbitraryListing,
        fc.oneof(
          fc.integer({ min: 1, max: 5_000_000 }),
          fc.constant(999),
          fc.constant(1_500_000),
          fc.constant(2_000_000),
        ),
        (base, price) => {
          const label = markerLabel({ ...base, price })
          expect(label.startsWith('$')).toBe(true)
          expect(/\d/.test(label)).toBe(true)
          expect(label).not.toBe('Private Listing')
        },
      ),
      { numRuns: 200 },
    )
  })
})
