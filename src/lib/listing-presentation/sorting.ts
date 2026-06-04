// Sorting logic for the Exclusive Listings Map Tab.
//
// `sortListings` is a pure, non-mutating, STABLE sort: it copies its input and
// returns a permutation of that input (the same multiset of listings) ordered
// by the chosen comparator. Ties always preserve the original input order.
//
// Stability is guaranteed explicitly via an index tiebreaker (rather than
// relying on the host engine's Array.prototype.sort stability), so the result
// is deterministic across environments.
//
// Validates: Requirements 4.6 (Property 11: sorting is an order-respecting
// permutation).

import type { SortOption } from './types'
import { type ShowcaseListing, hasCoords } from '../../components/listings/ExclusiveListingsShowcase'

/**
 * Human-readable sort options surfaced by the Sort menu. Covers every
 * `SortOption` value with a friendly label.
 */
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'priceDesc', label: 'Price: High to Low' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'cityAsc', label: 'City: A to Z' },
  { value: 'newest', label: 'Newest' },
  { value: 'mappedFirst', label: 'Mapped First' },
]

/**
 * A price is "valid" for ordering purposes when it is a positive, finite
 * number. Missing, zero, negative, or non-finite prices are treated as having
 * no price and are ordered last for both price sorts.
 */
const hasValidPrice = (price: number | undefined | null): price is number =>
  typeof price === 'number' && Number.isFinite(price) && price > 0

/**
 * Compare two listings by price. Listings without a valid price always sort
 * after listings with a valid price, regardless of direction.
 *
 * @param direction `'desc'` sorts higher prices first, `'asc'` lower first.
 * @returns negative if `a` should come before `b`, positive if after, 0 if equal.
 */
const comparePrice = (
  a: ShowcaseListing,
  b: ShowcaseListing,
  direction: 'asc' | 'desc',
): number => {
  const aHas = hasValidPrice(a.price)
  const bHas = hasValidPrice(b.price)

  // No-price listings always sort last.
  if (!aHas && !bHas) return 0
  if (!aHas) return 1
  if (!bHas) return -1

  // Both have a valid price.
  return direction === 'desc' ? b.price! - a.price! : a.price! - b.price!
}

/**
 * Compare two listings by city name, case-insensitively (A–Z).
 */
const compareCity = (a: ShowcaseListing, b: ShowcaseListing): number => {
  const aCity = (a.city ?? '').trim().toLowerCase()
  const bCity = (b.city ?? '').trim().toLowerCase()
  return aCity.localeCompare(bCity)
}

/**
 * Compare two listings by mapped status: mapped listings (those with finite
 * coordinates) come before unmapped ones. Listings in the same group tie.
 */
const compareMappedFirst = (a: ShowcaseListing, b: ShowcaseListing): number => {
  const aMapped = hasCoords(a)
  const bMapped = hasCoords(b)
  if (aMapped === bMapped) return 0
  return aMapped ? -1 : 1
}

/**
 * Resolve the comparator for a given sort option. The `newest` option has no
 * date field available on `ShowcaseListing`, so it preserves input order as a
 * stable fallback (comparator always returns 0).
 */
const comparatorFor = (
  option: SortOption,
): ((a: ShowcaseListing, b: ShowcaseListing) => number) => {
  switch (option) {
    case 'priceDesc':
      return (a, b) => comparePrice(a, b, 'desc')
    case 'priceAsc':
      return (a, b) => comparePrice(a, b, 'asc')
    case 'cityAsc':
      return compareCity
    case 'mappedFirst':
      return compareMappedFirst
    case 'newest':
    default:
      // No date fields on ShowcaseListing: keep input order (stable fallback).
      return () => 0
  }
}

/**
 * Sort listings by the given option without mutating the input.
 *
 * Guarantees (Property 11):
 * - Returns a permutation of the input (same multiset of listings).
 * - Does not mutate the input array.
 * - Is stable: listings that tie under the chosen comparator keep their
 *   original relative input order (enforced via an index tiebreaker).
 */
export function sortListings(
  listings: ShowcaseListing[],
  option: SortOption,
): ShowcaseListing[] {
  const compare = comparatorFor(option)

  // Decorate with original index so ties resolve to input order, guaranteeing
  // stability independent of the engine's Array.sort implementation.
  return listings
    .map((listing, index) => ({ listing, index }))
    .sort((a, b) => {
      const result = compare(a.listing, b.listing)
      return result !== 0 ? result : a.index - b.index
    })
    .map((entry) => entry.listing)
}
