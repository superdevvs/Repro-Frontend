// Property-based test for `removeFilter`.
//
// Feature: map-tab-ui-improvements, Property 10: Removing a filter drops exactly
// that filter
// Validates: Requirements 4.5
//
// For any set of filters and any filter key present in it, `removeFilter`
// returns a set that no longer contains that key and is otherwise identical to
// the input (all other filters preserved, order stable).

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { addFilter, filterKey, removeFilter } from './filters'
import { arbitraryFilter } from './test-arbitraries'

describe('Feature: map-tab-ui-improvements, Property 10: Removing a filter drops exactly that filter', () => {
  it('drops exactly the targeted key and preserves all others in order', () => {
    fc.assert(
      fc.property(
        // Build a de-duplicated set so keys are unique, then pick an index to remove.
        fc
          .array(arbitraryFilter, { minLength: 1 })
          .map((raw) => raw.reduce((acc, f) => addFilter(acc, f), [] as ReturnType<typeof addFilter>))
          .chain((filters) =>
            fc.record({
              filters: fc.constant(filters),
              index: fc.integer({ min: 0, max: filters.length - 1 }),
            }),
          ),
        ({ filters, index }) => {
          const keyToRemove = filterKey(filters[index])
          const result = removeFilter(filters, keyToRemove)

          // 1. The removed key is gone.
          expect(result.some((f) => filterKey(f) === keyToRemove)).toBe(false)

          // 2. Exactly one filter dropped (keys were unique in the active set).
          expect(result).toHaveLength(filters.length - 1)

          // 3. All other filters preserved in their original relative order.
          const expected = filters.filter((_, i) => i !== index)
          expect(result).toEqual(expected)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('is a no-op when the key is not present', () => {
    fc.assert(
      fc.property(fc.array(arbitraryFilter), (rawFilters) => {
        const filters = rawFilters.reduce(
          (acc, f) => addFilter(acc, f),
          [] as ReturnType<typeof addFilter>,
        )
        const absentKey = 'definitely-not-a-real-filter-key:__none__'
        // Sanity: the synthetic key is genuinely absent.
        fc.pre(!filters.some((f) => filterKey(f) === absentKey))

        const result = removeFilter(filters, absentKey)
        expect(result).toEqual(filters)
      }),
      { numRuns: 100 },
    )
  })
})
