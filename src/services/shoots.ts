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
