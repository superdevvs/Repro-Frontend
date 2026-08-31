import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { FloorplanSection } from './FloorplanSection'

afterEach(() => {
  cleanup()
})

const PRIVATE_LABEL = 'Confidential main-level plan'
const PRIVATE_FILENAME = '9137LakelandValleyCourt-floorplan-0.jpg'
const PREVIEW_URL = '/media/floorplan-preview.jpg'

const floorplans = [
  {
    image: PREVIEW_URL,
    label: PRIVATE_LABEL,
    filename: PRIVATE_FILENAME,
  },
]

function renderSection() {
  return render(<FloorplanSection floorplans={floorplans} />)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function expectDownloadGesturesBlocked(image: HTMLElement) {
  expect(image).toHaveAttribute('draggable', 'false')

  // dispatchEvent/fireEvent returns false only when a cancelable event has had
  // preventDefault() called. This verifies the browser menu and drag gestures,
  // rather than merely checking that React handlers are present.
  expect(fireEvent.contextMenu(image)).toBe(false)
  expect(fireEvent.dragStart(image)).toBe(false)
}

describe('FloorplanSection', () => {
  it('does not visibly render a floorplan label or filename', () => {
    renderSection()

    expect(screen.getByRole('heading', { name: 'Floor Plans' })).toBeInTheDocument()
    expect(screen.queryByText(PRIVATE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(PRIVATE_FILENAME)).not.toBeInTheDocument()
  })

  it('opens a generically named, full-screen dialog when a preview is clicked', async () => {
    const user = userEvent.setup()
    renderSection()

    const preview = screen.getByRole('img')
    expect(preview).toHaveAccessibleName('Floor plan 1')
    expect(preview).not.toHaveAccessibleName(new RegExp(escapeRegExp(PRIVATE_LABEL), 'i'))
    expect(preview).not.toHaveAccessibleName(new RegExp(escapeRegExp(PRIVATE_FILENAME), 'i'))

    await user.click(preview)

    const dialog = screen.getByRole('dialog', { name: 'Floor plan full view' })
    expect(dialog).not.toHaveAccessibleName(new RegExp(escapeRegExp(PRIVATE_LABEL), 'i'))
    expect(dialog).not.toHaveAccessibleName(new RegExp(escapeRegExp(PRIVATE_FILENAME), 'i'))

    expect(dialog).toHaveClass('fixed', '!h-[100svh]', '!w-screen', '!max-w-none')
    const fullViewImage = within(dialog).getByRole('img', {
      name: 'Floor plan 1 full view',
    })
    expect(fullViewImage).toHaveAttribute('src', PREVIEW_URL)
    expect(screen.queryByText(PRIVATE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(PRIVATE_FILENAME)).not.toBeInTheDocument()
  })

  it('prevents context menus and dragging on thumbnail and full-view images', async () => {
    const user = userEvent.setup()
    renderSection()

    const thumbnail = screen.getByRole('img')
    expectDownloadGesturesBlocked(thumbnail)

    await user.click(thumbnail)

    const dialog = screen.getByRole('dialog', { name: 'Floor plan full view' })
    const fullViewImage = within(dialog).getByRole('img')
    expectDownloadGesturesBlocked(fullViewImage)
  })
})
