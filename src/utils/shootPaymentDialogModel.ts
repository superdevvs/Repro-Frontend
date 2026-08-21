import type { PricingBreakdown } from '@/utils/pricing';
import {
  getShootServiceItems,
  type NormalizedShootServiceItem,
} from '@/utils/shootServiceItems';

type UnknownRecord = Record<string, unknown>;

export type ShootPaymentDialogModel = {
  shootId: string;
  amount: number;
  totalQuote: number;
  totalPaid: number;
  paymentStatus?: string;
  shootAddress?: string;
  shootServices: string[];
  serviceItems: NormalizedShootServiceItem[];
  shootDate?: string;
  shootTime?: string;
  clientName?: string;
  clientEmail?: string;
  pricing?: PricingBreakdown;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? value as UnknownRecord : {};

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const optionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
};

const finiteNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return undefined;
};

const buildFullAddress = (shoot: UnknownRecord, location: UnknownRecord): string | undefined => {
  const explicit = optionalString(
    location.fullAddress
      ?? location.full_address
      ?? shoot.fullAddress
      ?? shoot.full_address
      ?? shoot.property_address,
  );
  if (explicit) return explicit;

  const street = optionalString(location.address ?? shoot.address);
  const city = optionalString(location.city ?? shoot.city);
  const state = optionalString(location.state ?? shoot.state);
  const zip = optionalString(location.zip ?? shoot.zip);
  const locality = [city, state].filter(Boolean).join(', ');
  const localityWithZip = [locality, zip].filter(Boolean).join(' ');

  return [street, localityWithZip].filter(Boolean).join(', ') || undefined;
};

const buildPricing = (
  shoot: UnknownRecord,
  payment: UnknownRecord,
  totalQuote: number,
  totalPaid: number,
): PricingBreakdown | undefined => {
  const serviceSubtotal = finiteNumber(
    payment.serviceSubtotal,
    payment.service_subtotal,
    shoot.service_subtotal,
    shoot.base_quote,
  );
  const discountedSubtotal = finiteNumber(
    payment.discountedSubtotal,
    payment.discounted_subtotal,
    shoot.discounted_subtotal,
    shoot.base_quote,
  );
  const taxAmount = finiteNumber(payment.taxAmount, payment.tax_amount, shoot.tax_amount);

  if (serviceSubtotal === undefined || discountedSubtotal === undefined || taxAmount === undefined) {
    return undefined;
  }

  return {
    serviceSubtotal,
    discountType: optionalString(
      payment.discountType ?? payment.discount_type ?? shoot.discount_type,
    ) as PricingBreakdown['discountType'],
    discountValue: finiteNumber(
      payment.discountValue,
      payment.discount_value,
      shoot.discount_value,
    ) ?? null,
    discountAmount: finiteNumber(
      payment.discountAmount,
      payment.discount_amount,
      shoot.discount_amount,
    ) ?? Math.max(serviceSubtotal - discountedSubtotal, 0),
    discountedSubtotal,
    taxAmount,
    totalQuote,
    totalPaid,
  };
};

/**
 * Canonical adapter shared by Shoot Overview and the post-booking payment handoff.
 * It accepts both Resource and Presenter aliases, but refuses to create a payment
 * model until the server has supplied a shoot id, financial snapshot, and the
 * canonical service-item collection.
 */
export const buildShootPaymentDialogModel = (value: unknown): ShootPaymentDialogModel | null => {
  const shoot = asRecord(value);
  const payment = asRecord(shoot.payment);
  const location = asRecord(shoot.location);
  const client = asRecord(shoot.client);
  const shootId = optionalString(shoot.id);
  const hasCanonicalServiceItems = Array.isArray(shoot.serviceItems)
    || Array.isArray(shoot.service_items)
    || Array.isArray(shoot.serviceObjects);
  const totalQuote = finiteNumber(
    payment.totalQuote,
    payment.total_quote,
    shoot.total_quote,
    shoot.order_total,
    shoot.orderTotal,
  );
  const totalPaid = finiteNumber(
    payment.totalPaid,
    payment.total_paid,
    shoot.total_paid,
  );
  const explicitBalance = finiteNumber(
    payment.remainingBalance,
    payment.remaining_balance,
    shoot.remaining_balance,
  );

  if (!shootId || !hasCanonicalServiceItems || totalQuote === undefined) {
    return null;
  }

  const resolvedTotalPaid = totalPaid ?? Math.max(totalQuote - (explicitBalance ?? totalQuote), 0);
  const amount = Math.max(explicitBalance ?? totalQuote - resolvedTotalPaid, 0);
  const serviceItems = getShootServiceItems(shoot);
  const serviceNames = serviceItems
    .map((item) => item.name)
    .filter((name) => Boolean(name));
  const fallbackServices = asArray(shoot.services_list ?? shoot.services)
    .map((service) => {
      if (typeof service === 'string') return service;
      const record = asRecord(service);
      return optionalString(record.name ?? record.label);
    })
    .filter((name): name is string => Boolean(name));

  return {
    shootId,
    amount,
    totalQuote,
    totalPaid: resolvedTotalPaid,
    paymentStatus: optionalString(
      payment.paymentStatus
        ?? payment.payment_status
        ?? shoot.payment_status
        ?? shoot.paymentStatus,
    ),
    shootAddress: buildFullAddress(shoot, location),
    shootServices: Array.from(new Set(serviceNames.length > 0 ? serviceNames : fallbackServices)),
    serviceItems: serviceItems.filter((item) => item.balanceDue > 0.01),
    shootDate: optionalString(
      shoot.scheduledDate ?? shoot.scheduled_date ?? shoot.scheduled_at ?? shoot.scheduledAt,
    ),
    shootTime: optionalString(shoot.time),
    clientName: optionalString(client.name),
    clientEmail: optionalString(client.email),
    pricing: buildPricing(shoot, payment, totalQuote, resolvedTotalPaid),
  };
};
