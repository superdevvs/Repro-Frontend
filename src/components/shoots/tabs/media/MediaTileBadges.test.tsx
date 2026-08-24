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

// A treatment is a request a photographer makes on one frame. It has to be
// visible to whoever edits the photo later, otherwise marking it achieves
// nothing. The file itself stays a raw of its booked service, so the badge is
// only a projection of `treatment` and must never imply a reclassification.
describe('MediaTileBadges treatment chip', () => {
  it('shows VS for a virtual staging request', () => {
    render(<MediaTileBadges file={makeFile({ treatment: 'virtual_staging' })} />)

    expect(screen.getByText('VS')).toBeInTheDocument()
  })

  it('shows GG for a green grass request', () => {
    render(<MediaTileBadges file={makeFile({ treatment: 'green_grass' })} />)

    expect(screen.getByText('GG')).toBeInTheDocument()
  })

  it('shows TW for a twilight request', () => {
    render(<MediaTileBadges file={makeFile({ treatment: 'twilight' })} />)

    expect(screen.getByText('TW')).toBeInTheDocument()
  })

  it('shows no treatment chip when none was requested', () => {
    const { container } = render(<MediaTileBadges file={makeFile({ treatment: null })} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('VS')).not.toBeInTheDocument()
    expect(screen.queryByText('GG')).not.toBeInTheDocument()
    expect(screen.queryByText('TW')).not.toBeInTheDocument()
  })

  it('ignores a value that is not one of the three treatments', () => {
    // Floor plan and drone are capture classifications owned by the booked
    // service, never per-file treatments, so they must not produce a chip.
    const { container } = render(<MediaTileBadges file={makeFile({ treatment: 'floorplan' })} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the treatment chip in the list variant too', () => {
    render(<MediaTileBadges file={makeFile({ treatment: 'twilight' })} variant="list" />)

    expect(screen.getByText('TW')).toBeInTheDocument()
  })

  it('shows the treatment alongside EXTRA rather than replacing it', () => {
    render(<MediaTileBadges file={makeFile({ isExtra: true, treatment: 'green_grass' })} />)

    expect(screen.getByText('EXTRA')).toBeInTheDocument()
    expect(screen.getByText('GG')).toBeInTheDocument()
  })

  it('shows the treatment alongside HERO rather than replacing it', () => {
    render(<MediaTileBadges file={makeFile({ is_cover: true, treatment: 'virtual_staging' })} />)

    expect(screen.getByText('HERO')).toBeInTheDocument()
    expect(screen.getByText('VS')).toBeInTheDocument()
  })
})
