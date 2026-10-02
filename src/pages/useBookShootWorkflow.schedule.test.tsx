import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOOKING_FORM_CACHE_KEY } from '@/utils/bookingDraftReset';
import { useBookShootWorkflow } from './useBookShootWorkflow';
import { buildShootScheduleTimestamp, findServiceScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import { resolveServiceShootDuration } from '@/utils/shootDuration';
import { resolveUnitSchedule } from '@/features/shoot-units/model';

const mocks = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn(), navigate: vi.fn(), shoots: [] }));
vi.mock('axios', () => ({ default: { get: mocks.get } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/context/shootsContextState', () => ({
  useShoots: () => ({ shoots: mocks.shoots, addShoot: vi.fn(), fetchShoots: vi.fn() }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it('keeps the sales-rep photographer directory intact for independent service schedule checks', async () => {
  localStorage.setItem('authToken', 'test-token');
  mocks.get.mockImplementation(async (url: string) => ({ data: { data: url.includes('photographers')
    ? [{ id: 9, name: 'Morning photographer' }, { id: 10, name: 'Afternoon photographer' }] : [] } }));
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useBookShootWorkflow({
    user: { id: '1', role: 'rep' } as never, isClientAccount: false,
    clientIdFromUrl: null, clientNameFromUrl: null, clientCompanyFromUrl: null,
    editShootId: null, canAdjustBookingAmount: false,
  }));
  await waitFor(() => expect(result.current.photographers).toHaveLength(2));
  act(() => { result.current.setDate(new Date(2026, 9, 5)); result.current.setTime('09:00'); });
  expect(result.current.photographers.map(person => person.id)).toEqual(['9', '10']);
  // Schedule's duration-aware /for-booking request owns candidate filtering;
  // a second main-time lookup cannot discard tomorrow's/afternoon's candidates.
  expect(fetchMock).not.toHaveBeenCalled();
});

describe('editing a shoot request keeps its stored schedule', () => {
  it.each([
    { timezone: null, scheduled_at: '2026-09-09T10:00:00.000000Z' },
    { timezone: 'America/New_York', scheduled_at: '2026-09-09T14:00:00Z' },
  ])('initializes the order and service at 10 AM for $timezone', async (schedule) => {
    localStorage.setItem('authToken', 'test-token');
    mocks.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/services')) return { data: { data: [{ id: 19, name: 'Photography', price: 200, shoot_duration_minutes: 120 }] } };
      if (url.endsWith('/shoots/86')) return { data: { data: {
        id: 86, address: '7319 Golden Horseshoe Court', ...schedule,
        services: [{ id: 19, name: 'Photography' }],
        service_items: [{ id: 126, service_id: 19, scheduled_at: schedule.scheduled_at, duration_minutes: 30 }],
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
    expect(result.current.serviceSchedules['19']).toEqual({ date: '2026-09-09', time: '10:00', duration_minutes: 30 });
    expect(result.current.selectedServices[0].duration_minutes).toBe(30);
    expect(result.current.selectedServices[0].shoot_duration_minutes).toBe(120);
    const source = result.current.editingScheduleSource;
    const serviceSchedule = result.current.serviceSchedules['19'];
    expect(buildShootScheduleTimestamp(serviceSchedule.date, serviceSchedule.time, source?.timezone,
      findServiceScheduleTimestamp(source, '19'))).toBe(schedule.timezone
      ? '2026-09-09T14:00:00.000Z' : '2026-09-09T10:00:00');
  });
});

describe('booking catalogue duration mapping', () => {
  it.each([
    { label: 'stale catalogue default and tier', cached: { shoot_duration_minutes: 60, pricing_type: 'variable', sqft_ranges: [{ sqft_from: 1, sqft_to: 5000, duration: 60, price: 90 }] }, schedule: {} },
    { label: 'missing cached duration fields', cached: {}, schedule: {} },
    { label: 'previous manual schedule override', cached: { shoot_duration_minutes: 60 }, schedule: { duration_minutes: 83 } },
    { label: 'previous selected service snapshot', cached: { duration_minutes: 45, shoot_duration_minutes: 60 }, schedule: {} },
  ])('uses configured timing for a new draft with $label', async ({ cached, schedule }) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem(BOOKING_FORM_CACHE_KEY, JSON.stringify({ bookingQuantityVersion: 1,
      selectedServices: [{ id: '6', name: '10 Exterior HDR Photos', description: 'Saved draft', price: 90, quantity: 2, ...cached }],
      serviceSchedules: { '6': { date: '2026-10-02', time: '09:00', ...schedule } }, propertySqft: 2467,
      multiUnitDraft: { enabled: true, activeUnitKey: 'unit-1',
        units: [{ client_key: 'unit-1', label: 'Suite 1', sqft: 2467 }],
        lines: [{ client_key: 'line-1', unit_client_key: 'unit-1', service_id: '6', duration_minutes: 120,
          date: '2026-10-03', time: '11:00', photographer_id: '9', price: 90, quantity: 2 }],
        defaults: { '6': { duration_minutes: 83, date: '2026-10-02', time: '09:00', photographer_id: '8' } } },
    }));
    mocks.get.mockImplementation(async (url: string) => ({ data: { data: url.endsWith('/services') ? [
      { id: 6, name: '10 Exterior HDR Photos', price: 100, shoot_duration_minutes: 30, pricing_type: 'variable',
        sqft_ranges: [{ sqft_from: 1, sqft_to: 5000, duration: 30, price: 110 }], photographer_required: true },
    ] : [] } }));
    const { result } = renderHook(() => useBookShootWorkflow({ user: { id: '1', role: 'admin' } as never, isClientAccount: false,
      clientIdFromUrl: null, clientNameFromUrl: null, clientCompanyFromUrl: null, editShootId: null, canAdjustBookingAmount: false }));
    await waitFor(() => expect(result.current.packages).toHaveLength(1));
    await waitFor(() => expect(result.current.selectedServices[0]?.shoot_duration_minutes).toBe(30));
    for (const sqft of [1000, 2467]) {
      expect(resolveServiceShootDuration(result.current.selectedServices[0], sqft,
        result.current.serviceSchedules['6'].duration_minutes)).toBe(30);
    }
    expect(result.current.selectedServices[0]).toMatchObject({ price: 90, quantity: 2, description: 'Saved draft' });
    expect(result.current.serviceSchedules['6']).toEqual({ date: '2026-10-02', time: '09:00' });
    expect(result.current.selectedServices[0].duration_minutes).toBeUndefined();
    const units = result.current.multiUnitDraft;
    expect(units.defaults['6']).toEqual({ date: '2026-10-02', time: '09:00', photographer_id: '8' });
    expect(units.lines[0]).toEqual({ client_key: 'line-1', unit_client_key: 'unit-1', service_id: '6',
      date: '2026-10-03', time: '11:00', photographer_id: '9', price: 90, quantity: 2 });
    expect(resolveUnitSchedule(units, result.current.packages, {}).lines[0]).toMatchObject({
      scheduled_date: '2026-10-03', start_time: '11:00', end_time: '11:30', duration_minutes: 30,
    });
  });

  it('uses saved service defaults and matching tiers without interpreting delivery time as shoot length', async () => {
    mocks.get.mockImplementation(async (url: string) => ({ data: { data: url.endsWith('/services') ? [
      { id: 19, name: 'Photography', price: 200, delivery_time: 48, shoot_duration_minutes: 120 },
      { id: 21, name: 'Video', price: 300, shoot_duration_minutes: 150, pricing_type: 'variable',
        sqft_ranges: [{ sqft_from: 1, sqft_to: 2000, duration: 90 }] },
    ] : [] } }));
    const { result } = renderHook(() => useBookShootWorkflow({ user: null, isClientAccount: false,
      clientIdFromUrl: null, clientNameFromUrl: null, clientCompanyFromUrl: null,
      editShootId: null, canAdjustBookingAmount: false }));
    await waitFor(() => expect(result.current.packages).toHaveLength(2));
    expect(resolveServiceShootDuration(result.current.packages[0], 1000)).toBe(120);
    expect(resolveServiceShootDuration(result.current.packages[1], 1000)).toBe(90);
    expect(resolveServiceShootDuration(result.current.packages[1], 3000)).toBe(150);
  });
});

describe('booking service photographer-required flags', () => {
  it('restores photographer_required from the service catalog onto cached selections', async () => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem(BOOKING_FORM_CACHE_KEY, JSON.stringify({
      selectedServices: [
        { id: '19', name: 'Photography', price: 200 },
        { id: '21', name: 'Virtual Staging', price: 45 },
      ],
    }));
    mocks.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/services')) {
        return {
          data: {
            data: [
              { id: 19, name: 'Photography', price: 200, photographer_required: true },
              { id: 21, name: 'Virtual Staging', price: 45, photographer_required: false },
            ],
          },
        };
      }
      return { data: { data: [] } };
    });

    const { result } = renderHook(() => useBookShootWorkflow({
      user: { id: '1', role: 'admin' } as never, isClientAccount: false, clientIdFromUrl: null,
      clientNameFromUrl: null, clientCompanyFromUrl: null, editShootId: null,
      canAdjustBookingAmount: false,
    }));

    await waitFor(() => expect(result.current.packages).toHaveLength(2));
    await waitFor(() => {
      expect(result.current.selectedServices).toEqual([
        expect.objectContaining({ id: '19', photographer_required: true }),
        expect.objectContaining({ id: '21', photographer_required: false }),
      ]);
    });
  });
});
