// Summary statistics for the Exclusive Listings Map Tab.
//
// `computeSummary` derives the Total / Mapped / Unmapped / Private / Hidden
// counts entirely from the already-loaded listing set. It is a pure,
// synchronous computation: no network calls and no mutation of its input.
//
// Validates: Requirements 5.1, 5.2 (Property 14: summary statistics are
// arithmetically consistent).

import type { Summary } from './types'
import { type ShowcaseListing, hasCoords } from '../../components/listings/ExclusiveListingsShowcase'

/**
 * Compute summary statistics for a set of listings, client-side.
 *
 * Guarantees (Property 14):
 * - `total === listings.length`
 * - `mapped === count(hasCoords)`
 * - `unmapped === total - mapped` (so `mapped + unmapped === total`)
 * - `hidden === count(isListingHidden)`
 * - `private === count(isPrivateListing)`
 * - every count lies within `[0, total]`
 */
export function computeSummary(listings: ShowcaseListing[]): Summary {
  const total = listings.length

  let mapped = 0
  let hidden = 0
  let privateCount = 0

  for (const listing of listings) {
    if (hasCoords(listing)) mapped += 1
    if (listing.isListingHidden) hidden += 1
    if (listing.isPrivateListing) privateCount += 1
  }

  return {
    total,
    mapped,
    unmapped: total - mapped,
    private: privateCount,
    hidden,
  }
}
