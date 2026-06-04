// RTL tests for FilterChipBar (Task 14.6).
//
// Verifies the presentational behavior of the chip bar over the pure
// `getFilterChips`/`filterKey` logic:
//   - R4.4: one removable Filter_Chip renders per active filter.
//   - R4.5: activating a chip's remove control calls `onRemoveFilter` with the
//           corresponding filter's stable key.

import '@testing-library/jest-dom/vitest'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FilterChipBar } from './FilterChipBar'
import { filterKey } from '@/lib/listing-presentation/filters'
import type { Filter } from '@/lib/listing-presentation/types'

describe('FilterChipBar', () => {
  it('renders exactly one removable chip per active filter (R4.4)', () => {
    const filters: Filter[] = [
      { kind: 'forSale' },
      { kind: 'minBeds', value: 3 },
      { kind: 'city', value: 'Austin' },
    ]

    render(<FilterChipBar filters={filters} onRemoveFilter={vi.fn()} />)

    // One remove control per active filter — one-to-one correspondence.
    const removeButtons = screen.getAllByRole('button', {
      name: /Remove .* filter/i,
    })
    expect(removeButtons).toHaveLength(filters.length)

    // The human-readable chip labels are present.
    expect(screen.getByText('For Sale')).toBeInTheDocument()
    expect(screen.getByText('3+ Beds')).toBeInTheDocument()
    expect(screen.getByText('Austin')).toBeInTheDocument()
  })

  it('calls onRemoveFilter with the correct key when a chip remove control is activated (R4.5)', async () => {
    const user = userEvent.setup()
    const onRemoveFilter = vi.fn()
    const filters: Filter[] = [
      { kind: 'forSale' },
      { kind: 'minBeds', value: 3 },
      { kind: 'city', value: 'Austin' },
    ]

    render(<FilterChipBar filters={filters} onRemoveFilter={onRemoveFilter} />)

    // Remove the "Austin" city chip.
    await user.click(
      screen.getByRole('button', { name: 'Remove Austin filter' }),
    )
    expect(onRemoveFilter).toHaveBeenCalledTimes(1)
    expect(onRemoveFilter).toHaveBeenCalledWith(
      filterKey({ kind: 'city', value: 'Austin' }),
    )
    // Sanity-check the expected stable key value mapping.
    expect(filterKey({ kind: 'city', value: 'Austin' })).toBe('city:Austin')

    // Remove the "3+ Beds" chip — confirms the key maps per-chip.
    onRemoveFilter.mockClear()
    await user.click(
      screen.getByRole('button', { name: 'Remove 3+ Beds filter' }),
    )
    expect(onRemoveFilter).toHaveBeenCalledTimes(1)
    expect(onRemoveFilter).toHaveBeenCalledWith(
      filterKey({ kind: 'minBeds', value: 3 }),
    )
    expect(filterKey({ kind: 'minBeds', value: 3 })).toBe('minBeds:3')
  })

  it('renders nothing when there are no active filters (empty state)', () => {
    const { container } = render(
      <FilterChipBar filters={[]} onRemoveFilter={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(
      screen.queryByRole('button', { name: /Remove .* filter/i }),
    ).toBeNull()
  })
})
