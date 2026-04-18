import { apiClient } from './api';

export type RecoveryStatus = 'sent' | 'failed' | 'skipped';
export type RecoverySource = 'automation' | 'fallback' | 'replay';
export type RecoveryReasonCode =
  | 'missing_email'
  | 'no_delivery_path'
  | 'provider_error'
  | string
  | null;

export interface RecoveryShootSummary {
  id: number;
  status: string | null;
  workflow_status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  scheduled_at: string | null;
}

export interface RecoveryClientSummary {
  id: number;
  name: string | null;
  email: string | null;
}

export interface RecoveryMessageSummary {
  id: number;
  status: string | null;
  send_source: string | null;
  to_address: string | null;
  sent_at: string | null;
  failed_at: string | null;
}

export interface ClientConfirmationDelivery {
  id: number;
  event_type: string;
  recipient_type: string;
  status: RecoveryStatus;
  source: RecoverySource;
  reason_code: RecoveryReasonCode;
  attempt_count: number;
  last_attempted_at: string | null;
  sent_at: string | null;
  recovered_at: string | null;
  last_error_message: string | null;
  last_message_id: number | null;
  shoot: RecoveryShootSummary | null;
  client: RecoveryClientSummary | null;
  last_message: RecoveryMessageSummary | null;
}

export interface ClientConfirmationDeliveryListResponse {
  data: ClientConfirmationDelivery[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface ClientConfirmationReplayResponse {
  replayed: ClientConfirmationDelivery[];
  rejected: Array<{
    delivery_id: number;
    reason: string;
    delivery: ClientConfirmationDelivery | null;
  }>;
}

export interface ClientConfirmationRecoveryFilters {
  status?: RecoveryStatus;
  shoot_id?: number;
  client_id?: number;
  per_page?: number;
  page?: number;
}

export const listClientConfirmationRecoveries = async (
  filters: ClientConfirmationRecoveryFilters = {}
): Promise<ClientConfirmationDeliveryListResponse> => {
  const response = await apiClient.get('/messaging/email/recovery/client-confirmations', {
    params: filters,
  });
  return response.data;
};

export const replayClientConfirmations = async (
  deliveryIds: number[]
): Promise<ClientConfirmationReplayResponse> => {
  const response = await apiClient.post(
    '/messaging/email/recovery/client-confirmations/replay',
    { delivery_ids: deliveryIds }
  );
  return response.data;
};
