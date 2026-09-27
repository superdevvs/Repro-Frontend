import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useUnitEditDirtyTracking, useUnitScopedEdit } from './useUnitScopedEdit';
import { getUnitVisitDefaults } from './shootUnitData';

describe('existing request unit edit adapter', () => {
  it('projects one unit but sends every untouched line with the concurrency revision', () => {
    const { result } = renderHook(() => useUnitScopedEdit());
    const raw = { id: 701, units_revision: 4, units: [
      { id: 1, client_key: 'u1', label: '101', kind: 'unit' as const, sqft: 900, beds: 1, baths: 1 },
      { id: 2, client_key: 'u2', label: '102', kind: 'unit' as const, sqft: 1600, beds: 3, baths: 2 },
    ], service_items: [{ shoot_service_id: 51, service_id: 5, shoot_unit_id: 1, name: 'Photos', price: 150, photographer_id: 8, scheduled_at: '2026-10-05 09:00:00' }, { shoot_service_id: 52, service_id: 5, shoot_unit_id: 2, name: 'Photos', price: 200, photographer_id: 9, scheduled_at: '2026-10-06 12:00:00' }] };
    let projected: typeof raw;
    act(() => { projected = result.current.projectFetched(raw); });
    expect(projected!.service_items).toHaveLength(1);
    expect(projected!).toMatchObject({ scheduled_at: '2026-10-05 09:00:00', time: '09:00', photographer_id: 8 });
    const payload = result.current.buildPayload({ service_items: [{ service_id: 5, photographer_id: 10, scheduled_at: '2026-10-05 11:00:00' }], property_details: { sqft: 1100, bedrooms: 2 }, sqft: 1100, photographer_id: 10, scheduled_at: '2026-10-05 11:00:00' });
    expect(payload.expected_units_revision).toBe(4);
    expect(payload).not.toHaveProperty('services');
    expect(payload).not.toHaveProperty('service_items');
    expect(payload).not.toHaveProperty('sqft');
    expect(payload).not.toHaveProperty('photographer_id');
    expect(payload).not.toHaveProperty('scheduled_at');
    expect(payload.service_lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ shoot_service_id: '52', shoot_unit_id: '2', service_id: '5', photographer_id: '9', scheduled_at: '2026-10-06 12:00:00' }),
      expect.objectContaining({ shoot_service_id: '51', shoot_unit_id: 1, service_id: '5', photographer_id: 10 }),
    ]));
    expect(payload.units).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1, sqft: 1100 }), expect.objectContaining({ id: 2, sqft: 1600 })]));
  });
  it('uses the selected unit visit and shoot timezone when adding work instead of the parent visit', () => {
    expect(getUnitVisitDefaults({ scheduled_at: '2026-10-05T13:00:00Z', photographer_id: 8, timezone: 'America/New_York', service_lines: [
      { shoot_unit_id: 1, scheduled_at: '2026-10-05T13:00:00Z', photographer_id: 8 },
      { shoot_unit_id: 2, scheduled_at: '2026-10-06T16:00:00Z', photographer_id: 9 },
    ] }, '2')).toMatchObject({ date: '2026-10-06', time: '12:00', photographerId: 9 });
  });
  it('locks switching after local edits and resets the baseline after loading another unit', () => {
    const { result, rerender } = renderHook(({ value, loading, unit }) => useUnitEditDirtyTracking(value, loading, unit), { initialProps: { value: 'first', loading: true, unit: '1' } });
    rerender({ value: 'first', loading: false, unit: '1' });
    rerender({ value: 'changed', loading: false, unit: '1' });
    expect(result.current).toBe(true);
    rerender({ value: 'changed', loading: true, unit: '2' });
    rerender({ value: 'second', loading: false, unit: '2' });
    rerender({ value: 'second', loading: false, unit: '2' });
    expect(result.current).toBe(false);
  });
});
