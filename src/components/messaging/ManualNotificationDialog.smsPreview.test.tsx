import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ManualNotificationDialog } from './ManualNotificationDialog';

const mocks = vi.hoisted(() => ({ preview: vi.fn(), send: vi.fn(), recipients: vi.fn().mockResolvedValue({ recipients: [] }) }));
vi.mock('@/services/messaging', () => ({
  MANUAL_NOTIFICATION_TYPES: ['shoot_scheduled', 'shoot_on_hold', 'shoot_cancelled', 'shoot_ready', 'payment_due', 'payment_receipt'],
  previewManualNotification: mocks.preview,
  sendManualNotification: mocks.send,
  getNotificationRecipients: mocks.recipients,
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Manual notification channel preview', () => {
  it.each(['Shoot on hold', 'Shoot cancelled'])('can preview and send %s to the sales rep', async (label) => {
    mocks.preview.mockResolvedValue({ subject: 'Notification', body_text: 'Preview message', body_html: null, missing_variables: [] });
    mocks.send.mockResolvedValue({ channel: 'email' });
    mocks.recipients.mockImplementation(async (_shootId, recipientType) => ({ recipients: recipientType === 'rep' ? [{ id: 9, name: 'Alex Sales', recipient_type: 'rep' }] : [] }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ManualNotificationDialog shootId={104} open onClose={vi.fn()} /></QueryClientProvider>);
    await screen.findByText('Preview message');
    fireEvent.click(screen.getByRole('button', { name: 'Photographer' }));
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith(expect.objectContaining({ recipient_type: 'photographer' })));
    fireEvent.click(screen.getByRole('combobox', { name: 'Notification' }));
    fireEvent.click(await screen.findByRole('option', { name: label }));
    expect(screen.getByRole('button', { name: 'Photographer' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Sales rep' }));
    expect(await screen.findByText('Alex Sales')).toBeVisible();
    const type = label === 'Shoot on hold' ? 'shoot_on_hold' : 'shoot_cancelled';
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith({ shoot_id: 104, type, recipient_type: 'rep', channel: 'email' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Notify$/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /^Notify$/ }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith({ shoot_id: 104, type, recipient_type: 'rep', channel: 'email' }));
  });

  it.each([['Shoot cancelled', 'shoot_cancelled'], ['Shoot on hold', 'shoot_on_hold']])('previews and sends %s to the assigned photographer', async (label, type) => {
    mocks.preview.mockResolvedValue({ subject: 'Cancelled', body_text: 'Cancellation message', body_html: null, missing_variables: [] });
    mocks.send.mockResolvedValue({ channel: 'email' });
    mocks.recipients.mockResolvedValue({ recipients: [{ id: 8, name: 'Assigned Photographer', recipient_type: 'photographer' }] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ManualNotificationDialog shootId={104} open onClose={vi.fn()} /></QueryClientProvider>);
    await screen.findByText('Cancellation message');
    fireEvent.click(screen.getByRole('button', { name: 'Photographer' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Notification' }));
    fireEvent.click(await screen.findByRole('option', { name: label }));
    expect(screen.getByRole('button', { name: 'Photographer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Sales rep' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Client' })).toBeVisible();
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith({ shoot_id: 104, type, recipient_type: 'photographer', channel: 'email' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Notify$/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /^Notify$/ }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith({ shoot_id: 104, type, recipient_type: 'photographer', channel: 'email' }));
  });

  it.each([
    ['Shoot cancelled', 'Photographer', 'Shoot on hold', 'Photographer', 'shoot_on_hold', 'photographer'],
    ['Shoot cancelled', 'Sales rep', 'Shoot scheduled', 'Client', 'shoot_scheduled', 'client'],
    ['Shoot cancelled', 'Sales rep', 'Shoot on hold', 'Sales rep', 'shoot_on_hold', 'rep'],
    ['Shoot on hold', 'Sales rep', 'Shoot cancelled', 'Sales rep', 'shoot_cancelled', 'rep'],
    ['Shoot cancelled', 'Photographer', 'Shoot scheduled', 'Photographer', 'shoot_scheduled', 'photographer'],
  ])('switches %s / %s to %s with %s selected', async (initialLabel, recipient, nextLabel, selected, type, recipientType) => {
    mocks.preview.mockResolvedValue({ subject: 'Notification', body_text: 'Preview message', body_html: null, missing_variables: [] });
    mocks.recipients.mockResolvedValue({ recipients: [] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ManualNotificationDialog shootId={104} open onClose={vi.fn()} /></QueryClientProvider>);
    await screen.findByText('Preview message');
    fireEvent.click(screen.getByRole('combobox', { name: 'Notification' }));
    fireEvent.click(await screen.findByRole('option', { name: initialLabel }));
    fireEvent.click(screen.getByRole('button', { name: recipient }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Notification' }));
    fireEvent.click(await screen.findByRole('option', { name: nextLabel }));
    expect(screen.getByRole('button', { name: selected })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith({ shoot_id: 104, type, recipient_type: recipientType, channel: 'email' }));
    expect(mocks.preview.mock.calls.some(([payload]) => payload.type === 'shoot_scheduled' && payload.recipient_type === 'rep')).toBe(false);
  });

  it('fetches the SMS template on channel change and uses that channel when sending', async () => {
    mocks.preview.mockImplementation(async ({ channel }: { channel: string }) => ({
      subject: channel === 'sms' ? '' : 'Detailed email',
      body_html: channel === 'sms' ? null : '<p>Full email information</p>',
      body_text: channel === 'sms' ? 'Shoot: 104 Test Lane. Details: /shoots/104' : 'Full email information',
      missing_variables: [],
    }));
    mocks.send.mockResolvedValue({ channel: 'sms' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}>
      <ManualNotificationDialog shootId={104} open onClose={vi.fn()} />
    </QueryClientProvider>);

    expect(await screen.findByText('Full email information')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^SMS$/ }));
    expect(await screen.findByText('Shoot: 104 Test Lane. Details: /shoots/104')).toBeInTheDocument();
    expect(mocks.preview).toHaveBeenLastCalledWith({ shoot_id: 104, type: 'shoot_scheduled', recipient_type: 'client', channel: 'sms' });
    expect(screen.queryByText('Full email information')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Notify$/ }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith({ shoot_id: 104, type: 'shoot_scheduled', recipient_type: 'client', channel: 'sms' }));
  });
});
