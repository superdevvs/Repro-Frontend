import { describe, expect, it } from 'vitest'
import { mapShootApiToShootData } from './shootHistoryTransforms'

describe('mapShootApiToShootData coordinate mapping', () => {
  it('preserves valid coordinates from the operational API location payload', () => {
    const shoot = mapShootApiToShootData({
      id: 42,
      location: {
        fullAddress: '1600 Pennsylvania Ave NW, Washington, DC 20500',
        latitude: '38.8977',
        longitude: -77.0365,
      },
    })

    expect(shoot.location).toMatchObject({
      fullAddress: '1600 Pennsylvania Ave NW, Washington, DC 20500',
      latitude: 38.8977,
      longitude: -77.0365,
    })
  })

  it('falls back from a partial preferred source to the next complete valid pair', () => {
    const shoot = mapShootApiToShootData({
      id: 43,
      location: {
        latitude: 38.8977,
      },
      latitude: 39.084,
      longitude: -77.1528,
    })

    expect(shoot.location.latitude).toBe(39.084)
    expect(shoot.location.longitude).toBe(-77.1528)
  })

  it('does not combine valid coordinate halves from different or invalid pairs', () => {
    const shoot = mapShootApiToShootData({
      id: 44,
      location: {
        latitude: 38.8977,
        longitude: Number.POSITIVE_INFINITY,
      },
      latitude: 91,
      longitude: -77.0365,
      property_details: {
        lat: 39.084,
        lng: -181,
      },
    })

    expect(shoot.location.latitude).toBeUndefined()
    expect(shoot.location.longitude).toBeUndefined()
  })

  it('uses the first complete valid alias pair without mixing field conventions', () => {
    const shoot = mapShootApiToShootData({
      id: 45,
      location: {
        latitude: 38.8977,
        lng: -77.0365,
        lat: 39.084,
        longitude: -77.1528,
      },
      latitude: 40.7128,
      longitude: -74.006,
    })

    expect(shoot.location).toMatchObject({
      latitude: 38.8977,
      longitude: -77.1528,
    })
  })
})
