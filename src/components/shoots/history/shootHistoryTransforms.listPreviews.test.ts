import { describe, expect, it } from 'vitest'
import { mapShootApiToShootData } from './shootHistoryTransforms'

describe('mapShootApiToShootData list previews', () => {
  it('maps hero_image + preview_images from include_files=false list payloads', () => {
    const mapped = mapShootApiToShootData({
      id: 160,
      address: '6003 Calla Place',
      city: 'Rockville',
      state: 'MD',
      zip: '20852',
      status: 'delivered',
      workflow_status: 'delivered',
      scheduled_date: '2026-09-10',
      hero_image: 'https://cdn.test/shoots/calla-hero_grid.jpg',
      preview_images: [
        'https://cdn.test/shoots/calla-hero_grid.jpg',
        'https://cdn.test/shoots/calla-2_grid.jpg',
      ],
      files: [],
    })

    expect(mapped.heroImage).toBe('https://cdn.test/shoots/calla-hero_grid.jpg')
    expect(mapped.previewImages).toEqual([
      'https://cdn.test/shoots/calla-hero_grid.jpg',
      'https://cdn.test/shoots/calla-2_grid.jpg',
    ])
    expect(mapped.files).toEqual([])
  })
})
