// RTL test for FloatingMapActions.
//
// Feature: map-tab-ui-improvements, Task 13.4: Write RTL test for floating actions
// Validates: Requirements 8.1, 8.5, 1.5
//
// Asserts that exactly the four floating map actions render (Recenter map,
// Draw area, Toggle property labels, Fullscreen map), each carrying a
// tooltip-matching accessible name, that NO satellite/imagery action exists
// (R8.5 / R1.5), and that clicking each button invokes its handler.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { FloatingMapActions } from './FloatingMapActions'

afterEach(() => {
  cleanup()
})

const ACTION_NAMES = [
  'Recenter map',
  'Draw area',
  'Toggle property labels',
  'Fullscreen map',
] as const

function setup() {
  const handlers = {
    onRecenter: vi.fn(),
    onToggleDrawArea: vi.fn(),
    onToggleLabels: vi.fn(),
    onToggleFullscreen: vi.fn(),
  }
  const utils = render(<FloatingMapActions {...handlers} />)
  return { ...utils, handlers }
}

describe('FloatingMapActions', () => {
  it('R8.1: renders exactly the four floating map actions with tooltip-matching accessible names', () => {
    setup()

    // Each action button is queryable by its accessible name (the aria-label,
    // which mirrors the tooltip text).
    for (const name of ACTION_NAMES) {
      expect(
        screen.getByRole('button', { name }),
      ).toBeInTheDocument()
    }

    // Exactly four action buttons render — no more, no less.
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('R8.1: each action button exposes the tooltip text as its accessible name', () => {
    setup()

    for (const name of ACTION_NAMES) {
      const button = screen.getByRole('button', { name })
      // The accessible name comes from aria-label, which equals the tooltip
      // content text, so asserting the name is a robust tooltip check.
      expect(button).toHaveAttribute('aria-label', name)
    }
  })

  it('R8.5 / R1.5: renders no satellite or imagery action', () => {
    setup()

    // No button is named like a satellite/imagery toggle.
    expect(
      screen.queryByRole('button', { name: /satellite/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /imagery/i }),
    ).toBeNull()

    // No element anywhere renders satellite/imagery text.
    expect(screen.queryByText(/satellite|imagery/i)).toBeNull()
  })

  it('invokes the matching handler when each action button is clicked', async () => {
    const user = userEvent.setup()
    const { handlers } = setup()

    await user.click(screen.getByRole('button', { name: 'Recenter map' }))
    expect(handlers.onRecenter).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Draw area' }))
    expect(handlers.onToggleDrawArea).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', { name: 'Toggle property labels' }),
    )
    expect(handlers.onToggleLabels).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Fullscreen map' }))
    expect(handlers.onToggleFullscreen).toHaveBeenCalledTimes(1)
  })
})
