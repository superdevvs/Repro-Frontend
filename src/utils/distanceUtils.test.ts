import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCoordinatesFromAddress } from '@/utils/distanceUtils'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getCoordinatesFromAddress', () => {
  it('uses the backend geocode endpoint and normalizes its coordinates', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { latitude: 39.084, longitude: -77.1528 },
      }),
    } as Response)

    await expect(
      getCoordinatesFromAddress(
        '777 QA Desktop Journey Ave',
        'Rockville',
        'MD',
        '20850',
      ),
    ).resolves.toEqual({ lat: 39.084, lon: -77.1528 })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/address/geocode'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          address: '777 QA Desktop Journey Ave',
          city: 'Rockville',
          state: 'MD',
          zip: '20850',
        }),
      }),
    )
  })
})
