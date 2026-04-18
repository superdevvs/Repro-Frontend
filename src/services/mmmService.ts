import { apiClient } from './api';
import { API_ROUTES } from '@/lib/api';

export interface MmmPunchoutPayload {
  file_ids?: number[];
  artwork_url?: string;
  artwork_file_id?: number;
  cost_center_number?: string;
  employee_email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  buyer_cookie?: string;
  mls_id?: string;
  price?: string;
  address?: string;
  description?: string;
  start_point?: string;
  template_external_number?: string;
  deployment_mode?: string;
  url_return?: string;
  order_number?: string;
}

export interface MmmPunchoutResponse {
  success: boolean;
  status?: string | null;
  redirect_url?: string | null;
  session_id?: number | string | null;
  buyer_cookie?: string | null;
  message?: string | null;
}

export interface MmmPunchoutOrderLineItem {
  line_number?: number | null;
  supplier_part_id?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_of_measure?: string | null;
  unit_price?: number | null;
  currency?: string | null;
  extended_price?: number | null;
}

export interface MmmPunchoutOrder {
  items?: MmmPunchoutOrderLineItem[];
  subtotal?: number | null;
  tax?: number | null;
  shipping?: number | null;
  total?: number | null;
  currency?: string | null;
}

export interface MmmPunchoutSessionItem {
  id: number;
  shoot_id: number;
  user_id: number | null;
  status: string | null;
  order_number: string | null;
  buyer_cookie: string | null;
  redirect_url: string | null;
  redirected_at: string | null;
  returned_at: string | null;
  last_error: string | null;
  employee_email: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
  deployment_mode: string | null;
  order: MmmPunchoutOrder | null;
}

export interface MmmSessionsSummary {
  mmm_status: string | null;
  mmm_order_number: string | null;
  mmm_buyer_cookie: string | null;
  mmm_redirect_url: string | null;
  mmm_last_punchout_at: string | null;
  mmm_last_order_at: string | null;
  mmm_last_error: string | null;
}

export interface MmmSessionsResponse {
  success: boolean;
  sessions: MmmPunchoutSessionItem[];
  summary: MmmSessionsSummary;
}

export const mmmService = {
  async startPunchout(shootId: number | string, payload: MmmPunchoutPayload = {}): Promise<MmmPunchoutResponse> {
    const response = await apiClient.post(API_ROUTES.integrations.mmm.punchout(shootId), payload);
    return response.data as MmmPunchoutResponse;
  },
  async listSessions(shootId: number | string): Promise<MmmSessionsResponse> {
    const response = await apiClient.get(API_ROUTES.integrations.mmm.sessions(shootId));
    return response.data as MmmSessionsResponse;
  },
};
