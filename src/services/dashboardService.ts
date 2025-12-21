import { DashboardOverview } from '@/types/dashboard';
import { transformDashboardOverview } from '@/utils/dashboardTransformers';
import { API_BASE_URL } from '@/config/env';

const buildHeaders = (token?: string) => ({
  Accept: 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const fetchDashboardOverview = async (token?: string): Promise<DashboardOverview> => {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/overview`, {
    headers: buildHeaders(token),
  });

  if (!res.ok) {
    const message = res.status === 403
      ? 'You are not allowed to view the dashboard summary.'
      : `Failed to load dashboard data (${res.status})`;
    throw new Error(message);
  }

  const json = await res.json();
  return transformDashboardOverview(json.data);
};

interface AvailabilityWindow {
  date: string;
  start_time: string;
  end_time: string;
}

export const fetchAvailablePhotographers = async (
  window: AvailabilityWindow,
  token?: string,
): Promise<number[]> => {
  const res = await fetch(`${API_BASE_URL}/api/photographer/availability/available-photographers`, {
    method: 'POST',
    headers: {
      ...buildHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(window),
  });

  if (!res.ok) {
    throw new Error('Unable to load availability window');
  }

  const json = await res.json();
  const records = Array.isArray(json.data) ? json.data : [];
  return records
    .map((item: any) => item.photographer_id)
    .filter((id: number | null | undefined) => typeof id === 'number')
    .filter((value, index, self) => self.indexOf(value) === index);
};

