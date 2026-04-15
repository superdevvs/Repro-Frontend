import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { registerInvoicesRefresh } from '@/realtime/realtimeRefreshBus';
import { fetchSalesRepSummary } from '@/services/salesSummaryService';

export const getSalesRepSummaryQueryKey = (startDate?: string, endDate?: string) =>
  ['salesRepSummary', startDate ?? 'none', endDate ?? 'none'] as const;

export const useSalesRepSummary = ({
  startDate,
  endDate,
  enabled = true,
}: {
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}) => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedRole = String(role || '').toLowerCase();
  const isSalesRep = normalizedRole === 'salesrep' || normalizedRole === 'sales_rep';

  const query = useQuery({
    queryKey: getSalesRepSummaryQueryKey(startDate, endDate),
    queryFn: () => fetchSalesRepSummary({ startDate: startDate!, endDate: endDate! }),
    enabled: enabled && Boolean(user?.id) && isSalesRep && Boolean(startDate) && Boolean(endDate),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const unregister = registerInvoicesRefresh(() =>
      queryClient.invalidateQueries({ queryKey: ['salesRepSummary'] }),
    );

    return unregister;
  }, [queryClient]);

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salesRepSummary'] });
      await query.refetch();
    },
  };
};
