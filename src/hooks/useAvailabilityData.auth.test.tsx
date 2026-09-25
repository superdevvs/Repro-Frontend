import React, { useState } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAvailabilityData } from './useAvailabilityData';
import { useSchedulingPhotographers } from '@/features/dashboard/hooks/useSchedulingPhotographers';

const date = new Date(2026, 8, 28);
const slot = { id: 11, photographer_id: 42, day_of_week: 'monday', date: null, start_time: '09:00', end_time: '17:00', status: 'available' };
const roster = [{ id: 42, name: 'New Photographer' }, { id: 43, name: 'Another Photographer' }];
const response = (data: unknown, ok = true) => ({ ok, json: async () => ({ data }) }) as Response;
function useCalendar() {
  const [selected, setSelected] = useState('all');
  return { ...useAvailabilityData({ selectedPhotographer: selected, setSelectedPhotographer: setSelected, date,
    viewMode: 'day', role: 'salesRep', userId: 7, isPhotographer: false,
    canManagePhotographerSelection: true, availabilitySessionScope: 'salesRep:7' }), setSelected };
}

describe('sales scheduling roster and authenticated calendars', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('token', 'legacy-token'); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('authenticates bulk fallback and individual calendar reads with the legacy token', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer legacy-token' });
      if (String(url).endsWith('/photographers')) return response(roster);
      if (String(url).endsWith('/bulk-index')) return response({}, false);
      if (String(url).endsWith('/booked-slots')) return response([]);
      return response([slot]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useCalendar);
    await waitFor(() => expect(result.current.allBackendSlots.length).toBeGreaterThan(0));
    expect(result.current.photographers.map((p) => p.id)).toEqual(['42', '43']);
    act(() => result.current.setSelected('42'));
    await waitFor(() => expect(result.current.backendSlots[0]?.id).toBe(11));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/availability/42'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer legacy-token' }) }));
  });

  it('loads all scheduling photographers independently of the rep shoot history', async () => {
    const fetchMock = vi.fn(async () => response(roster));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSchedulingPhotographers(true, 'salesRep:7'), { wrapper });
    await waitFor(() => expect(result.current.data?.map((p) => p.id)).toEqual([42, 43]));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/photographers$/), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer legacy-token' }) }));
    client.clear();
  });
});
