import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { normalizeShootAutoDelivery } from '@/utils/shootAutoDelivery';

export async function updateShootAutoDelivery(shootId: string | number, enabled: boolean, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/auto-delivery`, {
    method: 'PATCH', headers: getApiHeaders(), signal, body: JSON.stringify({ enabled }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'The update could not be confirmed. Please try again.');
  const policy = normalizeShootAutoDelivery(payload?.data?.auto_delivery);
  if (!policy || String(payload?.data?.id) !== String(shootId)) {
    throw new Error('The saved setting could not be confirmed. Refresh this shoot and try again.');
  }
  return policy;
}
