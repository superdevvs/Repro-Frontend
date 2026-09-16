import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSchedulingFormController } from './useSchedulingFormController';
import type { SchedulingFormProps } from './schedulingModel';

vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { role: 'client' } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('per-service booking photographer availability', () => {
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
    act(() => result.current.setActiveServiceForPicker('2'));
    expect(result.current.filteredAndSortedPhotographers.map(p => p.id)).toEqual(['10']);
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
