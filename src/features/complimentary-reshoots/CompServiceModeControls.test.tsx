import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
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
        hasSalesRep={false}
      />,
    );

    expect(screen.getByRole('switch', { name: 'Pay sales rep' })).toBeDisabled();
    expect(screen.getByText('None assigned')).toBeInTheDocument();
    expect(screen.getByText('No sales rep is assigned, so only photographer pay is available.')).toBeInTheDocument();
  });
});
