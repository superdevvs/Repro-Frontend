import { API_BASE_URL } from '@/config/env';
import { shootEditTravelMode } from '@/features/travel/shootEditTravelMode';
import type { ShootData } from '@/types/shoots';
import { prepareShootManagementSave } from '@/utils/shootManagementSave';

/** Confirmed edits use the update endpoint; pending requests keep the approval contract. */
export function buildShootEditMutationRequest(shootId: string | number, source: unknown, payload: Record<string, unknown>, isRep: boolean, isAdmin: boolean) {
  const editing = shootEditTravelMode(source) === 'update';
  return {
    url: `${API_BASE_URL}/api/shoots/${shootId}${editing ? '' : '/approve'}`,
    method: editing ? 'PATCH' as const : 'POST' as const,
    payload: editing && isRep && !isAdmin ? prepareShootManagementSave(payload, source as ShootData) : payload,
  };
}
