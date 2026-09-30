import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { getClientDeliveredMedia, resolveClientDeliveredAssetUrl } from './utils';

describe('getClientDeliveredMedia', () => {
  it('uses hydrated hero/preview_images when file rows are omitted (include_files=false)', () => {
    const hero =
      'https://cdn.test/shoots/384/grids/707%20Sequoia%20Dr%20-8132_grid.jpg';
    const shoot = {
      id: 384,
      address: '707 Sequoia Drive',
      status: 'delivered',
      workflowStatus: 'delivered',
      editedPhotoCount: 27,
      heroImage: hero,
      previewImages: [
        hero,
        'https://cdn.test/shoots/384/grids/707%20Sequoia%20Dr%20-8133_grid.jpg',
      ],
      files: [],
    } as ShootData;

    const media = getClientDeliveredMedia(shoot);
    expect(media.count).toBe(27);
    expect(media.coverPhoto).toBe(hero);
    expect(media.photos[0]).toBe(hero);
    expect(media.photos.length).toBeGreaterThanOrEqual(2);
  });

  it('still prefers file-derived covers when files are present', () => {
    const shoot = {
      id: 384,
      editedPhotoCount: 27,
      heroImage: 'https://cdn.test/shoots/384/list-hero.jpg',
      previewImages: ['https://cdn.test/shoots/384/list-hero.jpg'],
      files: [
        {
          id: '1',
          filename: '707 Sequoia Dr -8132.jpg',
          media_type: 'edited',
          workflow_stage: 'verified',
          is_cover: true,
          grid_url: 'https://cdn.test/shoots/384/grids/file-cover_grid.jpg',
        },
      ],
    } as ShootData;

    const media = getClientDeliveredMedia(shoot);
    expect(media.coverPhoto).toBe('https://cdn.test/shoots/384/grids/file-cover_grid.jpg');
  });

  it('skips CubiCasa floorplan list heroes when a photo preview exists', () => {
    const floorplan =
      'https://cdn.test/shoots/166/grids/0-5933-keysville-road-keymar-md-united-states-0-6d830b71_grid.jpg';
    const exterior =
      'https://cdn.test/shoots/166/grids/5933%20Keysville%20Rd-2847_0116_grid.jpg';
    const shoot = {
      id: 166,
      editedPhotoCount: 40,
      heroImage: floorplan,
      previewImages: [floorplan, exterior],
      files: [],
    } as ShootData;

    expect(getClientDeliveredMedia(shoot).coverPhoto).toBe(exterior);
  });
});

describe('resolveClientDeliveredAssetUrl', () => {
  it('resolves grid_path when other renditions are missing', () => {
    expect(
      resolveClientDeliveredAssetUrl({
        filename: 'cover.jpg',
        grid_path: 'shoots/384/grids/cover_grid.jpg',
      }),
    ).toContain('shoots/384/grids/cover_grid.jpg');
  });
});
