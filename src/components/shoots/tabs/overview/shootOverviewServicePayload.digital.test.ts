import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { applyOverviewServicePayload } from './shootOverviewServicePayload';
import type { ShootOverviewUpdatePayload } from './shootOverviewUpdateTypes';

const servicesList = [
  { id: '1', name: 'HDR Photos', photographer_required: true, category: 'Photos' },
  { id: '51', name: 'Green Grass Enhancement', photographer_required: true, category: 'Digital Enhancements' },
  { id: '87', name: 'Virtual staging (per image)', photographer_required: false, category: 'Digital Enhancements' },
];

function payload(serviceEditorChanges: Record<string, string> = {}) {
  const shoot = { id: '2407', scheduledDate: '2026-10-08', time: '16:30', photographer: { id: '7', name: 'Ivan' } } as ShootData;
  const updates: ShootOverviewUpdatePayload = { photographer: shoot.photographer };
  applyOverviewServicePayload({ updates, shoot, servicesList, isAdmin: true, omitStandardServices: false,
    selectedServiceIds: ['1', '51', '87'], serviceSchedules: {}, servicePrices: {}, servicePhotographerPays: {},
    perCategoryPhotographers: { photo: '7', 'digital enhancement': '7' }, serviceEditorChanges });
  return JSON.parse(JSON.stringify(updates)) as ShootOverviewUpdatePayload;
}

describe('digital service edit payload', () => {
  it('clears stale digital photographers while retaining on-site assignments and never inherits an editor', () => {
    const updates = payload();
    expect(updates.service_photographers).toEqual([{ service_id: 1, photographer_id: 7 }]);
    expect(updates.service_items?.filter(item => item.service_id !== 1)).toEqual([
      expect.objectContaining({ service_id: 51, photographer_id: null }),
      expect.objectContaining({ service_id: 87, photographer_id: null }),
    ]);
    expect(updates.photographer?.id).toBe('7');
    expect(updates.service_items?.every(item => !('editor_id' in item))).toBe(true);
  });
  it('assigns or clears each digital editor explicitly without changing the other service', () => {
    expect(payload({ '51': '8', '87': '' }).service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: 51, editor_id: 8, photographer_id: null }),
      expect.objectContaining({ service_id: 87, editor_id: null, photographer_id: null }),
      expect.not.objectContaining({ service_id: 1, editor_id: expect.anything() }),
    ]));
  });
});
