import type { Dispatch, SetStateAction } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildUnitPayload, emptyMultiUnitDraft, makeUnitDraft, resolveUnitSchedule, type MultiUnitDraft } from '@/features/shoot-units/model';
import type { MultiUnitBookingController } from '@/features/shoot-units/useMultiUnitBooking';
import { buildBookingDurationAdjuster } from './bookShootDurationAdjustment';
import type { ServicePackage, ServiceScheduleMap } from './bookShootModel';

const catalog: ServicePackage[] = [
  { id: '6', name: '10 Exterior HDR Photos', description: '', price: 100, photographer_required: true,
    shoot_duration_minutes: 30, booking_duration_defaults: { default_minutes: 30, min_minutes: 5, max_minutes: 300 } },
  { id: '8', name: 'Video', description: '', price: 200, photographer_required: true, shoot_duration_minutes: 60 },
  { id: '90', name: 'Digital editing', description: '', price: 25, photographer_required: false, shoot_duration_minutes: 0 },
];
const fallback = { date: '2026-10-06', time: '09:00', photographer_id: '1104' };

function state<T>(initial: T) {
  let current = initial;
  const set: Dispatch<SetStateAction<T>> = vi.fn(next => {
    current = typeof next === 'function' ? (next as (previous: T) => T)(current) : next;
  });
  return { get: () => current, set };
}

function fixture(draft: MultiUnitDraft = emptyMultiUnitDraft(), services = catalog) {
  const schedules = state<ServiceScheduleMap>({
    '6': { date: '2026-10-06', time: '09:00', duration_minutes: 30 },
    '8': { date: '2026-10-07', time: '13:00', duration_minutes: 60 },
  });
  const unitState = state(draft);
  const units = { enabled: draft.enabled, draft, setDraft: unitState.set, catalog: services,
    schedule: resolveUnitSchedule(draft, services, fallback) } as MultiUnitBookingController;
  const options: Parameters<typeof buildBookingDurationAdjuster>[0] = {
    role: 'admin', impersonating: false, canOverride: true, services, sqft: 2467,
    schedules: schedules.get(), setSchedules: schedules.set, units, onApplied: vi.fn(),
  };
  return { options, schedules, unitState };
}

describe('booking duration changes from the authorized travel warning', () => {
  it('permits supported admin and rep aliases only with server override permission', () => {
    for (const role of ['admin', 'superadmin', 'super_admin', 'salesRep', 'SALES_REP', 'rep']) {
      const { options } = fixture();
      expect(buildBookingDurationAdjuster({ ...options, role })?.items.map(item => item.key)).toEqual(['6', '8']);
      expect(buildBookingDurationAdjuster({ ...options, role, canOverride: false })).toBeUndefined();
      expect(buildBookingDurationAdjuster({ ...options, role, impersonating: true })).toBeUndefined();
    }
  });

  it('does not give clients or other staff duration controls even with a forged positive UI permission', () => {
    for (const role of ['client', 'photographer', 'editor', 'editing_manager', undefined]) {
      const { options } = fixture();
      expect(buildBookingDurationAdjuster({ ...options, role })).toBeUndefined();
    }
    const { options } = fixture(emptyMultiUnitDraft(), [catalog[2]]);
    expect(buildBookingDurationAdjuster(options)).toBeUndefined();
  });

  it.each([0, 4, 301, 17.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid duration %s without changing draft state', minutes => {
    const { options, schedules, unitState } = fixture();
    const before = schedules.get();
    buildBookingDurationAdjuster(options)!.onApply({ '6': minutes });
    expect(schedules.get()).toBe(before);
    expect(schedules.set).not.toHaveBeenCalled();
    expect(unitState.set).not.toHaveBeenCalled();
    expect(options.onApplied).not.toHaveBeenCalled();
  });

  it('rejects unknown, digital, unchanged, or partly invalid batches atomically', () => {
    for (const changes of [{}, { '6': 30 }, { missing: 17 }, { '90': 17 }, { '6': 17, '8': 4 }]) {
      const { options, schedules } = fixture();
      buildBookingDurationAdjuster(options)!.onApply(changes);
      expect(schedules.set).not.toHaveBeenCalled();
      expect(options.onApplied).not.toHaveBeenCalled();
    }
  });

  it('accepts exact whole-minute values including both configured boundaries', () => {
    for (const minutes of [5, 17, 300]) {
      const { options, schedules } = fixture();
      buildBookingDurationAdjuster(options)!.onApply({ '6': minutes });
      expect(schedules.get()['6'].duration_minutes).toBe(minutes);
      expect(options.onApplied).toHaveBeenCalledTimes(1);
    }
  });

  it('honors duration bounds supplied by the selected service catalog', () => {
    const services = [{ ...catalog[0], booking_duration_defaults: { default_minutes: 30, min_minutes: 15, max_minutes: 90 } }];
    const { options, schedules } = fixture(emptyMultiUnitDraft(), services);
    const adjuster = buildBookingDurationAdjuster(options)!;
    expect(adjuster.items[0]).toMatchObject({ currentMinutes: 30, minMinutes: 15, maxMinutes: 90 });
    adjuster.onApply({ '6': 10 });
    adjuster.onApply({ '6': 91 });
    expect(schedules.set).not.toHaveBeenCalled();
    adjuster.onApply({ '6': 17 });
    expect(schedules.get()['6'].duration_minutes).toBe(17);
  });

  it('preserves the latest flat dates, times, unrelated services, and catalog values', () => {
    const { options, schedules, unitState } = fixture();
    const originalCatalog = structuredClone(options.services);
    const adjuster = buildBookingDurationAdjuster(options)!;
    const latest = { ...schedules.get(), '6': { date: '2026-10-08', time: '11:45', duration_minutes: 30 },
      another: { date: '2026-10-09', time: '15:00', duration_minutes: 45 } };
    schedules.set(latest);
    adjuster.onApply({ '6': 17 });
    expect(schedules.get()).toEqual({ ...latest, '6': { ...latest['6'], duration_minutes: 17 } });
    expect(schedules.get()['8']).toBe(latest['8']);
    expect(schedules.get().another).toBe(latest.another);
    expect(options.services).toEqual(originalCatalog);
    expect(unitState.set).not.toHaveBeenCalled();
    expect(options.onApplied).toHaveBeenCalledTimes(1);
  });

  it('changes one exact unit line and resequences inherited starts without touching other lines or assignments', () => {
    const draft: MultiUnitDraft = { ...emptyMultiUnitDraft(), enabled: true, activeUnitKey: 'u333',
      units: [makeUnitDraft({ client_key: 'u333', label: '333', sqft: 1000 }),
        makeUnitDraft({ client_key: 'u206', label: '206', sqft: 1200 }),
        makeUnitDraft({ client_key: 'u400', label: '400', sqft: 1500 })],
      lines: [
        { client_key: 'u333:6', unit_client_key: 'u333', service_id: '6', price: 95, quantity: 1 },
        { client_key: 'u333:90', unit_client_key: 'u333', service_id: '90', price: 20, quantity: 2 },
        { client_key: 'u206:6', unit_client_key: 'u206', service_id: '6', price: 90, quantity: 2 },
        { client_key: 'u400:8', unit_client_key: 'u400', service_id: '8', date: '2026-10-07', time: '13:00', photographer_id: '1136', duration_minutes: 45 },
      ] };
    const { options, unitState, schedules } = fixture(draft);
    const adjuster = buildBookingDurationAdjuster(options)!;
    expect(adjuster.items.map(item => item.key)).toEqual(['u333:6', 'u206:6', 'u400:8']);
    expect(adjuster.items[0]).toMatchObject({ name: '10 Exterior HDR Photos · 333', currentMinutes: 30 });
    expect(options.units.schedule.lines.find(line => line.client_key === 'u206:6')?.start_time).toBe('09:30');
    adjuster.onApply({ 'u333:6': 17 });
    const updated = unitState.get();
    expect(updated.lines[0]).toEqual({ ...draft.lines[0], duration_minutes: 17 });
    for (const index of [1, 2, 3]) expect(updated.lines[index]).toBe(draft.lines[index]);
    expect(updated.units).toBe(draft.units);
    expect(updated.defaults).toBe(draft.defaults);
    const resolved = resolveUnitSchedule(updated, catalog, fallback);
    expect(resolved.errors).toEqual([]);
    expect(resolved.lines.find(line => line.client_key === 'u333:6')).toMatchObject({ start_time: '09:00', end_time: '09:17', duration: 17, photographer_id: '1104' });
    expect(resolved.lines.find(line => line.client_key === 'u206:6')).toMatchObject({ start_time: '09:17', end_time: '09:47', duration: 30, quantity: 2 });
    expect(resolved.lines.find(line => line.client_key === 'u400:8')).toMatchObject({ scheduled_date: '2026-10-07', start_time: '13:00', end_time: '13:45', photographer_id: '1136', duration: 45 });
    const payload = buildUnitPayload(updated, resolved.lines, 'America/New_York');
    expect(payload.service_lines.map(line => line.duration_minutes)).toEqual([17, 0, 30, 45]);
    expect(payload.service_lines[2]).toMatchObject({ client_key: 'u206:6', unit_client_key: 'u206', service_id: '6', quantity: 2 });
    expect(schedules.set).not.toHaveBeenCalled();
    expect(options.onApplied).toHaveBeenCalledTimes(1);
  });
});
