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

export const mmmService = {
  async startPunchout(shootId: number | string, payload: MmmPunchoutPayload = {}): Promise<MmmPunchoutResponse> {
    const response = await apiClient.post(API_ROUTES.integrations.mmm.punchout(shootId), payload);
    return response.data as MmmPunchoutResponse;
  },
};
