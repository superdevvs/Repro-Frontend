// Unit tests for the `useListingPresentation` coordinating hook.
//
// These tests exercise the reactive contract of the hook via `renderHook` +
// `act`: filtering recomputes `displayedListings` and `summary`, sorting
// reorders the displayed set, and selection is normalized against the
// currently displayed listings.
//
// Validates: Requirements 4.3, 4.6, 5.3, 10.9.

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { type ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'
import { useListingPresentation } from '@/hooks/useListingPresentation'

/**
 * Build a ShowcaseListing fixture with sensible defaults, overridable per case.
 */
function makeListing(overrides: Partial<ShowcaseListing> & { id: string }): ShowcaseListing {
  return {
    id: overrides.id,
    address: overrides.address ?? `${overrides.id} Main St`,
    city: overrides.city ?? 'Austin',
    state: overrides.state ?? 'TX',
    zip: overrides.zip ?? '78701',
    fullAddress: overrides.fullAddress ?? `${overrides.id} Main St, Austin, TX 78701`,
    client: overrides.client ?? { name: 'Acme Realty' },
    isListingHidden: overrides.isListingHidden ?? false,
    isPrivateListing: overrides.isPrivateListing ?? false,
    listing_type: overrides.listing_type,
    bedrooms: overrides.bedrooms,
    bathrooms: overrides.bathrooms,
    sqft: overrides.sqft,
    price: overrides.price,
    latitude: overrides.latitude,
    longitude: overrides.longitude,
    coordsSource: overrides.coordsSource,
    heroImage: overrides.heroImage,
  }
}

/**
 * A small, varied fixture set:
 * - a: mapped, for_sale, $500k, Austin
 * - b: mapped, private, $1.2M, Dallas
 * - c: unmapped, for_sale, $750k, Austin, hidden
 * - d: unmapped, private, no price, Dallas
 * - e: mapped, for_rent, $300k, Houston
 */
function makeFixtures(): ShowcaseListing[] {
  return [
    makeListing({
      id: 'a',
      city: 'Austin',
      listing_type: 'for_sale',
      price: 500_000,
      bedrooms: 3,
      latitude: 30.2672,
      longitude: -97.7431,
    }),
    makeListing({
      id: 'b',
      city: 'Dallas',
      isPrivateListing: true,
      price: 1_200_000,
      bedrooms: 5,
      latitude: 32.7767,
      longitude: -96.797,
    }),
    makeListing({
      id: 'c',
      city: 'Austin',
      listing_type: 'for_sale',
      price: 750_000,
      bedrooms: 2,
      isListingHidden: true,
      // no coords -> unmapped
    }),
    makeListing({
      id: 'd',
      city: 'Dallas',
      isPrivateListing: true,
      bedrooms: 1,
      // no price, no coords -> unmapped
    }),
    makeListing({
      id: 'e',
      city: 'Houston',
      listing_type: 'for_rent',
      price: 300_000,
      bedrooms: 4,
      latitude: 29.7604,
      longitude: -95.3698,
    }),
  ]
}

describe('useListingPresentation', () => {
  it('starts with all listings displayed and an arithmetically consistent summary', () => {
    const listings = makeFixtures()
    const { result } = renderHook(() =>
      useListingPresentation({ listings, searchQuery: '' }),
    )

    expect(result.current.displayedListings).toHaveLength(listings.length)
    expect(result.current.summary.total).toBe(listings.length)
    // a, b, e are mapped; c, d are unmapped.
    expect(result.current.summary.mapped).toBe(3)
    expect(result.current.summary.unmapped).toBe(2)
    expect(result.current.summary.mapped + result.current.summary.unmapped).toBe(
      result.current.summary.total,
    )
    expect(result.current.summary.private).toBe(2) // b, d
    expect(result.current.summary.hidden).toBe(1) // c
  })

  // R4.3: applying a filter recomputes displayedListings client-side.
  // R5.3: the summary recomputes to reflect the filtered set.
  it('recomputes displayedListings and summary when a filter is added (R4.3, R5.3)', () => {
    const listings = makeFixtures()
    const { result } = renderHook(() =>
      useListingPresentation({ listings, searchQuery: '' }),
    )

    act(() => {
      result.current.addFilter({ kind: 'mapped' })
    })

    // Only mapped listings (a, b, e) remain.
    const ids = result.current.displayedListings.map((l) => l.id).sort()
    expect(ids).toEqual(['a', 'b', 'e'])

    // Summary recomputes against the filtered set (R5.3): total tracks the
    // filtered length and every displayed listing is mapped.
    expect(result.current.summary.total).toBe(result.current.displayedListings.length)
    expect(result.current.summary.total).toBe(3)
    expect(result.current.summary.mapped).toBe(3)
    expect(result.current.summary.unmapped).toBe(0)

    // A filter chip is surfaced for the active filter.
    expect(result.current.filterChips).toEqual([{ key: 'mapped', label: 'Mapped' }])

    // Removing the filter restores the full set.
    act(() => {
      result.current.removeFilter('mapped')
    })
    expect(result.current.displayedListings).toHaveLength(listings.length)
    expect(result.current.summary.total).toBe(listings.length)
    expect(result.current.filterChips).toEqual([])
  })

  // R4.6: selecting a sort option reorders displayedListings client-side.
  it('reorders displayedListings when the sort changes to priceDesc (R4.6)', () => {
    const listings = makeFixtures()
    const { result } = renderHook(() =>
      useListingPresentation({ listings, searchQuery: '' }),
    )

    act(() => {
      result.current.setSort('priceDesc')
    })

    expect(result.current.sort).toBe('priceDesc')

    const ids = result.current.displayedListings.map((l) => l.id)
    // Prices: b=1.2M, c=750k, a=500k, e=300k, d=none.
    // No-price (d) sorts last regardless of direction.
    expect(ids).toEqual(['b', 'c', 'a', 'e', 'd'])

    // priceAsc reverses the priced listings; d still last.
    act(() => {
      result.current.setSort('priceAsc')
    })
    expect(result.current.displayedListings.map((l) => l.id)).toEqual([
      'e',
      'a',
      'c',
      'b',
      'd',
    ])
  })

  // R5.3: summary stays consistent with the filtered set across combined filters.
  it('keeps summary consistent with the displayed set under combined filters (R5.3)', () => {
    const listings = makeFixtures()
    const { result } = renderHook(() =>
      useListingPresentation({ listings, searchQuery: '' }),
    )

    act(() => {
      result.current.addFilter({ kind: 'forSale' })
    })
    act(() => {
      result.current.addFilter({ kind: 'city', value: 'Austin' })
    })

    // for_sale AND Austin -> a, c.
    const ids = result.current.displayedListings.map((l) => l.id).sort()
    expect(ids).toEqual(['a', 'c'])

    const { total, mapped, unmapped, private: priv, hidden } = result.current.summary
    expect(total).toBe(result.current.displayedListings.length)
    expect(total).toBe(2)
    expect(mapped).toBe(1) // a is mapped, c is not
    expect(unmapped).toBe(1) // c
    expect(mapped + unmapped).toBe(total)
    expect(priv).toBe(0)
    expect(hidden).toBe(1) // c is hidden
  })

  // R10.9: selection is shared and normalized against the displayed listings.
  it('selects a visible listing and clears the selection when filtered away (R10.9)', () => {
    const listings = makeFixtures()
    const { result } = renderHook(() =>
      useListingPresentation({ listings, searchQuery: '' }),
    )

    // Select an unmapped, private listing (d) that is currently visible.
    act(() => {
      result.current.selectListing('d')
    })
    expect(result.current.selectedListingId).toBe('d')

    // Add a filter that excludes 'd' (it has no coords). Selection normalizes
    // away to null because the id is no longer in the displayed set.
    act(() => {
      result.current.addFilter({ kind: 'mapped' })
    })
    expect(result.current.displayedListings.some((l) => l.id === 'd')).toBe(false)
    expect(result.current.selectedListingId).toBeNull()

    // Selecting a non-existent id yields null.
    act(() => {
      result.current.selectListing('does-not-exist')
    })
    expect(result.current.selectedListingId).toBeNull()

    // Selecting a currently-visible mapped listing works.
    act(() => {
      result.current.selectListing('b')
    })
    expect(result.current.selectedListingId).toBe('b')
  })

  // R4.7/4.8 supporting behavior used by R4.6/R4.3: saved view round-trip.
  it('round-trips a saved view: saveView records it and applyView restores filters + sort', () => {
    const listings = makeFixtures()
    const onSavedViewsChange = vi.fn()
    const { result } = renderHook(() =>
      useListingPresentation({ listings, searchQuery: '', onSavedViewsChange }),
    )

    // Configure a filter + sort, then capture as a saved view.
    act(() => {
      result.current.addFilter({ kind: 'private' })
    })
    act(() => {
      result.current.setSort('cityAsc')
    })
    act(() => {
      result.current.saveView('Private A-Z')
    })

    expect(result.current.savedViews).toHaveLength(1)
    expect(result.current.savedViews[0].name).toBe('Private A-Z')
    expect(onSavedViewsChange).toHaveBeenCalledTimes(1)
    expect(onSavedViewsChange).toHaveBeenLastCalledWith(result.current.savedViews)

    const savedId = result.current.savedViews[0].id

    // Reset state to a different configuration.
    act(() => {
      result.current.removeFilter('private')
    })
    act(() => {
      result.current.setSort('newest')
    })
    expect(result.current.filters).toEqual([])
    expect(result.current.sort).toBe('newest')

    // Applying the saved view restores its filters + sort (R4.8).
    act(() => {
      result.current.applyView(savedId)
    })
    expect(result.current.filters).toEqual([{ kind: 'private' }])
    expect(result.current.sort).toBe('cityAsc')
    // applyView does not mutate the saved-views collection.
    expect(onSavedViewsChange).toHaveBeenCalledTimes(1)

    // displayedListings reflect the restored private filter -> b, d.
    const ids = result.current.displayedListings.map((l) => l.id).sort()
    expect(ids).toEqual(['b', 'd'])
  })

  it('seeds savedViews from initialSavedViews on mount without invoking onSavedViewsChange', () => {
    const listings = makeFixtures()
    const onSavedViewsChange = vi.fn()
    const seeded = [
      { id: 'seed-1', name: 'Seeded', filters: [{ kind: 'mapped' as const }], sort: 'priceDesc' as const },
    ]
    const { result } = renderHook(() =>
      useListingPresentation({
        listings,
        searchQuery: '',
        initialSavedViews: seeded,
        onSavedViewsChange,
      }),
    )

    expect(result.current.savedViews).toEqual(seeded)
    expect(onSavedViewsChange).not.toHaveBeenCalled()
  })
})
