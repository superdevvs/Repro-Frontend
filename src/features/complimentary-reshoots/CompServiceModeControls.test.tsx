import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompServiceModeControls } from './CompServiceModeControls';

describe('CompServiceModeControls', () => {
  it('disables and explains sales-rep pay when the shoot has no assigned rep', () => {
    render(
      <CompServiceModeControls
        enabled
        onEnabledChange={vi.fn()}
        reasonCode="company_error"
        onReasonCodeChange={vi.fn()}
        reasonNote=""
        onReasonNoteChange={vi.fn()}
        payPhotographer={false}
        onPayPhotographerChange={vi.fn()}
        paySalesRep={false}
        onPaySalesRepChange={vi.fn()}
        clientPays={false}
        onClientPaysChange={vi.fn()}
        hasSalesRep={false}
      />,
    );

    expect(screen.getByRole('switch', { name: 'Pay sales rep' })).toBeDisabled();
    expect(screen.getByText('None assigned')).toBeInTheDocument();
  });

  it('makes client billing explicit and reports billing changes', () => {
    const onClientPaysChange = vi.fn();

    render(
      <CompServiceModeControls
        enabled
        onEnabledChange={vi.fn()}
        reasonCode="company_error"
        onReasonCodeChange={vi.fn()}
        reasonNote=""
        onReasonNoteChange={vi.fn()}
        payPhotographer={false}
        onPayPhotographerChange={vi.fn()}
        paySalesRep={false}
        onPaySalesRepChange={vi.fn()}
        clientPays={false}
        onClientPaysChange={onClientPaysChange}
        hasSalesRep
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Bill client for return visit' }));

    expect(screen.getByText('Bill client')).toBeInTheDocument();
    expect(onClientPaysChange).toHaveBeenCalledWith(true);
  });

  it('shows the internal note only for the Other reason', () => {
    const sharedProps = {
      enabled: true,
      onEnabledChange: vi.fn(),
      onReasonCodeChange: vi.fn(),
      reasonNote: '',
      onReasonNoteChange: vi.fn(),
      payPhotographer: false,
      onPayPhotographerChange: vi.fn(),
      paySalesRep: false,
      onPaySalesRepChange: vi.fn(),
      clientPays: false,
      onClientPaysChange: vi.fn(),
      hasSalesRep: true,
    } as const;

    const { rerender } = render(
      <CompServiceModeControls {...sharedProps} reasonCode="company_error" />,
    );
    expect(screen.queryByLabelText('Internal note')).not.toBeInTheDocument();

    rerender(<CompServiceModeControls {...sharedProps} reasonCode="other" />);
    expect(screen.getByLabelText('Internal note')).toBeInTheDocument();
  });
});
