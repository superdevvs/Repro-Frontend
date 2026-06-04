// Pure, client-side filtering logic for the Exclusive Listings Map Tab.
//
// All functions here are array -> array (or value) pure functions with no side
// effects and no network calls. They operate on the already-loaded listing set.
//
// Filter semantics (AND across the active set):
//   - forSale -> listing_type === 'for_sale'
//   - private -> isPrivateListing
//   - mapped  -> hasCoords(listing)
//   - minBeds -> (bedrooms ?? 0) >= value
//   - city    -> case-insensitive equality on city

import type { Filter, FilterChip, FilterKey } from './types'
import {
  hasCoords,
  type ShowcaseListing,
} from '../../components/listings/ExclusiveListingsShowcase'

/**
 * True iff the listing satisfies the single filter.
 */
export function listingMatchesFilter(l: ShowcaseListing, f: Filter): boolean {
  switch (f.kind) {
    case 'forSale':
      return l.listing_type === 'for_sale'
    case 'private':
      return l.isPrivateListing === true
    case 'mapped':
      return hasCoords(l)
    case 'minBeds': {
      const threshold = Number(f.value ?? 0)
      return (l.bedrooms ?? 0) >= threshold
    }
    case 'city': {
      const target = String(f.value ?? '').toLowerCase()
      return (l.city ?? '').toLowerCase() === target
    }
    default:
      return false
  }
}

/**
 * Returns the listings satisfying ALL active filters (AND semantics).
 * An empty filter list returns the input unchanged (same reference); the input
 * array is never mutated.
 */
export function applyFilters(
  listings: ShowcaseListing[],
  filters: Filter[],
): ShowcaseListing[] {
  if (filters.length === 0) return listings
  return listings.filter((l) => filters.every((f) => listingMatchesFilter(l, f)))
}

/**
 * Stable string identity for a filter, used for chips and removal.
 * e.g. "forSale", "private", "mapped", "minBeds:3", "city:Austin"
 */
export function filterKey(f: Filter): FilterKey {
  switch (f.kind) {
    case 'forSale':
    case 'private':
    case 'mapped':
      return f.kind
    case 'minBeds':
      return `minBeds:${Number(f.value ?? 0)}`
    case 'city':
      return `city:${String(f.value ?? '')}`
    default:
      return String(f.kind)
  }
}

/**
 * Adds a filter, de-duplicated by stable key (no-op if the key is already
 * present). Returns a new array; the input is never mutated.
 */
export function addFilter(filters: Filter[], f: Filter): Filter[] {
  const key = filterKey(f)
  if (filters.some((existing) => filterKey(existing) === key)) {
    return filters
  }
  return [...filters, f]
}

/**
 * Removes the filter matching the given key, preserving the order of the
 * remaining filters. Returns a new array; the input is never mutated.
 */
export function removeFilter(filters: Filter[], key: FilterKey): Filter[] {
  return filters.filter((f) => filterKey(f) !== key)
}

/**
 * Human-readable label for a filter chip.
 * e.g. "For Sale", "Private", "Mapped", "3+ Beds", "Austin"
 */
function filterLabel(f: Filter): string {
  switch (f.kind) {
    case 'forSale':
      return 'For Sale'
    case 'private':
      return 'Private'
    case 'mapped':
      return 'Mapped'
    case 'minBeds':
      return `${Number(f.value ?? 0)}+ Beds`
    case 'city':
      return String(f.value ?? '')
    default:
      return String(f.kind)
  }
}

/**
 * Maps each active filter to exactly one chip carrying a human label and the
 * filter's stable removal key (one-to-one with the input filters, order
 * preserved).
 */
export function getFilterChips(filters: Filter[]): FilterChip[] {
  return filters.map((f) => ({ key: filterKey(f), label: filterLabel(f) }))
}
