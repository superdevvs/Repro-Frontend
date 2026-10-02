import { getBookedServiceQuantities, normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';
import { asRecord, type ServicePackage } from './bookShootModel';
import { resolveShootDuration } from '@/utils/shootDuration';

export function restoreCachedServiceQuantities(services: ServicePackage[], quantityVersion: unknown): ServicePackage[] {
  // Older drafts copied catalog package counts; their bookings always used one.
  return services.map(service => ({ ...service, quantity: quantityVersion === 1 ? normalizeBookingQuantity(service.quantity) : 1 }));
}

/** Refresh new-draft timing without changing prices, quantities, or explicit snapshots. */
export function syncDraftServiceDurations(services: ServicePackage[], catalog: ServicePackage[]): ServicePackage[] {
  const byId = new Map(catalog.map(service => [service.id, service]));
  return services.map(service => {
    const current = byId.get(service.id);
    if (!current) return service;
    const timing = {
      shoot_duration_minutes: current.shoot_duration_minutes,
      booking_duration_default_minutes: current.booking_duration_default_minutes,
      booking_duration_min_minutes: current.booking_duration_min_minutes,
      booking_duration_max_minutes: current.booking_duration_max_minutes,
      booking_duration_defaults: current.booking_duration_defaults,
      booking_duration_tiers: current.pricing_type === 'variable'
        ? (current.sqft_ranges ?? []).map(({ sqft_from, sqft_to, duration }) => ({ sqft_from, sqft_to, duration })) : [],
    };
    const unchanged = Object.entries(timing).every(([key, value]) =>
      JSON.stringify(service[key as keyof ServicePackage]) === JSON.stringify(value));
    return unchanged ? service : { ...service, ...timing };
  });
}

export function hydrateBookedServiceSelection(catalog: ServicePackage[], value: unknown): ServicePackage[] {
  const shoot = asRecord(value);
  const bookedRows = (Array.isArray(shoot.serviceItems) ? shoot.serviceItems
    : Array.isArray(shoot.service_items) ? shoot.service_items : []).map(asRecord);
  const source = Array.isArray(shoot.services) ? shoot.services : bookedRows;
  const quantities = getBookedServiceQuantities(shoot);
  const selected = new Map<string, ServicePackage>();
  for (const value of source) {
    if (isInvoiceAdjustmentServiceItem(value)) continue;
    const item = asRecord(value);
    const id = String(item.service_id ?? item.serviceId ?? item.id ?? '');
    const service = catalog.find(option => option.id === id);
    if (!service) continue;
    const booked = bookedRows.find(row => String(row.service_id ?? row.serviceId ?? row.id) === id);
    const savedPrice = booked?.price ?? asRecord(item.pivot).price;
    const savedDuration = booked?.duration_minutes ?? asRecord(item.pivot).duration_minutes ?? item.duration_minutes;
    selected.set(id, {
      ...service,
      quantity: normalizeBookingQuantity(quantities[id]),
      ...(Number(savedDuration) > 0 ? { duration_minutes: resolveShootDuration(savedDuration) } : {}),
      ...(savedPrice != null && Number.isFinite(Number(savedPrice))
        ? { price: Number(savedPrice), booked_price: Number(savedPrice) } : {}),
    });
  }
  return [...selected.values()];
}
