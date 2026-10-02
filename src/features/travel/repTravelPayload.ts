import { slimAssignedRepShootSavePayload } from '@/utils/assignedRepShootSavePayload';
import { normalizeSlotTime } from '@/utils/suggestedTimeSlots';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import type { ShootData } from '@/types/shoots';
import type { TravelPayload } from './types';

/** Match the existing assigned-rep save allowlist before asking about its itinerary. */
export function repTravelChanges(shoot: ShootData, changes: TravelPayload): TravelPayload {
  const candidate = { ...changes,
    ...(changes.scheduledDate !== undefined ? { scheduled_date: changes.scheduledDate } : {}),
    ...(changes.time !== undefined ? { time: normalizeSlotTime(String(changes.time)) } : {}),
    ...(changes.photographer && typeof changes.photographer === 'object' ? { photographer_id: (changes.photographer as { id?: unknown }).id } : {}),
  };
  const slim = slimAssignedRepShootSavePayload(candidate, shoot);
  if (slim.scheduled_date !== undefined || slim.time !== undefined) {
    slim.scheduled_at = buildShootScheduleTimestamp(String(slim.scheduled_date ?? shoot.scheduledDate ?? ''), String(slim.time ?? shoot.time ?? ''), shoot.timezone);
  }
  return slim;
}
