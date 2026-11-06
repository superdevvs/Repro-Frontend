import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { buildUnitScopedUpdate } from '@/features/shoot-units/unitMutations';
import { getShootPhotographerAssignments, getShootPhotographerAssignmentGroups } from '@/utils/shootPhotographerAssignments';
import { applyOverviewServicePayload } from './shootOverviewServicePayload';
import type { ShootOverviewUpdatePayload } from './shootOverviewUpdateTypes';

const servicesList = [
  { id: '3', name: '25 Flash Photos', category: 'Photos', photographer_required: true, shoot_duration_minutes: 60 },
  { id: '90', name: 'Onsite Cancellation/hold fee', category: 'Cancellation/Hold', photographer_required: true,
    financial_only: true, price: 60, photographer_pay: 50, shoot_duration_minutes: 60 },
];
const shoot = {
  id: '5944', status: 'uploaded', scheduledDate: '2026-11-06', time: '10:00', timezone: 'America/New_York',
  photographer: { id: '1143', name: 'Ivan' }, units_revision: 2,
  units: [{ id: 15, client_key: 'unit-15', label: '1', kind: 'unit', sqft: 2004 }],
  serviceItems: [{ id: '3', service_id: '3', shoot_service_id: '6128', shoot_unit_id: 15, client_key: 'unit-15:3',
    name: '25 Flash Photos', quantity: 1, price: 125, photographer_id: '1143', duration_minutes: 60,
    scheduled_at: '2026-11-06T15:00:00Z', workflow_status: 'in_progress' }],
} as unknown as ShootData;

function payload(source = shoot, assignments: Record<string, string> = {}): ShootOverviewUpdatePayload {
  const updates: ShootOverviewUpdatePayload = {};
  applyOverviewServicePayload({ updates, shoot: source, isAdmin: false, omitStandardServices: false,
    selectedServiceIds: ['3', '90'], servicesList,
    serviceSchedules: { '3': { date: '2026-11-06', time: '10:00' }, '90': { date: '2026-11-06', time: '10:00' } },
    servicePrices: { '90': '999' }, servicePhotographerPays: {}, perCategoryPhotographers: assignments });
  return updates;
}

describe('overview financial fee addition and reload', () => {
  it('sends the displayed Ivan recipient with no extra visit and no rep price override', () => {
    const updates = payload();
    expect(updates.service_photographers).toEqual([{ service_id: 90, photographer_id: 1143 }]);
    expect(updates.service_items?.find(item => item.service_id === 90)).toEqual({
      service_id: 90, duration_minutes: 0, scheduled_at: null,
    });
    const unit = buildUnitScopedUpdate(shoot, '15', updates);
    expect(unit.service_lines).toEqual([
      expect.objectContaining({ shoot_service_id: '6128', service_id: '3', photographer_id: '1143',
        duration_minutes: 60, scheduled_at: '2026-11-06T15:00:00.000Z' }),
      expect.objectContaining({ service_id: '90', shoot_unit_id: 15, photographer_id: 1143, duration_minutes: 0, scheduled_at: null }),
    ]);
    expect(unit.service_lines).not.toEqual(expect.arrayContaining([expect.objectContaining({ price: 999 })]));
  });

  it('honors a selected fee recipient without changing the primary photographer', () => {
    const updates = payload(shoot, { 'cancellation/hold': '1125' });
    expect(updates.service_photographers).toEqual([{ service_id: 90, photographer_id: 1125 }]);
    expect(updates).not.toHaveProperty('photographer');
  });

  it.each(['1125', null])('preserves a booked fee recipient %s on reopen', recipient => {
    const fee = { id: '90', service_id: '90', shoot_service_id: '6200', shoot_unit_id: 15, client_key: 'unit-15:90',
      name: 'Onsite Cancellation/hold fee', quantity: 1, price: 60, financial_only: true,
      photographer_required: false, photographer_id: recipient, resolved_photographer_id: '1143',
      resolved_photographer: { id: '1143', name: 'Ivan' }, duration_minutes: 0, scheduled_at: null };
    const reloaded = { ...shoot, serviceItems: [...shoot.serviceItems!, fee] } as ShootData;
    const updates = payload(reloaded);
    expect(updates.service_photographers).toEqual(recipient ? [{ service_id: 90, photographer_id: Number(recipient) }] : []);
    expect(updates.service_items?.find(item => item.service_id === 90)).toMatchObject({ duration_minutes: 0, scheduled_at: null });
    const unit = buildUnitScopedUpdate(reloaded, '15', updates);
    expect(unit.service_lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ shoot_service_id: '6200', photographer_id: recipient ? Number(recipient) : null, scheduled_at: null }),
    ]));
    expect(getShootPhotographerAssignments({ serviceObjects: [fee] })[0].photographerId).toBe(recipient ?? undefined);
    expect(getShootPhotographerAssignmentGroups({ serviceObjects: [fee] }).groups[0].photographer?.id).toBe(recipient ?? undefined);
  });
});
