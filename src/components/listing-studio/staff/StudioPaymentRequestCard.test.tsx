import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { StudioPaymentRequestCard } from './StudioPaymentRequestCard';
import { billingRequest } from './staffFixtures.test-data';
import { listingStudioStaff } from '@/services/listingStudioStaffService';

vi.mock('@/services/listingStudioStaffService', () => ({ listingStudioStaff: { emailRequest: vi.fn(), cancelRequest: vi.fn() } }));
const changed = vi.fn();
function view(request = billingRequest) { return render(<StudioPaymentRequestCard actorId="9" clientId="42" request={request} onChanged={changed} />); }
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });
afterEach(cleanup);
describe('staff payment-request sharing', () => {
  it('does not invent a zero price before an upgrade has been reviewed', () => {
    view({ ...billingRequest, kind: 'subscription_upgrade', amountCents: null });
    expect(screen.getByText('Calculated at client review')).toBeInTheDocument();
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
  });
  it('does not email automatically and copies only an owned client review link', async () => {
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(); view();
    expect(listingStudioStaff.emailRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Copy client review link' }));
    expect(copy).toHaveBeenCalledWith(window.location.origin + billingRequest.appUrl);
    expect(screen.getByRole('status')).toHaveTextContent('Review link copied');
    expect(listingStudioStaff.emailRequest).not.toHaveBeenCalled();
  });
  it('provides a selectable safe fallback if clipboard permission is denied', async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied')); view();
    await user.click(screen.getByRole('button', { name: 'Copy client review link' }));
    expect(await screen.findByLabelText('Client review link')).toHaveValue(window.location.origin + billingRequest.appUrl);
  });
  it('never exposes a hosted Stripe URL to staff', () => {
    view({ ...billingRequest, appUrl: 'https://checkout.stripe.com/c/pay/test' });
    expect(screen.getByRole('button', { name: 'Copy client review link' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('could not be verified');
    expect(screen.queryByDisplayValue(/stripe/)).not.toBeInTheDocument();
  });
  it('sends only after the explicit click and retries the identical email key', async () => {
    const user = userEvent.setup(); vi.mocked(listingStudioStaff.emailRequest).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ request: { ...billingRequest, email: { status: 'queued', lastSentAt: null } }, delivery: { status: 'queued', created: false } }); view();
    await user.click(screen.getByRole('button', { name: 'Send to registered email' })); await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Send to registered email' }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(vi.mocked(listingStudioStaff.emailRequest).mock.calls[1]).toEqual(vi.mocked(listingStudioStaff.emailRequest).mock.calls[0]);
    expect(vi.mocked(listingStudioStaff.emailRequest).mock.calls[0].slice(0, 2)).toEqual(['42', billingRequest.id]);
    expect(screen.getByRole('status')).toHaveTextContent('Email queued');
  });
  it('requires a confirmation before cancelling and respects server capabilities', async () => {
    const user = userEvent.setup(); vi.mocked(listingStudioStaff.cancelRequest).mockResolvedValue({ ...billingRequest, status: 'cancelled' }); view();
    await user.click(screen.getByRole('button', { name: 'Cancel request' })); expect(listingStudioStaff.cancelRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm cancellation' })); await waitFor(() => expect(changed).toHaveBeenCalled());
    cleanup(); view({ ...billingRequest, status: 'expired', actions: { canShare: false, canEmail: false, canCancel: false, canConfirm: false } });
    expect(screen.getByRole('button', { name: 'Send to registered email' })).toBeDisabled(); expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument();
  });
});
