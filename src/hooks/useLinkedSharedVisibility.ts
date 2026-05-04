import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchLinkedSharedVisibility } from '@/services/accountLinkingService';

const LINKED_SHARED_VISIBILITY_QUERY_KEY = ['linked-shared-visibility'];

export const useLinkedSharedVisibility = () => {
  const { isAuthenticated, user } = useAuth();

  const query = useQuery({
    queryKey: [...LINKED_SHARED_VISIBILITY_QUERY_KEY, user?.id ?? null],
    queryFn: ({ signal }) => fetchLinkedSharedVisibility(signal),
    enabled: isAuthenticated && Boolean(user?.id),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    data: query.data ?? { hasLinkedAccounts: false, linkedAccounts: [] },
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
};
