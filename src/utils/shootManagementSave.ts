import { slimAssignedRepShootSavePayload } from './assignedRepShootSavePayload';
import type { ShootData } from '@/types/shoots';

/** Booking access is not production/media access. Keep server-owned prices out. */
export function prepareShootManagementSave(payload: Record<string, unknown>, shoot: ShootData): Record<string, unknown> {
  const next = slimAssignedRepShootSavePayload(payload, shoot);
  for (const key of ['client_id', 'address', 'city', 'state', 'zip', 'property_details',
    'bedrooms', 'bathrooms', 'sqft', 'timezone', 'listing_type', 'property_status',
    'alternate_scheduled_date', 'alternate_time', 'shoot_notes', 'company_notes',
    'photographer_notes', 'editor_notes', 'approval_notes', 'discount_type',
    'discount_value', 'admin_adjusted_total_quote', 'expected_edit_version']) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) next[key] = payload[key];
  }
  return next;
}
