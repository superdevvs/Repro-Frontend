export type PricingDiscountType = 'fixed' | 'percent' | 'percentage' | null | undefined;

export interface PricingBreakdown {
  serviceSubtotal: number;
  discountType: PricingDiscountType;
  discountValue: number | null;
  discountAmount: number;
  discountedSubtotal: number;
  taxAmount: number;
  totalQuote: number;
  totalPaid?: number;
}

/** Keep financial fees whole, including legacy catalogue rows without a flag. */
export const isDiscountEligibleService = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const nested = row.service && typeof row.service === 'object' ? row.service as Record<string, unknown> : {};
  const financialOnly = row.financial_only ?? nested.financial_only;
  if (financialOnly === true || financialOnly === 1 || financialOnly === '1') return false;
  return !/\b(?:travel|mileage|cancell?ation)\b|\bhold\s+fee\b/i.test(String(row.name ?? row.service_name ?? nested.name ?? ''));
};

const TAX_RATES_BY_STATE: Record<string, number> = {
  maryland: 0.06,
  md: 0.06,
  'district of columbia': 0.0575,
  dc: 0.0575,
  'washington dc': 0.0575,
  virginia: 0.053,
  va: 0.053,
};

const roundCurrency = (value: number) => {
  const cents = value * 100;
  // Scale the floating-point tolerance with the amount so decimal half-cents
  // (e.g. 280.25 * 6% = 16.815) round up like the server's currency rounding.
  return Math.round(cents + Number.EPSILON * Math.abs(cents)) / 100;
};

export const getTaxRateForState = (state?: string | null) => {
  const normalizedState = String(state || '').trim().toLowerCase();
  return TAX_RATES_BY_STATE[normalizedState] ?? 0;
};

export const calculateDiscountAmount = (
  serviceSubtotal: number,
  discountType?: PricingDiscountType,
  discountValue?: number | null,
) => {
  const subtotal = Math.max(Number(serviceSubtotal || 0), 0);
  const value = Math.max(Number(discountValue || 0), 0);
  const normalizedType = String(discountType || '').trim().toLowerCase();

  if (!subtotal || !value) {
    return 0;
  }

  const rawAmount =
    normalizedType === 'percent' || normalizedType === 'percentage'
      ? subtotal * Math.min(value, 100) / 100
      : normalizedType === 'fixed'
        ? value
        : 0;

  return roundCurrency(Math.min(rawAmount, subtotal));
};

export const calculatePricingBreakdown = ({
  serviceSubtotal,
  discountEligibleSubtotal,
  discountType,
  discountValue,
  taxRate,
  totalPaid,
}: {
  serviceSubtotal: number;
  discountEligibleSubtotal?: number;
  discountType?: PricingDiscountType;
  discountValue?: number | null;
  taxRate?: number;
  totalPaid?: number;
}): PricingBreakdown => {
  const subtotal = roundCurrency(Math.max(Number(serviceSubtotal || 0), 0));
  const resolvedTaxRate = Math.max(Number(taxRate || 0), 0);
  const eligibleSubtotal = Math.min(subtotal, roundCurrency(Math.max(Number(discountEligibleSubtotal ?? subtotal), 0)));
  const discountAmount = calculateDiscountAmount(eligibleSubtotal, discountType, discountValue);
  const discountedSubtotal = roundCurrency(Math.max(subtotal - discountAmount, 0));
  const taxAmount = roundCurrency(discountedSubtotal * resolvedTaxRate);
  const totalQuote = roundCurrency(discountedSubtotal + taxAmount);

  return {
    serviceSubtotal: subtotal,
    discountType: discountType ?? null,
    discountValue: discountValue ?? null,
    discountAmount,
    discountedSubtotal,
    taxAmount,
    totalQuote,
    totalPaid,
  };
};
