import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SquarePaymentDialog } from './SquarePaymentDialog';

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
}));
vi.mock('./SquarePaymentForm', async () => {
  const { forwardRef } = await import('react');
  return { SquarePaymentForm: forwardRef(function Form({ onPaymentSuccess }: {
    onPaymentSuccess: (payment: { status: 'success'; amount: number }) => void;
  }, _ref) {
    return <button onClick={() => onPaymentSuccess({ status: 'success', amount: 40 })}>Confirm exact payment</button>;
  }) };
});
vi.mock('./MarkAsPaidDialog', () => ({ MarkAsPaidDialog: () => null }));
vi.mock('./OfflinePaymentIntentDialog', () => ({ OfflinePaymentIntentDialog: () => null }));

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SquarePaymentDialog confirmed payment lifecycle', () => {
  it('shows confirmed success and closes once after two seconds', () => {
    const onClose = vi.fn();
    const onPaymentSuccess = vi.fn();
    render(<SquarePaymentDialog isOpen onClose={onClose} amount={40} shootId="42" onPaymentSuccess={onPaymentSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exact payment' }));
    expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    expect(onPaymentSuccess).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(1999); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['reopen', 'different shoot', 'different batch'])('does not let an old success timer close a future checkout (%s)', kind => {
    const onClose = vi.fn();
    const page = render(<SquarePaymentDialog isOpen onClose={onClose} amount={40} shootId="42" />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exact payment' }));
    act(() => { vi.advanceTimersByTime(1000); });
    if (kind === 'reopen') {
      page.rerender(<SquarePaymentDialog isOpen={false} onClose={onClose} amount={40} shootId="42" />);
      page.rerender(<SquarePaymentDialog isOpen onClose={onClose} amount={40} shootId="42" />);
    } else if (kind === 'different batch') {
      page.rerender(<SquarePaymentDialog isOpen onClose={onClose} amount={40} shootIds={['43', '44']} />);
    } else {
      page.rerender(<SquarePaymentDialog isOpen onClose={onClose} amount={40} shootId="43" />);
    }
    expect(screen.getByRole('button', { name: 'Confirm exact payment' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exact payment' }));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cleans up the success timer on unmount', () => {
    const onClose = vi.fn();
    const page = render(<SquarePaymentDialog isOpen onClose={onClose} amount={40} shootId="42" />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exact payment' }));
    page.unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(['throws', 'rejects'])('isolates a parent refresh that %s from the recorded payment', async kind => {
    const onClose = vi.fn();
    const onPaymentError = vi.fn();
    const onPaymentSuccess = kind === 'throws'
      ? vi.fn(() => { throw new Error('Refresh failed'); }) : vi.fn().mockRejectedValue(new Error('Refresh failed'));
    render(<SquarePaymentDialog isOpen onClose={onClose} amount={40} shootId="42"
      onPaymentSuccess={onPaymentSuccess} onPaymentError={onPaymentError} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm exact payment' })); });
    expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Payment confirmed; refresh unavailable', description: expect.stringContaining('already recorded'),
    }));
    expect(onPaymentError).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
