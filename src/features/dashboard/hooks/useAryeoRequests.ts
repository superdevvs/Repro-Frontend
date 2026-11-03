import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { registerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';

export interface AryeoInboxRequest {
  id: number;
  address: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  receivedAt: string;
  required: Record<string, number> | null;
  status: string;
  providerCheckedAt: string | null;
  shoot: { id: number; address: string; clientName: string | null; scheduledDate: string | null; workflowStatus: string } | null;
}

interface AryeoInboxResponse {
  data: AryeoInboxRequest[];
  meta: { total: number; pendingCount: number; page: number; lastPage: number };
  connections: { id: number; name: string; online: boolean; lastSeenAt: string | null; processingEnabled: boolean; executorReady: boolean }[];
}

export function canViewAryeoRequests(role: string) {
  return ['admin', 'superadmin', 'editingmanager', 'salesrep', 'rep', 'representative'].includes(role.toLowerCase().replace(/[_\s-]/g, ''));
}

export function useAryeoRequests(enabled: boolean, viewerScope: string) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState({ scope: viewerScope, page: 1, history: false });
  const { page, history } = selection.scope === viewerScope ? selection : { page: 1, history: false };
  const query = useQuery({
    queryKey: ['aryeoRequests', viewerScope, page, history],
    enabled,
    queryFn: async ({ signal }): Promise<AryeoInboxResponse> => {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/aryeo-requests?page=${page}&history=${history ? 1 : 0}`, {
        headers: getApiHeaders(), signal,
      });
      if (!response.ok) throw new Error('Unable to load Aryeo requests. Please retry.');
      return response.json();
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (!enabled) return;
    return registerDashboardOverviewRefresh(() => {
      void queryClient.invalidateQueries({ queryKey: ['aryeoRequests', viewerScope] });
    });
  }, [enabled, queryClient, viewerScope]);

  return {
    requests: enabled ? query.data?.data ?? [] : [],
    pendingCount: enabled ? query.data?.meta.pendingCount ?? 0 : 0,
    total: enabled ? query.data?.meta.total ?? 0 : 0,
    page: enabled ? query.data?.meta.page ?? page : 1,
    lastPage: enabled ? query.data?.meta.lastPage ?? 1 : 1,
    connections: enabled ? query.data?.connections ?? [] : [],
    loading: enabled && query.isLoading,
    error: enabled && query.error ? query.error.message : null,
    history,
    refresh: () => { if (enabled) void query.refetch(); },
    setPage: (next: number) => { if (enabled) setSelection({ scope: viewerScope, history, page: Math.max(1, next) }); },
    setHistory: (next: boolean) => { if (enabled) setSelection({ scope: viewerScope, history: next, page: 1 }); },
  };
}

export type AryeoRequestsState = ReturnType<typeof useAryeoRequests>;
