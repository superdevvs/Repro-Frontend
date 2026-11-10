import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ShootData } from '@/types/shoots';
import { ClientDeliveryNotice } from './ClientDeliveryNotice';

afterEach(cleanup);
const shoot = { id: '42', deliveryStatus: 'partially_delivered', total_quote: 400, total_paid: 200, payment_status: 'partial' } as unknown as ShootData;
describe('client delivery notice', () => {
  it('opens the existing payment action and explains a partial payment', () => {
    const onPayNow = vi.fn();
    render(<ClientDeliveryNotice shoot={shoot} onPayNow={onPayNow} />);
    expect(screen.getByText(/Your payment is recorded/)).toHaveTextContent('coming soon');
    fireEvent.click(screen.getByRole('button', { name: /Pay now/ }));
    expect(onPayNow).toHaveBeenCalledOnce();
  });
  it('does not offer payment again for a paid or bypassed shoot', () => {
    render(<ClientDeliveryNotice shoot={{ ...shoot, total_paid: 400, payment_status: 'paid' } as ShootData} onPayNow={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/content is unlocked/)).toBeInTheDocument();
  });
});
