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
  
  // Ensure data exists and has required structure
  if (!json.data) {
    console.error('Dashboard API response missing data:', json);
    throw new Error('Invalid dashboard response: missing data');
  }
  
  // Log the structure for debugging (dev only)
  if (import.meta.env.DEV) {
    console.log('📊 Dashboard data received:', {
      hasWorkflow: !!json.data.workflow,
      workflowColumns: json.data.workflow?.columns?.length ?? 0,
      issuesCount: Array.isArray(json.data.issues) ? json.data.issues.length : 'not array',
      photographersCount: Array.isArray(json.data.photographers) ? json.data.photographers.length : 'not array',
    });
  }
  
  // Ensure workflow exists with columns array
  if (!json.data.workflow) {
    console.warn('⚠️ Dashboard response missing workflow, creating empty structure');
    json.data.workflow = { columns: [] };
  }
  if (!Array.isArray(json.data.workflow.columns)) {
    console.warn('⚠️ Dashboard workflow.columns is not an array:', typeof json.data.workflow.columns);
    json.data.workflow.columns = [];
  }
  
  // Ensure other arrays exist
  if (!Array.isArray(json.data.upcoming_shoots)) {
    console.warn('⚠️ upcoming_shoots is not an array');
    json.data.upcoming_shoots = [];
  }
  if (!Array.isArray(json.data.photographers)) {
    console.warn('⚠️ photographers is not an array');
    json.data.photographers = [];
  }
  if (!Array.isArray(json.data.pending_reviews)) {
    console.warn('⚠️ pending_reviews is not an array');
    json.data.pending_reviews = [];
  }
  if (!Array.isArray(json.data.activity_log)) {
    console.warn('⚠️ activity_log is not an array');
    json.data.activity_log = [];
  }
  if (!Array.isArray(json.data.issues)) {
    console.warn('⚠️ issues is not an array');
    json.data.issues = [];
  }
  if (!json.data.stats) {
    console.warn('⚠️ stats is missing');
    json.data.stats = {};
  }
  
  try {
    return transformDashboardOverview(json.data);
  } catch (error) {
    console.error('❌ Error transforming dashboard data:', error);
    throw error;
  }
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

