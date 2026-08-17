import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ShootData } from '@/types/shoots';
import { OverviewPaymentSummarySection } from './OverviewPaymentSummarySection';

const makeShoot = (): ShootData => ({
  id: '23',
  payment: {
    baseQuote: 100,
    taxAmount: 6,
    totalQuote: 126,
    totalPaid: 0,
    paymentStatus: 'unpaid',
    invoiceAdjustmentsTotal: 20,
    pendingPayments: [],
  },
} as ShootData);

describe('OverviewPaymentSummarySection invoice adjustments', () => {
  it('shows the adjustment as a separate order-total line', () => {
    const shoot = makeShoot();
    render(
      <OverviewPaymentSummarySection
        isEditMode={false}
        isAdmin
        isRep={false}
        isClient={false}
        isClientReleaseLocked={false}
        editedShoot={shoot}
        shoot={shoot}
        paymentTotalPaid={0}
        paymentBalance={126}
        editedPaymentBalance={126}
        setTaxAmountDirty={vi.fn()}
        updateField={vi.fn()}
      />,
    );

    expect(screen.getByText('Invoice adjustments:')).toBeTruthy();
    expect(screen.getByText('$20.00')).toBeTruthy();
    expect(screen.getAllByText('$126.00')).toHaveLength(2);
  });
});
