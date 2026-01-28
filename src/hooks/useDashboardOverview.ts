import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { DashboardOverview } from '@/types/dashboard';
import { fetchDashboardOverview } from '@/services/dashboardService';

const getToken = (sessionToken?: string | null) => {
  const localToken =
    (typeof window !== 'undefined' && (localStorage.getItem('authToken') || localStorage.getItem('token'))) ||
    null;
  return localToken || sessionToken || undefined;
};

interface UseDashboardOverviewResult {
  data: DashboardOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useDashboardOverview = (): UseDashboardOverviewResult => {
  const { session, role } = useAuth();
  const queryClient = useQueryClient();
  
  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['dashboardOverview'],
    queryFn: () => fetchDashboardOverview(getToken(session?.accessToken)),
    enabled: ['admin', 'superadmin'].includes(role),
    staleTime: 60 * 1000, // 60 seconds - dashboard data can be slightly stale
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const refresh = async () => {
    // Invalidate cache to force fresh data fetch
    await queryClient.invalidateQueries({ queryKey: ['dashboardOverview'] });
    await refetch();
  };

  return {
    data: data ?? null,
    loading,
    error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load dashboard data') : null,
    refresh,
  };
};
