import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { HoverCopyValue } from './HoverCopyValue'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('HoverCopyValue', () => {
  it('copies the value without bubbling the parent click', async () => {
    const user = userEvent.setup()
    const onParentClick = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(
      <div onClick={onParentClick}>
        <HoverCopyValue value="123 Sample Street" label="address" />
      </div>,
    )

    const copyButton = screen.getByRole('button', { name: 'Copy address' })
    expect(copyButton.className).toContain('opacity-0')
    await user.click(copyButton)

    expect(writeText).toHaveBeenCalledWith('123 Sample Street')
    expect(onParentClick).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Copy address' })).toBeInTheDocument()
  })

  it('renders nothing when there is no value', () => {
    const { container } = render(<HoverCopyValue value="  " label="client email" />)
    expect(container.firstChild).toBeNull()
  })
})
