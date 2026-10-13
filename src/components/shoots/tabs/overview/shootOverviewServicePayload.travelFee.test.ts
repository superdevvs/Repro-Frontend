import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { buildUnitScopedUpdate } from '@/features/shoot-units/unitMutations';
import { applyOverviewServicePayload } from './shootOverviewServicePayload';
import type { ShootOverviewUpdatePayload } from './shootOverviewUpdateTypes';

const servicesList = [
  { id: '58', name: '25 Photos', category: { name: 'Photos' }, photographer_required: true, shoot_duration_minutes: 60 },
  { id: '62', name: 'Travel Fee 60 miles', category: { name: 'Travel Fees' }, photographer_required: false, shoot_duration_minutes: 0 },
  { id: '63', name: 'Floor plan', category: { name: 'Floor Plans' }, photographer_required: false },
];
const shoot = {
  id: '2402', scheduledDate: '2026-10-13', time: '10:00',
  photographer: { id: '1121', name: 'Alaina' },
  serviceItems: [{ service_id: '58', duration_minutes: 60, scheduled_at: '2026-10-13T10:00:00' },
    { service_id: '62', duration_minutes: 0, scheduled_at: null }],
} as unknown as ShootData;

function buildPayload(perCategoryPhotographers: Record<string, string>): ShootOverviewUpdatePayload {
  const updates: ShootOverviewUpdatePayload = { photographer: shoot.photographer };
  applyOverviewServicePayload({ updates, shoot, isAdmin: true, omitStandardServices: false,
    selectedServiceIds: ['58', '62', '63'],
    serviceSchedules: { '58': { date: '2026-10-13', time: '10:00' }, '62': { date: '', time: '' }, '63': { date: '', time: '' } },
    servicePrices: { '58': '125', '62': '100' }, servicePhotographerPays: { '62': '100' },
    perCategoryPhotographers, servicesList,
  });
  return updates;
}

describe('overview travel fee assignment', () => {
  it('sends the selected travel payout recipient without changing the photo or primary assignment', () => {
    const before = buildPayload({ photo: '1125' });
    const after = buildPayload({ photo: '1125', 'travel fee': '1125', 'floor plan': '1121' });
    expect(after.service_photographers).toEqual([
      { service_id: 58, photographer_id: 1125 }, { service_id: 62, photographer_id: 1125 },
    ]);
    expect(after.photographer).toEqual(shoot.photographer);
    expect(after.service_items).toEqual(before.service_items);
    expect(after.services).toEqual(before.services);
    expect(after.service_items?.find(item => item.service_id === 62)).toMatchObject({
      duration_minutes: 0, scheduled_at: null, price: 100, photographer_pay: 100,
    });
    expect(after.service_items?.find(item => item.service_id === 63)).toHaveProperty('photographer_id', null);
    expect(after.service_items?.filter(item => item.service_id !== 63).every(item => !('photographer_id' in item))).toBe(true);
  });

  it('leaves a fee without an explicit recipient unassigned', () => {
    expect(buildPayload({ photo: '1125' }).service_photographers).toEqual([{ service_id: 58, photographer_id: 1125 }]);
  });

  it('carries the explicit recipient into the active unit while preserving sibling lines', () => {
    const unitShoot = { ...shoot, units_revision: 4,
      units: [1, 2].map(id => ({ id, client_key: `unit-${id}`, label: `Unit ${id}`, kind: 'unit' })),
      service_lines: [
        { id: '58', service_id: '58', shoot_service_id: '1', shoot_unit_id: 1, name: '25 Photos', quantity: 1,
          photographer_id: '1125', scheduled_at: '2026-10-13T10:00:00', duration_minutes: 60 },
        { id: '62', service_id: '62', shoot_service_id: '2', shoot_unit_id: 1, name: 'Travel Fee 60 miles', quantity: 1,
          photographer_id: null, photographer_required: false, scheduled_at: null, duration_minutes: 0 },
        { id: '62', service_id: '62', shoot_service_id: '3', shoot_unit_id: 2, name: 'Travel Fee 60 miles', quantity: 1,
          photographer_id: '1121', photographer_required: false, scheduled_at: null, duration_minutes: 0 },
      ],
    } as unknown as ShootData;
    const payload = buildUnitScopedUpdate(unitShoot, '1', buildPayload({ photo: '1125', 'travel fee': '1125' }));
    expect(payload.service_lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ shoot_service_id: '1', photographer_id: 1125, duration_minutes: 60 }),
      expect.objectContaining({ shoot_service_id: '2', photographer_id: 1125, duration_minutes: 0, scheduled_at: null }),
      expect.objectContaining({ shoot_service_id: '3', photographer_id: '1121', scheduled_at: null }),
    ]));
    expect(payload.photographer).toEqual(shoot.photographer);
    expect(payload).not.toHaveProperty('service_photographers');
  });
});
