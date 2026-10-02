import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EmailActivityPanel } from './EmailActivityPanel';
import type { Message } from '@/types/messaging';

const activity = vi.hoisted(() => vi.fn());
vi.mock('@/services/messaging', () => ({ getEmailActivity: activity }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 1 }, role: 'admin' }) }));
const message = { id: 15, direction: 'OUTBOUND', provider: 'RESEND', status: 'SENT' } as Message;
beforeEach(() => { activity.mockReset(); });
afterEach(cleanup);
function view(value = message) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><EmailActivityPanel message={value} /></QueryClientProvider>);
}

it('shows delivery and engagement counts and expands the event timeline', async () => {
  activity.mockResolvedValue({ status: 'DELIVERED', open_count: 3, click_count: 1, provider_logs_available: true,
    events: [{ id: 'open', type: 'opened', at: '2026-10-02T04:00:00Z' }] });
  view();
  expect(await screen.findByText('delivered')).toBeVisible();
  expect(screen.getByText('3')).toBeVisible();
  expect(screen.getByText('1')).toBeVisible();
  fireEvent.click(screen.getByText('Event timeline (1)'));
  expect(screen.getByText('Opened')).toBeVisible();
  expect(activity).toHaveBeenCalledWith(15);
});

it('shows CakeMail suppression even when the saved message was accepted', async () => {
  activity.mockResolvedValue({ status: 'FAILED', open_count: 0, click_count: 0, provider_logs_available: true,
    events: [{ id: 'reject', type: 'rejected', at: '2026-10-02T04:00:00Z', detail: 'suppressed' }] });
  view({ ...message, provider: 'CAKEMAIL' });
  expect(await screen.findByText('suppressed')).toBeVisible();
  expect(screen.getByText('failed')).toBeVisible();
});

it('does not request provider activity for an internal or inbound message', () => {
  const internal = view({ ...message, provider: 'INTERNAL' });
  expect(screen.queryByRole('region', { name: 'Email activity' })).not.toBeInTheDocument();
  internal.unmount();
  view({ ...message, direction: 'INBOUND' });
  expect(activity).not.toHaveBeenCalled();
});

it('offers a retry when activity cannot be loaded', async () => {
  activity.mockRejectedValue(new Error('unavailable'));
  view();
  expect(await screen.findByRole('alert')).toHaveTextContent('Email activity could not be loaded');
  expect(screen.getByRole('button', { name: 'Refresh email activity' })).toBeEnabled();
});
