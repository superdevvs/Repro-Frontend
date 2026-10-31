import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import ListingStudioPaymentRequest from './ListingStudioPaymentRequest';
import { listingStudioPaymentRequests } from '@/services/listingStudioPaymentRequestService';
import { billingRequest, billingReview } from '@/components/listing-studio/staff/staffFixtures.test-data';
import { readStudioRequestConfirmation } from '@/lib/listingStudioRequestConfirmation';

const auth = vi.hoisted(() => ({ user: { id: '42', role: 'client', isActive: true }, isAuthenticated: true, isLoading: false, isImpersonating: false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/listingStudioPaymentRequestService', () => ({ listingStudioPaymentRequests: { review: vi.fn(), confirm: vi.fn(), cancel: vi.fn() } }));
const clientRequest = { ...billingRequest, actions: { ...billingRequest.actions, canConfirm: true, canEmail: false } };
function view(id = billingRequest.id) { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/listing-studio/payment-requests/' + id]}><Routes><Route path="/listing-studio/payment-requests/:requestId" element={<ListingStudioPaymentRequest />} /></Routes></MemoryRouter></QueryClientProvider>); }
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); auth.user = { id: '42', role: 'client', isActive: true }; auth.isImpersonating = false; auth.isLoading = false; auth.isAuthenticated = true; vi.mocked(listingStudioPaymentRequests.review).mockResolvedValue({ request: clientRequest, review: billingReview }); vi.mocked(listingStudioPaymentRequests.confirm).mockResolvedValue({ request: { ...clientRequest, status: 'processing' }, status: 'processing', nextAction: { type: 'await_payment' } }); });
afterEach(cleanup);
describe('owned client payment approval', () => {
  it('opens dashboard-issued UUIDv7 review routes', async () => {
    const id = '019a3adb-2c54-7f80-a3df-8c2ef86bd090';
    vi.mocked(listingStudioPaymentRequests.review).mockResolvedValue({ request: { ...clientRequest, id }, review: billingReview });
    view(id); await screen.findByRole('checkbox');
    expect(listingStudioPaymentRequests.review).toHaveBeenCalledWith(id, expect.any(AbortSignal));
  });
  it('loads the server price without confirming and requires explicit approval', async () => {
    view(); const user = userEvent.setup(); const approve = await screen.findByRole('button', { name: 'Approve and continue to payment' });
    expect(approve).toBeDisabled(); expect(listingStudioPaymentRequests.confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox')); await user.click(approve);
    await waitFor(() => expect(listingStudioPaymentRequests.confirm).toHaveBeenCalledTimes(1));
    expect(listingStudioPaymentRequests.confirm).toHaveBeenCalledWith(billingRequest.id, { reviewId: billingReview.reviewId, confirmationToken: billingReview.confirmationToken, acceptCharges: true });
  });
  it.each(['salesrep', 'superadmin', 'admin'])('refuses approval or review reads from primary %s', role => { auth.user.role = role; view(); expect(screen.getByText(/Staff accounts cannot approve/)).toBeInTheDocument(); expect(listingStudioPaymentRequests.review).not.toHaveBeenCalled(); });
  it('refuses impersonation and another client’s review data', async () => {
    auth.isImpersonating = true; view(); expect(listingStudioPaymentRequests.review).not.toHaveBeenCalled(); cleanup(); auth.isImpersonating = false; auth.user.id = '43'; view();
    await screen.findByText('Payment request unavailable'); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(listingStudioPaymentRequests.confirm).not.toHaveBeenCalled();
  });
  it('recovers the exact confirmation after a lost response and reload', async () => {
    vi.mocked(listingStudioPaymentRequests.confirm).mockRejectedValueOnce(new Error('Connection interrupted')); const first = view(); const user = userEvent.setup();
    await screen.findByRole('checkbox'); await user.click(screen.getByRole('checkbox')); await user.click(screen.getByRole('button', { name: 'Approve and continue to payment' }));
    await screen.findByRole('button', { name: 'Check existing confirmation' }); const firstArgs = vi.mocked(listingStudioPaymentRequests.confirm).mock.calls[0]; first.unmount();
    vi.mocked(listingStudioPaymentRequests.review).mockResolvedValue({ request: clientRequest, review: { ...billingReview, confirmationToken: 'a-new-review-token' } }); view();
    await user.click(await screen.findByRole('button', { name: 'Check existing confirmation' })); await waitFor(() => expect(listingStudioPaymentRequests.confirm).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listingStudioPaymentRequests.confirm).mock.calls[1]).toEqual(firstArgs); expect(readStudioRequestConfirmation('43', billingRequest.id)).toBeNull();
  });
  it.each(['review_stale', 'subscription_review_expired', 'subscription_review_changed'])('clears %s and requires approval of the refreshed amount', async code => {
    vi.mocked(listingStudioPaymentRequests.confirm).mockRejectedValueOnce({ response: { status: 409, data: { code, message: 'Review the current price.' } } }); view(); const user = userEvent.setup();
    await screen.findByRole('checkbox'); await user.click(screen.getByRole('checkbox')); await user.click(screen.getByRole('button', { name: 'Approve and continue to payment' }));
    await screen.findByText('Review the current price.'); expect(readStudioRequestConfirmation('42', billingRequest.id)).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve and continue to payment' })).toBeDisabled();
  });
  it('continues an already approved payment on a new device without another submission', async () => {
    vi.mocked(listingStudioPaymentRequests.review).mockResolvedValue({ request: { ...clientRequest, kind: 'subscription_upgrade', status: 'processing' }, review: null, url: 'https://invoice.stripe.com/i/test-existing', nextAction: { type: 'complete_payment' } });
    view();
    expect(await screen.findByRole('link', { name: 'Continue existing payment' })).toHaveAttribute('href', 'https://invoice.stripe.com/i/test-existing');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(listingStudioPaymentRequests.confirm).not.toHaveBeenCalled();
  });
  it.each(['expired', 'cancelled', 'completed'] as const)('has no payment action for a %s request', async status => {
    vi.mocked(listingStudioPaymentRequests.review).mockResolvedValue({ request: { ...clientRequest, status, actions: { ...clientRequest.actions, canConfirm: false, canCancel: false } }, review: null }); view();
    await screen.findByRole('link', { name: 'Open credit & plan' }); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument(); expect(listingStudioPaymentRequests.confirm).not.toHaveBeenCalled();
  });
  it('requires confirmation before declining a request', async () => {
    vi.mocked(listingStudioPaymentRequests.cancel).mockResolvedValue({ ...clientRequest, status: 'cancelled', actions: { ...clientRequest.actions, canConfirm: false, canCancel: false } }); view(); const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Decline request' })); expect(listingStudioPaymentRequests.cancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm decline' })); await waitFor(() => expect(listingStudioPaymentRequests.cancel).toHaveBeenCalledTimes(1));
  });
  it('allows a server-authorized decline after an unsubmitted failure and preserves recovery until it succeeds', async () => {
    vi.mocked(listingStudioPaymentRequests.confirm).mockRejectedValueOnce(new Error('Connection interrupted'));
    vi.mocked(listingStudioPaymentRequests.cancel).mockRejectedValueOnce(new Error('Please retry')).mockResolvedValueOnce({ ...clientRequest, status: 'cancelled', actions: { ...clientRequest.actions, canConfirm: false, canCancel: false } });
    view(); const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox')); await user.click(screen.getByRole('button', { name: 'Approve and continue to payment' }));
    await screen.findByRole('button', { name: 'Check existing confirmation' }); const saved = readStudioRequestConfirmation('42', billingRequest.id);
    expect(saved).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Decline request' })); await user.click(screen.getByRole('button', { name: 'Confirm decline' }));
    await waitFor(() => expect(listingStudioPaymentRequests.cancel).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm decline' })).toBeEnabled());
    expect(readStudioRequestConfirmation('42', billingRequest.id)).toEqual(saved);
    await user.click(screen.getByRole('button', { name: 'Confirm decline' }));
    await waitFor(() => expect(readStudioRequestConfirmation('42', billingRequest.id)).toBeNull());
  });
  it('does not offer decline when the server retains an uncertain submission', async () => {
    vi.mocked(listingStudioPaymentRequests.review).mockResolvedValue({ request: { ...clientRequest, status: 'processing', actions: { ...clientRequest.actions, canCancel: false } }, review: null });
    view(); await screen.findByRole('link', { name: 'Open credit & plan' });
    expect(screen.queryByRole('button', { name: 'Decline request' })).not.toBeInTheDocument();
  });
});
