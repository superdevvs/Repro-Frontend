// Property-based test for Saved View serialization round-trips.
//
// Feature: map-tab-ui-improvements, Property 12: Saved view serialization round-trips
// Validates: Requirements 4.7, 4.8
//
// For any list of valid `SavedView` objects, parsing the serialized form
// reproduces the original list exactly (deep-equality), so saving and
// restoring a view reproduces its filters and sort without loss.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { parseSavedViews, serializeSavedViews } from './saved-views'
import { arbitrarySavedView } from './test-arbitraries'

describe('Feature: map-tab-ui-improvements, Property 12: Saved view serialization round-trips', () => {
  it('parseSavedViews(serializeSavedViews(views)) deep-equals the original list', () => {
    fc.assert(
      fc.property(fc.array(arbitrarySavedView), (views) => {
        const roundTripped = parseSavedViews(serializeSavedViews(views))
        expect(roundTripped).toEqual(views)
      }),
      { numRuns: 200 },
    )
  })
})
