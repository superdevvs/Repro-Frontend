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

  it('skips floorplan media_type covers when edited photos exist', () => {
    const shoot = {
      id: '166',
      status: 'delivered',
      workflowStatus: 'delivered',
      location: { address: '5933 Keysville Road' },
      heroImage: 'https://cdn.test/shoots/166/grids/0-5933-keysville-road-keymar-md-united-states-0-6d830b71_grid.jpg',
      previewImages: [
        'https://cdn.test/shoots/166/grids/0-5933-keysville-road-keymar-md-united-states-0-6d830b71_grid.jpg',
      ],
      files: [
        {
          id: '1',
          filename: '0_5933-keysville-road-keymar-md-united-states_0.jpg',
          media_type: 'floorplan',
          workflow_stage: 'verified',
          is_cover: true,
          grid_url: 'https://cdn.test/shoots/166/grids/0-5933-keysville-road-keymar-md-united-states-0-6d830b71_grid.jpg',
        },
        {
          id: '2',
          filename: '5933 Keysville Rd-2847_0116.jpg',
          media_type: 'edited',
          workflow_stage: 'verified',
          grid_url: 'https://cdn.test/shoots/166/grids/5933%20Keysville%20Rd-2847_0116_grid.jpg',
        },
      ],
    } as ShootData

    expect(resolveShootThumbnail(shoot, 'thumb')).toBe(
      'https://cdn.test/shoots/166/grids/5933%20Keysville%20Rd-2847_0116_grid.jpg',
    )
  })
})
