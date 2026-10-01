import { describe, expect, it } from 'vitest';
import { resolveSelectedServiceSubtotal, type ServicePackage } from '@/pages/bookShootModel';
import { buildUnitPayload, copyMissingServices, emptyMultiUnitDraft, hydrateUnitDraft, makeUnitDraft, multiUnitErrors, resolveUnitSchedule, setUnitServices, summarizeUnitServices, unitServiceDuration, type MultiUnitDraft } from './model';
const catalog: ServicePackage[] = [
  { id: '1', name: 'Photos', description: '', price: 200, photographer_required: true, pricing_type: 'variable', sqft_ranges: [{ sqft_from: 1, sqft_to: 2000, price: 200, duration: 60, photographer_pay: 50 }, { sqft_from: 2001, sqft_to: 10000, price: 350, duration: 90, photographer_pay: 80 }] },
  { id: '2', name: 'Floor plan', description: '', price: 100, photographer_required: false },
];
function draft(count = 2): MultiUnitDraft {
  let value = { ...emptyMultiUnitDraft(), enabled: true, units: Array.from({ length: count }, (_, i) => makeUnitDraft({ client_key: `u${i}`, label: `${101 + i}`, sqft: i ? 2500 : 1000, beds: 2, baths: 2 })), activeUnitKey: 'u0' };
  value = setUnitServices(value, 'u0', ['1']);
  return value;
}
describe('multi-unit booking identity, pricing and occupied time', () => {
  it('uses explicit per-line durations for sequential blocks and the saved payload', () => {
    const value = copyMissingServices(draft(), 'u0', ['u1']);
    value.defaults['1'] = { duration_minutes: 120 };
    value.lines[0].duration_minutes = 30;
    const result = resolveUnitSchedule(value, catalog, { date: '2026-10-06', time: '09:00', photographer_id: '7' });
    expect(result.lines.map(line => [line.start_time, line.end_time])).toEqual([['09:00', '09:30'], ['09:30', '11:30']]);
    expect(buildUnitPayload(value, result.lines).service_lines.map(line => line.duration_minutes)).toEqual([30, 120]);
    expect(result.errors).toEqual([]);
  });
  it('changes quantities only in the active unit and prices each item without multiplying aggregate totals twice', () => {
    const original = setUnitServices(draft(), 'u0', [{ id: '1', quantity: 3 }]);
    const copied = copyMissingServices(original, 'u0', ['u1']);
    expect(copied.lines.map(line => line.quantity)).toEqual([3, 3]);
    const updated = setUnitServices(copied, 'u1', [{ id: '1', quantity: 2 }]);
    expect(updated.lines.map(line => line.quantity)).toEqual([3, 2]);
    const [summary] = summarizeUnitServices(updated, catalog);
    expect(summary).toMatchObject({ quantity: 5, price: 1300, total_price: 1300 });
    expect(resolveSelectedServiceSubtotal(summary, 1000)).toBe(1300);
    expect(copyMissingServices(updated, 'u0', ['u1']).lines).toEqual(updated.lines);
    const schedule = resolveUnitSchedule(updated, catalog, { date: '2026-10-06', time: '09:00', photographer_id: '7' });
    expect(schedule.totalMinutes).toBe(150);
    expect(buildUnitPayload(updated, schedule.lines).service_lines.map(line => line.quantity)).toEqual([3, 2]);
  });
  it('preserves independent saved quantities and unit prices when a booking is reopened', () => {
    const value = hydrateUnitDraft({ units: [{ id: 8, label: '101', kind: 'unit', sqft: 1000 }, { id: 9, label: '102', kind: 'unit', sqft: 2500 }], service_items: [
      { shoot_service_id: 50, service_id: 1, shoot_unit_id: 8, quantity: 2, price: 111 },
      { shoot_service_id: 51, service_id: 1, shoot_unit_id: 9, quantity: 4, price: 222 },
    ] });
    expect(value.lines.map(line => line.quantity)).toEqual([2, 4]);
    expect(summarizeUnitServices(value, catalog)[0]).toMatchObject({ quantity: 6, total_price: 1110 });
  });
  it('bulk adds missing services idempotently and reprices each destination without replacing snapshots or overrides', () => {
    const value = setUnitServices(draft(3), 'u1', ['1']);
    value.lines[1] = { ...value.lines[1], price: 275, date: '2026-10-09', time: '14:00', photographer_id: '9', shoot_service_id: 'line-5' };
    const copied = copyMissingServices(value, 'u0', ['u1', 'u2']);
    expect(copied.lines).toHaveLength(3);
    expect(copied.lines.find(line => line.unit_client_key === 'u1')).toEqual(value.lines[1]);
    expect(summarizeUnitServices(copied, catalog)[0].price).toBe(825);
    expect(copyMissingServices(copied, 'u0', ['u1', 'u2']).lines).toEqual(copied.lines);
  });
  it('uses separate line keys for repeated catalog services and retains identity when units are renamed/reordered', () => {
    const value = copyMissingServices(draft(), 'u0', ['u1']);
    const renamed = { ...value, units: [...value.units].reverse().map(unit => ({ ...unit, label: `Renamed ${unit.label}` })) };
    expect(new Set(renamed.lines.map(line => line.client_key)).size).toBe(2);
    expect(renamed.lines).toEqual(value.lines);
  });
  it('finds incomplete units outside the first page of a 100-unit roster', () => {
    const value = copyMissingServices(draft(100), 'u0', Array.from({ length: 99 }, (_, i) => `u${i + 1}`));
    value.units[98].sqft = null;
    expect(Object.keys(multiUnitErrors(value))).toEqual(['u98']);
  });
  it('creates sequential occupied blocks with own-unit tier duration, not one shared instant', () => {
    const value = copyMissingServices(draft(), 'u0', ['u1']);
    const result = resolveUnitSchedule(value, catalog, { date: '2026-10-06', time: '9:00 AM', photographer_id: '7' });
    expect(result.errors).toEqual([]);
    expect(result.lines.map(line => [line.start_time, line.end_time])).toEqual([['09:00', '10:00'], ['10:00', '11:30']]);
    expect(result.totalMinutes).toBe(150);
    const payload = buildUnitPayload(value, result.lines);
    expect(payload.service_lines.map(line => line.service_id)).toEqual(['1', '1']);
    expect(payload.service_lines.map(line => line.unit_client_key)).toEqual(['u0', 'u1']);
    expect(payload.service_lines.every(line => !('price' in line))).toBe(true);
  });
  it('rejects explicit overlaps and schedules that spill past midnight', () => {
    const value = copyMissingServices(draft(), 'u0', ['u1']);
    value.lines[1].time = '09:30';
    expect(resolveUnitSchedule(value, catalog, { date: '2026-10-06', time: '09:00', photographer_id: '7' }).errors.join()).toMatch(/overlaps/);
    value.lines[1].time = undefined;
    expect(resolveUnitSchedule(value, catalog, { date: '2026-10-06', time: '23:00', photographer_id: '7' }).errors.join()).toMatch(/midnight/);
  });
  it('independent dates and photographers have independent time cursors', () => {
    const value = copyMissingServices(draft(), 'u0', ['u1']);
    value.lines[1].photographer_id = '8';
    const result = resolveUnitSchedule(value, catalog, { date: '2026-10-06', time: '09:00', photographer_id: '7' });
    expect(result.lines.map(line => line.start_time)).toEqual(['09:00', '09:00']);
    expect(result.errors).toEqual([]);
  });
  it('matches backend duration precedence and configuration bounds, ignoring delivery time', () => {
    expect(unitServiceDuration({ ...catalog[0], shoot_duration_minutes: 40, delivery_time: 3 }, draft().units[1])).toBe(40);
    expect(unitServiceDuration({ ...catalog[1], delivery_time: 48 }, draft().units[0])).toBe(60);
    expect(unitServiceDuration({ ...catalog[0], shoot_duration_minutes: 400 }, draft().units[0])).toBe(240);
  });
  it('hydrates repeated persisted catalog services without collapsing unit ownership or snapshot prices', () => {
    const hydrated = hydrateUnitDraft({ units: [{ id: 8, label: '101', kind: 'unit', sqft: 900 }, { id: 9, label: 'Lobby', kind: 'common_area', sqft: 400 }], service_items: [{ shoot_service_id: 50, service_id: 1, shoot_unit_id: 8, price: 111, scheduled_at: '2026-10-06 09:00:00' }, { shoot_service_id: 51, service_id: 1, shoot_unit_id: 9, price: 222, scheduled_at: '2026-10-06 11:00:00' }] });
    expect(hydrated.lines).toHaveLength(2);
    expect(hydrated.lines.map(line => line.shoot_service_id)).toEqual([50, 51]);
    expect(hydrated.units[1].kind).toBe('common_area');
    expect(summarizeUnitServices(hydrated, catalog)[0].price).toBe(333);
    expect(hydrateUnitDraft({ services: [] }).enabled).toBe(false);
  });
});
