export interface SalesRepSummaryPeriod {
  start_date: string;
  end_date: string;
  days_window: number;
}

export interface SalesRepSummaryMetrics {
  new_clients: number;
  paid_revenue: number;
  commission_rate: number | null;
  commission_earned: number | null;
  average_client_value: number;
}

export interface SalesRepSummaryTrendPoint {
  bucket: string;
  paid_revenue: number;
  new_clients: number;
}

export interface SalesRepTopClient {
  client_id: number | string;
  client_name: string;
  paid_revenue: number;
  outstanding_balance: number;
  last_shoot_date: string | null;
}

export interface SalesRepNewClient extends SalesRepTopClient {
  created_at: string | null;
}

export interface SalesRepSummaryResponse {
  period: SalesRepSummaryPeriod;
  summary: SalesRepSummaryMetrics;
  trend: SalesRepSummaryTrendPoint[];
  top_clients: SalesRepTopClient[];
  new_clients: SalesRepNewClient[];
}

export interface SalesRepInactiveClient {
  client_id: number | string;
  client_name: string;
  first_known_relationship_at: string | null;
  last_shoot_date: string | null;
  days_since_last_shoot: number | null;
  reason: string;
}

export interface SalesRepInactiveClientsResponse {
  cutoff_days: number;
  cutoff_date: string;
  total: number;
  clients: SalesRepInactiveClient[];
}
