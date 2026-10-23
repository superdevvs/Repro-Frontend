import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { confirmPaymentReturnWithRetry } from '@/utils/paymentConfirmationRetry';
import {
  getStripeConfirmationFailureMessage,
  isStripeConfirmationPending,
  isStripeSessionPaymentRecorded,
  isStripeSessionRefundedAsStale,
  readStripeConfirmation,
  type StripeConfirmationResult,
} from '@/utils/stripeConfirmation';

type Result = StripeConfirmationResult & { confirmationHttpStatus?: number; malformed?: boolean };
export type HostedPaymentReturnState = {
  kind: 'idle' | 'confirming' | 'confirmed' | 'pending' | 'unavailable' | 'refunded' | 'closed';
  message?: string;
};
type Notice = { title: string; description: string; variant?: 'default' | 'destructive' };
type Options = {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  onConfirmed: () => unknown;
  notify: (notice: Notice) => void;
};

/** Confirm a hosted batch return without treating a delayed local record as a failed charge. */
export function useHostedPaymentReturn({ searchParams, setSearchParams, onConfirmed, notify }: Options) {
  const sessionId = searchParams.get('session_id') || null;
  const missingSession = !sessionId && searchParams.get('payment') === 'success';
  const [state, setState] = useState<HostedPaymentReturnState>({ kind: sessionId ? 'confirming' : 'idle' });
  const [attempt, setAttempt] = useState(0);
  const checking = useRef(false);
  const settled = useRef(new Set<string>());
  const callbacks = useRef({ setSearchParams, onConfirmed, notify });
  callbacks.current = { setSearchParams, onConfirmed, notify };

  useEffect(() => {
    if (!sessionId) {
      checking.current = false;
      if (missingSession) {
        setState({ kind: 'unavailable', message: 'Missing checkout session details. Contact support before making another payment.' });
        return;
      }
      setState(current => ['confirmed', 'refunded', 'closed'].includes(current.kind) ? current : { kind: 'idle' });
      return;
    }
    if (settled.current.has(sessionId)) return;
    const controller = new AbortController();
    checking.current = true;
    setState({ kind: 'confirming' });
    const clearReturn = () => callbacks.current.setSearchParams(current => {
      if (current.get('session_id') !== sessionId) return current;
      const next = new URLSearchParams(current);
      next.delete('session_id');
      next.delete('payment');
      return next;
    }, { replace: true });
    const confirm = async (): Promise<Result | null> => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.post(`${API_BASE_URL}/api/payments/stripe-session/confirm`,
          { session_id: sessionId }, {
            signal: controller.signal, timeout: 10000,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
        return readStripeConfirmation(response.data?.data ?? response.data)
          ?? { outcome: 'confirmation_rejected', malformed: true };
      } catch (error) {
        if (controller.signal.aborted) return null;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        return status && status !== 408 && status !== 429 && status < 500
          ? { outcome: 'confirmation_rejected', confirmationHttpStatus: status }
          : null;
      }
    };
    void (async () => {
      try {
        const result = await confirmPaymentReturnWithRetry(confirm, sessionId, controller.signal);
        if (controller.signal.aborted) return;
        if (isStripeSessionPaymentRecorded(result, sessionId)) {
          settled.current.add(sessionId);
          setState({ kind: 'confirmed', message: 'Your Stripe payment has been confirmed.' });
          clearReturn();
          try { callbacks.current.notify({ title: 'Payment successful', description: 'Your Stripe payment has been confirmed.' }); }
          catch { /* A notification failure cannot undo a recorded payment. */ }
          // Refresh failures cannot undo an exact-session payment confirmation.
          void Promise.resolve().then(() => callbacks.current.onConfirmed()).catch(() => undefined);
          return;
        }
        if (isStripeSessionRefundedAsStale(result, sessionId)) {
          settled.current.add(sessionId);
          setState({ kind: 'refunded', message: getStripeConfirmationFailureMessage(result, sessionId,
            'The invoice changed while Checkout was open, so this charge was refunded. Review the current balance before paying.') });
          clearReturn();
          return;
        }
        if (isStripeConfirmationPending(result, sessionId)) {
          setState({ kind: 'pending', message: 'We are still checking this payment. Check its status again or contact support before making another payment.' });
          return;
        }
        if (result?.session_id === sessionId && result.session_payment_status === 'unpaid'
          && ['expired', 'cancelled', 'canceled', 'declined'].includes(result.outcome?.toLowerCase() ?? '')) {
          settled.current.add(sessionId);
          setState({ kind: 'closed', message: 'This checkout was not completed. Review the current invoice before starting another payment.' });
          clearReturn();
          return;
        }
        setState({ kind: 'unavailable', message: result?.confirmationHttpStatus && [401, 403].includes(result.confirmationHttpStatus)
          ? 'We could not access this payment confirmation. Sign in again or contact support before making another payment.'
          : 'We could not verify this checkout session. Contact support before making another payment.' });
      } catch {
        if (!controller.signal.aborted && !settled.current.has(sessionId)) setState({ kind: 'pending', message: 'We could not check this payment yet. Check its status again before making another payment.' });
      } finally {
        if (!controller.signal.aborted) checking.current = false;
      }
    })();
    return () => controller.abort();
  }, [attempt, missingSession, sessionId]);

  const checkStatus = useCallback(() => {
    if (checking.current || !sessionId || settled.current.has(sessionId)) return;
    checking.current = true;
    setAttempt(current => current + 1);
  }, [sessionId]);

  return { state, checkStatus, blockCheckout: missingSession || Boolean(sessionId && !settled.current.has(sessionId)) };
}
