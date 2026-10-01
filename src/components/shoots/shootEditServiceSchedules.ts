import { getShootSchedule } from '@/utils/shootSchedule';
import { resolveServiceShootDuration, resolveShootDuration } from '@/utils/shootDuration';
import { getShootEditCatalogServiceId } from './shootEditInvoiceAdjustments';
import type { SelectedServiceSource, Service, ServiceScheduleFields, ShootDetails } from './shootEditModalTypes';

/** Hydrate saved appointment lengths separately from optional per-service timestamps. */
export function hydrateShootEditServiceSchedules({ shoot, serviceSource, catalog, fallbackSchedule, sqft }: {
  shoot: Pick<ShootDetails, 'serviceItems' | 'service_items' | 'timezone'>;
  serviceSource: SelectedServiceSource[];
  catalog: Service[];
  fallbackSchedule: ServiceScheduleFields;
  sqft: number | null;
}) {
  const rawServiceItems = Array.isArray(shoot.serviceItems)
    ? shoot.serviceItems
    : Array.isArray(shoot.service_items) ? shoot.service_items : [];
  const scheduleByServiceId = new Map<string, ServiceScheduleFields>();
  const durationByServiceId = new Map<string, number>();
  rawServiceItems.forEach(item => {
    const serviceId = getShootEditCatalogServiceId(item);
    if (!serviceId) return;
    if (Number(item.duration_minutes) > 0) durationByServiceId.set(serviceId, resolveShootDuration(item.duration_minutes));
    const { date, time } = getShootSchedule({
      scheduled_at: item.scheduled_at ?? item.scheduledAt,
      timezone: shoot.timezone,
    });
    if (date || time) {
      scheduleByServiceId.set(serviceId, {
        date,
        time,
        ...(durationByServiceId.has(serviceId) ? { duration_minutes: durationByServiceId.get(serviceId) } : {}),
      });
    }
  });

  const schedules: Record<string, ServiceScheduleFields> = {};
  serviceSource.forEach(service => {
    if (!service || typeof service !== 'object') return;
    const serviceId = getShootEditCatalogServiceId(service);
    if (!serviceId) return;
    const source = service as Record<string, unknown>;
    const directSchedule = getShootSchedule({
      scheduled_at: source.scheduled_at ?? source.scheduledAt,
      timezone: shoot.timezone,
    });
    schedules[serviceId] = scheduleByServiceId.get(serviceId) || {
      date: directSchedule.date || fallbackSchedule.date,
      time: directSchedule.time || fallbackSchedule.time,
    };
    schedules[serviceId].duration_minutes = resolveServiceShootDuration(
      catalog.find(item => String(item.id) === serviceId) ?? {}, sqft, durationByServiceId.get(serviceId),
    );
  });

  const inheritedIds = new Set(Object.entries(schedules)
    .filter(([, schedule]) => schedule.date === fallbackSchedule.date && schedule.time === fallbackSchedule.time)
    .map(([id]) => id));
  return { schedules, inheritedIds };
}
