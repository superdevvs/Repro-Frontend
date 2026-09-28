import { getBookedServiceQuantities, normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';
import { asRecord, type ServicePackage } from './bookShootModel';

export function restoreCachedServiceQuantities(services: ServicePackage[], quantityVersion: unknown): ServicePackage[] {
  // Older drafts copied catalog package counts; their bookings always used one.
  return services.map(service => ({ ...service, quantity: quantityVersion === 1 ? normalizeBookingQuantity(service.quantity) : 1 }));
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
    selected.set(id, {
      ...service,
      quantity: normalizeBookingQuantity(quantities[id]),
      ...(savedPrice != null && Number.isFinite(Number(savedPrice))
        ? { price: Number(savedPrice), booked_price: Number(savedPrice) } : {}),
    });
  }
  return [...selected.values()];
}
