import { describe, expect, it } from 'vitest';
import { resolveInvoicePricingDisplay } from './invoicePricingSummary';

describe('saved invoice pricing display', () => {
  it.each(['pricing_breakdown', 'pricingBreakdown'] as const)('reads the reported invoice from %s without changing saved totals', (key) => {
    const pricing = resolveInvoicePricingDisplay({
      subtotal: 279, tax: 14.79, total: 293.79,
      [key]: { subtotal_before_discount: 310, discount_amount: 31, pricing_adjustment_amount: 0 },
    });
    expect(pricing).toMatchObject({ subtotalBeforeDiscount: 310, discountAmount: 31, subtotal: 279, tax: 14.79, total: 293.79 });
    expect(pricing.rows.map(({ amount }) => amount)).toEqual([310, -31, 279, 14.79]);
  });

  it('preserves signed manual credits already included in the gross and net amounts', () => {
    const invoice = {
      subtotal: 80, tax: 4.8, total: 84.8,
      pricing_breakdown: { subtotal_before_discount: 110, discount_amount: 30 },
      items: [{ total_amount: 120 }, { total_amount: -10, description: 'Invoice credit' }],
    };
    expect(resolveInvoicePricingDisplay(invoice).rows.map(({ amount }) => amount)).toEqual([110, -30, 80, 4.8]);
    expect(resolveInvoicePricingDisplay(invoice).total).toBe(84.8);
  });

  it('does not infer a discount from current client defaults, shoot discounts or negative invoice items', () => {
    const invoice = {
      subtotal: 279, tax: 14.79, total: 293.79,
      items: [{ total_amount: 310 }, { total_amount: -31, description: 'Discount' }],
      client: { discount: 50 }, shoot: { discount_amount: 31 },
    };
    expect(resolveInvoicePricingDisplay(invoice).rows).toEqual([
      { key: 'subtotal', label: 'Subtotal:', amount: 279 },
      { key: 'tax', label: 'Tax:', amount: 14.79 },
    ]);
  });

  it('treats a canonical zero as authoritative over stale top-level discount aliases', () => {
    const pricing = resolveInvoicePricingDisplay({
      subtotal: 310, total: 310, discount_amount: 31, discountAmount: 40,
      pricingBreakdown: { discount_amount: 0, subtotal_before_discount: 310 },
      pricing_breakdown: { discount_amount: 31, subtotal_before_discount: 341 },
    });
    expect(pricing.rows).toEqual([{ key: 'subtotal', label: 'Subtotal:', amount: 310 }]);
  });

  it.each([-31, 25])('shows a signed legacy pricing adjustment of %s without calling it a discount', (adjustment) => {
    const pricing = resolveInvoicePricingDisplay({
      subtotal: 310 + adjustment, total: 310 + adjustment,
      pricing_breakdown: { subtotal_before_discount: 310, pricing_adjustment_amount: adjustment },
    });
    expect(pricing.rows).toEqual([
      { key: 'gross', label: 'Subtotal before adjustments:', amount: 310 },
      { key: 'pricing-adjustment', label: 'Pricing adjustment:', amount: adjustment },
      { key: 'subtotal', label: 'Subtotal after adjustments:', amount: 310 + adjustment },
    ]);
  });

  it('supports saved top-level aliases and finite numeric strings without a canonical breakdown', () => {
    expect(resolveInvoicePricingDisplay({
      subtotal: '279', total: '293.79', tax: '14.79', discountAmount: '31', subtotalBeforeDiscount: '310',
    })).toMatchObject({ subtotalBeforeDiscount: 310, discountAmount: 31, subtotal: 279, tax: 14.79, total: 293.79 });
    expect(resolveInvoicePricingDisplay({
      subtotal: 279, total: 293.79, discount_amount: 31, subtotal_before_discount: 310,
    }).discountAmount).toBe(31);
  });

  it('can reconstruct only the display gross from saved amounts while keeping the net authoritative', () => {
    const pricing = resolveInvoicePricingDisplay({
      subtotal: 304, total: 304,
      pricing_breakdown: { discount_amount: 31, pricing_adjustment_amount: 25 },
    });
    expect(pricing.subtotalBeforeDiscount).toBe(310);
    expect(pricing.rows.map(({ amount }) => amount)).toEqual([310, -31, 25, 304]);
    expect(pricing.total).toBe(304);
  });

  it('ignores invalid discount values and leaves legacy invoices unchanged', () => {
    expect(resolveInvoicePricingDisplay({ amount: 100 }).rows).toEqual([{ key: 'subtotal', label: 'Subtotal:', amount: 100 }]);
    expect(resolveInvoicePricingDisplay({
      subtotal: 100, total: 100,
      pricing_breakdown: { discount_amount: 'invalid', pricing_adjustment_amount: Infinity },
    }).rows).toEqual([{ key: 'subtotal', label: 'Subtotal:', amount: 100 }]);
  });

  it.each([
    ['net', 'Item amounts already include their shoot discounts.'],
    ['mixed', 'Some item amounts already include shoot discounts.'],
    ['gross', null],
    ['unknown', null],
  ] as const)('clarifies %s item amounts only when a discount breakdown is shown', (basis, note) => {
    expect(resolveInvoicePricingDisplay({
      subtotal: 279, total: 279,
      pricing_breakdown: { line_amount_basis: basis, discount_amount: 31, subtotal_before_discount: 310 },
    }).itemAmountNote).toBe(note);
    expect(resolveInvoicePricingDisplay({
      subtotal: 310, total: 310,
      pricing_breakdown: { line_amount_basis: basis, discount_amount: 0, subtotal_before_discount: 310 },
    }).itemAmountNote).toBeNull();
  });
});
