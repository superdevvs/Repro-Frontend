import { getBookedServiceQuantities, getBookedServiceUnitPrices, normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { calculatePricingBreakdown, type PricingDiscountType } from '@/utils/pricing';
import { getShootInvoiceAdjustmentTotal, isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const serviceId = (value: unknown) => { const item = record(value); return String(item.service_id ?? item.serviceId ?? item.id ?? ''); };
const numberOr = (value: unknown, fallback: number) => value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;

export type ApprovalService = { id: number; name: string; price: number; quantity: number; allow_multiple: boolean; [key: string]: unknown };

/** Canonical booked lines retain counts/prices; catalog metadata supplies the capability. */
export function getApprovalServices(value: unknown): Array<ApprovalService | string> {
  const shoot = record(value);
  const relationships = rows(shoot.services);
  const quantities = getBookedServiceQuantities(shoot);
  const prices = getBookedServiceUnitPrices(shoot);
  const source = [shoot.serviceItems, shoot.service_items, shoot.serviceObjects, shoot.services].map(rows).find(items => items.length) ?? [];
  return source.filter(item => !isInvoiceAdjustmentServiceItem(item)).flatMap((value): Array<ApprovalService | string> => {
    if (typeof value === 'string') return [value];
    const item = record(value);
    const id = serviceId(item);
    if (!id) return [];
    const metadata = { ...record(relationships.find(row => serviceId(row) === id)), ...record(item.service), ...item };
    const multiple = metadata.allow_multiple;
    return [{ ...metadata, id: Number(id), service_id: Number(id), name: String(metadata.name ?? metadata.service_name ?? 'Service'),
      price: prices[id] ?? numberOr(metadata.price, 0), quantity: normalizeBookingQuantity(quantities[id]),
      allow_multiple: multiple === true || multiple === 1 || multiple === '1' || multiple === 'true' }];
  });
}

export function getApprovalPricing(value: unknown, services: Array<ApprovalService | string>, quantities: Record<string, number>) {
  const shoot = record(value);
  const payment = record(shoot.payment);
  const financials = record(shoot.financials);
  const originalSubtotal = services.reduce((sum, service) => sum + (typeof service === 'string' ? 0 : service.price * service.quantity), 0);
  const serviceSubtotal = services.reduce((sum, service) => sum + (typeof service === 'string' ? 0 : service.price * normalizeBookingQuantity(quantities[String(service.id)] ?? service.quantity)), 0);
  const changed = services.some(service => typeof service !== 'string' && normalizeBookingQuantity(quantities[String(service.id)] ?? service.quantity) !== service.quantity);
  const savedBase = numberOr(payment.baseQuote ?? financials.baseQuote ?? shoot.baseQuote ?? shoot.base_quote, originalSubtotal);
  const rawTax = numberOr(shoot.tax_percent ?? shoot.taxPercent ?? payment.taxRate, NaN);
  const storedTax = numberOr(payment.taxAmount ?? financials.taxAmount ?? shoot.taxAmount ?? shoot.tax_amount, 0);
  const taxRate = Number.isFinite(rawTax) ? (rawTax > 1 ? rawTax / 100 : rawTax) : (savedBase > 0 ? storedTax / savedBase : 0);
  const savedTax = storedTax > 0 ? storedTax : Number((savedBase * taxRate).toFixed(2));
  const adjustment = getShootInvoiceAdjustmentTotal(shoot);
  if (!changed) return { baseQuote: savedBase, taxAmount: savedTax,
    totalQuote: numberOr(payment.totalQuote ?? financials.totalQuote ?? shoot.totalQuote ?? shoot.total_quote, savedBase + savedTax + adjustment) };
  const discountType = shoot.discount_type ?? shoot.discountType ?? payment.discount_type ?? payment.discountType;
  const discountValue = shoot.discount_value ?? shoot.discountValue ?? payment.discount_value ?? payment.discountValue;
  const pricing = calculatePricingBreakdown({ serviceSubtotal, taxRate,
    discountType: (discountType ?? (originalSubtotal > savedBase ? 'fixed' : null)) as PricingDiscountType,
    discountValue: numberOr(discountValue, Math.max(originalSubtotal - savedBase, 0)),
  });
  return { baseQuote: pricing.discountedSubtotal, taxAmount: pricing.taxAmount, totalQuote: Math.max(0, Number((pricing.totalQuote + adjustment).toFixed(2))) };
}
