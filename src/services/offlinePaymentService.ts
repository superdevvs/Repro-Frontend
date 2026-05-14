import { apiClient } from '@/services/api';

export type OfflinePaymentMethod = 'cash' | 'check';

export type OfflinePaymentIntentPayload = {
  paymentMethod: OfflinePaymentMethod;
  amount: number;
  paymentDate?: string | null;
  checkNumber?: string | null;
  notes?: string | null;
};

export type OfflinePaymentIntentRecord = {
  id: number;
  payment_id: number;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  processed_at: string | null;
  payment_details: Record<string, unknown> | null;
};

const buildPayload = (payload: OfflinePaymentIntentPayload): Record<string, unknown> => {
  const details: Record<string, unknown> = {};
  if (payload.checkNumber && payload.checkNumber.trim() !== '') {
    details.check_number = payload.checkNumber.trim();
  }
  if (payload.notes && payload.notes.trim() !== '') {
    details.notes = payload.notes.trim();
  }
  const body: Record<string, unknown> = {
    payment_method: payload.paymentMethod,
    amount: payload.amount,
  };
  if (payload.paymentDate) {
    body.payment_date = payload.paymentDate;
  }
  if (Object.keys(details).length > 0) {
    body.payment_details = details;
  }
  return body;
};

export async function createOfflinePaymentIntent(
  shootId: number | string,
  payload: OfflinePaymentIntentPayload,
): Promise<OfflinePaymentIntentRecord> {
  const response = await apiClient.post(`/shoots/${shootId}/payment-intents`, buildPayload(payload));
  return (response.data?.data ?? response.data) as OfflinePaymentIntentRecord;
}

export async function confirmOfflinePaymentIntent(
  shootId: number | string,
  paymentId: number | string,
  paymentDate?: string | null,
): Promise<{ payment: OfflinePaymentIntentRecord; total_paid: number; payment_status: string }> {
  const body: Record<string, unknown> = {};
  if (paymentDate) body.payment_date = paymentDate;
  const response = await apiClient.post(
    `/shoots/${shootId}/payment-intents/${paymentId}/confirm`,
    body,
  );
  return (response.data?.data ?? response.data) as {
    payment: OfflinePaymentIntentRecord;
    total_paid: number;
    payment_status: string;
  };
}

export async function declineOfflinePaymentIntent(
  shootId: number | string,
  paymentId: number | string,
  reason?: string | null,
): Promise<OfflinePaymentIntentRecord> {
  const body: Record<string, unknown> = {};
  if (reason && reason.trim() !== '') body.reason = reason.trim();
  const response = await apiClient.post(
    `/shoots/${shootId}/payment-intents/${paymentId}/decline`,
    body,
  );
  return (response.data?.data ?? response.data) as OfflinePaymentIntentRecord;
}
