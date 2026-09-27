import { describe, expect, it } from 'vitest';
import { allUnitLines, buildUnitScopedUpdate, filterUnitFiles, unitLinePayload } from './unitMutations';
import type { ShootData, ShootServiceObject } from '@/types/shoots';

const line = (unit: number, service = 7): ShootServiceObject => ({ id: String(service), service_id: String(service), shoot_service_id: String(unit * 10 + service), client_key: `line-${unit}-${service}`, shoot_unit_id: unit, name: 'Photos', quantity: 1, price: 100 + unit, scheduled_at: `2026-10-01T${unit === 1 ? '09' : '11'}:00:00Z`, photographer_id: '9' });
const shoot = { id: 'unit-mutations', units_revision: 4, units: [1, 2].map(id => ({ id, client_key: `unit-${id}`, label: `Unit ${id}`, kind: 'unit', sqft: 1000 * id, beds: 2, baths: 1 })), service_lines: [line(1), line(2)], propertyDetails: { sqft: 10000, lockboxCode: 'shared-entry' } } as ShootData;
describe('single unit changes preserve the complete booking', () => {
  it('merges by unit and line identity when sibling units have the same catalogue service', () => {
    const result = buildUnitScopedUpdate(shoot, '1', { service_items: [{ service_id: 7, scheduled_at: '2026-10-04T09:00:00Z', price: 150 }], service_photographers: [{ service_id: 7, photographer_id: 22 }] });
    expect(result).not.toHaveProperty('service_items');
    expect(result).not.toHaveProperty('service_photographers');
    expect(result.expected_units_revision).toBe(4);
    expect(result.service_lines).toEqual([unitLinePayload(line(2)), expect.objectContaining({ shoot_service_id: '17', client_key: 'line-1-7', shoot_unit_id: 1, service_id: '7', photographer_id: 22, price: 150 })]);
    expect((result.service_lines as object[])[0]).not.toHaveProperty('price');
  });
  it('creates a stable client key for a newly added service and retains other units', () => {
    const result = buildUnitScopedUpdate(shoot, '1', { service_items: [{ service_id: 8 }] });
    const added = (result.service_lines as Record<string, unknown>[])[1];
    expect(added.client_key).toMatch(/^[a-f0-9-]{36}$/);
    expect(added).toMatchObject({ shoot_unit_id: 1, unit_client_key: 'unit-1', service_id: '8', quantity: 1 });
    expect(added).not.toHaveProperty('shoot_service_id');
    expect(shoot.service_lines).toEqual([line(1), line(2)]);
  });
  it('moves unit metrics into units while retaining building access and dimensions', () => {
    const result = buildUnitScopedUpdate(shoot, '1', { propertyDetails: { sqft: 900, bedrooms: 1, bathrooms: 1.5, lockboxCode: 'new-entry' } });
    expect(result.units).toEqual([expect.objectContaining({ id: 1, sqft: 900, beds: 1, baths: 1.5 }), expect.objectContaining({ id: 2, sqft: 2000 })]);
    expect(result.propertyDetails).toEqual({ sqft: 10000, lockboxCode: 'new-entry' });
  });
  it('never falls back to a different unit or mixes media with the same catalogue ID', () => {
    expect(() => buildUnitScopedUpdate(shoot, '999', {})).toThrow(/no longer exists/);
    const files = [{ shoot_service_id: 17 }, { shoot_service_id: 27 }, { shoot_service_id: null }];
    expect(filterUnitFiles(files, shoot, '1')).toEqual([files[0]]);
    expect(filterUnitFiles(files, shoot, '2')).toEqual([files[1]]);
    expect(filterUnitFiles(files, shoot, '999')).toEqual([]);
    expect(filterUnitFiles(files, { ...shoot, units: [] }, null)).toBe(files);
  });
  it('excludes invoice adjustments from operational updates without changing billing or snapshots', () => {
    const fee = { id: 'invoice-adjustment-3', name: 'Rush fee', price: 25, source: 'invoice_adjustment', is_invoice_adjustment: true } as ShootServiceObject;
    const withFee = { ...shoot, serviceItems: [...shoot.service_lines!, fee], service_lines: [...shoot.service_lines!, fee] };
    expect(allUnitLines(withFee)).toEqual(shoot.service_lines);
    const result = buildUnitScopedUpdate(withFee, '1', { services: [{ service_id: 7 }] });
    expect(result.service_lines).toHaveLength(2);
    expect((result.service_lines as object[])[0]).toEqual(unitLinePayload(line(2)));
    expect((result.service_lines as object[])[1]).not.toHaveProperty('price');
    expect(withFee.serviceItems).toHaveLength(3);
    expect(withFee.serviceItems[2]).toBe(fee);
  });
});
