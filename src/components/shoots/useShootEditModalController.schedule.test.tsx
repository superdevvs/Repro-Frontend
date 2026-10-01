import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { useShootEditModalController } from './useShootEditModalController';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(), projectFetched: (shoot: unknown) => shoot, buildPayload: (payload: unknown) => payload,
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
vi.mock('@/features/shoot-units/useUnitScopedEdit', () => ({
  useUnitScopedEdit: () => ({ projectFetched: mocks.projectFetched, buildPayload: mocks.buildPayload }),
  useUnitEditDirtyTracking: () => false,
}));
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('./shootEditModalTypes', async (importOriginal) => ({
  ...await importOriginal<typeof import('./shootEditModalTypes')>(),
  loadPhotographerOptions: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  mocks.projectFetched = (shoot: unknown) => shoot;
  vi.mocked(axios.get).mockResolvedValue({ data: { data: [
    { id: 10, name: 'Photos', price: 100, photographer_required: false },
    { id: 11, name: 'Floorplan', price: 50, photographer_required: false },
  ] } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('editing the main shoot appointment', () => {
  it('hydrates unscheduled saved durations and tier defaults independently of timestamps', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [
      { id: 10, name: 'Photos', price: 100, photographer_required: true, shoot_duration_minutes: 180 },
      { id: 11, name: 'Floorplan', price: 50, photographer_required: true, pricing_type: 'variable', shoot_duration_minutes: 120,
        sqft_ranges: [{ sqft_from: 1, sqft_to: 2000, price: 50, duration: 90 }] },
      { id: 12, name: 'Video', price: 200, photographer_required: true, shoot_duration_minutes: 150 },
    ] } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
      id: 42, address: '42 Service Lane', scheduled_at: '2026-10-06T10:30:00', sqft: 1000,
      services: [{ id: 10, name: 'Photos' }, { id: 11, name: 'Floorplan' }, { id: 12, name: 'Video' }],
      service_items: [{ service_id: 10, name: 'Photos', duration_minutes: 30 }, { service_id: 11, name: 'Floorplan' },
        { service_id: 12, name: 'Video', scheduled_at: '2026-10-07T12:00:00' }],
    } }) }));
    const { result } = renderHook(() => useShootEditModalController({ isOpen: true, onClose: vi.fn(), shootId: '42' }));
    await waitFor(() => expect(result.current.selectedServiceIds.size).toBe(3));
    expect(result.current.serviceSchedules['10'].duration_minutes).toBe(30);
    expect(result.current.serviceSchedules['11'].duration_minutes).toBe(90);
    expect(result.current.serviceSchedules['12']).toEqual({ date: '2026-10-07', time: '12:00', duration_minutes: 150 });
    expect(result.current.buildApprovalPayload()?.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: 10, duration_minutes: 30 }),
      expect.objectContaining({ service_id: 11, duration_minutes: 90 }),
      expect.objectContaining({ service_id: 12, duration_minutes: 150 }),
    ]));
  });
  it('preserves booked30, edits duration independently, and sends it through both update aliases', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
      id: 42, address: '42 Service Lane', scheduled_at: '2026-10-06T10:30:00',
      service_items: [{ service_id: 10, name: 'Photos', scheduled_at: '2026-10-06T10:30:00', duration_minutes: 30 },
        { service_id: 11, name: 'Floorplan', scheduled_at: '2026-10-06T10:30:00', duration_minutes: 85 }],
    } }) }));
    const { result } = renderHook(() => useShootEditModalController({ isOpen: true, onClose: vi.fn(), shootId: '42' }));
    await waitFor(() => expect(result.current.selectedServiceIds.size).toBe(2));
    expect(result.current.serviceSchedules['10'].duration_minutes).toBe(30);
    act(() => result.current.updateServiceSchedule('11', 'duration_minutes', 120));
    act(() => result.current.setScheduledTime('12:00'));
    act(() => result.current.applyServiceScheduleToAll('10'));
    const payload = result.current.buildApprovalPayload();
    expect(payload?.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: 10, duration_minutes: 30, scheduled_at: '2026-10-06T12:00:00' }),
      expect.objectContaining({ service_id: 11, duration_minutes: 120, scheduled_at: '2026-10-06T12:00:00' }),
    ]));
    expect(payload?.services).toEqual(expect.arrayContaining([expect.objectContaining({ id: 11, duration_minutes: 120 })]));
  });
  it('reclassifies reused service IDs when switching units and reopening', async () => {
    const firstUnit = {
      id: 42, address: '42 Service Lane', scheduled_at: '2026-10-06T10:30:00', timezone: null,
      service_items: [
        { service_id: 10, name: 'Photos', scheduled_at: '2026-10-06T10:30:00' },
        { service_id: 11, name: 'Floorplan', scheduled_at: '2026-10-07T10:30:00' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: firstUnit }) }));
    const { result, rerender } = renderHook(({ isOpen }) => useShootEditModalController({ isOpen, onClose: vi.fn(), shootId: '42', onSaved: vi.fn() }), { initialProps: { isOpen: true } });
    await waitFor(() => expect(result.current.selectedServiceIds.size).toBe(2));
    act(() => result.current.updateServiceSchedule('10', 'time', '17:00'));
    rerender({ isOpen: false });
    rerender({ isOpen: true });
    await waitFor(() => expect(result.current.serviceSchedules['10']?.time).toBe('10:30'));
    act(() => result.current.setScheduledTime('12:00'));
    expect(result.current.serviceSchedules['10'].time).toBe('12:00');

    mocks.projectFetched = () => ({
      ...firstUnit, scheduled_at: '2026-10-08T09:00:00',
      service_items: [
        { service_id: 10, name: 'Photos', scheduled_at: '2026-10-09T09:00:00' },
        { service_id: 11, name: 'Floorplan', scheduled_at: '2026-10-08T09:00:00' },
      ],
    });
    rerender({ isOpen: true });
    await waitFor(() => expect(result.current.scheduledTime).toBe('09:00'));
    act(() => result.current.setScheduledTime('12:00'));
    expect(result.current.serviceSchedules).toEqual({
      '10': { date: '2026-10-09', time: '09:00', duration_minutes: 60 },
      '11': { date: '2026-10-08', time: '12:00', duration_minutes: 60 },
    });
    act(() => result.current.applyServiceScheduleToAll('10'));
    act(() => result.current.setScheduledTime('14:00'));
    expect(result.current.serviceSchedules).toEqual({
      '10': { date: '2026-10-09', time: '09:00', duration_minutes: 60 },
      '11': { date: '2026-10-09', time: '09:00', duration_minutes: 60 },
    });
  });

  it.each([
    { timezone: null, original: '2026-10-06T10:30:00.000000Z', separate: '2026-10-07T10:30:00.000000Z', expected: '2026-10-07T12:00:00', expectedSeparate: '2026-10-07T10:30:00' },
    { timezone: 'America/New_York', original: '2026-10-06T14:30:00Z', separate: '2026-10-07T14:30:00Z', expected: '2026-10-07T16:00:00.000Z', expectedSeparate: '2026-10-07T14:30:00.000Z' },
  ])('moves inherited services and preserves separate appointments in $timezone', async fixture => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
      id: 42, address: '42 Service Lane', scheduled_at: fixture.original, timezone: fixture.timezone,
      service_items: [
        { service_id: 10, name: 'Photos', scheduled_at: fixture.original },
        { service_id: 11, name: 'Floorplan', scheduled_at: fixture.separate },
      ],
    } }) }));
    const { result } = renderHook(() => useShootEditModalController({ isOpen: true, onClose: vi.fn(), shootId: '42', onSaved: vi.fn() }));
    await waitFor(() => expect(result.current.selectedServiceIds.size).toBe(2));
    expect(result.current.serviceSchedules).toEqual({
      '10': { date: '2026-10-06', time: '10:30', duration_minutes: 60 }, '11': { date: '2026-10-07', time: '10:30', duration_minutes: 60 },
    });
    act(() => {
      result.current.setScheduledDate(new Date(2026, 9, 7, 12));
      result.current.setScheduledTime('12:00');
    });
    expect(result.current.serviceSchedules['10']).toEqual({ date: '2026-10-07', time: '12:00', duration_minutes: 60 });
    expect(result.current.serviceSchedules['11']).toEqual({ date: '2026-10-07', time: '10:30', duration_minutes: 60 });
    const payload = result.current.buildApprovalPayload();
    expect(payload?.scheduled_at).toBe(fixture.expected);
    expect(payload?.service_items).toEqual([
      expect.objectContaining({ service_id: 10, scheduled_at: fixture.expected }),
      expect.objectContaining({ service_id: 11, scheduled_at: fixture.expectedSeparate }),
    ]);
    expect(payload?.services).toEqual([
      expect.objectContaining({ id: 10, scheduled_at: fixture.expected }),
      expect.objectContaining({ id: 11, scheduled_at: fixture.expectedSeparate }),
    ]);
    act(() => result.current.updateServiceSchedule('10', 'time', '14:00'));
    act(() => result.current.setScheduledTime('14:00'));
    act(() => result.current.setScheduledTime('13:00'));
    expect(result.current.serviceSchedules['10']).toEqual({ date: '2026-10-07', time: '14:00', duration_minutes: 60 });
    const explicitPayload = result.current.buildApprovalPayload();
    expect(explicitPayload?.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: 10, scheduled_at: fixture.timezone ? '2026-10-07T18:00:00.000Z' : '2026-10-07T14:00:00' }),
    ]));
  });
});
