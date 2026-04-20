import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/config/env';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import {
  triggerDashboardOverviewRefresh,
  triggerInvoicesRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
} from '@/realtime/realtimeRefreshBus';
import { canUseSafeHistoryFallback, sanitizeRelativeReturnTo } from '@/utils/paymentReturn';

type PaymentConfirmationResult = {
  last_payment_amount?: number | string | null;
  return_to?: string | null;
  payment_status?: string | null;
  remaining_balance?: number | string | null;
  total_paid?: number | string | null;
  reconciled?: boolean | null;
  session_id?: string | null;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function AuthenticatedPaymentReturnPage() {
  const { shootId } = useParams<{ shootId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const initialReturnTo = searchParams.get('return_to');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPaymentAmount, setLastPaymentAmount] = useState<number | null>(null);
  const [resolvedReturnTo, setResolvedReturnTo] = useState<string | null>(
    sanitizeRelativeReturnTo(initialReturnTo),
  );

  const canGoBack = canUseSafeHistoryFallback();
  const canReturn = Boolean(resolvedReturnTo) || canGoBack;

  const handleReturn = useCallback(() => {
    if (resolvedReturnTo) {
      navigate(resolvedReturnTo);
      return;
    }

    if (canUseSafeHistoryFallback()) {
      window.history.back();
    }
  }, [navigate, resolvedReturnTo]);

  useEffect(() => {
    if (!shootId || !sessionId) {
      setError('Missing payment session details.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const confirmPayment = async () => {
      try {
        const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.post(
          `${API_BASE_URL}/api/shoots/${shootId}/confirm-stripe-session`,
          { session_id: sessionId },
          {
            headers: {
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              'Content-Type': 'application/json',
            },
          },
        );

        if (cancelled) {
          return;
        }

        const data = (response.data?.data || response.data) as PaymentConfirmationResult;
        const confirmedAmount = toFiniteNumber(data.last_payment_amount);
        const remainingBalance = toFiniteNumber(data.remaining_balance);
        const paymentStatus = (data.payment_status ?? '').toString().toLowerCase();

        const isPaidByStatus = paymentStatus === 'paid' || paymentStatus === 'succeeded';
        const isPaidByBalance = remainingBalance !== null && remainingBalance <= 0.01;
        const isPaidByAmount = confirmedAmount !== null && confirmedAmount > 0;
        const isPaidByReconcile = data.reconciled === true;

        if (!isPaidByStatus && !isPaidByBalance && !isPaidByAmount && !isPaidByReconcile) {
          // The backend did not indicate a successful payment. Surface a generic error so the
          // client knows to retry or contact support rather than assume success.
          throw new Error('Your payment could not be confirmed yet. Please refresh or contact support if this persists.');
        }

        setLastPaymentAmount(confirmedAmount ?? null);
        setResolvedReturnTo(sanitizeRelativeReturnTo(data.return_to ?? initialReturnTo));

        triggerDashboardOverviewRefresh();
        triggerInvoicesRefresh();
        triggerShootHistoryRefresh();
        triggerShootDetailRefresh(shootId);
        queryClient.invalidateQueries({ queryKey: ['clientBilling'] });
      } catch (confirmationError) {
        if (cancelled) {
          return;
        }

        setError(
          confirmationError instanceof Error
            ? confirmationError.message
            : 'Failed to confirm your payment.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void confirmPayment();

    return () => {
      cancelled = true;
    };
  }, [initialReturnTo, queryClient, sessionId, shootId]);

  useEffect(() => {
    if (loading || error || !canReturn) {
      return;
    }

    const timer = window.setTimeout(() => {
      handleReturn();
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [canReturn, error, handleReturn, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060a0e] flex items-center justify-center">
        <div className="w-full max-w-md">
          <HorizontalLoader message="Confirming payment..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#060a0e] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#0a0f1a] border-red-500/30">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Unable to Confirm Payment</h2>
            <p className="text-gray-400">{error}</p>
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
          <p className="text-gray-400 mb-4">
            {lastPaymentAmount !== null && lastPaymentAmount > 0
              ? `Your payment of $${lastPaymentAmount.toFixed(2)} has been processed successfully.`
              : 'Your payment has been processed successfully.'}
          </p>
          <p className="text-sm text-gray-500">
            You will receive a confirmation email shortly.
          </p>
          {canReturn && (
            <>
              <p className="text-xs text-gray-600 mt-4">
                Returning you to the previous page...
              </p>
              <Button className="mt-4" onClick={handleReturn}>
                Return to previous page
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
