import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOKING_ELIGIBILITY_TIMEOUT_MS, useSchedulingFormController } from './useSchedulingFormController';
import type { SchedulingFormProps } from './schedulingModel';

const mocks = vi.hoisted(() => ({ role: 'client', getDayAvailability: vi.fn() }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/utils/availabilityProvider', () => ({ getDayAvailability: mocks.getDayAvailability }));
vi.mock('@/utils/distanceUtils', () => ({ getCoordinatesFromAddress: vi.fn().mockResolvedValue(null), calculateDistance: vi.fn() }));

beforeEach(() => { mocks.role = 'client'; mocks.getDayAvailability.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const eligibilityProps = (): SchedulingFormProps => ({
  enforceNewBookingEligibility: true,
  date: new Date('2026-10-05T12:00:00'), time: '10:00', address: '123 Test Street',
  city: 'Test City', state: 'VA', setDate: vi.fn(), setTime: vi.fn(),
  formErrors: {}, setFormErrors: vi.fn(), handleSubmit: vi.fn(), goBack: vi.fn(),
  photographer: '9', setPhotographer: vi.fn(),
  photographers: [{ id: '9', name: 'Pat' }, { id: '10', name: 'Alex' }],
  selectedServices: [{ id: '1', name: 'Photos', price: 100 }],
});

describe('per-service booking photographer availability', () => {
  it.each([
    { netSlots: [{ start_time: '09:00', end_time: '10:00' }, { start_time: '11:00', end_time: '12:00' }] },
    { netSlots: [] },
  ])('preserves authoritative net slots when staff configured hours are broader: $netSlots', async ({ netSlots }) => {
    mocks.role = 'admin';
    mocks.getDayAvailability.mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: url.includes('for-booking')
      ? [{ id: 9, name: 'Pat', availability_slots: [{ start_time: '09:00', end_time: '12:00' }], net_available_slots: netSlots }]
      : { '9': [{ date: '2026-10-05', day_of_week: 'monday', status: 'available', start_time: '09:00', end_time: '17:00' }] },
    }) })));
    const props = eligibilityProps();
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.photographersWithDistance).toHaveLength(1));
    expect(result.current.photographersWithDistance[0].netAvailableSlots).toEqual(netSlots);
    expect(result.current.photographersWithDistance[0].availabilitySlots).toEqual([{ start_time: '09:00', end_time: '12:00' }]);
    if (netSlots.length > 0) expect(result.current.isPhotographerTimeDisabled('9', '10:00')).toBe(true);
  });

  it.each([403, 422, 503])('blocks a new booking after eligibility HTTP %s and permits a successful retry', async status => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status })
      .mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 9, name: 'Pat' }] }) }));
    const props = eligibilityProps();
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    expect(result.current.bookingEligibilityError).toMatch(/Could not check/);
    expect(result.current.canConfirmPhotographer).toBe(false);
    act(() => result.current.handleSubmit());
    expect(props.handleSubmit).not.toHaveBeenCalled();
    act(() => result.current.retryBookingEligibility());
    await waitFor(() => expect(result.current.canConfirmPhotographer).toBe(true));
    act(() => result.current.handleSubmit());
    expect(props.handleSubmit).toHaveBeenCalledOnce();
  });

  it('keeps one day check through roster enrichment, time changes and equivalent date objects', async () => {
    mocks.role = 'admin';
    let finish!: (value: unknown) => void;
    mocks.getDayAvailability.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 9, name: 'Pat' }] }) })));
    const props = eligibilityProps();
    const { result, rerender } = renderHook(p => useSchedulingFormController(p), { initialProps: props });
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    expect(mocks.getDayAvailability).toHaveBeenCalledTimes(1);
    const signal = mocks.getDayAvailability.mock.calls[0][2] as AbortSignal;
    rerender({ ...props, time: '11:00', date: new Date('2026-10-05T00:00:00'), photographers: [...props.photographers!] });
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    expect(signal.aborted).toBe(false);
    expect(mocks.getDayAvailability).toHaveBeenCalledTimes(1);
    await act(async () => finish({ status: 'success', day: { workingHours: { start: '09:00', end: '17:00' }, blocked: [], fromConfig: true, timezone: 'America/New_York' } }));
    expect(result.current.availabilityPanel?.kind).toBe('success');
    rerender({ ...props, photographers: [{ id: '9', name: 'Pat updated' }] });
    expect(result.current.availabilityPanel?.kind).toBe('success');
    expect(mocks.getDayAvailability).toHaveBeenCalledTimes(1);
    rerender({ ...props, date: new Date('2026-10-06T12:00:00') });
    expect(signal.aborted).toBe(true);
    expect(result.current.dayAvailability).toBeNull();
    expect(result.current.availabilityPanel?.kind).toBe('loading');
    expect(mocks.getDayAvailability).toHaveBeenCalledTimes(2);
  });

  it('clears the previous photographer working hours while the new day check is pending', async () => {
    mocks.role = 'admin';
    mocks.getDayAvailability.mockImplementation((id: string) => id === '9'
      ? Promise.resolve({ status: 'success', day: { workingHours: { start: '09:00', end: '10:00' }, blocked: [], fromConfig: true, timezone: 'America/New_York' } })
      : new Promise(() => {}));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 9, name: 'Pat' }, { id: 10, name: 'Alex' }] }) })));
    const props = eligibilityProps();
    const { result, rerender } = renderHook(p => useSchedulingFormController(p), { initialProps: props });
    await waitFor(() => expect(result.current.dayAvailability?.workingHours?.end).toBe('10:00'));
    rerender({ ...props, photographer: '10' });
    expect(result.current.dayAvailability).toBeNull();
    expect(result.current.isPhotographerTimeDisabled('10', '12:00')).toBe(false);
  });

  it('ignores a pending day check after the selected photographer is cleared', async () => {
    mocks.role = 'admin';
    let finish!: (value: unknown) => void;
    mocks.getDayAvailability.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));
    const props = eligibilityProps();
    const { result, rerender } = renderHook(p => useSchedulingFormController(p), { initialProps: props });
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    rerender({ ...props, photographer: '' });
    await act(async () => finish({ status: 'success', day: { workingHours: { start: '09:00', end: '10:00' }, blocked: [], fromConfig: true, timezone: 'America/New_York' } }));
    expect(result.current.dayAvailability).toBeNull();
    expect(result.current.availabilityPanel).toBeNull();
  });

  it('updates suggested times and the API check when the duration changes within a one-hour opening', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({ ok: true, json: async () => ({ data: [{
      id: 9, name: 'Pat', availability_slots: [{ start_time: '12:00', end_time: '13:00' }],
      net_available_slots: [{ start_time: '12:00', end_time: '13:00' }],
    }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const props: SchedulingFormProps = { ...eligibilityProps(), time: '12:00',
      serviceSchedules: { '1': { duration_minutes: 90 } } };
    const { result, rerender } = renderHook(p => useSchedulingFormController(p), { initialProps: props });
    await waitFor(() => expect(result.current.photographersWithDistance).toHaveLength(1));
    expect(result.current.suggestedTimes).not.toContain('12:00 PM');
    expect(result.current.isPhotographerTimeDisabled('9', '12:00', '1')).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({ duration_minutes: 90 });
    rerender({ ...props, serviceSchedules: { '1': { duration_minutes: 30 } } });
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    expect(result.current.suggestedTimes).toContain('12:00 PM');
    expect(result.current.suggestedTimes).toContain('12:30 PM');
    rerender({ ...props, serviceSchedules: { '1': { duration_minutes: 60 } } });
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    expect(result.current.suggestedTimes).toContain('12:00 PM');
    expect(result.current.suggestedTimes).not.toContain('12:15 PM');
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({ duration_minutes: 60 });
  });

  it('uses each candidate duration for API requests and visible availability when moving a service', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { photographer_ids: number[] };
      return { ok: true, json: async () => ({ data: body.photographer_ids.map(id => ({ id, name: String(id), net_available_slots: [{ start_time: '10:00', end_time: '10:20' }] })) }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const props: SchedulingFormProps = { ...eligibilityProps(), selectedServices: [
      { id: '1', name: 'Photos', price: 100, shoot_duration_minutes: 15 }, { id: '2', name: 'Video', price: 100, shoot_duration_minutes: 30 },
    ], servicePhotographers: { '1': '9', '2': '9' } };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    act(() => { result.current.setActiveServiceForPicker('1'); result.current.setShowAllPhotographers(false); });
    await waitFor(() => expect(result.current.filteredAndSortedPhotographers.map(person => person.id)).toEqual(['10']));
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual(expect.arrayContaining([
      expect.objectContaining({ photographer_ids: [9], duration_minutes: 45 }), expect.objectContaining({ photographer_ids: [10], duration_minutes: 15 }),
    ]));
  });
  it('checks independent services with their own duration and their own selected date and time', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({ ok: true, json: async () => ({ data: [{
      id: 9, name: 'Pat', availability_slots: [{ start_time: '12:00', end_time: '13:00' }],
      net_available_slots: [{ start_time: '12:00', end_time: '13:00' }],
    }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const props: SchedulingFormProps = { ...eligibilityProps(), time: '12:00',
      selectedServices: [{ id: '1', name: 'Photos', price: 100 }, { id: '2', name: 'Video', price: 100 }],
      serviceSchedules: { '1': { duration_minutes: 30 }, '2': { date: '2026-10-06', time: '12:15', duration_minutes: 90 } },
    };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.photographersWithDistance).toHaveLength(1));
    expect(result.current.suggestedTimes).toContain('12:00 PM'); // Tomorrow's long visit does not lengthen today's work.
    act(() => result.current.setActiveServiceForPicker('2'));
    await waitFor(() => expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({
      date: '2026-10-06', time: '12:15', duration_minutes: 90,
    }));
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    expect(result.current.isPhotographerTimeDisabled('9', '12:00', '2')).toBe(true);
  });

  it('sums distinct same-slot services and does not trust a stale available flag over a short free range', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({ ok: true, json: async () => ({ data: [{
      id: 9, name: 'Pat', is_available_at_time: true,
      availability_slots: [{ start_time: '12:00', end_time: '13:00' }],
      net_available_slots: [{ start_time: '12:00', end_time: '13:00' }],
    }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const props: SchedulingFormProps = { ...eligibilityProps(), time: '12:00',
      selectedServices: [{ id: '1', name: 'Photos', price: 100 }, { id: '2', name: 'Video', price: 100 }],
      serviceSchedules: { '1': { duration_minutes: 30 }, '2': { duration_minutes: 90 } },
    };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({ duration_minutes: 120 });
    expect(result.current.suggestedTimes).not.toContain('12:00 PM');
    expect(result.current.isPhotographerTimeDisabled('9', '12:00', '1')).toBe(true);
    act(() => result.current.setShowAllPhotographers(false));
    expect(result.current.filteredAndSortedPhotographers).toHaveLength(0);
  });

  it.each([
    { topLevel: {}, expected: { travel_range: 80, travel_range_unit: 'km' } },
    { topLevel: { travel_range: 25, travel_range_unit: 'miles' }, expected: { travel_range: 25, travel_range_unit: 'miles' } },
  ])('uses metadata travel range only when top-level settings are absent: $topLevel', async ({ topLevel, expected }) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 9, name: 'Pat' }] }) })));
    const props: SchedulingFormProps = {
      ...eligibilityProps(),
      photographers: [{ id: '9', name: 'Pat', metadata: { travel_range: 80, travel_range_unit: 'km' }, ...topLevel }],
    };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.photographersWithDistance).toHaveLength(1));
    expect(result.current.photographersWithDistance[0]).toMatchObject(expected);
  });

  it('preserves existing edit and comp scheduling when retaining a now-excluded assignment', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));
    const props = { ...eligibilityProps(), enforceNewBookingEligibility: false };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.isCalculatingDistances).toBe(false));
    act(() => result.current.handleSubmit());
    expect(props.handleSubmit).toHaveBeenCalledOnce();
    expect(result.current.canConfirmPhotographer).toBe(false); // A new selection still needs eligibility.
  });
  it('checks custom service slots in the picker without rejecting another service using the global slot', async () => {
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body));
      const data = body.date === '2026-10-06' && body.time === '13:00' ? [{ id: 9, name: 'Pat' }] : [];
      return { ok: true, json: async () => ({ data }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const props: SchedulingFormProps = {
      ...eligibilityProps(),
      selectedServices: [{ id: '1', name: 'Photos', price: 100 }, { id: '2', name: 'Video', price: 100 }],
      servicePhotographers: { '1': '9', '2': '10' },
      serviceSchedules: { '1': { date: '2026-10-06', time: '13:00' }, '2': { date: '2026-10-07', time: '14:00' } },
    };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.isCalculatingDistances).toBe(false));
    act(() => result.current.handleSubmit());
    expect(props.handleSubmit).toHaveBeenCalledOnce(); // The final preflight verifies each custom slot.
    act(() => result.current.setActiveServiceForPicker('1'));
    await waitFor(() => expect(result.current.canConfirmPhotographer).toBe(true));
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({ date: '2026-10-06', time: '13:00' });
    await waitFor(() => expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['9']));
  });


  it('does not refetch bulk hours when booking eligibility already includes complete hours', async () => {
    mocks.role = 'admin';
    mocks.getDayAvailability.mockResolvedValue({ status: 'error' });
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ data: [{
      id: 9, name: 'Pat', availability_slots: [], net_available_slots: [],
    }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const props = eligibilityProps();
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.isLoadingAvailability).toBe(false));
    // The month-calendar request remains; no second, single-day enrichment request.
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('bulk-index'))).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => url.includes('for-booking'))).toBe(true);
    expect(result.current.photographersWithDistance[0].netAvailableSlots).toEqual([]);
  });

  it('unblocks Confirm with a retryable error when eligibility never resolves client-side', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        const signal = options?.signal;
        if (!signal) return;
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      })));
      const props = eligibilityProps();
      const { result } = renderHook(() => useSchedulingFormController(props));
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isLoadingAvailability).toBe(true);
      act(() => result.current.handleSubmit());
      expect(props.handleSubmit).not.toHaveBeenCalled();
      expect(props.setFormErrors).toHaveBeenCalledWith(expect.objectContaining({
        photographer: 'Please wait for the photographer eligibility check to finish.',
      }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(BOOKING_ELIGIBILITY_TIMEOUT_MS);
      });
      expect(result.current.isLoadingAvailability).toBe(false);
      expect(result.current.isCalculatingDistances).toBe(false);
      expect(result.current.bookingEligibilityError).toMatch(/timed out/);
      expect(result.current.canConfirmPhotographer).toBe(false);
      act(() => result.current.handleSubmit());
      expect(props.handleSubmit).not.toHaveBeenCalled();
      expect(props.setFormErrors).toHaveBeenCalledWith(expect.objectContaining({
        photographer: expect.stringMatching(/timed out/),
      }));
      vi.useRealTimers();
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 9, name: 'Pat' }] }) })));
      act(() => result.current.retryBookingEligibility());
      await waitFor(() => expect(result.current.canConfirmPhotographer).toBe(true));
      expect(result.current.bookingEligibilityError).toBeNull();
      act(() => result.current.handleSubmit());
      expect(props.handleSubmit).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('unblocks Confirm after for-booking before bulkIndex finishes', async () => {
    let resolveBulk: (value: Response) => void = () => {};
    const bulkPromise = new Promise<Response>((resolve) => { resolveBulk = resolve; });
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('bulk-index')) return bulkPromise;
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [{ id: 9, name: 'Pat', is_available_at_time: true, net_available_slots: [{ start_time: '09:00', end_time: '12:00' }] }] }),
      } as Response);
    }));
    const props = eligibilityProps();
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.canConfirmPhotographer).toBe(true));
    expect(result.current.isLoadingAvailability).toBe(false);
    expect(result.current.isCalculatingDistances).toBe(false);
    act(() => result.current.handleSubmit());
    expect(props.handleSubmit).toHaveBeenCalledOnce();
    resolveBulk({ ok: true, json: async () => ({ data: {} }) } as Response);
  });


  it('treats malformed success responses as failed checks with retry, not zero eligible photographers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) })));
    const props = eligibilityProps();
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.bookingEligibilityError).toMatch(/Could not check/));
    expect(result.current.canConfirmPhotographer).toBe(false);
  });
  it('blocks confirmation after a network failure and allows a successful eligibility retry', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 9, name: 'Pat' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const eligibilityPropsStable = eligibilityProps();
    const { result } = renderHook(() => useSchedulingFormController(eligibilityPropsStable));
    await waitFor(() => expect(result.current.bookingEligibilityError).toMatch(/Could not check/));
    expect(result.current.filteredAndSortedPhotographers).toEqual([]);
    expect(result.current.canConfirmPhotographer).toBe(false);
    act(() => result.current.handleSubmit());
    expect(eligibilityPropsStable.handleSubmit).not.toHaveBeenCalled();
    expect(eligibilityPropsStable.setFormErrors).toHaveBeenCalledWith(expect.objectContaining({ photographer: expect.stringMatching(/Could not check/) }));
    act(() => result.current.retryBookingEligibility());
    await waitFor(() => expect(result.current.canConfirmPhotographer).toBe(true));
    expect(result.current.bookingEligibilityError).toBeNull();
    await waitFor(() => expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['9']));
    act(() => result.current.handleSubmit());
    expect(eligibilityPropsStable.handleSubmit).toHaveBeenCalledOnce();
  });

  it('ignores an old parsed response when the booking address changes', async () => {
    let finishOld!: (data: unknown) => void;
    const oldJson = new Promise(resolve => { finishOld = resolve; });
    const firstJson = vi.fn(() => oldJson);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: firstJson })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 10, name: 'Alex' }] }) }));
    const props = eligibilityProps();
    const { result, rerender } = renderHook(p => useSchedulingFormController(p), { initialProps: props });
    await waitFor(() => expect(firstJson).toHaveBeenCalled());
    expect(result.current.canConfirmPhotographer).toBe(false);
    act(() => result.current.handleSubmit());
    expect(props.handleSubmit).not.toHaveBeenCalled();
    rerender({ ...props, address: '456 Changed Street' });
    await waitFor(() => expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['10']));
    await act(async () => finishOld({ data: [{ id: 9, name: 'Pat' }] }));
    await waitFor(() => expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['10']));
    expect(result.current.canConfirmPhotographer).toBe(false);
    act(() => result.current.handleSubmit());
    expect(props.handleSubmit).not.toHaveBeenCalled();
  });

  it.each([{ data: [] }, { data: [{ id: 9, name: 'Eligible specialist', has_availability: false, is_available_at_time: false }] }])(
    'does not restore API-excluded photographers when showing all: $data', async ({ data }) => {
      const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data }) }));
      vi.stubGlobal('fetch', fetchMock);
      const props: SchedulingFormProps = {
        date: new Date('2026-10-05T12:00:00'), time: '10:00', address: '123 Test Street',
        city: 'Test City', state: 'VA', setDate: vi.fn(), setTime: vi.fn(),
        formErrors: {}, setFormErrors: vi.fn(), handleSubmit: vi.fn(), goBack: vi.fn(),
        photographers: [{ id: '9', name: 'Eligible specialist' }, { id: '10', name: 'Outside service area' }],
        selectedServices: [{ id: '1', name: 'Photos', price: 100 }],
      };
      const { result } = renderHook(() => useSchedulingFormController(props));
      await waitFor(() => expect(result.current.isCalculatingDistances).toBe(false));
      expect(fetchMock).toHaveBeenCalled();
      expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(data.map(p => String(p.id)));
      act(() => result.current.setShowAllPhotographers(false));
      expect(result.current.filteredAndSortedPhotographers).toEqual([]);
      act(() => result.current.setShowAllPhotographers(true));
      expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(data.map(p => String(p.id)));
    },
  );

  it('hides client profile locations and cannot search by a hidden service-area label', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [
      { id: 9, name: 'Pat', distance: '12.4', service_area_label: 'Private area', has_availability: true },
    ] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const props: SchedulingFormProps = {
      date: new Date('2026-10-05T12:00:00'), time: '10:00', address: '123 Test Street',
      city: 'Test City', state: 'VA', setDate: vi.fn(), setTime: vi.fn(),
      formErrors: {}, setFormErrors: vi.fn(), handleSubmit: vi.fn(), goBack: vi.fn(),
      photographers: [{ id: '9', name: 'Pat', address: '99 Private Street', city: 'Private City', state: 'VA', zip: '00000' }],
      selectedServices: [{ id: '1', name: 'Photos', price: 100 }],
    };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.photographersWithDistance).toHaveLength(1));
    expect(result.current.showPhotographerAddress).toBe(false);
    expect(result.current.filteredAndSortedPhotographers[0]).toMatchObject({
      distance: 12.4, address: undefined, city: undefined, state: undefined, zip: undefined, serviceAreaLabel: undefined,
    });
    act(() => result.current.setSearchQuery('Private'));
    expect(result.current.filteredAndSortedPhotographers).toEqual([]);
    act(() => result.current.setSearchQuery('Pat'));
    expect(result.current.filteredAndSortedPhotographers).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // No protected availability routes for clients.
  });

  it('keeps specialists available without requiring each one to perform every service', async () => {
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      const request = JSON.parse(String(options?.body ?? '{}'));
      // The API defaults to matching ALL services when this flag is omitted.
      const data = request.require_all_services === false ? [
        { id: 9, name: 'Photo specialist', is_available_at_time: true, has_availability: true },
        { id: 10, name: 'Video specialist', is_available_at_time: true, has_availability: true },
      ].filter(person => request.photographer_ids.includes(person.id)) : [];
      return { ok: true, json: async () => ({ data }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const props: SchedulingFormProps = {
      date: new Date('2026-10-05T12:00:00'), time: '10:00', address: '123 Test Street',
      city: 'Test City', state: 'VA', zip: '22015',
      setDate: vi.fn(), setTime: vi.fn(), formErrors: {}, setFormErrors: vi.fn(),
      handleSubmit: vi.fn(), goBack: vi.fn(),
      photographer: '9',
      photographers: [
        { id: '9', name: 'Photo specialist', specialties: ['1'] },
        { id: '10', name: 'Video specialist', specialties: ['2'] },
      ],
      selectedServices: [
        { id: '1', name: 'HDR Photos', price: 100 },
        { id: '2', name: 'Video', price: 100 },
        { id: '3', name: 'Editing only', price: 25, photographer_required: false },
      ],
    };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.photographersWithDistance).toHaveLength(2));
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request).toMatchObject({ service_ids: [1, 2], require_all_services: false });
    act(() => result.current.setActiveServiceForPicker('1'));
    await waitFor(() => expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['9']));
    expect(result.current.canConfirmPhotographer).toBe(true);
    act(() => result.current.setActiveServiceForPicker('2'));
    await waitFor(() => expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['10']));
    expect(result.current.canConfirmPhotographer).toBe(false);
  });

  it('shows photographers without configured hours and preserves the availability filter and conflicts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [
      { id: 9, name: 'Pat', has_availability: false, is_available_at_time: false,
        booked_slots: [{ start_time: '10:00', end_time: '11:00' }] },
    ] }) })));
    const props: SchedulingFormProps = {
      date: new Date('2026-10-05T12:00:00'), time: '10:00', address: '123 Test Street',
      city: 'Test City', state: 'VA', setDate: vi.fn(), setTime: vi.fn(),
      formErrors: {}, setFormErrors: vi.fn(), handleSubmit: vi.fn(), goBack: vi.fn(),
      photographers: [{ id: '9', name: 'Pat' }],
      selectedServices: [{ id: '1', name: 'Photos', price: 100 }],
    };
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.photographersWithDistance).toHaveLength(1));
    await waitFor(() => expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['9']));
    expect(result.current.isPhotographerTimeDisabled('9', '10:30')).toBe(true);
    act(() => result.current.setShowAllPhotographers(false));
    expect(result.current.filteredAndSortedPhotographers).toEqual([]);
  });

  it('does not ask for a photographer when every selected service opts out', () => {
    const props: SchedulingFormProps = {
      date: new Date('2026-10-05T12:00:00'), time: '10:00', address: '123 Test Street',
      city: 'Test City', state: 'VA', zip: '22015',
      setDate: vi.fn(), setTime: vi.fn(), formErrors: {}, setFormErrors: vi.fn(),
      handleSubmit: vi.fn(), goBack: vi.fn(),
      photographers: [{ id: '9', name: 'Pat' }],
      selectedServices: [
        { id: '3', name: 'Editing only', price: 25, photographer_required: false },
        { id: '4', name: 'Virtual Staging', price: 45, photographer_required: false },
      ],
    };

    const { result } = renderHook(() => useSchedulingFormController(props));

    expect(result.current.requiresPhotographerAssignment).toBe(false);
    expect(result.current.assignmentGroups).toEqual([]);
  });

  it('requires a photographer when a selected service needs one', () => {
    const props: SchedulingFormProps = {
      date: new Date('2026-10-05T12:00:00'), time: '10:00', address: '123 Test Street',
      city: 'Test City', state: 'VA', zip: '22015',
      setDate: vi.fn(), setTime: vi.fn(), formErrors: {}, setFormErrors: vi.fn(),
      handleSubmit: vi.fn(), goBack: vi.fn(),
      photographers: [{ id: '9', name: 'Pat' }],
      selectedServices: [
        { id: '1', name: 'HDR Photos', price: 100, photographer_required: true },
        { id: '3', name: 'Editing only', price: 25, photographer_required: false },
      ],
    };

    const { result } = renderHook(() => useSchedulingFormController(props));

    expect(result.current.requiresPhotographerAssignment).toBe(true);
    expect(result.current.assignmentGroups.map((group) => group.serviceId)).toEqual(['1']);
  });
});
