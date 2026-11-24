import { useQuery } from '@tanstack/react-query';
import { crmApi } from '../api';
import { useCrmQueryKey } from '../hooks';

export interface EventType { id: number; key: string; label: string; icon: string | null; is_active: boolean; is_system: boolean; counts_as_contact: boolean }

export function useEventTypes() {
  return useQuery({ queryKey: useCrmQueryKey(['crm', 'event-types']), queryFn: () => crmApi.get<{ data: EventType[] }>('/event-types'), staleTime: 300_000 });
}
