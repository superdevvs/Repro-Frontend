import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/config/env';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import { triggerDashboardOverviewRefresh, triggerInvoicesRefresh, triggerShootDetailRefresh, triggerShootHistoryRefresh } from '@/realtime/realtimeRefreshBus';
import { canUseSafeHistoryFallback, sanitizeRelativeReturnTo } from '@/utils/paymentReturn';
import { confirmPaymentReturnWithRetry } from '@/utils/paymentConfirmationRetry';
import { getStripeConfirmationFailureMessage, isStripeSessionPaymentRecorded, isStripeSessionRefundedAsStale, type StripeConfirmationResult } from '@/utils/stripeConfirmation';

type PaymentConfirmationResult = StripeConfirmationResult & { confirmationHttpStatus?: number; malformed?: boolean };
type ConfirmationState = { kind: 'confirming' | 'confirmed' | 'pending' | 'unavailable' | 'refunded' | 'failed'; message?: string; amount?: number | null };

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function readConfirmation(value: unknown): PaymentConfirmationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { malformed: true };
  const record = value as Record<string, unknown>;
  if (typeof record.session_id !== 'string'
    || ['outcome', 'session_payment_status', 'message', 'return_to'].some(key => record[key] != null && typeof record[key] !== 'string')
    || ['payment_recorded', 'payment_refunded', 'reconciled'].some(key => record[key] != null && typeof record[key] !== 'boolean')) return { malformed: true };
  return record as PaymentConfirmationResult;
}

function unconfirmedState(result: PaymentConfirmationResult | null, sessionId: string): ConfirmationState {
  if (isStripeSessionRefundedAsStale(result, sessionId)) {
    return { kind: 'refunded', message: getStripeConfirmationFailureMessage(result, sessionId,
      'The invoice balance changed while Checkout was open, so this charge was refunded. Check your invoice in the dashboard.') };
  }
  if (result?.confirmationHttpStatus) {
    return { kind: 'unavailable', message: [401, 403].includes(result.confirmationHttpStatus)
      ? 'We could not access this payment confirmation. Sign in again or contact support before making another payment.'
      : 'This payment confirmation is unavailable. Check your invoice in the dashboard or contact support before making another payment.' };
  }
  if (result?.malformed || (result && result.session_id !== sessionId)) {
    return { kind: 'unavailable', message: 'We could not verify this checkout session. Contact support before making another payment.' };
  }
  const outcome = result?.outcome?.toLowerCase();
  if (!result || ['busy', 'pending', 'unpaid', 'not_found'].includes(outcome ?? '')) {
    return { kind: 'pending', message: 'We are still checking this payment. Check its status again or contact support before making another payment.' };
  }
  if (['expired', 'cancelled', 'canceled'].includes(outcome ?? '')
    || (outcome === 'declined' && result?.session_payment_status === 'unpaid')) {
    return { kind: 'failed', message: 'This checkout was not completed. Check your invoice in the dashboard or contact support.' };
  }
  return { kind: 'unavailable', message: 'We could not verify this payment yet. Check your invoice in the dashboard or contact support before making another payment.' };
}

export default function AuthenticatedPaymentReturnPage() {
  const { shootId } = useParams<{ shootId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const initialReturnTo = searchParams.get('return_to');
  const [state, setState] = useState<ConfirmationState>({ kind: 'confirming' });
  const [attempt, setAttempt] = useState(0);
  const checking = useRef(false);
  const active = useRef<AbortController | null>(null);
  const refreshed = useRef(new Set<string>());
  const [resolvedReturnTo, setResolvedReturnTo] = useState<string | null>(sanitizeRelativeReturnTo(initialReturnTo));
  const canReturn = Boolean(resolvedReturnTo) || canUseSafeHistoryFallback();

  const handleReturn = useCallback(() => {
    if (resolvedReturnTo) navigate(resolvedReturnTo);
    else if (canUseSafeHistoryFallback()) window.history.back();
  }, [navigate, resolvedReturnTo]);

  useEffect(() => {
    if (!shootId || !sessionId) {
      checking.current = false;
      setState({ kind: 'unavailable', message: 'Missing payment session details.' });
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    checking.current = true;
    setState({ kind: 'confirming' });
    setResolvedReturnTo(sanitizeRelativeReturnTo(initialReturnTo));
    const confirm = async (): Promise<PaymentConfirmationResult | null> => {
      try {
        const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.post(`${API_BASE_URL}/api/shoots/${shootId}/confirm-stripe-session`,
          { session_id: sessionId }, {
            signal: controller.signal, timeout: 10000,
            headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), 'Content-Type': 'application/json' },
          });
        const confirmation = readConfirmation(response.data?.data ?? response.data);
        const outcome = confirmation.outcome?.toLowerCase();
        const paymentStatus = confirmation.session_payment_status?.toLowerCase();
        // A failed reconciliation can describe a successful Stripe charge. Retry
        // that same session until the backend proves its recorded outcome.
        if (confirmation.session_id === sessionId && (outcome === 'failed'
          || (paymentStatus === 'paid' && ['expired', 'cancelled', 'canceled', 'declined'].includes(outcome ?? ''))
          || (outcome === 'declined' && paymentStatus !== 'unpaid'))) {
          return { ...confirmation, outcome: 'pending' };
        }
        return confirmation;
      } catch (error) {
        if (controller.signal.aborted) return null;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status && status !== 408 && status !== 429 && status < 500) {
          return { outcome: 'confirmation_rejected', confirmationHttpStatus: status };
        }
        return null;
      }
    };
    void (async () => {
      try {
        const result = await confirmPaymentReturnWithRetry(confirm, sessionId, controller.signal);
        if (controller.signal.aborted) return;
        if (!isStripeSessionPaymentRecorded(result, sessionId)) {
          setState(unconfirmedState(result, sessionId));
          return;
        }
        setState({ kind: 'confirmed', amount: toFiniteNumber(result?.last_payment_amount) });
        setResolvedReturnTo(sanitizeRelativeReturnTo(result?.return_to ?? initialReturnTo));
        const refreshKey = `${shootId}:${sessionId}`;
        if (!refreshed.current.has(refreshKey)) {
          refreshed.current.add(refreshKey);
          triggerDashboardOverviewRefresh();
          triggerInvoicesRefresh();
          triggerShootHistoryRefresh();
          triggerShootDetailRefresh(shootId);
          void queryClient.invalidateQueries({ queryKey: ['clientBilling'] });
        }
      } finally {
        if (active.current === controller) { active.current = null; checking.current = false; }
      }
    })();
    return () => controller.abort();
  }, [attempt, initialReturnTo, queryClient, sessionId, shootId]);

  useEffect(() => {
    if (state.kind !== 'confirmed' || !canReturn) return;
    const timer = window.setTimeout(handleReturn, 3000);
    return () => window.clearTimeout(timer);
  }, [canReturn, handleReturn, state.kind]);

  if (state.kind === 'confirming') {
    return <div className="min-h-screen bg-[#060a0e] flex items-center justify-center"><div className="w-full max-w-md"><HorizontalLoader message="Confirming payment..." /></div></div>;
  }
  if (state.kind !== 'confirmed') {
    const pending = state.kind === 'pending';
    const title = pending ? 'Payment confirmation pending' : state.kind === 'refunded' ? 'Payment refunded'
      : state.kind === 'failed' ? 'Payment not completed' : 'Unable to Confirm Payment';
    return (
      <div className="min-h-screen bg-[#060a0e] flex items-center justify-center p-4">
        <Card className={`max-w-md w-full bg-[#0a0f1a] ${pending ? 'border-amber-500/30' : 'border-red-500/30'}`}>
          <CardContent className="pt-6 text-center">
            <AlertCircle className={`h-12 w-12 mx-auto mb-4 ${pending ? 'text-amber-500' : 'text-red-500'}`} />
            <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
            <p className="text-gray-400" role="status">{state.message}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {pending && <Button onClick={() => {
                if (checking.current) return;
                checking.current = true;
                setAttempt(value => value + 1);
              }}>Check payment status</Button>}
              <Button variant="outline" onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#060a0e] flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-[#0a0f1a] border-green-500/30">
        <CardContent className="pt-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-2">Payment Successful!</h2>
          <p className="text-gray-400 mb-4">{state.amount != null && state.amount > 0
            ? `Your payment of $${state.amount.toFixed(2)} has been processed successfully.`
            : 'Your payment has been processed successfully.'}</p>
          <p className="text-sm text-gray-500">You will receive a confirmation email shortly.</p>
          {canReturn && <><p className="text-xs text-gray-600 mt-4">Returning you to the previous page...</p><Button className="mt-4" onClick={handleReturn}>Return to previous page</Button></>}
        </CardContent>
      </Card>
    </div>
  );
}
