import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { DashboardOverview } from '@/types/dashboard';
import { fetchDashboardOverview } from '@/services/dashboardService';

interface UseDashboardOverviewResult {
  data: DashboardOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const getToken = (sessionToken?: string | null) => {
  const localToken =
    (typeof window !== 'undefined' && (localStorage.getItem('authToken') || localStorage.getItem('token'))) ||
    null;
  return localToken || sessionToken || undefined;
};

export const useDashboardOverview = (): UseDashboardOverviewResult => {
  const { session, role } = useAuth();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken(session?.accessToken);
    if (!token) {
      setError('Missing auth token');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const overview = await fetchDashboardOverview(token);
      setData(overview);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (!['admin', 'superadmin'].includes(role)) {
      setLoading(false);
      return;
    }

    load();
  }, [role, load]);

  return { data, loading, error, refresh: load };
};

