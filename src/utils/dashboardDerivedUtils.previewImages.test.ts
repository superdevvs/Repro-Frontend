import { describe, expect, it } from 'vitest';

import type { ShootData } from '@/types/shoots';

import { shootDataToSummary } from './dashboardDerivedUtils';

describe('shootDataToSummary preview images', () => {
  it('uses list preview_images when file rows are omitted', () => {
    const shoot = {
      id: 160,
      address: '6003 Calla Place',
      status: 'delivered',
      workflowStatus: 'delivered',
      scheduledDate: '2026-09-10',
      heroImage: 'https://cdn.test/shoots/calla-hero.jpg',
      previewImages: [
        'https://cdn.test/shoots/calla-1.jpg',
        'https://cdn.test/shoots/calla-2.jpg',
      ],
      files: [],
    } as ShootData;

    const summary = shootDataToSummary(shoot);

    expect(summary.heroImage).toBe('https://cdn.test/shoots/calla-hero.jpg');
    expect(summary.previewImages).toEqual([
      'https://cdn.test/shoots/calla-hero.jpg',
      'https://cdn.test/shoots/calla-1.jpg',
      'https://cdn.test/shoots/calla-2.jpg',
    ]);
  });

  it('skips CubiCasa floorplan list heroes when edited photos exist', () => {
    const floorplan =
      'https://cdn.test/shoots/166/grids/0-5933-keysville-road-keymar-md-united-states-0-6d830b71_grid.jpg';
    const exterior =
      'https://cdn.test/shoots/166/grids/5933%20Keysville%20Rd-2847_0116_grid.jpg';
    const shoot = {
      id: 166,
      address: '5933 Keysville Road',
      status: 'delivered',
      workflowStatus: 'delivered',
      scheduledDate: '2026-09-10',
      heroImage: floorplan,
      previewImages: [floorplan, exterior],
      files: [],
    } as ShootData;

    const summary = shootDataToSummary(shoot);
    expect(summary.heroImage).toBe(exterior);
    expect(summary.previewImages[0]).toBe(exterior);
    expect(summary.previewImages).not.toContain(floorplan);
  });
});
