// RTL test for ListingCard.
//
// Feature: map-tab-ui-improvements, Task 15.6: Write RTL test for listing card
// Validates: Requirements 3.8, 3.9, 10.7
//
// Asserts that activating "View Details" invokes the listing-open handler
// (R3.8), that the card carries the hover lift/blue-outline/soft-shadow
// classes (R3.9), and that the selected card renders with the blue border
// styling while an unselected card does not (R10.7). Bonus interaction
// coverage confirms "Share Invite" wiring and that selecting the card body
// reports the listing id while the action buttons stop propagation.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { ListingCard } from './ListingCard'
import type { ShowcaseListing } from './ExclusiveListingsShowcase'

afterEach(() => {
  cleanup()
})

const LISTING_ID = 'listing-1'

function makeListing(overrides: Partial<ShowcaseListing> = {}): ShowcaseListing {
  return {
    id: LISTING_ID,
    address: '123 Maple Street',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    fullAddress: '123 Maple Street, Austin, TX 78701',
    heroImage: 'hero.jpg',
    client: { name: 'Jane Client' },
    isListingHidden: false,
    isPrivateListing: true,
    listing_type: 'for_sale',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1800,
    price: 1250000,
    latitude: 30.2672,
    longitude: -97.7431,
    ...overrides,
  }
}

const resolveImageUrl = (v: string | null | undefined) => v ?? null
const formatPrice = (p: number | undefined | null) => (p ? `$${p}` : '')

/** Returns the outer Card element (the one carrying the listing data attributes). */
function getCardElement(container: HTMLElement): HTMLElement {
  const card = container.querySelector<HTMLElement>(
    `[data-listing-id="${LISTING_ID}"]`,
  )
  if (!card) throw new Error('Card element not found')
  return card
}

function setup(props: Partial<React.ComponentProps<typeof ListingCard>> = {}) {
  const listing = (props.listing as ShowcaseListing) ?? makeListing()
  const onOpenListing = vi.fn()
  const utils = render(
    <ListingCard
      listing={listing}
      resolveImageUrl={resolveImageUrl}
      formatPrice={formatPrice}
      onOpenListing={onOpenListing}
      {...props}
    />,
  )
  return { ...utils, listing, onOpenListing }
}

describe('ListingCard', () => {
  it('R3.8: clicking "View Details" invokes onOpenListing once with the listing', async () => {
    const user = userEvent.setup()
    const { onOpenListing, listing } = setup()

    await user.click(screen.getByRole('button', { name: /View Details/i }))

    expect(onOpenListing).toHaveBeenCalledTimes(1)
    expect(onOpenListing).toHaveBeenCalledWith(listing)
  })

  it('R10.7: renders the selected blue border styling when selected', () => {
    const { container } = setup({ selected: true })
    const card = getCardElement(container)

    expect(card).toHaveAttribute('data-selected', 'true')
    expect(card.className).toContain('border-blue-500')
    expect(card.className).toContain('ring-blue-500/20')
  })

  it('R10.7: does NOT render the selected blue border when not selected', () => {
    const { container } = setup({ selected: false })
    const card = getCardElement(container)

    expect(card).toHaveAttribute('data-selected', 'false')
    expect(card.className).not.toContain('border-blue-500')
  })

  it('R3.9: carries the hover lift, blue outline, and soft shadow classes', () => {
    const { container } = setup()
    const card = getCardElement(container)

    expect(card.className).toContain('hover:-translate-y-0.5')
    expect(card.className).toContain('hover:border-blue-400')
    expect(card.className).toContain('hover:shadow-md')
  })

  it('R3.7: clicking "Share Invite" invokes onShareInvite with the listing', async () => {
    const user = userEvent.setup()
    const onShareInvite = vi.fn()
    const { listing } = setup({ onShareInvite })

    await user.click(screen.getByRole('button', { name: /Share Invite/i }))

    expect(onShareInvite).toHaveBeenCalledTimes(1)
    expect(onShareInvite).toHaveBeenCalledWith(listing)
  })

  it('R10.5: selecting the card body calls onSelect with the listing id; action buttons stop propagation', async () => {
    const onSelect = vi.fn()
    const onOpenListing = vi.fn()
    const { container } = setup({ onSelect, onOpenListing })
    const card = getCardElement(container)

    // A pure click on the card body (the address text, outside the action
    // buttons) bubbles to the card and reports the selection. We use
    // fireEvent.click here rather than userEvent so the assertion isolates the
    // click-propagation path (userEvent also synthesizes hover/focus, which the
    // card intentionally treats as selection too).
    fireEvent.click(within(card).getByText('123 Maple Street'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(LISTING_ID)

    // Clicking "View Details" stops propagation, so the click never reaches the
    // card and does NOT also select. Use an exact name so the query targets the
    // inner button and not the selectable card (which, when onSelect is set,
    // also has role="button" with a name containing "View Details").
    onSelect.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }))
    expect(onOpenListing).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
