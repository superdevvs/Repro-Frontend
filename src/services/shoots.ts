import { apiClient } from './api';

/**
 * Scope for applying a shoot's stored alternate date onto its live schedule.
 *  - `main`        : copy the alternate onto the main schedule only (default).
 *  - `all_services`: also push the alternate onto every selected service pivot.
 */
export type ApplyAlternateDateScope = 'main' | 'all_services';

/**
 * POST /shoots/{id}/apply-alternate-date — apply the shoot's stored alternate
 * date/time onto its live schedule (shoot-alternate-date-field, Req 4.3 / 7.5).
 *
 * This is an internal schedule update: it does NOT create a reschedule request and
 * fires no automation/notification side effects (see ApplyAlternateDateAction).
 *
 * @param shootId Shoot identifier.
 * @param scope   `main` (default) sets the main schedule only; `all_services` also
 *                sets every selected service's `scheduled_at`.
 * @returns The raw, updated shoot resource (unwrapped from the `{ data }` envelope).
 */
export const applyAlternateDate = async (
  shootId: string,
  scope: ApplyAlternateDateScope = 'main',
): Promise<unknown> => {
  const res = await apiClient.post(`/shoots/${shootId}/apply-alternate-date`, { scope });
  return res.data?.data ?? res.data;
};

/**
 * Property access details a client can self-serve (lockbox-text-code-access-info).
 * Text/code only — no media/image upload (kept disabled until malware scanning
 * is in place). Maps to the shoot's `property_details` JSON keys.
 */
export type ShootAccessInfo = {
  presenceOption?: 'self' | 'other' | 'lockbox';
  lockboxCode?: string | null;
  lockboxLocation?: string | null;
  accessContactName?: string | null;
  accessContactPhone?: string | null;
};

/**
 * PATCH /shoots/{id} — submit property access info for a shoot. The backend
 * restricts clients to exactly these access keys within `property_details`
 * (see UpdateShootAction), so price/MLS/description cannot be overwritten here.
 *
 * @param shootId Shoot identifier.
 * @param info    Access fields to persist. Only the provided keys are sent.
 * @returns The raw, updated shoot resource (unwrapped from the `{ data }` envelope).
 */
export const updateShootAccessInfo = async (
  shootId: string,
  info: ShootAccessInfo,
): Promise<unknown> => {
  const propertyDetails: Record<string, unknown> = {};

  if (info.presenceOption) {
    propertyDetails.presenceOption = info.presenceOption;
  }
  if (info.presenceOption === 'lockbox') {
    propertyDetails.lockboxCode = info.lockboxCode?.trim() || null;
    propertyDetails.lockboxLocation = info.lockboxLocation?.trim() || null;
    propertyDetails.accessContactName = null;
    propertyDetails.accessContactPhone = null;
  } else if (info.presenceOption === 'other') {
    propertyDetails.accessContactName = info.accessContactName?.trim() || null;
    propertyDetails.accessContactPhone = info.accessContactPhone?.trim() || null;
    propertyDetails.lockboxCode = null;
    propertyDetails.lockboxLocation = null;
  } else if (info.presenceOption === 'self') {
    propertyDetails.lockboxCode = null;
    propertyDetails.lockboxLocation = null;
    propertyDetails.accessContactName = null;
    propertyDetails.accessContactPhone = null;
  }

  const res = await apiClient.patch(`/shoots/${shootId}`, {
    property_details: propertyDetails,
  });
  return res.data?.data ?? res.data;
};
