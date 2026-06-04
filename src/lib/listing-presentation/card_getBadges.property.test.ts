// Property-based test for `getBadges` (sidebar card badge set).
//
// Feature: map-tab-ui-improvements, Property 6: Badge set is derived correctly
// from listing flags.
//
// For any listing, `getBadges`:
//   - always includes 'Private',
//   - includes 'For Sale' iff `listing_type === 'for_sale'`,
//   - includes 'Mapped'   iff the listing has finite lat AND lng (hasCoords).
//
// Validates: Requirements 3.6

import fc from 'fast-check'
import { describe, it, expect } from 'vitest'

import { getBadges } from './card'
import { arbitraryListing } from './test-arbitraries'
import { hasCoords } from '../../components/listings/ExclusiveListingsShowcase'

describe('Feature: map-tab-ui-improvements, Property 6: Badge set is derived correctly from listing flags', () => {
  it('always includes Private, and For Sale / Mapped exactly per the listing flags', () => {
    fc.assert(
      fc.property(arbitraryListing, (listing) => {
        const badges = getBadges(listing)
        const badgeSet = new Set(badges)

        // 'Private' is always present.
        expect(badgeSet.has('Private')).toBe(true)

        // 'For Sale' iff listing_type === 'for_sale'.
        const expectForSale = listing.listing_type === 'for_sale'
        expect(badgeSet.has('For Sale')).toBe(expectForSale)

        // 'Mapped' iff the listing has finite coordinates.
        const expectMapped = hasCoords(listing)
        expect(badgeSet.has('Mapped')).toBe(expectMapped)

        // The badge set matches exactly the expected set (no extras).
        const expected = [
          'Private',
          expectForSale ? 'For Sale' : null,
          expectMapped ? 'Mapped' : null,
        ].filter((b): b is string => b !== null)

        expect(badges.length).toBe(expected.length)
        expect([...badgeSet].sort()).toEqual([...new Set(expected)].sort())
      }),
      { numRuns: 200 },
    )
  })
})
