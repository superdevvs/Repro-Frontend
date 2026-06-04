// RTL test for ViewSwitcher.
//
// Feature: map-tab-ui-improvements, Task 15.4: Write RTL test for view switcher
// Validates: Requirements 6.3, 6.4
//
// Asserts that activating a view option invokes `onChange` with the matching
// mode (R6.3), that every option exposes its view name as an accessible name
// and hovering surfaces a tooltip naming that view (R6.4), and that the option
// matching the active `viewMode` reflects the selected state.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { ViewSwitcher } from './ViewSwitcher'

afterEach(() => {
  cleanup()
})

// The three view options expose their name via aria-label (which mirrors the
// tooltip text). Radix renders single-type toggle items with role "radio".
const VIEW_NAMES = ['Map view', 'Grid view', 'List view'] as const

describe('ViewSwitcher', () => {
  it('R6.3: clicking a different option invokes onChange with the matching mode', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    // Active view is the Map view ('showcase'); clicking a DIFFERENT option
    // emits its value. Clicking the already-active item would emit '' (which
    // the component intentionally ignores), so we exercise the other options.
    render(<ViewSwitcher viewMode="showcase" onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Grid view' }))
    expect(onChange).toHaveBeenCalledWith('grid')

    await user.click(screen.getByRole('radio', { name: 'List view' }))
    expect(onChange).toHaveBeenCalledWith('list')

    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('R6.4: every option exposes its view name as an accessible name', () => {
    render(<ViewSwitcher viewMode="showcase" onChange={vi.fn()} />)

    for (const name of VIEW_NAMES) {
      const option = screen.getByRole('radio', { name })
      expect(option).toBeInTheDocument()
      // The accessible name comes from aria-label, which mirrors the tooltip
      // content text, so the option is reliably named after its view.
      expect(option).toHaveAttribute('aria-label', name)
    }

    // Exactly three options render — Map, Grid, and List.
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('R6.4: hovering an option surfaces a tooltip naming that view', async () => {
    const user = userEvent.setup()
    render(<ViewSwitcher viewMode="showcase" onChange={vi.fn()} />)

    await user.hover(screen.getByRole('radio', { name: 'Grid view' }))

    // The tooltip content renders the view name in a portal after the hover
    // delay. findAllByText awaits that portal render robustly (the aria-label
    // assertions above already satisfy the naming requirement on their own).
    const tooltips = await screen.findAllByText('Grid view', undefined, {
      timeout: 2000,
    })
    expect(tooltips.length).toBeGreaterThan(0)
  })

  it('reflects the active viewMode on the matching option', () => {
    render(<ViewSwitcher viewMode="showcase" onChange={vi.fn()} />)

    // 'showcase' is the Map view; its option is selected. (The toggle item is
    // a TooltipTrigger via `asChild`, so its `data-state` reflects the tooltip
    // open/closed state; `aria-checked` is the reliable selected-state signal.)
    const mapOption = screen.getByRole('radio', { name: 'Map view' })
    expect(mapOption).toHaveAttribute('aria-checked', 'true')

    // The other options are not selected.
    expect(screen.getByRole('radio', { name: 'Grid view' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('radio', { name: 'List view' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
})
