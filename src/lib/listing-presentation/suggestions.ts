// Pure search-suggestion logic for the Exclusive Listings Command Bar.
//
// `buildSuggestions` derives categorized autocomplete suggestions from the
// already-loaded listing set. It is the target of Property 7:
//   Feature: map-tab-ui-improvements, Property 7 — every returned Suggestion has
//   a value that contains the query case-insensitively, is derived from a field
//   of an existing listing, and carries a category matching that source field
//   (Address/City/State/ZIP/Client).

import type { ShowcaseListing } from '../../components/listings/ExclusiveListingsShowcase'
import type { Suggestion, SuggestionCategory } from './types'

// The fields that back each suggestion category, in display order. Keeping this
// as data (rather than branching) makes the category↔source-field mapping that
// Property 7 relies on explicit and easy to audit.
const SUGGESTION_SOURCES: Array<{
  category: SuggestionCategory
  getValue: (l: ShowcaseListing) => string | undefined
}> = [
  { category: 'Address', getValue: (l) => l.address },
  { category: 'City', getValue: (l) => l.city },
  { category: 'State', getValue: (l) => l.state },
  { category: 'ZIP', getValue: (l) => l.zip },
  { category: 'Client', getValue: (l) => l.client?.name },
]

/**
 * Build categorized search suggestions from the loaded listings.
 *
 * Semantics:
 * - A blank/whitespace-only query returns no suggestions (the dropdown stays
 *   closed until the user types something meaningful). This keeps Property 7
 *   trivially satisfied for the empty-query case.
 * - Otherwise, a field contributes a suggestion only when its trimmed value is
 *   non-blank and contains the query case-insensitively (matched against the
 *   raw query, lower-cased, so the emitted value always literally contains it).
 * - Suggestions are de-duplicated within a category by value (case-insensitive),
 *   keeping the first listing that produced the value.
 * - When `limitPerCategory` is provided, each category is capped to at most that
 *   many suggestions (a non-positive limit yields no suggestions).
 */
export function buildSuggestions(
  listings: ShowcaseListing[],
  query: string,
  limitPerCategory?: number,
): Suggestion[] {
  // No meaningful query → no suggestions.
  if (!query || query.trim() === '') {
    return []
  }

  // A provided, non-positive limit means "no suggestions per category".
  if (limitPerCategory !== undefined && limitPerCategory <= 0) {
    return []
  }

  const needle = query.toLowerCase()

  // Per-category accumulation so `limitPerCategory` and de-duplication apply
  // independently to each category while preserving listing order.
  const buckets = new Map<SuggestionCategory, Suggestion[]>()
  const seen = new Map<SuggestionCategory, Set<string>>()

  for (const listing of listings) {
    for (const source of SUGGESTION_SOURCES) {
      const raw = source.getValue(listing)
      // Skip blank/whitespace source fields.
      if (typeof raw !== 'string' || raw.trim() === '') {
        continue
      }
      // The emitted value must literally contain the query (case-insensitive).
      if (!raw.toLowerCase().includes(needle)) {
        continue
      }

      const dedupKey = raw.toLowerCase()
      let seenForCategory = seen.get(source.category)
      if (!seenForCategory) {
        seenForCategory = new Set<string>()
        seen.set(source.category, seenForCategory)
      }
      if (seenForCategory.has(dedupKey)) {
        continue
      }

      let bucket = buckets.get(source.category)
      if (!bucket) {
        bucket = []
        buckets.set(source.category, bucket)
      }
      if (limitPerCategory !== undefined && bucket.length >= limitPerCategory) {
        continue
      }

      seenForCategory.add(dedupKey)
      bucket.push({ category: source.category, value: raw, listingId: listing.id })
    }
  }

  // Flatten in canonical category order for stable, predictable rendering.
  const result: Suggestion[] = []
  for (const source of SUGGESTION_SOURCES) {
    const bucket = buckets.get(source.category)
    if (bucket) {
      result.push(...bucket)
    }
  }
  return result
}
