import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapInvoiceMutationResponse, mapInvoiceResponse } from './invoiceService.mapper';
import { toClientBillingInvoiceViewData } from './clientBillingService';
import { toInvoiceViewDialogInvoice } from '@/pages/accountingPageUtils';
import { useShootDetailsModalPayments } from '@/components/shoots/modal/useShootDetailsModalPayments';
import type { ClientBillingItem } from '@/types/clientBilling';
import type { ShootData } from '@/types/shoots';

vi.mock('@/services/api', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));

const pricing = { service_subtotal: 310, discount_amount: 31, subtotal_before_discount: 310, subtotal: 279, tax: 14.79, total: 293.79 };
const invoice = { id: 115, subtotal: 279, tax: 14.79, total: 293.79, pricing_breakdown: pricing };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('invoice discount transport', () => {
  it('retains the saved discount through invoice list and adjustment-response mapping', () => {
    expect(mapInvoiceResponse(invoice)).toMatchObject({ subtotal: 279, tax: 14.79, total: 293.79, pricingBreakdown: pricing });
    expect(mapInvoiceMutationResponse({ invoice }).invoice.pricingBreakdown).toEqual(pricing);
  });

  it('preserves client billing tax and discount through the Accounting dialog adapter', () => {
    const item: ClientBillingItem = {
      id: 'invoice-115', source: 'invoice', sourceLabel: 'Invoice', property: 'Example property',
      amount: 293.79, amountPaid: 0, balance: 293.79, status: 'pending', bucket: 'upcoming',
      paymentRequiredToRelease: false, pricing_breakdown: pricing,
    };
    const view = toClientBillingInvoiceViewData(item);
    expect(view).toMatchObject({ subtotal: 279, tax: 14.79, total: 293.79, pricingBreakdown: pricing });
    expect(toInvoiceViewDialogInvoice(view)).toMatchObject({ pricingBreakdown: pricing, total: 293.79 });
  });

  it('retains a fully discounted zero subtotal in client billing', () => {
    const item: ClientBillingItem = {
      id: 'invoice-116', source: 'invoice', sourceLabel: 'Invoice', property: 'Example property',
      amount: 0, amountPaid: 0, balance: 0, status: 'paid', bucket: 'paid', paymentRequiredToRelease: false,
      pricingBreakdown: { ...pricing, discount_amount: 310, subtotal: 0, tax: 0, total: 0 },
    };
    expect(toClientBillingInvoiceViewData(item)).toMatchObject({ subtotal: 0, tax: 0, total: 0, pricingBreakdown: { discount_amount: 310 } });
  });

  it('retains the saved discount when opening an invoice from shoot details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: invoice }) }));
    const { result } = renderHook(() => useShootDetailsModalPayments({
      shoot: { id: '86' } as ShootData, refreshShoot: vi.fn(), formatTime: String, navigate: vi.fn(), toast: vi.fn(),
    }));
    await act(async () => { await result.current.handleShowInvoice(); });
    expect(result.current.selectedInvoice).toMatchObject({ subtotal: 279, tax: 14.79, total: 293.79, pricingBreakdown: pricing });
  });
});
