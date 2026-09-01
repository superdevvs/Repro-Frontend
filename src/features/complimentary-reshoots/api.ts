import { apiClient } from '@/services/api';
import {
  normalizeCompReshootTemplate,
  type ComplimentaryReshootCreatePayload,
  type CompReshootTemplate,
  type ShootCompensationPayload,
} from './model';

const unwrap = <T,>(payload: { data?: T } | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export const getComplimentaryReshootTemplate = async (
  sourceShootId: string | number,
): Promise<CompReshootTemplate> => {
  const response = await apiClient.get(`/admin/shoots/${sourceShootId}/complimentary-reshoots`);
  return normalizeCompReshootTemplate(response.data);
};

export const createComplimentaryReshoot = async (
  sourceShootId: string | number,
  payload: ComplimentaryReshootCreatePayload,
  idempotencyKey: string,
) => {
  const response = await apiClient.post(
    `/admin/shoots/${sourceShootId}/complimentary-reshoots`,
    payload,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return unwrap<Record<string, unknown>>(response.data);
};

export const getShootCompensations = async (shootId: string | number) => {
  const response = await apiClient.get(`/admin/shoots/${shootId}/compensations`);
  return unwrap<Record<string, unknown>>(response.data);
};

export const updateShootCompensations = async (
  shootId: string | number,
  payload: ShootCompensationPayload,
) => {
  const response = await apiClient.patch(`/admin/shoots/${shootId}/compensations`, payload);
  return unwrap<Record<string, unknown>>(response.data);
};
