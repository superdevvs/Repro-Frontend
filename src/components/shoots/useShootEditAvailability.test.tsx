import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { getDayAvailability } from '@/utils/availabilityProvider';
import { useShootEditAvailability } from './useShootEditAvailability';

vi.mock('@/utils/availabilityProvider', () => ({ getDayAvailability: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const day = (start: string, end: string) => ({ status: 'success' as const, day: {
  workingHours: { start: '09:00', end: '18:00' }, blocked: [{ start, end }], fromConfig: true, timezone: 'America/New_York',
} });
it('drops old-assignee restrictions and ignores a late result after reassignment', async () => {
  let finish!: (value: ReturnType<typeof day>) => void;
  vi.mocked(getDayAvailability).mockImplementation(id => id === 'Paul' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(day('10:00', '11:00')));
  const { result, rerender } = renderHook(({ photographerId }) => useShootEditAvailability(true, '2505', [
    { serviceId: '2', photographerId, date: '2026-10-21' }, { serviceId: '81', photographerId, date: '2026-10-21' },
  ]), { initialProps: { photographerId: 'Paul' } });
  expect(getDayAvailability).toHaveBeenCalledTimes(1);
  rerender({ photographerId: 'Jaz' });
  await waitFor(() => expect(result.current('10:30', '2')).toBe(true));
  expect(result.current('15:00', '81')).toBe(false);
  await act(async () => finish(day('13:45', '15:45')));
  expect(result.current('15:00', '81')).toBe(false);
  expect(getDayAvailability).toHaveBeenLastCalledWith('Jaz', expect.any(Date), expect.any(AbortSignal), '2505');
});
it('uses each service date and assignee and combines only the main appointment constraints', async () => {
  vi.mocked(getDayAvailability).mockImplementation(id => Promise.resolve(id === 'A' ? day('10:00', '11:00') : day('15:00', '16:00')));
  const { result } = renderHook(() => useShootEditAvailability(true, '42', [
    { serviceId: 'photo', photographerId: 'A', date: '2026-10-21' },
    { serviceId: 'video', photographerId: 'B', date: '2026-10-22', followsMain: false },
  ]));
  await waitFor(() => expect(result.current('15:30', 'video')).toBe(true));
  expect(result.current('15:30', 'photo')).toBe(false);
  expect(result.current('10:30', 'video')).toBe(false);
  expect(result.current('10:30')).toBe(true);
  expect(result.current('15:30')).toBe(false);
  expect(vi.mocked(getDayAvailability).mock.calls[1][1].getDate()).toBe(22);
});
