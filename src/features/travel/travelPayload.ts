import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import { getShootSchedule } from '@/utils/shootSchedule';
import { normalizeSlotTime } from '@/utils/suggestedTimeSlots';
import type { TravelPayload } from './types';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
/** Merge request fields with the persisted property, without exposing neighboring appointments. */
export function shootTravelPayload(source: unknown, changes: TravelPayload = {}, actionMode = 'update'): TravelPayload {
  const shoot = record(source);
  const location = { ...record(shoot.location), ...record(changes.location) };
  const client = record(changes.client ?? shoot.client);
  const photographer = record(changes.photographer ?? shoot.photographer);
  const timezone = changes.timezone ?? shoot.timezone ?? null;
  const scheduledAt = changes.scheduled_at ?? (changes.scheduledDate !== undefined || changes.time !== undefined
    ? buildShootScheduleTimestamp(String(changes.scheduledDate ?? shoot.scheduledDate ?? ''), normalizeSlotTime(String(changes.time ?? shoot.time ?? '')), typeof timezone === 'string' ? timezone : null)
    : shoot.scheduled_at ?? shoot.scheduledAt ?? shoot.start_time);
  return {
    shoot_id: shoot.id, client_id: changes.client !== undefined ? client.id : shoot.client_id ?? client.id,
    address: record(changes.location).address ?? shoot.address ?? location.address, city: record(changes.location).city ?? shoot.city ?? location.city, state: record(changes.location).state ?? shoot.state ?? location.state, zip: record(changes.location).zip ?? shoot.zip ?? location.zip,
    property_details: changes.propertyDetails ?? shoot.property_details ?? shoot.propertyDetails,
    timezone, scheduled_at: scheduledAt, photographer_id: changes.photographer !== undefined ? photographer.id : shoot.photographer_id ?? photographer.id,
    ...changes, action_mode: actionMode,
  };
}
/** An incomplete or DST-invalid draft must stay editable; save owns its validation message. */
export function safelyBuildTravelPayload(build: () => TravelPayload | null): TravelPayload | null {
  try { return build(); } catch { return null; }
}
export function alternativeLocalSchedule(scheduled_at: string, timezone?: string) {
  return getShootSchedule({ scheduled_at, timezone: timezone || 'America/New_York' });
}
