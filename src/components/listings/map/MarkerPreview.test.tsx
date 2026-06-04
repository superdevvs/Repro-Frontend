// RTL test for MarkerPreview.
//
// Feature: map-tab-ui-improvements, Task 13.5: Write RTL test for markers and preview
// Validates: Requirements 10.3, 10.8
//
// Asserts that the marker preview card (shown on hover — R10.3 — and for the
// selected listing — R10.8) renders the listing's image, street address, a
// location line, a price, and a "View Details" call-to-action whose activation
// invokes `onOpenListing` with the previewed listing.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { MarkerPreview } from './MarkerPreview'
import { DEFAULT_PLACEHOLDER_IMAGE } from '@/lib/listing-presentation/card'
import { type ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

afterEach(() => {
  cleanup()
})

// A pass-through image resolver and a trivial price formatter used by the
// presentational helpers inside MarkerPreview.
const resolveImageUrl = (value: string | null | undefined): string | null => value ?? null
const formatPrice = (price: number | undefined | null): string =>
  typeof price === 'number' ? `$${price}` : ''

function makeListing(overrides: Partial<ShowcaseListing> = {}): ShowcaseListing {
  return {
    id: 'listing-1',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    fullAddress: '123 Main St, Austin, TX 78701',
    heroImage: 'https://images.example.com/house.jpg',
    client: { name: 'Jane Agent' },
    isListingHidden: false,
    isPrivateListing: true,
    listing_type: 'for_sale',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2500,
    price: 1_500_000,
    latitude: 30.2672,
    longitude: -97.7431,
    coordsSource: 'api',
    ...overrides,
  }
}

describe('MarkerPreview', () => {
  it('R10.8: renders the listing image, address, location line, price, and a View Details CTA', () => {
    const listing = makeListing()
    render(
      <MarkerPreview
        listing={listing}
        resolveImageUrl={resolveImageUrl}
        formatPrice={formatPrice}
        onOpenListing={vi.fn()}
      />,
    )

    // Image: resolves to the hero image and is labelled by the address.
    const image = screen.getByRole('img', { name: '123 Main St' })
    expect(image).toHaveAttribute('src', 'https://images.example.com/house.jpg')

    // Address (street) is shown.
    expect(screen.getByText('123 Main St')).toBeInTheDocument()

    // Location line "City, State Zip" is shown.
    expect(screen.getByText('Austin, TX 78701')).toBeInTheDocument()

    // Price is formatted via the supplied formatter.
    expect(screen.getByText('$1500000')).toBeInTheDocument()

    // Call-to-action present.
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument()
  })

  it('R10.8: clicking "View Details" invokes onOpenListing with the previewed listing', async () => {
    const user = userEvent.setup()
    const listing = makeListing()
    const onOpenListing = vi.fn()

    render(
      <MarkerPreview
        listing={listing}
        resolveImageUrl={resolveImageUrl}
        formatPrice={formatPrice}
        onOpenListing={onOpenListing}
      />,
    )

    await user.click(screen.getByRole('button', { name: /view details/i }))

    expect(onOpenListing).toHaveBeenCalledTimes(1)
    expect(onOpenListing).toHaveBeenCalledWith(listing)
  })

  it('R10.8: falls back to a placeholder image and price label when data is missing', () => {
    const listing = makeListing({ heroImage: undefined, price: undefined })
    render(
      <MarkerPreview
        listing={listing}
        resolveImageUrl={resolveImageUrl}
        formatPrice={formatPrice}
      />,
    )

    // Image still resolves to a non-empty source (the placeholder).
    const image = screen.getByRole('img', { name: '123 Main St' })
    expect(image.getAttribute('src')).toBe(DEFAULT_PLACEHOLDER_IMAGE)

    // Missing price shows the non-empty fallback label rather than an empty string.
    expect(screen.getByText('Price upon request')).toBeInTheDocument()

    // CTA still renders (it is safe to click even without an onOpenListing handler).
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument()
  })

  it('cycles between multiple shoots available at the same location', async () => {
    const user = userEvent.setup()
    const first = makeListing({ id: 'shoot-1' })
    const second = makeListing({ id: 'shoot-2', heroImage: 'https://images.example.com/house-2.jpg' })
    const onSelectListing = vi.fn()

    render(
      <MarkerPreview
        listing={first}
        relatedListings={[first, second]}
        resolveImageUrl={resolveImageUrl}
        formatPrice={formatPrice}
        onSelectListing={onSelectListing}
      />,
    )

    expect(screen.getByText('1 of 2 shoots')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next shoot at this location' }))
    expect(onSelectListing).toHaveBeenCalledWith('shoot-2')

    await user.click(screen.getByRole('button', { name: 'Previous shoot at this location' }))
    expect(onSelectListing).toHaveBeenLastCalledWith('shoot-2')
  })
})
