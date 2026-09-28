import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { getShootDetailsServiceNames } from './shootDetailsPresentation';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';

describe('unit service chip summary', () => {
  it('bounds repeated unit services while preserving legacy service display', () => {
    const shoot = { services: Array.from({ length: 100 }, () => 'Photography'), units: [{ id: 1, label: '101', kind: 'unit' }] } as ShootData;
    expect(getShootDetailsServiceNames(shoot)).toEqual(['Photography × 100']);
    expect(getShootDetailsServiceNames({ ...shoot, units: [], services: ['Photography'] })).toEqual(['Photography']);
    expect(getShootDetailsServiceNames({ ...shoot, units: [], services: ['Photography', 'Photography'] })).toEqual(['Photography × 2']);
  });

  it('recovers five booked occurrences after the history mapper deduplicates names', () => {
    const shoot = mapShootApiToShootData({ id: 108, services_list: ['HDR Photos'], serviceItems:
      Array.from({ length: 5 }, (_, index) => ({ shoot_service_id: 151 + index, service_id: 2, name: 'HDR Photos', quantity: 1, price: 175 })),
    });
    const before = JSON.stringify(shoot);
    expect(getShootDetailsServiceNames(shoot)).toEqual(['HDR Photos × 5']);
    expect(shoot.services).toEqual(['HDR Photos']);
    expect(shoot.serviceItems).toHaveLength(5);
    expect(JSON.stringify(shoot)).toBe(before);
  });

  it('counts exact booked IDs once without multiplying quantity, photo counts, or aliased arrays', () => {
    const rows = [{ shoot_service_id: '151', name: 'HDR  Photos', quantity: 3, photo_count: 25 },
      { shoot_service_id: '152', name: ' hdr photos ', quantity: 1 },
      { shoot_service_id: '151', name: 'HDR Photos', quantity: 3 },
      { shoot_service_id: '153', name: '5 HDR Photos' },
      { name: 'Rush fee', isInvoiceAdjustment: true }];
    const shoot = { services: ['HDR Photos', '5 HDR Photos', 'Rush fee'], service_lines: rows, serviceItems: rows } as ShootData;
    expect(getShootDetailsServiceNames(shoot)).toEqual(['HDR Photos × 2', '5 HDR Photos', 'Rush fee']);
  });

  it('retains legacy object labels and tolerates empty service rows', () => {
    const shoot = { services: [{ name: 'HDR Photos' }, { label: 'HDR Photos' }, { service_name: 'Floorplan' }, null, {}],
      serviceItems: [null, { shoot_service_id: '151', label: 'HDR Photos' }, { shoot_service_id: '152', name: 'HDR Photos' }],
    } as unknown as ShootData;
    expect(getShootDetailsServiceNames(shoot)).toEqual(['HDR Photos × 2', 'Floorplan']);
    expect(getShootDetailsServiceNames({ ...shoot, serviceItems: [] })).toEqual(['HDR Photos × 2', 'Floorplan']);
  });
});
