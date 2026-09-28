import { isInvoiceAdjustmentServiceItem } from './shootServiceItems';

export function normalizeBookingQuantity(value: unknown): number {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

/** Catalog `quantity` describes the product; only booked lines/pivots describe an order. */
export function getBookedServiceQuantities(value: unknown): Record<string, number> {
  const shoot = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const quantities: Record<string, number> = {};
  for (const key of ['serviceItems', 'service_items', 'service_lines', 'serviceObjects', 'services']) {
    const source = shoot[key];
    if (!Array.isArray(source)) continue;
    for (const entry of source) {
      if (!entry || typeof entry !== 'object' || isInvoiceAdjustmentServiceItem(entry)) continue;
      const item = entry as Record<string, unknown>;
      const pivot = item.pivot && typeof item.pivot === 'object' ? item.pivot as Record<string, unknown> : {};
      const id = item.service_id ?? item.serviceId ?? item.id;
      if (id == null || quantities[String(id)] !== undefined) continue;
      const quantity = key === 'services' ? pivot.quantity : item.quantity ?? pivot.quantity;
      // A service relationship may include the catalog's item-count field.
      if (quantity != null) quantities[String(id)] = normalizeBookingQuantity(quantity);
    }
  }
  return quantities;
}

export function getBookedServiceUnitPrices(value: unknown): Record<string, number> {
  const shoot = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const prices: Record<string, number> = {};
  for (const key of ['serviceItems', 'service_items', 'service_lines', 'serviceObjects', 'services']) {
    const source = shoot[key];
    if (!Array.isArray(source)) continue;
    for (const entry of source) {
      if (!entry || typeof entry !== 'object' || isInvoiceAdjustmentServiceItem(entry)) continue;
      const item = entry as Record<string, unknown>;
      const pivot = item.pivot && typeof item.pivot === 'object' ? item.pivot as Record<string, unknown> : {};
      const id = item.service_id ?? item.serviceId ?? item.id;
      if (id == null || prices[String(id)] !== undefined) continue;
      const rawPrice = key === 'services' ? pivot.price : item.price ?? pivot.price ?? item.unit_amount;
      if (rawPrice != null && Number.isFinite(Number(rawPrice))) prices[String(id)] = Number(rawPrice);
    }
  }
  return prices;
}
