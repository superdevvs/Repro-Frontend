import { apiClient } from '@/services/api';
import type {
  LiveUserActivity,
  SystemHistory,
  SystemOverviewResourceResponse,
  SystemRouteCatalogEntry,
  SystemSnapshot,
  SystemTraceDetail,
} from '@/types/systemOverview';

export async function fetchSystemOverviewSnapshot() {
  const { data } = await apiClient.get<SystemOverviewResourceResponse<SystemSnapshot>>('/admin/system-overview/snapshot');
  return data;
}

export async function fetchSystemOverviewHistory() {
  const { data } = await apiClient.get<SystemOverviewResourceResponse<SystemHistory>>('/admin/system-overview/history');
  return data;
}

export async function fetchSystemOverviewLiveUsers() {
  const { data } = await apiClient.get<SystemOverviewResourceResponse<LiveUserActivity[]>>('/admin/system-overview/users/live');
  return data;
}

export async function fetchSystemOverviewRoutes() {
  const { data } = await apiClient.get<SystemOverviewResourceResponse<SystemRouteCatalogEntry[]>>('/admin/system-overview/routes');
  return data;
}

export async function fetchSystemOverviewTrace(traceId: string) {
  const { data } = await apiClient.get<SystemOverviewResourceResponse<SystemTraceDetail>>(`/admin/system-overview/traces/${traceId}`);
  return data.data;
}
