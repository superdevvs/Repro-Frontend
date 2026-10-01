import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { registerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';

export interface OverdueClient {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  balanceDue: number;
  oldestDays: number;
  shoots: {
    id: number;
    address: string;
    completedAt: string;
    daysSinceCompletion: number;
    balanceDue: number;
  }[];
}

interface OverdueClientsResponse {
  data: OverdueClient[];
  meta: { total: number; page: number; lastPage: number };
}

export function canViewOverdueClients(role: string) {
  return ['superadmin', 'salesrep', 'rep', 'representative'].includes(role.toLowerCase().replace(/[_-]/g, ''));
}

export function useOverdueClients(enabled: boolean, viewerScope: string) {
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState({ scope: viewerScope, page: 1 });
  const page = pagination.scope === viewerScope ? pagination.page : 1;
  const query = useQuery({
    queryKey: ['overdueClients', viewerScope, page],
    enabled,
    queryFn: async ({ signal }): Promise<OverdueClientsResponse> => {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/overdue-clients?page=${page}`, {
        headers: getApiHeaders(), signal,
      });
      if (!response.ok) throw new Error('Unable to load overdue clients. Please retry.');
      return response.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!enabled) return;
    return registerDashboardOverviewRefresh(() => {
      void queryClient.invalidateQueries({ queryKey: ['overdueClients', viewerScope] });
    });
  }, [enabled, queryClient, viewerScope]);

  return {
    clients: enabled ? query.data?.data ?? [] : [],
    total: enabled ? query.data?.meta.total ?? 0 : 0,
    page: enabled ? query.data?.meta.page ?? page : 1,
    lastPage: enabled ? query.data?.meta.lastPage ?? 1 : 1,
    loading: enabled && query.isLoading,
    error: enabled && query.error ? query.error.message : null,
    refresh: () => { if (enabled) void query.refetch(); },
    setPage: (next: number) => { if (enabled) setPagination({ scope: viewerScope, page: Math.max(1, next) }); },
  };
}

export type OverdueClientsState = ReturnType<typeof useOverdueClients>;
