import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { EmailMessageDetail } from './EmailMessageDetail';
import type { Message } from '@/types/messaging';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('./EmailActivityPanel', () => ({ EmailActivityPanel: () => null }));
const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/messaging', () => ({ composeEmail: send, retryEmail: send, cancelEmail: send }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function view(status: string) {
  const message = { id: 10457, status, channel: 'EMAIL', direction: 'OUTBOUND', provider: 'CAKEMAIL',
    from_address: 'office@example.test', to_address: 'recipient@example.test',
    subject: 'Invoice Requires Approval', body_text: 'A payout invoice is waiting for review.',
    created_at: '2026-10-28T04:10:17Z', error_message: 'Recipient email notification permission is disabled.' } as Message;
  return render(<MemoryRouter><EmailMessageDetail message={message} onClose={vi.fn()} onRefresh={vi.fn()} /></MemoryRouter>);
}

it('opens a blocked message and explains why delivery was blocked without sending it', () => {
  view('BLOCKED');
  expect(screen.getByText('Blocked')).toBeVisible();
  expect(screen.getByText('Delivery blocked')).toBeVisible();
  expect(screen.getByText('Recipient email notification permission is disabled.')).toBeVisible();
  expect(screen.getByText('Invoice Requires Approval')).toBeVisible();
  expect(send).not.toHaveBeenCalled();
});

it('renders an unknown future status without crashing', () => {
  view('PROVIDER_PENDING');
  expect(screen.getByText('PROVIDER_PENDING')).toBeVisible();
  expect(send).not.toHaveBeenCalled();
});
