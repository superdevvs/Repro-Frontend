// Property-based test for `buildSuggestions`.
//
// Task 4.2 — Property 7: Suggestions match the query and carry the correct category.
// Validates: Requirements 4.2.
//
// For any listings and any query, every returned Suggestion:
//   - has a `value` that contains the query case-insensitively,
//   - has a `value` derived from an existing listing's field matching the
//     category (Address -> address, City -> city, State -> state, ZIP -> zip,
//     Client -> client.name),
//   - has a `listingId` that references an existing listing whose corresponding
//     field equals `value`.
//
// The query arbitrary mixes random strings with substrings extracted from the
// generated listings' fields, so the matching path (non-empty suggestion sets)
// is exercised, not just the trivial no-match case.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import { buildSuggestions } from './suggestions'
import { arbitraryListing } from './test-arbitraries'
import type { ShowcaseListing } from '../../components/listings/ExclusiveListingsShowcase'
import type { SuggestionCategory } from './types'

const NUM_RUNS = 200

// Maps each suggestion category to the listing field it must be derived from.
const fieldForCategory = (
  l: ShowcaseListing,
  category: SuggestionCategory,
): string | undefined => {
  switch (category) {
    case 'Address':
      return l.address
    case 'City':
      return l.city
    case 'State':
      return l.state
    case 'ZIP':
      return l.zip
    case 'Client':
      return l.client?.name
  }
}

// Build a query arbitrary that, given the generated listings, sometimes returns
// a substring of one of their fields (so suggestions can actually match) and
// sometimes a random string (so the no-match path is covered too).
const queryFor = (
  listings: ShowcaseListing[],
): fc.Arbitrary<string> => {
  const fieldValues: string[] = []
  for (const l of listings) {
    for (const v of [l.address, l.city, l.state, l.zip, l.client?.name]) {
      if (typeof v === 'string' && v.trim() !== '') {
        fieldValues.push(v)
      }
    }
  }

  const substringArb: fc.Arbitrary<string> =
    fieldValues.length === 0
      ? fc.string()
      : fc.constantFrom(...fieldValues).chain((value) => {
          const len = value.length
          return fc
            .tuple(
              fc.integer({ min: 0, max: len - 1 }),
              fc.integer({ min: 1, max: len }),
            )
            .map(([start, span]) => {
              const end = Math.min(len, start + span)
              return value.slice(start, end)
            })
        })

  return fc.oneof(substringArb, fc.string(), fc.string({ unit: 'grapheme' }))
}

describe('buildSuggestions', () => {
  it('Feature: map-tab-ui-improvements, Property 7: Suggestions match the query and carry the correct category', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryListing).chain((listings) =>
          fc.tuple(
            fc.constant(listings),
            queryFor(listings),
            fc.option(fc.integer({ min: -2, max: 10 }), { nil: undefined }),
          ),
        ),
        ([listings, query, limitPerCategory]) => {
          const suggestions = buildSuggestions(listings, query, limitPerCategory)

          const byId = new Map<string, ShowcaseListing>()
          // Note: ids can collide in the arbitrary; keep the first listing for
          // an id, but the equality check below tolerates any matching listing.
          const listingsById = new Map<string, ShowcaseListing[]>()
          for (const l of listings) {
            if (!byId.has(l.id)) byId.set(l.id, l)
            const bucket = listingsById.get(l.id)
            if (bucket) bucket.push(l)
            else listingsById.set(l.id, [l])
          }

          const needle = query.toLowerCase()

          for (const s of suggestions) {
            // (1) value contains the query case-insensitively.
            expect(s.value.toLowerCase()).toContain(needle)

            // (2) listingId references an existing listing.
            expect(listingsById.has(s.listingId)).toBe(true)

            // (3) the referenced listing's field for this category equals value.
            const candidates = listingsById.get(s.listingId) ?? []
            const matches = candidates.some(
              (l) => fieldForCategory(l, s.category) === s.value,
            )
            expect(matches).toBe(true)

            // (4) the value is itself derived from some existing listing's field
            //     matching the category (redundant with (3) but asserts the
            //     category<->field mapping across the whole set).
            const derivedSomewhere = listings.some(
              (l) => fieldForCategory(l, s.category) === s.value,
            )
            expect(derivedSomewhere).toBe(true)
          }
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('Feature: map-tab-ui-improvements, Property 7: a blank query yields no suggestions', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryListing),
        fc.constantFrom('', '   ', '\t', '\n  '),
        (listings, blankQuery) => {
          expect(buildSuggestions(listings, blankQuery)).toEqual([])
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })
})
