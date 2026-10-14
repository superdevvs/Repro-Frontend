import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';

export function useDismissedIncomingCalls() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const queryKey = ['voice-incoming-dismissed', user?.id];
  const { data = [] } = useQuery<string[]>({ queryKey, queryFn: async () => [], initialData: [], enabled: false, staleTime: Infinity });
  return { dismissed: data, dismiss: (id: string) => cache.setQueryData<string[]>(queryKey, previous => [...new Set([...(previous ?? []).slice(-49), id])]) };
}
