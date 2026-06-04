// Property-based test for selection synchronization.
//
// Feature: map-tab-ui-improvements, Property 18: Selection is shared, normalized, and idempotent
// Validates: Requirements 10.4, 10.5, 10.9
//
// For any set of listings and any select action (originating from either the
// Map_Region or the Sidebar_Region), the resolved selected id is always either
// `null` or an id present in the current listing set, present ids resolve to
// themselves while absent/null ids resolve to `null`, normalization is
// idempotent, and `selectListing` agrees with `normalizeSelection` (so both
// regions share the same normalized identifier).

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { normalizeSelection, selectListing } from './selection'
import { arbitraryListing } from './test-arbitraries'

describe('Feature: map-tab-ui-improvements, Property 18: Selection is shared, normalized, and idempotent', () => {
  // An id arbitrary that mixes ids drawn from the current listing set (present)
  // with freely-generated ids (mostly absent), so the property exercises both
  // the "present" and "absent" branches.
  const idForListings = (listings: { id: string }[]) =>
    listings.length === 0
      ? fc.oneof(
          fc.constant<string | null>(null),
          fc.string().map<string | null>((s) => s),
        )
      : fc.oneof(
          fc.constant<string | null>(null),
          // Present: an id known to be in the set.
          fc.constantFrom(...listings.map((l) => l.id)),
          // Possibly absent: a freely generated id.
          fc.string().map<string | null>((s) => s),
        )

  it('normalizeSelection returns null or a present id, maps present->id and absent/null->null, and is idempotent', () => {
    fc.assert(
      fc.property(
        fc
          .array(arbitraryListing)
          .chain((listings) =>
            idForListings(listings).map((id) => ({ listings, id })),
          ),
        ({ listings, id }) => {
          const present = id !== null && listings.some((l) => l.id === id)
          const result = normalizeSelection(listings, id)

          // 1. Result is always null OR an id present in the listings set.
          if (result !== null) {
            expect(listings.some((l) => l.id === result)).toBe(true)
          }

          // 2. Present id -> that id; absent or null -> null.
          if (present) {
            expect(result).toBe(id)
          } else {
            expect(result).toBeNull()
          }

          // 3. Idempotent: normalizing the normalized result is a no-op.
          expect(normalizeSelection(listings, result)).toBe(result)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('selectListing agrees with normalizeSelection and is always shared/normalized (null or present id)', () => {
    fc.assert(
      fc.property(
        fc
          .array(arbitraryListing)
          // selectListing takes a non-null id (a concrete select action).
          .chain((listings) =>
            (listings.length === 0
              ? fc.string()
              : fc.oneof(
                  fc.constantFrom(...listings.map((l) => l.id)),
                  fc.string(),
                )
            ).map((id) => ({ listings, id })),
          ),
        ({ listings, id }) => {
          const selected = selectListing(listings, id)

          // Agreement: selectListing is exactly normalizeSelection for an id.
          expect(selected).toBe(normalizeSelection(listings, id))

          // Shared/normalized invariant: null or an id present in the set.
          if (selected !== null) {
            expect(listings.some((l) => l.id === selected)).toBe(true)
          }

          // Present id selects to itself; absent id selects to null.
          if (listings.some((l) => l.id === id)) {
            expect(selected).toBe(id)
          } else {
            expect(selected).toBeNull()
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
