import { useQuery } from '@tanstack/react-query';
import { crmApi } from '../api';

export interface EventType { id: number; key: string; label: string; icon: string | null; is_active: boolean }

export function useEventTypes() {
  return useQuery({ queryKey: ['crm', 'event-types'], queryFn: () => crmApi.get<{ data: EventType[] }>('/event-types'), staleTime: 300_000 });
}
