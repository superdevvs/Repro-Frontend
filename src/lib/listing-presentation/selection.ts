// Selection synchronization for the Exclusive Listings Map Tab.
//
// The Selected_Listing is a single shared identifier read by both the
// Map_Region (markers) and the Sidebar_Region (cards). These pure helpers
// guarantee that whatever identifier is stored is always either `null` or an
// id that is actually present in the current listing set, and that selecting
// the same id repeatedly is idempotent.
//
// All functions here are pure: no side effects, no network calls, no mutation
// of their inputs.
//
// Validates: Requirements 10.4, 10.5, 10.9 (Property 18: selection is shared,
// normalized, and idempotent).

import { type ShowcaseListing } from '../../components/listings/ExclusiveListingsShowcase'

/**
 * Normalize a selection id against the current listing set.
 *
 * Returns `null` when `id` is `null` or is not the id of any listing in
 * `listings`; otherwise returns `id` (which is then guaranteed to be present
 * in the set).
 *
 * This is the canonical resolver applied to every stored selection so that the
 * Map_Region and Sidebar_Region always agree on a valid identifier (R10.9).
 */
export function normalizeSelection(
  listings: ShowcaseListing[],
  id: string | null,
): string | null {
  if (id === null) return null
  return listings.some((l) => l.id === id) ? id : null
}

/**
 * Resolve a select action (from a marker click or a card click) against the
 * current listing set.
 *
 * Returns `id` when a listing with that id exists, otherwise `null`.
 *
 * Idempotent with respect to {@link normalizeSelection}: applying
 * `normalizeSelection` to the result yields the same result, since the result
 * is always either `null` or an id present in the set.
 */
export function selectListing(
  listings: ShowcaseListing[],
  id: string,
): string | null {
  return normalizeSelection(listings, id)
}
