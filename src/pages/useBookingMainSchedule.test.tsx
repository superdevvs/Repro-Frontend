import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBookingMainSchedule } from './useBookingMainSchedule';
import { useBookingTravel } from '@/features/travel/useBookingTravel';
import type { ServiceScheduleMap } from './bookShootModel';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    const payload = JSON.parse(String(init.body));
    const conflict = payload.service_items[0].scheduled_at.startsWith('2026-10-09');
    return new Response(JSON.stringify({ data: { enabled: true, available: !conflict,
      status: conflict ? 'conflict' : 'available', reason_codes: conflict ? ['capture_overlap'] : [] } }));
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function useHarness(initial: ServiceScheduleMap, multiple = false, multiUnit = false) {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 13, 12));
  const [time, setTime] = useState('12:00 PM');
  const [serviceSchedules, setServiceSchedules] = useState(initial);
  const selectedServices = [{ id: '84', name: 'Photos', description: '', price: 100, shoot_duration_minutes: 135 },
    ...(multiple ? [{ id: '85', name: 'Video', description: '', price: 100, shoot_duration_minutes: 60 }] : [])];
  const schedule = useBookingMainSchedule({ date, time, setDate, setTime, setServiceSchedules, selectedServices, multiUnit });
  const travel = useBookingTravel({ active: true, requestedOnly: false, address: '1 Main St', city: 'Baltimore',
    state: 'MD', zip: '21201', date, time, photographer: '9', propertyDetails: {},
    selectedServices, servicePhotographers: {}, serviceSchedules });
  return { ...schedule, date, time, serviceSchedules, travel };
}
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(350); });

it('moves a restored stale single-service date through Oct 10, 11, 13 and back to the real conflict on Oct 9', async () => {
  const { result } = renderHook(() => useHarness({ '84': { date: '2026-10-09', time: '', duration_minutes: 135 } }));
  await settle();
  expect(result.current.travel.result?.available).toBe(false);
  for (const day of [10, 11, 13, 9]) {
    act(() => result.current.setDate(new Date(2026, 9, day, 12)));
    expect(result.current.travel.result).toBeNull(); // Old conflict is immediately invalidated.
    expect(result.current.travel.loading).toBe(true);
    await settle();
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body));
    const expected = `2026-10-${String(day).padStart(2, '0')}T16:00:00.000Z`;
    expect(body.scheduled_at).toBe(expected);
    expect(body.service_items[0].scheduled_at).toBe(expected);
    expect(result.current.travel.result?.available).toBe(day !== 9);
    expect(result.current.serviceSchedules['84'].duration_minutes).toBe(135);
  }
});

it('moves single-service time overrides with the main time control', async () => {
  const { result } = renderHook(() => useHarness({ '84': { time: '09:00', duration_minutes: 40 } }));
  act(() => result.current.setTime('2:30 PM'));
  await settle();
  expect(result.current.travel.payload?.service_items?.[0].scheduled_at).toBe('2026-10-13T18:30:00.000Z');
  expect(result.current.serviceSchedules['84']).toEqual({ duration_minutes: 40 });
});

it('moves linked services but preserves independent appointments even on the same original date', async () => {
  const { result } = renderHook(() => useHarness({
    '84': { date: '2026-10-13', time: '12:00', duration_minutes: 30 },
    '85': { date: '2026-10-13', time: '15:00', duration_minutes: 60 },
  }, true));
  act(() => result.current.setDate(new Date(2026, 9, 14, 12)));
  act(() => result.current.setTime('1:00 PM'));
  await settle();
  expect((result.current.travel.payload?.service_items as Array<{ scheduled_at: string }>).map(item => item.scheduled_at)).toEqual([
    '2026-10-14T17:00:00.000Z', '2026-10-13T19:00:00.000Z',
  ]);
});

it('leaves multi-unit schedule overrides to their own controls', () => {
  const initial = { '84': { date: '2026-10-09', time: '09:00' } };
  const { result } = renderHook(() => useHarness(initial, false, true));
  act(() => result.current.setDate(new Date(2026, 9, 14, 12)));
  act(() => result.current.setTime('1:00 PM'));
  expect(result.current.serviceSchedules).toEqual(initial);
});
