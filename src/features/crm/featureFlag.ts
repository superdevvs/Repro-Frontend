/**
 * The Sales CRM stays dark until both sides are switched on: this flag in the
 * frontend build and CRM_ENABLED on the backend (which 404s /api/crm/*).
 */
export const CRM_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(import.meta.env.VITE_CRM_ENABLED ?? 'false').trim().toLowerCase(),
);
