import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceScheduleMap } from '@/pages/bookShootModel';
import { useSchedulingBase } from './useSchedulingBase';

vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { role: 'client' } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
afterEach(cleanup);
describe('booking duration state', () => {
  it('keeps a duration-only edit linked to the main date/time and preserves it through service scheduling', () => {
    const date = new Date(2026, 9, 8);
    const photographers: [] = [];
    const { result, rerender } = renderHook(({ time }) => {
      const [serviceSchedules, setServiceSchedules] = useState<ServiceScheduleMap>({});
      return { serviceSchedules, ...useSchedulingBase({ date, photographers, time, serviceSchedules, setServiceSchedules }) };
    }, { initialProps: { time: '10:00' } });
    act(() => result.current.updateServiceSchedules(['10'], { duration_minutes: 30 }));
    expect(result.current.serviceSchedules).toEqual({ '10': { duration_minutes: 30 } });
    rerender({ time: '12:00' });
    expect(result.current.getServiceSchedule('10')).toMatchObject({ time: '12:00', duration_minutes: 30 });
    act(() => result.current.updateServiceSchedules(['10'], { time: '13:00' }));
    expect(result.current.getServiceSchedule('10')).toMatchObject({ time: '13:00', duration_minutes: 30 });
  });
});
