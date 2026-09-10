import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBookShootWorkflow } from './useBookShootWorkflow';
import { buildShootScheduleTimestamp, findServiceScheduleTimestamp } from '@/utils/shootScheduleSubmission';

const mocks = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn(), navigate: vi.fn(), shoots: [] }));
vi.mock('axios', () => ({ default: { get: mocks.get } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/context/shootsContextState', () => ({
  useShoots: () => ({ shoots: mocks.shoots, addShoot: vi.fn(), fetchShoots: vi.fn() }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('editing a shoot request keeps its stored schedule', () => {
  it.each([
    { timezone: null, scheduled_at: '2026-09-09T10:00:00.000000Z' },
    { timezone: 'America/New_York', scheduled_at: '2026-09-09T14:00:00Z' },
  ])('initializes the order and service at 10 AM for $timezone', async (schedule) => {
    localStorage.setItem('authToken', 'test-token');
    mocks.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/services')) return { data: { data: [{ id: 19, name: 'Photography', price: 200 }] } };
      if (url.endsWith('/shoots/86')) return { data: { data: {
        id: 86, address: '7319 Golden Horseshoe Court', ...schedule,
        services: [{ id: 19, name: 'Photography' }],
        service_items: [{ id: 126, service_id: 19, scheduled_at: schedule.scheduled_at }],
      } } };
      return { data: { data: [] } };
    });
    const { result } = renderHook(() => useBookShootWorkflow({
      user: null, isClientAccount: false, clientIdFromUrl: null, clientNameFromUrl: null,
      clientCompanyFromUrl: null, editShootId: '86', canAdjustBookingAmount: false,
    }));
    await waitFor(() => expect(result.current.time).toBe('10:00 AM'));
    expect(result.current.date?.getFullYear()).toBe(2026);
    expect(result.current.date?.getMonth()).toBe(8);
    expect(result.current.date?.getDate()).toBe(9);
    expect(result.current.serviceSchedules['19']).toEqual({ date: '2026-09-09', time: '10:00' });
    const source = result.current.editingScheduleSource;
    const serviceSchedule = result.current.serviceSchedules['19'];
    expect(buildShootScheduleTimestamp(serviceSchedule.date, serviceSchedule.time, source?.timezone,
      findServiceScheduleTimestamp(source, '19'))).toBe(schedule.timezone
      ? '2026-09-09T14:00:00.000Z' : '2026-09-09T10:00:00');
  });
});
