import { useQuery } from '@tanstack/react-query';
import API_ROUTES from '@/lib/api';
import type { ServiceGroupDetail } from '@/types/serviceGroups';

export const useServiceGroups = (options?: { enabled?: boolean }) => {
  return useQuery<ServiceGroupDetail[]>({
    queryKey: ['service-groups'],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(API_ROUTES.serviceGroups.all, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          return [];
        }
        throw new Error('Failed to load service groups');
      }

      const json = await response.json();
      return Array.isArray(json.data) ? json.data : [];
    },
  });
};
