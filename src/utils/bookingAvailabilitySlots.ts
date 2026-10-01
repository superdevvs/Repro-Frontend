import type { BookingAvailabilitySlot } from '@/types/availability';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const optionalId = (value: unknown): number | undefined => {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};

/** Keep only booking details explicitly supplied on the authorized API slot. */
export function normalizeBookingAvailabilitySlots(value: unknown): BookingAvailabilitySlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const slot = asRecord(entry);
    const startTime = optionalString(slot.start_time);
    const endTime = optionalString(slot.end_time);
    if (!startTime || !endTime) return [];
    return [{
      start_time: startTime,
      end_time: endTime,
      status: optionalString(slot.status),
      shoot_id: optionalId(slot.shoot_id),
      client_name: optionalString(slot.client_name),
      address: optionalString(slot.address),
      city: optionalString(slot.city),
      state: optionalString(slot.state),
      zip: optionalString(slot.zip),
      services: (Array.isArray(slot.services) ? slot.services : []).flatMap((entry) => {
        const service = asRecord(entry);
        const id = optionalId(service.id);
        const name = optionalString(service.name);
        return id !== undefined && name ? [{ id, name }] : [];
      }),
    }];
  });
}
