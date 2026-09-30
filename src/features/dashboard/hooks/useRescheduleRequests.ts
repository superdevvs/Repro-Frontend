import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/utils/authToken';
import { useToast } from '@/hooks/use-toast';
import { useShootMutationRefresh } from '@/hooks/useShootMutationRefresh';
import { registerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';
import {
  normalizeRescheduleStatus,
  type RescheduleRequestStatus,
} from '@/utils/rescheduleRequests';

export interface RescheduleRequestItem {
  id: number;
  shootId?: number;
  address: string;
  clientName?: string;
  originalDate?: string | null;
  originalTime?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  reason?: string | null;
  requesterName?: string;
  status: RescheduleRequestStatus;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  approverName?: string;
}

type RescheduleRequestResponse = {
  id: string | number;
  shoot_id?: string | number;
  shootId?: string | number;
  status?: string;
  address?: string;
  location?: { fullAddress?: string; address?: string };
  client?: { name?: string };
  clientName?: string;
  original_date?: string | null;
  original_time?: string | null;
  requested_date?: string | null;
  requested_time?: string | null;
  originalDate?: string | null;
  originalTime?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  reason?: string | null;
  review_notes?: string | null;
  reviewNotes?: string | null;
  reviewed_at?: string | null;
  reviewedAt?: string | null;
  requester?: { id?: number | string; name?: string } | null;
  approver?: { id?: number | string; name?: string } | null;
  shoot?: {
    id?: string | number;
    address?: string;
    location?: { fullAddress?: string; address?: string };
    client?: { name?: string };
  } | null;
};

const headers = () => ({
  Authorization: `Bearer ${getAuthToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const mapItem = (item: RescheduleRequestResponse): RescheduleRequestItem => {
  const shoot = item.shoot;
  const address =
    item.location?.fullAddress ||
    item.location?.address ||
    item.address ||
    shoot?.location?.fullAddress ||
    shoot?.location?.address ||
    shoot?.address ||
    (shoot?.id != null ? `Shoot #${shoot.id}` : null) ||
    `Request #${item.id}`;

  const shootIdRaw = item.shoot_id ?? item.shootId ?? shoot?.id;

  return {
    id: Number(item.id),
    shootId: shootIdRaw != null ? Number(shootIdRaw) : undefined,
    address,
    clientName: item.clientName || item.client?.name || shoot?.client?.name,
    originalDate: item.original_date ?? item.originalDate,
    originalTime: item.original_time ?? item.originalTime,
    requestedDate: item.requested_date ?? item.requestedDate,
    requestedTime: item.requested_time ?? item.requestedTime,
    reason: item.reason,
    requesterName: item.requester?.name,
    // Missing status (legacy pending-only payloads) normalizes to pending.
    status: normalizeRescheduleStatus(item.status),
    reviewNotes: item.review_notes ?? item.reviewNotes ?? null,
    reviewedAt: item.reviewed_at ?? item.reviewedAt ?? null,
    approverName: item.approver?.name,
  };
};

export function useRescheduleRequests(enabled: boolean, viewerScope: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const refreshShoot = useShootMutationRefresh();
  const queryKey = ['pendingRescheduleRequests', viewerScope];
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal }): Promise<RescheduleRequestItem[]> => {
      const response = await fetch(`${API_BASE_URL}/api/shoots/pending-reschedules`, {
        headers: headers(),
        signal,
      });
      if (!response.ok) {
        throw new Error('Unable to load reschedule requests. Please retry.');
      }
      const json = await response.json();
      return (Array.isArray(json.data) ? json.data : []).map(mapItem);
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!enabled) return;
    return registerDashboardOverviewRefresh(() => {
      void queryClient.invalidateQueries({ queryKey: ['pendingRescheduleRequests', viewerScope] });
    });
  }, [enabled, queryClient, viewerScope]);

  const mutation = useMutation({
    mutationFn: async ({
      id,
      decision,
    }: {
      id: number;
      decision: 'approved' | 'rejected';
      shootId?: number;
    }) => {
      const response = await fetch(`${API_BASE_URL}/api/shoots/reschedule-requests/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: decision }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Unable to update the reschedule request.');
      }
      return response.json().catch(() => ({}));
    },
    onSuccess: (json, { id, decision, shootId }) => {
      // Keep the row as recent history (approved/rejected) when the endpoint
      // returns mixed payloads; pending-only backends still drop it on refetch.
      queryClient.setQueryData<RescheduleRequestItem[]>(queryKey, (items) =>
        items?.map((item) =>
          item.id === id ? { ...item, status: decision } : item,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ['pendingRescheduleRequests'] });
      if (decision === 'approved' && shootId != null) {
        refreshShoot(shootId);
      }
      toast({
        title: decision === 'approved' ? 'Request approved' : 'Request rejected',
        description: typeof json?.message === 'string' ? json.message : undefined,
      });
    },
    onError: (error) =>
      toast({
        title: 'Unable to update reschedule request',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const requests = enabled ? query.data ?? [] : [];
  const pendingCount = requests.filter(
    (item) => normalizeRescheduleStatus(item.status) === 'pending',
  ).length;

  return {
    requests,
    pendingCount,
    loading: enabled && query.isLoading,
    error: enabled && query.error ? query.error.message : null,
    refresh: () => {
      void query.refetch();
    },
    decide: (id: number, decision: 'approved' | 'rejected', shootId?: number) =>
      mutation.mutate({ id, decision, shootId }),
    actioning: mutation.isPending ? mutation.variables.id : null,
  };
}

export type RescheduleRequestsState = ReturnType<typeof useRescheduleRequests>;
