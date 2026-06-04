// Property-based test for `computeSummary`.
//
// Task 5.2 — Property 14: Summary statistics are arithmetically consistent.
// Validates: Requirements 5.1, 5.2.
//
// For any listings, `computeSummary` satisfies:
//   - total === listings.length
//   - mapped + unmapped === total
//   - hidden === count(isListingHidden)
//   - private === count(isPrivateListing)
//   - mapped === count(hasCoords)   (cross-check)
//   - every count lies within [0, total]
// and does not mutate the input.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import { computeSummary } from './summary'
import { arbitraryListing } from './test-arbitraries'
import { hasCoords } from '../../components/listings/ExclusiveListingsShowcase'

const NUM_RUNS = 200

describe('computeSummary', () => {
  it('Feature: map-tab-ui-improvements, Property 14: Summary statistics are arithmetically consistent', () => {
    fc.assert(
      fc.property(fc.array(arbitraryListing), (listings) => {
        const total = listings.length
        const expectedMapped = listings.filter((l) => hasCoords(l)).length
        const expectedHidden = listings.filter((l) => l.isListingHidden).length
        const expectedPrivate = listings.filter((l) => l.isPrivateListing).length

        const summary = computeSummary(listings)

        // total === listings.length
        expect(summary.total).toBe(total)

        // mapped + unmapped === total
        expect(summary.mapped + summary.unmapped).toBe(total)

        // hidden === count(isListingHidden)
        expect(summary.hidden).toBe(expectedHidden)

        // private === count(isPrivateListing)
        expect(summary.private).toBe(expectedPrivate)

        // mapped cross-checked against hasCoords count
        expect(summary.mapped).toBe(expectedMapped)
        expect(summary.unmapped).toBe(total - expectedMapped)

        // every count within [0, total]
        for (const count of [
          summary.total,
          summary.mapped,
          summary.unmapped,
          summary.private,
          summary.hidden,
        ]) {
          expect(count).toBeGreaterThanOrEqual(0)
          expect(count).toBeLessThanOrEqual(total)
        }
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('Feature: map-tab-ui-improvements, Property 14: computeSummary does not mutate its input', () => {
    fc.assert(
      fc.property(fc.array(arbitraryListing), (listings) => {
        const before = listings.map((l) => ({ ...l }))
        computeSummary(listings)
        expect(listings).toHaveLength(before.length)
        for (let i = 0; i < before.length; i++) {
          expect(listings[i]).toEqual(before[i])
        }
      }),
      { numRuns: NUM_RUNS },
    )
  })
})
