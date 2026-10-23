import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import type { MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { BulkActionsDialog } from './BulkActionsDialog';

const mocks = vi.hoisted(() => ({ post: vi.fn(), refresh: vi.fn(), close: vi.fn(), toast: vi.fn(), completion: vi.fn() }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/api', () => ({ apiClient: { post: mocks.post, delete: vi.fn() } }));
vi.mock('@/components/shoots/ShootDetailsModal', () => ({ ShootDetailsModal: () => null }));
vi.mock('@/services/shootEditingDispatch', () => ({ sendShootToEditing: vi.fn() }));
vi.mock('@/components/shoots/finalize/finalizeShootWithProgressToast', () => ({ finalizeShootsWithProgressToast: vi.fn() }));
vi.mock('@/components/payments/StripePaymentDialog', () => ({ StripePaymentDialog: ({ isOpen, onPaymentSuccess }: {
  isOpen: boolean; onPaymentSuccess: () => Promise<void>;
}) => isOpen ? <button onClick={() => { const promise = onPaymentSuccess(); mocks.completion(promise); void promise.catch(() => undefined); }}>Stripe payment confirmed</button> : null }));
vi.mock('@/components/payments/MarkAsPaidDialog', () => ({ MarkAsPaidDialog: ({ isOpen, onConfirm }: {
  isOpen: boolean; onConfirm: (payload: MarkAsPaidPayload) => Promise<void>;
}) => isOpen ? <button onClick={() => { const promise = onConfirm({ paymentMethod: 'cash', paymentDate: '2026-10-23' });
  mocks.completion(promise); void promise.catch(() => undefined); }}>Confirm manual cash</button> : null }));

const shoots = [
  { id: '42', location: { fullAddress: 'Test property A' }, client: { name: 'Test client' }, payment: { totalQuote: 100, totalPaid: 0 } },
  { id: '43', location: { fullAddress: 'Test property B' }, client: { name: 'Test client' }, payment: { totalQuote: 75, totalPaid: 25 } },
] as ShootData[];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockReset();
  mocks.refresh.mockReset();
  mocks.post.mockResolvedValue({});
  mocks.refresh.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

async function selectShoots(withRefresh = true) {
  await act(async () => { render(<BulkActionsDialog isOpen onClose={mocks.close} shoots={shoots} onComplete={withRefresh ? mocks.refresh : undefined} />); });
  fireEvent.click(screen.getByRole('button', { name: 'Select visible' }));
}

async function stripeCompleted(withRefresh = true) {
  await selectShoots(withRefresh);
  fireEvent.click(screen.getByRole('button', { name: 'Pay $150.00' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stripe payment confirmed' })); });
  await mocks.completion.mock.calls[0][0];
}

describe('bulk payment completion', () => {
  it('reloads verified Stripe payments without manually recording their old balances again', async () => {
    await stripeCompleted();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment update failed' }));
  });

  it('keeps Stripe success truthful when shoot-list refresh fails', async () => {
    mocks.refresh.mockRejectedValue(new Error('refresh unavailable'));
    await stripeCompleted();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Payment confirmed; refresh unavailable',
      description: 'Your Stripe payment is already recorded. Refresh the shoot list before making another payment.',
    });
  });

  it('does not create a fallback manual payment when no refresh callback is configured', async () => {
    await stripeCompleted(false);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('preserves manual cash recording for each selected outstanding balance', async () => {
    await selectShoots();
    fireEvent.click(screen.getByText('Mark as paid'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Paid' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm manual cash' })); });
    await mocks.completion.mock.calls[0][0];
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.post).toHaveBeenCalledWith('/shoots/42/mark-paid', { payment_type: 'cash', amount: 100, payment_date: '2026-10-23' });
    expect(mocks.post).toHaveBeenCalledWith('/shoots/43/mark-paid', { payment_type: 'cash', amount: 50, payment_date: '2026-10-23' });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it.each(['resolve', 'reject'])('ignores an older Stripe refresh that %s after the dialog is reopened', async outcome => {
    let finish!: () => void;
    mocks.refresh.mockReturnValue(new Promise<void>((resolve, reject) => {
      finish = outcome === 'resolve' ? resolve : () => reject(new Error('old refresh failed'));
    }));
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<BulkActionsDialog isOpen onClose={mocks.close} shoots={shoots} onComplete={mocks.refresh} />); });
    fireEvent.click(screen.getByRole('button', { name: 'Select visible' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pay $150.00' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stripe payment confirmed' })); });
    const oldCompletion = mocks.completion.mock.calls[0][0];
    await act(async () => { view.rerender(<BulkActionsDialog isOpen={false} onClose={mocks.close} shoots={shoots} onComplete={mocks.refresh} />); });
    await act(async () => { view.rerender(<BulkActionsDialog isOpen onClose={mocks.close} shoots={shoots} onComplete={mocks.refresh} />); });
    fireEvent.click(screen.getByRole('button', { name: 'Select visible' }));
    expect(screen.getByRole('button', { name: 'Pay $150.00' })).toBeEnabled();
    await act(async () => { finish(); await oldCompletion; });
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pay $150.00' })).toBeEnabled();
  });

  it('lets a new target selection proceed without an older Stripe refresh closing it', async () => {
    let finish!: () => void;
    mocks.refresh.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await selectShoots();
    fireEvent.click(screen.getByRole('button', { name: 'Pay $150.00' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stripe payment confirmed' })); });
    const oldCompletion = mocks.completion.mock.calls[0][0];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deselect visible' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Select visible' })); });
    expect(screen.getByRole('button', { name: 'Pay $150.00' })).toBeEnabled();
    await act(async () => { finish(); await oldCompletion; });
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
