// RTL test for SidebarEmptyState.
//
// Feature: map-tab-ui-improvements, Task 15.8: Write RTL test for empty states
// Validates: Requirements 7.1, 7.2, 7.3
//
// Asserts the Sidebar_Region empty / low-data states render the correct content:
//   - R7.1: the "Nearby listings will appear here" note in the no-mapped state.
//   - R7.2: both help-text lines render verbatim in the no-mapped and low-data
//           states.
//   - R7.3: the no-listings state renders a NON-AGGRESSIVE add prompt — a calm
//           "Add a listing" ghost button (only when onAddListing is provided),
//           which invokes onAddListing on click; the "Nearby listings" note is
//           absent in this state; and the component renders without crashing
//           when onAddListing is omitted (button optional).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { SidebarEmptyState } from './SidebarEmptyState'

afterEach(() => {
  cleanup()
})

const NEARBY_NOTE = 'Nearby listings will appear here'
const HELP_LINE_MARKER = 'Click a marker to preview listing details.'
const HELP_LINE_FILTERS = 'Use filters to narrow private properties.'

describe('SidebarEmptyState', () => {
  it('R7.1: renders the "Nearby listings will appear here" note in the no-mapped state', () => {
    render(<SidebarEmptyState kind="no-mapped" />)

    expect(screen.getByText(NEARBY_NOTE)).toBeInTheDocument()
  })

  it('R7.2: renders both help-text lines verbatim in the no-mapped state', () => {
    render(<SidebarEmptyState kind="no-mapped" />)

    expect(screen.getByText(HELP_LINE_MARKER)).toBeInTheDocument()
    expect(screen.getByText(HELP_LINE_FILTERS)).toBeInTheDocument()
  })

  it('R7.2: renders both help-text lines verbatim in the low-data state', () => {
    render(<SidebarEmptyState kind="low-data" />)

    // The low-data state shares the "Nearby listings" note and both help lines.
    expect(screen.getByText(NEARBY_NOTE)).toBeInTheDocument()
    expect(screen.getByText(HELP_LINE_MARKER)).toBeInTheDocument()
    expect(screen.getByText(HELP_LINE_FILTERS)).toBeInTheDocument()
  })

  it('R7.3: renders a non-aggressive add prompt with an "Add a listing" button that invokes onAddListing', async () => {
    const user = userEvent.setup()
    const onAddListing = vi.fn()

    render(<SidebarEmptyState kind="no-listings" onAddListing={onAddListing} />)

    const addButton = screen.getByRole('button', { name: /add a listing/i })
    expect(addButton).toBeInTheDocument()

    await user.click(addButton)
    expect(onAddListing).toHaveBeenCalledTimes(1)
  })

  it('R7.3: does not render the "Nearby listings" note in the no-listings state (different state)', () => {
    render(<SidebarEmptyState kind="no-listings" onAddListing={vi.fn()} />)

    expect(screen.queryByText(NEARBY_NOTE)).toBeNull()
  })

  it('R7.3: renders without crashing (and without a button) when onAddListing is omitted', () => {
    render(<SidebarEmptyState kind="no-listings" />)

    // The add button is optional — it only appears when onAddListing is provided.
    expect(screen.queryByRole('button', { name: /add a listing/i })).toBeNull()
    // The calm prompt copy still renders, proving the state mounted cleanly.
    expect(screen.getByText(/no listings in this view yet/i)).toBeInTheDocument()
  })

  it('R7.3: the "Add a listing" button is calm/ghost styled, not a loud primary', () => {
    render(<SidebarEmptyState kind="no-listings" onAddListing={vi.fn()} />)

    const addButton = screen.getByRole('button', { name: /add a listing/i })
    // Lenient style check: a calm ghost button must not carry the loud primary
    // background class. Presence (asserted above) is the key requirement.
    expect(addButton).not.toHaveClass('bg-primary')
  })
})
