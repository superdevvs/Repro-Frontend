import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { fetchRequestedShoots } from './useRequestedShoots';
import { useDashboardDerivedData } from '@/hooks/useDashboardDerivedData';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: { get } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const request = (id: number) => ({
  id, status: 'requested', workflow_status: 'requested', address: `Request ${id}`,
  client: { id: id + 10, name: 'Unassigned client' },
});

describe('sales requested shoots', () => {
  it('loads every requested page and deduplicates requests across page changes', async () => {
    get.mockResolvedValueOnce({ data: { data: [request(1)], meta: { last_page: 2 } } });
    get.mockResolvedValueOnce({ data: { data: [request(1), request(2)], meta: { last_page: 2 } } });
    const shoots = await fetchRequestedShoots();
    expect(shoots.map((shoot) => String(shoot.id))).toEqual(['1', '2']);
    expect(get).toHaveBeenNthCalledWith(2, '/shoots', expect.objectContaining({
      params: expect.objectContaining({ scheduled_status: 'requested', page: 2 }),
    }));
  });

  it('does not hide requests outside a sales reps client or region scope', () => {
    const shoots = [mapShootApiToShootData(request(1))];
    const { result } = renderHook(() => useDashboardDerivedData({
      shoots, role: 'salesRep', user: { id: '99', name: 'Sales', email: 'sales@example.invalid', role: 'salesRep', metadata: { clientIds: ['999'] } },
    }));
    expect(result.current.requestedShoots).toHaveLength(1);
  });

  it('surfaces a failed requested page instead of presenting an incomplete queue', async () => {
    get.mockResolvedValueOnce({ data: { data: [request(1)], meta: { last_page: 2 } } });
    get.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(fetchRequestedShoots()).rejects.toThrow('Unavailable');
  });
});
