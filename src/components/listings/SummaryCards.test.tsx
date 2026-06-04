// RTL test for SummaryCards — summary recompute on filter change (R5.3).
//
// Task 15.2: assert the displayed summary values recompute when filters change.
//
// SummaryCards is a thin renderer of a precomputed `Summary` prop. To make this
// a faithful Requirement 5.3 test ("WHEN the loaded listing set or active
// filters change, THE Portal_Shell SHALL recompute and update each Summary_Card
// value"), we drive the `summary` prop from the real pure logic:
//   1. summaryA = computeSummary(allListings)  -> render, assert the five values
//   2. simulate a filter change via applyFilters(allListings, [{kind:'mapped'}])
//      then summaryB = computeSummary(filtered) -> rerender, assert values update
// This proves the cards reflect the recomputed summary after a filter change.

import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SummaryCards } from './SummaryCards'
import type { ShowcaseListing } from './ExclusiveListingsShowcase'
import { computeSummary } from '@/lib/listing-presentation/summary'
import { applyFilters } from '@/lib/listing-presentation/filters'

// --- Fixtures ---------------------------------------------------------------

/** Build a ShowcaseListing fixture with sensible defaults. */
function makeListing(overrides: Partial<ShowcaseListing> & { id: string }): ShowcaseListing {
  return {
    address: '1 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    fullAddress: '1 Main St, Austin, TX 78701',
    client: { name: 'Acme' },
    isListingHidden: false,
    isPrivateListing: true,
    ...overrides,
  }
}

// Three mapped listings (finite coords) and two unmapped; one of the unmapped
// is hidden. So: total=5, mapped=3, unmapped=2, private=5, hidden=1.
const allListings: ShowcaseListing[] = [
  makeListing({ id: 'l1', latitude: 30.27, longitude: -97.74 }),
  makeListing({ id: 'l2', latitude: 30.3, longitude: -97.7, listing_type: 'for_sale' }),
  makeListing({ id: 'l3', latitude: 30.25, longitude: -97.8 }),
  makeListing({ id: 'l4' }), // no coords -> unmapped
  makeListing({ id: 'l5', isListingHidden: true }), // no coords -> unmapped, hidden
]

/** Read the rendered number for a given summary key via its data-testid hook. */
function valueOf(key: string): string {
  return screen.getByTestId(`summary-value-${key}`).textContent ?? ''
}

describe('SummaryCards — recompute on filter change (R5.3)', () => {
  it('renders the five summary values from computeSummary over the full set', () => {
    const summaryA = computeSummary(allListings)

    render(<SummaryCards summary={summaryA} />)

    // Sanity-check the fixture-derived summary, then assert the rendered values.
    expect(summaryA).toEqual({ total: 5, mapped: 3, unmapped: 2, private: 5, hidden: 1 })
    expect(valueOf('total')).toBe('5')
    expect(valueOf('mapped')).toBe('3')
    expect(valueOf('unmapped')).toBe('2')
    expect(valueOf('private')).toBe('5')
    expect(valueOf('hidden')).toBe('1')
  })

  it('updates every displayed value when a filter changes the listing set', () => {
    const summaryA = computeSummary(allListings)
    const { rerender } = render(<SummaryCards summary={summaryA} />)

    // Baseline render reflects the unfiltered set.
    expect(valueOf('total')).toBe('5')
    expect(valueOf('unmapped')).toBe('2')

    // Simulate applying the "Mapped" filter, then recompute the summary over the
    // filtered set — exactly what the coordinating hook does on a filter change.
    const filtered = applyFilters(allListings, [{ kind: 'mapped' }])
    const summaryB = computeSummary(filtered)

    rerender(<SummaryCards summary={summaryB} />)

    // The cards now reflect the recomputed summary: total dropped to the mapped
    // count and there are no unmapped listings left.
    expect(summaryB).toEqual({ total: 3, mapped: 3, unmapped: 0, private: 3, hidden: 0 })
    expect(valueOf('total')).toBe('3')
    expect(valueOf('mapped')).toBe('3')
    expect(valueOf('unmapped')).toBe('0')
    expect(valueOf('private')).toBe('3')
    expect(valueOf('hidden')).toBe('0')

    // The total must equal the mapped count after the Mapped filter, and the
    // values must differ from the pre-filter render (proves recompute happened).
    expect(valueOf('total')).toBe(valueOf('mapped'))
    expect(valueOf('total')).not.toBe(String(summaryA.total))
  })
})
