type SavedAmount = number | string | null;

interface SavedPricingBreakdown {
  discount_amount?: SavedAmount;
  subtotal_before_discount?: SavedAmount;
  pricing_adjustment_amount?: SavedAmount;
  line_amount_basis?: 'gross' | 'net' | 'mixed' | 'unknown';
}

export interface InvoicePricingDisplaySource {
  subtotal?: SavedAmount;
  tax?: SavedAmount;
  total?: SavedAmount;
  amount?: SavedAmount;
  pricingBreakdown?: SavedPricingBreakdown | null;
  pricing_breakdown?: SavedPricingBreakdown | null;
  discountAmount?: SavedAmount;
  discount_amount?: SavedAmount;
  subtotalBeforeDiscount?: SavedAmount;
  subtotal_before_discount?: SavedAmount;
}

export interface InvoicePricingSummaryRow {
  key: 'gross' | 'discount' | 'pricing-adjustment' | 'subtotal' | 'tax';
  label: string;
  amount: number;
}

const finiteAmount = (value: SavedAmount | undefined, fallback = 0): number => {
  if (value == null || value === '') return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
};

/** Display saved invoice pricing only. Item credits and current client defaults
 * must never be used to infer another discount or recalculate the net total. */
export const resolveInvoicePricingDisplay = (invoice: InvoicePricingDisplaySource) => {
  const total = finiteAmount(invoice.total ?? invoice.amount);
  const tax = finiteAmount(invoice.tax);
  const subtotal = finiteAmount(invoice.subtotal, Math.max(total - tax, 0));
  const breakdown = invoice.pricingBreakdown ?? invoice.pricing_breakdown;
  // A canonical breakdown (including zero) takes precedence over legacy aliases.
  const discountAmount = Math.max(0, finiteAmount(breakdown
    ? breakdown.discount_amount
    : invoice.discountAmount ?? invoice.discount_amount));
  const pricingAdjustmentAmount = finiteAmount(breakdown?.pricing_adjustment_amount);
  const subtotalBeforeDiscount = finiteAmount(breakdown
    ? breakdown.subtotal_before_discount
    : invoice.subtotalBeforeDiscount ?? invoice.subtotal_before_discount,
  subtotal + discountAmount - pricingAdjustmentAmount);
  const hasAdjustment = pricingAdjustmentAmount !== 0;
  const hasBreakdown = discountAmount > 0 || hasAdjustment;
  const itemAmountNote = discountAmount > 0
    ? breakdown?.line_amount_basis === 'net'
      ? 'Item amounts already include their shoot discounts.'
      : breakdown?.line_amount_basis === 'mixed'
        ? 'Some item amounts already include shoot discounts.'
        : null
    : null;
  const rows: InvoicePricingSummaryRow[] = [];

  if (hasBreakdown) {
    rows.push({
      key: 'gross',
      label: hasAdjustment ? 'Subtotal before adjustments:' : 'Subtotal before discount:',
      amount: subtotalBeforeDiscount,
    });
  }
  if (discountAmount > 0) rows.push({ key: 'discount', label: 'Discount:', amount: -discountAmount });
  if (hasAdjustment) rows.push({ key: 'pricing-adjustment', label: 'Pricing adjustment:', amount: pricingAdjustmentAmount });
  rows.push({
    key: 'subtotal',
    label: hasAdjustment ? 'Subtotal after adjustments:' : hasBreakdown ? 'Subtotal after discount:' : 'Subtotal:',
    amount: subtotal,
  });
  if (tax > 0) rows.push({ key: 'tax', label: 'Tax:', amount: tax });

  return { subtotalBeforeDiscount, discountAmount, pricingAdjustmentAmount, subtotal, tax, total, rows, itemAmountNote };
};
