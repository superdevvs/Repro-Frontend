import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InvoiceAdjustmentEditor } from './InvoiceAdjustmentEditor';

describe('InvoiceAdjustmentEditor discounts', () => {
  it('accepts a negative dollar amount and applies a new discount to the client balance', () => {
    const onAmountChange = vi.fn();
    const onBillsClientChange = vi.fn();
    render(<InvoiceAdjustmentEditor
      amount="" billsClient={false} chargeType="misc" description="Client discount"
      isEditing={false} isSaving={false} linkedShoots={[]} quantity="1" shootId=""
      onAmountChange={onAmountChange} onBillsClientChange={onBillsClientChange}
      onCancel={vi.fn()} onChargeTypeChange={vi.fn()} onDescriptionChange={vi.fn()}
      onPrefillVirtualStaging={vi.fn()} onQuantityChange={vi.fn()} onSave={vi.fn()} onShootIdChange={vi.fn()}
    />);

    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-30.00' } });

    expect(input.validity.rangeUnderflow).toBe(false);
    expect(onAmountChange).toHaveBeenCalledWith('-30.00');
    expect(onBillsClientChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Positive = charge. Negative = discount.')).toBeTruthy();
  });
});
