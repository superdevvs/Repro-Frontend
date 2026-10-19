import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { FloatingMapActions } from './FloatingMapActions'

afterEach(cleanup)

function setup() {
  const handlers = { onToggleLabels: vi.fn(), onToggleCompactMode: vi.fn() }
  const utils = render(<FloatingMapActions {...handlers} position="bottom-left" />)
  return { ...utils, handlers }
}

describe('FloatingMapActions', () => {
  it('keeps only preview size and labels, without the unfinished or duplicate controls', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Expand listing previews' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle property labels' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
    for (const name of ['Recenter map', 'Draw area', 'Fullscreen map']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /satellite|imagery/i })).not.toBeInTheDocument()
  })

  it('invokes the retained actions', async () => {
    const user = userEvent.setup()
    const { handlers } = setup()
    await user.click(screen.getByRole('button', { name: 'Expand listing previews' }))
    expect(handlers.onToggleCompactMode).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Toggle property labels' }))
    expect(handlers.onToggleLabels).toHaveBeenCalledTimes(1)
  })

  it('uses one button with matching expand/shrink icons, tooltip, and state', async () => {
    const user = userEvent.setup()
    const { handlers, rerender } = setup()
    const toggle = screen.getByRole('button', { name: 'Expand listing previews' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle.querySelector('svg')).toHaveClass('lucide-maximize2')
    await user.hover(toggle)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Expand listing previews')
    rerender(<FloatingMapActions {...handlers} compactMode={false} position="bottom-left" />)
    expect(toggle).toHaveAccessibleName('Shrink listing previews')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle.querySelector('svg')).toHaveClass('lucide-minimize2')
  })
})
