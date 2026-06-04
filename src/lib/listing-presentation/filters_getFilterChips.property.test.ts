// Property-based test for `getFilterChips`.
//
// Feature: map-tab-ui-improvements, Property 9: Filter chips are in one-to-one
// correspondence with active filters
// Validates: Requirements 4.4
//
// For any set of active filters, `getFilterChips` produces exactly one chip per
// active filter, and each chip carries a removal key that maps back to its
// filter via `filterKey` (order preserved).

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { addFilter, filterKey, getFilterChips } from './filters'
import { arbitraryFilter } from './test-arbitraries'

describe('Feature: map-tab-ui-improvements, Property 9: Filter chips are in one-to-one correspondence with active filters', () => {
  it('produces exactly one chip per input filter, each key mapping back to its filter', () => {
    fc.assert(
      fc.property(fc.array(arbitraryFilter), (filters) => {
        const chips = getFilterChips(filters)

        // One chip per filter, order preserved.
        expect(chips).toHaveLength(filters.length)
        chips.forEach((chip, i) => {
          expect(chip.key).toBe(filterKey(filters[i]))
        })
      }),
      { numRuns: 200 },
    )
  })

  it('on a de-duplicated active set, chip keys are unique and one-to-one with active filters', () => {
    fc.assert(
      fc.property(fc.array(arbitraryFilter), (rawFilters) => {
        // Build a valid active set the way the app does: de-dup by key via addFilter.
        const activeFilters = rawFilters.reduce(
          (acc, f) => addFilter(acc, f),
          [] as ReturnType<typeof addFilter>,
        )

        const chips = getFilterChips(activeFilters)

        // Exactly one chip per active filter.
        expect(chips).toHaveLength(activeFilters.length)

        // Every chip key maps back to the corresponding active filter.
        chips.forEach((chip, i) => {
          expect(chip.key).toBe(filterKey(activeFilters[i]))
        })

        // Keys are unique (true one-to-one correspondence with the active set).
        const keys = chips.map((c) => c.key)
        expect(new Set(keys).size).toBe(keys.length)
      }),
      { numRuns: 200 },
    )
  })
})
