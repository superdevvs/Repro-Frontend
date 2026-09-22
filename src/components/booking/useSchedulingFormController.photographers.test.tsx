import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSchedulingFormController } from './useSchedulingFormController';
import type { SchedulingFormProps } from './schedulingModel';

vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { role: 'client' } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

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
    expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['9']);
  });

  it('treats malformed success responses as failed checks with retry, not zero eligible photographers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) })));
    const props = eligibilityProps();
    const { result } = renderHook(() => useSchedulingFormController(props));
    await waitFor(() => expect(result.current.bookingEligibilityError).toMatch(/Could not check/));
    expect(result.current.canConfirmPhotographer).toBe(false);
  });
  it('blocks confirmation after a failed eligibility check and allows a successful retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
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
    expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['9']);
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
    expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['10']);
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
      ] : [];
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
    expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['9']);
    expect(result.current.canConfirmPhotographer).toBe(true);
    act(() => result.current.setActiveServiceForPicker('2'));
    expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['10']);
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
    expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['9']);
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
