import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CancellationDecisionActions } from './CancellationDecisionActions';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

import { useIsMobile } from '@/hooks/use-mobile';

describe('CancellationDecisionActions', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it('renders inline Charge/Waive/Reject on desktop', () => {
    render(
      <CancellationDecisionActions
        shootId={12}
        onCharge={vi.fn()}
        onWaive={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Charge \$60/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Waive fee/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('opens a Vaul drawer with stacked actions on mobile', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const onCharge = vi.fn();
    render(
      <CancellationDecisionActions
        shootId={12}
        addressLabel="123 Main St"
        onCharge={onCharge}
        onWaive={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Charge \$60/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancellation-actions-open'));
    expect(screen.getByText('Cancellation actions')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Charge \$60/i }));
    expect(onCharge).toHaveBeenCalled();
  });
});
