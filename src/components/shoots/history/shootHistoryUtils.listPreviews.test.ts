import { describe, expect, it } from 'vitest'
import type { ShootData } from '@/types/shoots'
import { resolveShootThumbnail } from './shootHistoryUtils'

describe('resolveShootThumbnail list previews', () => {
  it('uses hero_image + preview_images when file rows are omitted (include_files=false)', () => {
    const shoot = {
      id: '160',
      status: 'delivered',
      workflowStatus: 'delivered',
      location: { address: '6003 Calla Place' },
      heroImage: 'https://cdn.test/shoots/calla-hero_grid.jpg',
      previewImages: [
        'https://cdn.test/shoots/calla-hero_grid.jpg',
        'https://cdn.test/shoots/calla-2_grid.jpg',
      ],
      files: [],
    } as ShootData

    expect(resolveShootThumbnail(shoot, 'thumb')).toBe(
      'https://cdn.test/shoots/calla-hero_grid.jpg',
    )
    expect(resolveShootThumbnail(shoot, 'default')).toBe(
      'https://cdn.test/shoots/calla-hero_grid.jpg',
    )
  })

  it('prefers file grid renditions over list previews when files are present', () => {
    const shoot = {
      id: '167',
      status: 'delivered',
      workflowStatus: 'delivered',
      location: { address: 'Imported home' },
      heroImage: 'https://cdn.test/shoots/list-hero.jpg',
      previewImages: ['https://cdn.test/shoots/list-hero.jpg'],
      files: [
        {
          id: '1',
          filename: 'cover.jpg',
          workflow_stage: 'completed',
          is_cover: true,
          grid_url: 'https://cdn.test/shoots/file-grid.jpg',
          web_url: 'https://cdn.test/shoots/file-web.jpg',
        },
      ],
    } as ShootData

    expect(resolveShootThumbnail(shoot, 'thumb')).toBe(
      'https://cdn.test/shoots/file-grid.jpg',
    )
  })
})
