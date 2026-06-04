import { describe, expect, it } from 'vitest'

import {
  buildMarkerLocationGroups,
  listingLocationKey,
} from './markers'
import type { ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

const makeListing = (
  id: string,
  fullAddress: string,
  latitude: number,
  longitude: number,
): ShowcaseListing => ({
  id,
  address: fullAddress.split(',')[0],
  city: 'Rockville',
  state: 'MD',
  zip: '20850',
  fullAddress,
  client: { name: 'Client' },
  isListingHidden: false,
  isPrivateListing: true,
  latitude,
  longitude,
})

describe('marker location groups', () => {
  it('groups repeated shoots at one normalized address and keeps distinct locations separate', () => {
    const first = makeListing('1', '777 QA Desktop Journey, Rockville, MD 20850', 39.1, -77.1)
    const duplicate = makeListing('2', '777 QA DESKTOP JOURNEY Rockville MD 20850', 39.10001, -77.10001)
    const distinct = makeListing('3', '999 QA Swarm Test Ave, Rockville, MD 20850', 39.2, -77.2)

    expect(listingLocationKey(first)).toBe(listingLocationKey(duplicate))

    const groups = buildMarkerLocationGroups([first, duplicate, distinct])
    expect(groups).toHaveLength(2)
    expect(groups[0].listings.map((listing) => listing.id)).toEqual(['1', '2'])
    expect(groups[1].listings.map((listing) => listing.id)).toEqual(['3'])
  })

  it('groups different shoots that resolve to the same fallback locality coordinates', () => {
    const first = {
      ...makeListing('1', '777 QA Desktop Journey, Rockville, MD 20850', 39.084, -77.1528),
      coordsSource: 'cache' as const,
    }
    const second = {
      ...makeListing('2', '888 Client UI Request, Rockville, MD 20850', 39.084, -77.1528),
      coordsSource: 'cache' as const,
    }
    const distinct = {
      ...makeListing('3', '6275 Kerrydale Drive, Springfield, VA 22152', 38.76, -77.18),
      coordsSource: 'api' as const,
    }

    const groups = buildMarkerLocationGroups([first, second, distinct])

    expect(groups).toHaveLength(2)
    expect(groups[0].listings.map((listing) => listing.id)).toEqual(['1', '2'])
    expect(groups[1].listings.map((listing) => listing.id)).toEqual(['3'])
  })
})
