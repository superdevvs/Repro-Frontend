// Property-based test for tolerant, total Saved View parsing.
//
// Feature: map-tab-ui-improvements, Property 13: Saved view parsing is total and safe
// Validates: Requirements 4.9
//
// For ANY input string (random text, arbitrary JSON, malformed fragments) and
// for `null`, `parseSavedViews` never throws and always returns a SavedView[].
// Each returned entry is checked to have the canonical SavedView shape.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { parseSavedViews } from './saved-views'
import type { Filter, SavedView, SortOption } from './types'

const KNOWN_SORT_OPTIONS: ReadonlySet<string> = new Set<SortOption>([
  'priceDesc',
  'priceAsc',
  'cityAsc',
  'newest',
  'mappedFirst',
])

const KNOWN_FILTER_KINDS: ReadonlySet<string> = new Set([
  'forSale',
  'private',
  'mapped',
  'minBeds',
  'city',
])

/** Assert a returned entry has the canonical `SavedView` shape. */
function assertValidSavedView(view: SavedView): void {
  expect(typeof view.id).toBe('string')
  expect(typeof view.name).toBe('string')
  expect(Array.isArray(view.filters)).toBe(true)
  expect(KNOWN_SORT_OPTIONS.has(view.sort)).toBe(true)

  for (const filter of view.filters as Filter[]) {
    expect(KNOWN_FILTER_KINDS.has(filter.kind)).toBe(true)
    if (filter.kind === 'minBeds') {
      expect(typeof filter.value).toBe('number')
      expect(Number.isFinite(filter.value as number)).toBe(true)
    } else if (filter.kind === 'city') {
      expect(typeof filter.value).toBe('string')
    } else {
      // Valueless kinds carry only `kind`.
      expect(filter.value).toBeUndefined()
    }
  }
}

// A generator of strings spanning the full untrusted input space:
//   - random text (incl. empty / whitespace / non-ASCII)
//   - arbitrary JSON values stringified (objects, arrays, primitives)
//   - arbitrary values stringified (incl. shapes that look like SavedViews)
//   - malformed JSON fragments
const arbitraryRawString: fc.Arbitrary<string> = fc.oneof(
  fc.string(),
  fc.string({ unit: 'grapheme' }),
  fc.json(),
  fc.anything().map((v) => {
    try {
      return JSON.stringify(v) ?? 'undefined'
    } catch {
      return '[unserializable]'
    }
  }),
  fc.constantFrom(
    '',
    '   ',
    '{',
    '}',
    '[',
    ']',
    '[{',
    'null',
    'true',
    '42',
    '"a string"',
    '{"id":"x"}',
    '[{"id":"x","name":"n"}]',
    '[{"id":"x","name":"n","filters":[],"sort":"nope"}]',
    '[{"id":"x","name":"n","filters":[{"kind":"unknown"}],"sort":"newest"}]',
    '[{"id":1,"name":"n","filters":[],"sort":"newest"}]',
    '[1,2,3]',
    '{"not":"an array"}',
    'not json at all',
  ),
)

describe('Feature: map-tab-ui-improvements, Property 13: Saved view parsing is total and safe', () => {
  it('never throws and always returns a valid SavedView[] for any string input', () => {
    fc.assert(
      fc.property(arbitraryRawString, (raw) => {
        let result: SavedView[]
        expect(() => {
          result = parseSavedViews(raw)
        }).not.toThrow()

        // Total: always an array.
        expect(Array.isArray(result!)).toBe(true)

        // Safe: every returned entry has the canonical SavedView shape.
        for (const view of result!) {
          assertValidSavedView(view)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('returns the empty array for null input without throwing', () => {
    expect(() => parseSavedViews(null)).not.toThrow()
    expect(parseSavedViews(null)).toEqual([])
  })
})
