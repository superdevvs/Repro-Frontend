import { apiClient } from '@/services/api';
import type {
  SalesRepNewClient,
  SalesRepSummaryMetrics,
  SalesRepSummaryPeriod,
  SalesRepSummaryResponse,
  SalesRepSummaryTrendPoint,
  SalesRepTopClient,
} from '@/types/salesSummary';

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePeriod = (value: Partial<SalesRepSummaryPeriod> | undefined): SalesRepSummaryPeriod => ({
  start_date: value?.start_date || '',
  end_date: value?.end_date || '',
  days_window: toNumber(value?.days_window),
});

const normalizeSummary = (value: Partial<SalesRepSummaryMetrics> | undefined): SalesRepSummaryMetrics => ({
  new_clients: toNumber(value?.new_clients),
  paid_revenue: toNumber(value?.paid_revenue),
  commission_rate: toNullableNumber(value?.commission_rate),
  commission_earned: toNullableNumber(value?.commission_earned),
  average_client_value: toNumber(value?.average_client_value),
});

const normalizeTrendPoint = (value: Partial<SalesRepSummaryTrendPoint>): SalesRepSummaryTrendPoint => ({
  bucket: value.bucket || '',
  paid_revenue: toNumber(value.paid_revenue),
  new_clients: toNumber(value.new_clients),
});

const normalizeTopClient = (value: Partial<SalesRepTopClient>): SalesRepTopClient => ({
  client_id: value.client_id ?? '',
  client_name: value.client_name || 'Unknown Client',
  paid_revenue: toNumber(value.paid_revenue),
  outstanding_balance: toNumber(value.outstanding_balance),
  last_shoot_date: value.last_shoot_date || null,
});

const normalizeNewClient = (value: Partial<SalesRepNewClient>): SalesRepNewClient => ({
  ...normalizeTopClient(value),
  created_at: value.created_at || null,
});

export const fetchSalesRepSummary = async ({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}): Promise<SalesRepSummaryResponse> => {
  const response = await apiClient.get<Partial<SalesRepSummaryResponse>>('/reports/sales/summary', {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  });

  const data = response.data ?? {};

  return {
    period: normalizePeriod(data.period),
    summary: normalizeSummary(data.summary),
    trend: Array.isArray(data.trend) ? data.trend.map(normalizeTrendPoint) : [],
    top_clients: Array.isArray(data.top_clients) ? data.top_clients.map(normalizeTopClient) : [],
    new_clients: Array.isArray(data.new_clients) ? data.new_clients.map(normalizeNewClient) : [],
  };
};
