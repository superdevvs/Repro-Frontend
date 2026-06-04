import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { CompactListingRow } from '@/components/listings/CompactListingRow'
import type { ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

const listing: ShowcaseListing = {
  id: 'listing-1',
  address: '123 Maple Street',
  city: 'Rockville',
  state: 'MD',
  zip: '20850',
  fullAddress: '123 Maple Street, Rockville, MD 20850',
  client: { name: 'Test Client' },
  isListingHidden: false,
  isPrivateListing: true,
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1500,
}

describe('CompactListingRow', () => {
  it('keeps hover and selected-hover surfaces dark in dark mode', () => {
    const { container, rerender } = render(
      <CompactListingRow
        listing={listing}
        resolveImageUrl={() => null}
        selected={false}
        bookmarked={false}
        onSelect={vi.fn()}
        onToggleBookmark={vi.fn()}
      />,
    )

    expect(container.firstElementChild).toHaveClass(
      'dark:hover:bg-slate-800/90',
      'dark:hover:text-white',
    )

    rerender(
      <CompactListingRow
        listing={listing}
        resolveImageUrl={() => null}
        selected
        bookmarked={false}
        onSelect={vi.fn()}
        onToggleBookmark={vi.fn()}
      />,
    )

    expect(container.firstElementChild).toHaveClass(
      'dark:bg-blue-500/15',
      'dark:hover:bg-blue-500/25',
    )
  })
})
