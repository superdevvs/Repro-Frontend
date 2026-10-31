import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRequestManager } from './RequestManagerContext';
import { listingStudioTeam } from '@/services/listingStudioTeamService';
import { canUseListingStudioRevisions } from '@/utils/listingStudio';
import { studioRevisionTaskId } from '@/utils/studioRevisionNavigation';
import { normalizeApiError } from '@/services/apiError';
import { StudioRevisionRequestsContext, type EditingSource } from './studioRevisionRequestsState';

export function StudioRevisionRequestsProvider({ children }: { children: ReactNode }) {
  const { user, role, isImpersonating, isLoading } = useAuth();
  const enabled = Boolean(user && !isLoading && !isImpersonating && canUseListingStudioRevisions(role, user.secondary_roles));
  const accountId = String(user?.id ?? '');
  const accessKey = `${accountId}:${role}:${user?.secondary_roles?.join(',') ?? ''}:${isImpersonating ? 'impersonating' : 'self'}`;
  return <StudioRevisionRequestsScope key={accessKey} accountId={accountId} accessKey={accessKey} enabled={enabled} authLoading={isLoading}>{children}</StudioRevisionRequestsScope>;
}

function StudioRevisionRequestsScope({ children, accountId, accessKey, enabled, authLoading }: {
  children: ReactNode; accountId: string; accessKey: string; enabled: boolean; authLoading: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openModal, requests, isOpen } = useRequestManager();
  const [source, setSource] = useState<EditingSource>('all');
  const [selectedTaskId, selectTask] = useState<string | null>(null);
  const count = useQuery({
    queryKey: ['studio-team', accountId, 'active-count', accessKey],
    queryFn: async () => {
      // Only the totals are needed here; never download every task to count the queue.
      const pages = await Promise.all(['queued', 'assigned', 'in_progress'].map(status => listingStudioTeam.list(1, status, 1)));
      return pages.reduce((total, page) => total + page.pagination.total, 0);
    },
    enabled, staleTime: 60_000, retry: false,
    refetchInterval: query => [401, 403].includes(normalizeApiError(query.state.error).status ?? 0) ? false : 60_000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => { if (!isOpen) selectTask(null); }, [isOpen]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (authLoading || params.get('requests') !== 'editing') return;
    if (enabled) {
      setSource(params.get('editingSource') === 'studio' ? 'studio' : 'all');
      selectTask(studioRevisionTaskId(params.get('studioTask')));
      openModal(requests, undefined, 'editing');
    }
    params.delete('requests'); params.delete('editingSource'); params.delete('studioTask');
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { replace: true });
  }, [authLoading, enabled, location.pathname, location.search, location.hash, navigate, openModal, requests]);
  const openTask = (id: string) => {
    if (!enabled || !studioRevisionTaskId(id)) return;
    selectTask(id);
    openModal(requests, undefined, 'editing');
  };
  return <StudioRevisionRequestsContext.Provider value={{
    enabled, accountId, accessKey, activeCount: enabled ? count.data ?? 0 : 0, countError: enabled && count.isError,
    source, setSource, selectedTaskId: enabled ? selectedTaskId : null, openTask,
    clearTask: () => selectTask(null), refreshCount: () => { void count.refetch(); },
  }}>{children}</StudioRevisionRequestsContext.Provider>;
}
