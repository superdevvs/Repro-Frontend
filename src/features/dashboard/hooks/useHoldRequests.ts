import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/utils/authToken';
import { useToast } from '@/hooks/use-toast';
import { useShootMutationRefresh } from '@/hooks/useShootMutationRefresh';
import { registerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';

export interface HoldRequest {
  id: number;
  address: string;
  clientName?: string;
  reason?: string;
}

type HoldRequestResponse = {
  id: string | number;
  location?: { fullAddress?: string; address?: string };
  address?: string;
  client?: { name?: string };
  holdReason?: string;
  hold_reason?: string;
};

const headers = () => ({ Authorization: `Bearer ${getAuthToken()}`, Accept: 'application/json' });

export function useHoldRequests(enabled: boolean, viewerScope: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const refreshShoot = useShootMutationRefresh();
  const queryKey = ['pendingHoldRequests', viewerScope];
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal }): Promise<HoldRequest[]> => {
      const response = await fetch(`${API_BASE_URL}/api/shoots/pending-holds`, { headers: headers(), signal });
      if (!response.ok) throw new Error('Unable to load hold requests. Please retry.');
      const json = await response.json();
      return (Array.isArray(json.data) ? json.data : []).map((item: HoldRequestResponse) => ({
        id: Number(item.id),
        address: item.location?.fullAddress || item.location?.address || item.address || `Shoot #${item.id}`,
        clientName: item.client?.name,
        reason: item.holdReason || item.hold_reason,
      }));
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!enabled) return;
    return registerDashboardOverviewRefresh(() => {
      void queryClient.invalidateQueries({ queryKey: ['pendingHoldRequests', viewerScope] });
    });
  }, [enabled, queryClient, viewerScope]);

  const mutation = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: 'approve' | 'reject' }) => {
      const response = await fetch(`${API_BASE_URL}/api/shoots/${id}/${decision}-hold`, {
        method: 'POST', headers: headers(),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Unable to update the hold request.');
      }
    },
    onSuccess: (_, { id, decision }) => {
      queryClient.setQueryData<HoldRequest[]>(queryKey, (items) => items?.filter((item) => item.id !== id));
      void queryClient.invalidateQueries({ queryKey: ['pendingHoldRequests'] });
      refreshShoot(id);
      toast({ title: decision === 'approve' ? 'Shoot placed on hold' : 'Hold request rejected' });
    },
    onError: (error) => toast({ title: 'Unable to update hold request', description: error.message, variant: 'destructive' }),
  });

  return {
    shoots: enabled ? query.data ?? [] : [],
    loading: enabled && query.isLoading,
    error: enabled && query.error ? query.error.message : null,
    refresh: () => { void query.refetch(); },
    decide: (id: number, decision: 'approve' | 'reject') => mutation.mutate({ id, decision }),
    actioning: mutation.isPending ? mutation.variables.id : null,
  };
}

export type HoldRequestsState = ReturnType<typeof useHoldRequests>;
