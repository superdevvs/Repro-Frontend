import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { registerInvoicesRefresh } from '@/realtime/realtimeRefreshBus';
import { fetchClientBilling } from '@/services/clientBillingService';

const CLIENT_BILLING_QUERY_KEY = ['clientBilling'];

export const useClientBilling = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedRole = String(role || '').toLowerCase();
  const isClient = normalizedRole === 'client' || normalizedRole === 'customer';

  const query = useQuery({
    queryKey: CLIENT_BILLING_QUERY_KEY,
    queryFn: fetchClientBilling,
    enabled: Boolean(user?.id) && isClient,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const unregister = registerInvoicesRefresh(() =>
      queryClient.invalidateQueries({ queryKey: CLIENT_BILLING_QUERY_KEY }),
    );

    return unregister;
  }, [queryClient]);

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: CLIENT_BILLING_QUERY_KEY });
      await query.refetch();
    },
  };
};
