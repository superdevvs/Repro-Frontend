import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';
import { getUnitServiceLines, projectShootForUnit } from '@/features/shoot-units/shootUnitData';
describe('unit-aware shoot normalization', () => {
  it('retains revision, common areas, and duplicate catalog lines with separate ownership', () => {
    const shoot = transformShootFromApi({ id: 12, units_revision: 7, units: [{ id: 1, client_key: 'u1', label: '101', kind: 'unit', sqft: 900, beds: 1, baths: 1 }, { id: 2, client_key: 'u2', label: 'Lobby', kind: 'common_area', sqft: 200, beds: 0, baths: 0 }], service_lines: [
      { shoot_service_id: 90, service_id: 5, shoot_unit_id: 1, name: 'Photos', price: 150 },
      { shoot_service_id: 91, service_id: 5, shoot_unit_id: 2, name: 'Photos', price: 80, duration_minutes: 85, photographer_required: false, requires_editing: false },
    ] });
    expect(shoot.units_revision).toBe(7);
    expect(shoot.units?.[1].kind).toBe('common_area');
    expect(shoot.serviceItems).toHaveLength(2);
    expect(getUnitServiceLines(shoot, '2')[0]).toMatchObject({ shoot_service_id: '91', shoot_unit_id: 2, service_id: '5', price: 80, duration_minutes: 85, photographer_required: false, requires_editing: false });
    const projected = projectShootForUnit(shoot, '1');
    expect(projected.serviceItems).toHaveLength(1);
    expect(projected.propertyDetails?.sqft).toBe(900);
    expect(shoot.serviceItems).toHaveLength(2);
  });
  it('keeps a legacy single-property shoot untouched by projection', () => {
    const shoot = transformShootFromApi({ id: 15, service_items: [{ shoot_service_id: 20, service_id: 2, name: 'Photos' }] });
    expect(projectShootForUnit(shoot, null)).toBe(shoot);
  });
  it('keeps invoice adjustments in billing while canonical unit lines contain only booked services', () => {
    const booked = { shoot_service_id: 90, service_id: 5, shoot_unit_id: 1, name: 'Photos', price: 150 };
    const fee = { id: 'invoice-adjustment-1', source: 'invoice_adjustment', is_invoice_adjustment: true, name: 'Rush fee', price: 25, total_amount: 25 };
    const shoot = transformShootFromApi({ id: 12, serviceItems: [booked, fee], service_lines: [booked] });
    expect(shoot.serviceItems).toHaveLength(2);
    expect(shoot.serviceItems?.[1]).toMatchObject({ source: 'invoice_adjustment', price: 25 });
    expect(shoot.payment.invoiceAdjustmentsTotal).toBe(25);
    expect(shoot.service_lines).toEqual([expect.objectContaining({ shoot_service_id: '90', price: 150 })]);
    const legacyAlias = transformShootFromApi({ id: 12, service_lines: [booked, fee] });
    expect(legacyAlias.serviceItems).toHaveLength(2);
    expect(legacyAlias.service_lines).toHaveLength(1);
  });
});
