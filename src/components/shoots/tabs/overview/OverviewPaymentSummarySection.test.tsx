import { fireEvent, render, screen } from '@testing-library/react';
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
  it('lets an admin enter a shoot discount and shows negative invoice adjustments', () => {
    const shoot = makeShoot();
    shoot.payment = { ...shoot.payment, discountType: 'fixed', discountValue: 30, invoiceAdjustmentsTotal: -30 };
    const updateField = vi.fn();
    render(<OverviewPaymentSummarySection
      isEditMode isAdmin isRep={false} isClient={false} isClientReleaseLocked={false}
      editedShoot={shoot} shoot={shoot} paymentTotalPaid={0} paymentBalance={76} updateField={updateField}
    />);

    expect(screen.getByText('$-30.00')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Client discount value'), { target: { value: '40' } });
    expect(updateField).toHaveBeenCalledWith('payment.discountValue', 40);
    expect(updateField).toHaveBeenCalledWith('adminAdjustedTotalQuote', null);
    fireEvent.change(screen.getByLabelText('Client discount'), { target: { value: 'none' } });
    expect(updateField).toHaveBeenCalledWith('payment.discountType', null);
    expect(updateField).toHaveBeenCalledWith('payment.discountValue', null);
  });

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
        updateField={vi.fn()}
      />,
    );

    expect(screen.getByText('Invoice adjustments:')).toBeTruthy();
    expect(screen.getByText('$20.00')).toBeTruthy();
    expect(screen.getAllByText('$126.00')).toHaveLength(2);
  });

  it('shows overpayment as refund or credit due', () => {
    const shoot = makeShoot();
    shoot.payment = {
      ...shoot.payment,
      totalPaid: 156,
      overpaymentAmount: 30,
      paymentStatus: 'paid',
    };

    render(
      <OverviewPaymentSummarySection
        isEditMode={false}
        isAdmin
        isRep={false}
        isClient={false}
        isClientReleaseLocked={false}
        editedShoot={shoot}
        shoot={shoot}
        paymentTotalPaid={156}
        paymentBalance={0}
        updateField={vi.fn()}
      />,
    );

    expect(screen.getByText('Refund/credit due:')).toBeTruthy();
    expect(screen.getByText('$30.00')).toBeTruthy();
  });

  it('offers one explicit adjusted-total control and leaves canonical lines read only', () => {
    const shoot = { ...makeShoot(), canRemoveAllServices: true };
    const updateField = vi.fn();

    render(
      <OverviewPaymentSummarySection
        isEditMode
        isAdmin
        isRep={false}
        isClient={false}
        isClientReleaseLocked={false}
        editedShoot={shoot}
        shoot={shoot}
        paymentTotalPaid={0}
        paymentBalance={126}
        updateField={updateField}
      />,
    );

    fireEvent.change(screen.getByLabelText('Adjusted Total'), { target: { value: '150' } });

    expect(updateField).toHaveBeenCalledWith('adminAdjustedTotalQuote', 150);
    expect(screen.queryByLabelText('Base Quote')).toBeNull();
    expect(screen.queryByLabelText('Tax')).toBeNull();
    expect(screen.queryByLabelText('Total')).toBeNull();
  });
});
