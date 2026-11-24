import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/AuthProvider';
import { crmApi, toApiError } from './api';
import type { ApiError, CrmMeta } from './types';

export const crmKeys = {
  all: ['crm'] as const,
  meta: ['crm', 'meta'] as const,
  board: (filters: object) => ['crm', 'board', filters] as const,
  contacts: (filters: object) => ['crm', 'contacts', filters] as const,
  contact: (id: number) => ['crm', 'contact', id] as const,
  contactPart: (id: number, part: string) => ['crm', 'contact', id, part] as const,
};

export function useCrmQueryKey(key: QueryKey): QueryKey {
  const { user, role, isImpersonating, originalUser } = useAuth();
  return [...key, `${user?.id ?? ''}:${role}:${isImpersonating}:${originalUser?.id ?? ''}`];
}

export function useCrmMeta() {
  return useQuery({ queryKey: useCrmQueryKey(crmKeys.meta), queryFn: () => crmApi.get<CrmMeta>('/meta'), staleTime: 60_000 });
}

/** A read query against /api/crm with the shared error shape. */
export function useCrmQuery<T>(key: QueryKey, path: string, params?: Record<string, string | number | boolean | null | undefined>, enabled = true) {
  return useQuery<T, ApiError>({
    queryKey: useCrmQueryKey(key),
    enabled,
    queryFn: async () => {
      try {
        return await crmApi.get<T>(path, params);
      } catch (error) {
        throw toApiError(error);
      }
    },
  });
}

/**
 * A write that refreshes CRM data afterwards and shows the outcome. Errors are
 * returned to the caller too, so forms can show field messages (409 duplicates,
 * 422 content checks) instead of only a toast.
 */
export function useCrmMutation<TVars, TResult = unknown>(
  run: (vars: TVars) => Promise<TResult>,
  { success, invalidate = [crmKeys.all], silentErrors = false }: { success?: string | ((r: TResult) => string); invalidate?: QueryKey[]; silentErrors?: boolean } = {},
) {
  const client = useQueryClient();
  return useMutation<TResult, ApiError, TVars>({
    mutationFn: async (vars) => {
      try {
        return await run(vars);
      } catch (error) {
        throw toApiError(error);
      }
    },
    onSuccess: (result) => {
      invalidate.forEach((key) => client.invalidateQueries({ queryKey: key }));
      if (success) toast.success(typeof success === 'function' ? success(result) : success);
    },
    onError: (error) => {
      if (!silentErrors) toast.error(error.message);
    },
  });
}
