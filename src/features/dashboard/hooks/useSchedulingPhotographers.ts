import { useQuery } from '@tanstack/react-query';
import API_ROUTES from '@/lib/api';
import { getAuthToken } from '@/utils/authToken';
import type { DashboardPhotographerSummary } from '@/types/dashboard';

export function useSchedulingPhotographers(enabled: boolean, viewerScope: string) {
  return useQuery({
    queryKey: ['schedulingPhotographers', viewerScope],
    enabled,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<DashboardPhotographerSummary[]> => {
      const response = await fetch(API_ROUTES.people.photographers, {
        signal,
        headers: { Authorization: `Bearer ${getAuthToken()}`, Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Unable to load photographers. Please refresh.');
      const json = await response.json();
      return (Array.isArray(json.data) ? json.data : []).map((person: { id: string | number; name: string; avatar?: string }) => ({
        id: Number(person.id), name: person.name, avatar: person.avatar,
        region: '', loadToday: 0, availableFrom: null, nextSlot: null, status: 'offline',
      }));
    },
  });
}
