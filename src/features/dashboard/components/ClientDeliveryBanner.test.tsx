import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClientDeliveryBanner } from './ClientDeliveryBanner';

const notification = {
  id: 91,
  shootId: 501,
  address: '501 Cross Device Lane',
  deliveredAt: '2026-08-20T08:00:00Z',
  seenAt: null,
};

describe('ClientDeliveryBanner', () => {
  it('shows the latest address and plural unseen count', () => {
    render(
      <ClientDeliveryBanner
        latest={notification}
        unseenCount={3}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('3 new deliveries')).toBeTruthy();
    expect(screen.getByText('Latest: 501 Cross Device Lane')).toBeTruthy();
  });

  it('uses singular copy and opens the selected delivery', () => {
    const onOpen = vi.fn();
    render(
      <ClientDeliveryBanner
        latest={notification}
        unseenCount={1}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText('1 new delivery')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /view delivery/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
