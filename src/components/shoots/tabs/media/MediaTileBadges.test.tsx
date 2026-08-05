// RTL test for MediaTileBadges.
//
// Task 17.3 (Req 3.12): a single badge component renders EXTRA / HERO / AI on
// every media tile render path. These tests pin the badge rules — in
// particular that the HERO badge appears for the cover file and that EXTRA and
// HERO are mutually exclusive — so the hero marking is visible everywhere.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { MediaTileBadges } from './MediaTileBadges'
import { type MediaFile } from '@/hooks/useShootFiles'

afterEach(() => {
  cleanup()
})

const makeFile = (overrides: Partial<MediaFile> = {}): MediaFile =>
  ({ id: 'file-1', filename: 'photo.jpg', ...overrides } as MediaFile)

describe('MediaTileBadges', () => {
  it('shows the HERO badge for the cover file', () => {
    render(<MediaTileBadges file={makeFile({ is_cover: true })} />)

    expect(screen.getByText('HERO')).toBeInTheDocument()
    expect(screen.queryByText('EXTRA')).not.toBeInTheDocument()
  })

  it('shows EXTRA and never HERO for an extra file, even if flagged as cover', () => {
    render(<MediaTileBadges file={makeFile({ isExtra: true, is_cover: true })} />)

    expect(screen.getByText('EXTRA')).toBeInTheDocument()
    expect(screen.queryByText('HERO')).not.toBeInTheDocument()
  })

  it('shows the AI badge for an AI-edited file', () => {
    render(<MediaTileBadges file={makeFile({ is_ai_edited: true })} />)

    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('renders nothing when the file has no badge-worthy status', () => {
    const { container } = render(<MediaTileBadges file={makeFile()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the HERO badge in the list variant too', () => {
    render(<MediaTileBadges file={makeFile({ is_cover: true })} variant="list" />)

    expect(screen.getByText('HERO')).toBeInTheDocument()
  })
})
