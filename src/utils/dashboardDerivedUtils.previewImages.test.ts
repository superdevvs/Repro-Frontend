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
      'https://cdn.test/shoots/calla-1.jpg',
      'https://cdn.test/shoots/calla-2.jpg',
    ]);
  });
});
