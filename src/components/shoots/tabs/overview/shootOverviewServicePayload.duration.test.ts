import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { applyOverviewServicePayload } from './shootOverviewServicePayload';
import type { ShootOverviewUpdatePayload } from './shootOverviewUpdateTypes';

describe('overview duration save payload', () => {
  it('preserves a stored duration without a timestamp and resolves null legacy durations from the catalogue tier', () => {
    const updates: ShootOverviewUpdatePayload = {};
    applyOverviewServicePayload({ updates, shoot: { id: '42', scheduledDate: '2026-10-08', time: '10:00',
      serviceItems: [{ service_id: '10', name: 'Photos', duration_minutes: 30 }, { service_id: '11', name: 'Video', duration_minutes: null }],
    } as unknown as ShootData, isAdmin: true, omitStandardServices: false,
    selectedServiceIds: ['10', '11'], serviceSchedules: {}, servicePrices: {}, servicePhotographerPays: {}, perCategoryPhotographers: {},
    effectiveSqft: 1200, servicesList: [{ id: '10', name: 'Photos', duration_minutes: 180 }, { id: '11', name: 'Video', pricing_type: 'variable',
      sqft_ranges: [{ sqft_from: 1, sqft_to: 2000, duration: 90, price: 100, photographer_pay: null }] }],
    });
    expect(updates.service_items?.map(item => item.duration_minutes)).toEqual([30, 90]);
    expect(updates.services?.map(item => item.duration_minutes)).toEqual([30, 90]);
  });
  it('retains a changed duration when preserving a separately scheduled service appointment', () => {
    const updates: ShootOverviewUpdatePayload = {};
    applyOverviewServicePayload({ updates, shoot: { id: '42', scheduledDate: '2026-10-08', time: '10:00',
      serviceItems: [{ service_id: '10', name: 'Photos', duration_minutes: 30, scheduled_at: '2026-10-08T14:00:00' }],
    } as unknown as ShootData, isAdmin: true, omitStandardServices: false, selectedServiceIds: ['10'],
    serviceSchedules: { '10': { date: '2026-10-08', time: '10:00', duration_minutes: 120 } },
    servicePrices: {}, servicePhotographerPays: {}, perCategoryPhotographers: {}, servicesList: [],
    });
    expect(updates.service_items?.[0]).toMatchObject({ duration_minutes: 120, scheduled_at: '2026-10-08T14:00:00' });
  });
});
