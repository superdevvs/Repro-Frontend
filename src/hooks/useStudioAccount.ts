import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { canManageStudioBilling, studioBillingRole } from '@/lib/studioBillingAccess';
import { listingStudioClient } from '@/services/listingStudioClientService';
import { listingStudioStaff } from '@/services/listingStudioStaffService';
import type { StudioAccount } from '@/types/listingStudioClient';
import type { StudioManagedAccount } from '@/types/listingStudioStaff';

export function useStudioAccount(managedClientId?: string | null) {
  const { user, isAuthenticated, isLoading, isImpersonating } = useAuth();
  const actorId = String(user?.id ?? '');
  const ownClient = studioBillingRole(user?.role) === 'client' && !managedClientId;
  const managed = canManageStudioBilling(user?.role) && Boolean(managedClientId);
  const eligible = Boolean(isAuthenticated && !isLoading && !isImpersonating && user?.isActive !== false && actorId && (ownClient || managed));
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const query = useQuery<StudioAccount | StudioManagedAccount>({
    queryKey: managed
      ? ['studio-managed-client', actorId, managedClientId, 'account']
      : ['studio-client', actorId, 'account'],
    queryFn: ({ signal }) => {
      if (!eligible) throw new Error('Use an eligible account to view editing credit.');
      return managed ? listingStudioStaff.account(managedClientId!, signal) : listingStudioClient.account(signal);
    },
    enabled: eligible,
    staleTime: 30_000,
    refetchInterval: eligible && visible ? 30_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: (count, error) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      return count < 1 && status !== 401 && status !== 403 && status !== 429;
    },
  });
  // A disabled observer can still have cached data. Never expose it in another auth context.
  return { ...query, data: eligible ? query.data : undefined, eligible };
}
