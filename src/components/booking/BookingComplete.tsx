import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircleIcon, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { StripePaymentDialog } from '@/components/payments/StripePaymentDialog';
import { useToast } from '@/hooks/use-toast';
import type { PricingBreakdown } from '@/utils/pricing';
import { API_BASE_URL } from '@/config/env';
import {
  buildShootPaymentDialogModel,
  type ShootPaymentDialogModel,
} from '@/utils/shootPaymentDialogModel';

interface BookingCompleteProps {
  date: Date | undefined;
  time: string;
  resetForm: () => void;
  isClientRequest?: boolean;
  shootId?: string | number;
  totalAmount?: number;
  pricing?: PricingBreakdown;
  shootAddress?: string;
  shootServices?: string[];
  clientName?: string;
  clientEmail?: string;
  shoot?: unknown;
}

export function BookingComplete({ 
  date, 
  time, 
  resetForm, 
  isClientRequest = false, 
  shootId, 
  totalAmount = 0,
  pricing,
  shootAddress,
  shootServices = [],
  clientName,
  clientEmail,
  shoot,
}: BookingCompleteProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(10);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [countdownComplete, setCountdownComplete] = useState(false);
  const [canonicalShoot, setCanonicalShoot] = useState<unknown>(shoot);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [paymentSnapshotError, setPaymentSnapshotError] = useState<string | null>(null);
  const refetchedShootIdRef = useRef<string | null>(null);

  useEffect(() => {
    setCanonicalShoot(shoot);
    setPaymentSnapshotError(null);
    refetchedShootIdRef.current = null;
  }, [shoot, shootId]);

  const paymentModel = useMemo(
    () => buildShootPaymentDialogModel(canonicalShoot),
    [canonicalShoot],
  );
  const effectivePricing = paymentModel?.pricing ?? pricing;

  const fetchPaymentSnapshot = useCallback(async (): Promise<ShootPaymentDialogModel | null> => {
    const normalizedShootId = shootId ? String(shootId) : '';
    if (!normalizedShootId) {
      setPaymentSnapshotError('The shoot was created, but its payment details are not ready yet.');
      return null;
    }

    setIsRefreshingPayment(true);
    setPaymentSnapshotError(null);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${normalizedShootId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'message' in payload
          ? String(payload.message)
          : 'Unable to refresh payment details.';
        throw new Error(message);
      }

      const refreshedShoot = payload && typeof payload === 'object' && 'data' in payload
        ? payload.data
        : payload;
      const refreshedModel = buildShootPaymentDialogModel(refreshedShoot);
      if (!refreshedModel) {
        throw new Error('Payment details are still being prepared. Please try again in a moment.');
      }

      setCanonicalShoot(refreshedShoot);
      return refreshedModel;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to refresh payment details.';
      setPaymentSnapshotError(message);
      return null;
    } finally {
      setIsRefreshingPayment(false);
    }
  }, [shootId]);

  // A newly-created ShootResource normally contains the full payment snapshot.
  // If it does not, hydrate it once before the countdown is allowed to start.
  useEffect(() => {
    const normalizedShootId = shootId ? String(shootId) : '';
    if (
      !isClientRequest
      || !normalizedShootId
      || paymentModel
      || refetchedShootIdRef.current === normalizedShootId
    ) {
      return;
    }

    refetchedShootIdRef.current = normalizedShootId;
    void fetchPaymentSnapshot();
  }, [fetchPaymentSnapshot, isClientRequest, paymentModel, shootId]);
  
  // Format the date properly to ensure correct display
  const formattedDate = date ? format(new Date(
    date.getFullYear(),
    date.getMonth(), 
    date.getDate(),
    12 // Set to noon to avoid timezone issues
  ), 'MMMM d, yyyy') : '';

  // Countdown effect for client bookings
  useEffect(() => {
    if (!isClientRequest || !paymentModel || paymentModel.amount <= 0 || countdownComplete) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCountdownComplete(true);
      setShowPaymentDialog(true);
    }
  }, [countdown, isClientRequest, countdownComplete, paymentModel]);

  const openPaymentDialog = useCallback(async () => {
    const resolvedModel = paymentModel ?? await fetchPaymentSnapshot();
    if (!resolvedModel || resolvedModel.amount <= 0) {
      if (!resolvedModel) {
        toast({
          title: 'Payment details unavailable',
          description: paymentSnapshotError || 'Please try again in a moment.',
          variant: 'destructive',
        });
      }
      return;
    }

    setCountdownComplete(true);
    setShowPaymentDialog(true);
  }, [fetchPaymentSnapshot, paymentModel, paymentSnapshotError, toast]);

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    toast({
      title: "Payment successful",
      description: "Your payment has been processed successfully.",
    });
    navigate('/shoot-history');
  };

  return (
    <>
      <motion.div
        key="complete"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto"
      >
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <CheckCircleIcon className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {isClientRequest ? 'Shoot Requested!' : 'Booking Complete!'}
        </h2>
        <p className="text-muted-foreground mb-4">
          {isClientRequest 
            ? `Your shoot request for ${formattedDate} at ${time} has been submitted. We'll notify you once it's approved.`
            : `The shoot has been successfully scheduled for ${formattedDate} at ${time}.`
          }
        </p>
        
        {/* Payment section for client requests */}
        {isClientRequest && (paymentModel?.amount ?? totalAmount) > 0 && (
          <motion.div 
            className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {effectivePricing && (
              <div className="mb-4 rounded-md bg-white/70 dark:bg-slate-900/50 p-3 text-left text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${effectivePricing.serviceSubtotal.toFixed(2)}</span>
                </div>
                {effectivePricing.discountAmount > 0 && (
                  <div className="mt-1 flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span>-${effectivePricing.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between">
                  <span>Tax</span>
                  <span>${effectivePricing.taxAmount.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>${effectivePricing.totalQuote.toFixed(2)}</span>
                </div>
              </div>
            )}
            {!paymentModel ? (
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                {isRefreshingPayment ? 'Preparing secure payment details…' : 'Payment details need to be refreshed.'}
              </p>
            ) : !countdownComplete ? (
              <p className="text-blue-700 dark:text-blue-300 font-medium flex items-center justify-center gap-2">
                <CreditCard className="h-5 w-5" />
                Taking you to payment in{' '}
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-lg font-bold text-white bg-blue-500 rounded-full animate-pulse">
                  {countdown}
                </span>
              </p>
            ) : (
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                Complete your payment to confirm your booking.
              </p>
            )}
            <Button 
              onClick={() => void openPaymentDialog()}
              disabled={isRefreshingPayment || !shootId}
              className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {isRefreshingPayment
                ? 'Preparing Payment…'
                : `Pay Now - $${(paymentModel?.amount ?? totalAmount).toFixed(2)}`}
            </Button>
            {paymentSnapshotError && !isRefreshingPayment && (
              <p className="mt-2 text-xs text-red-700 dark:text-red-300">{paymentSnapshotError}</p>
            )}
          </motion.div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={resetForm} variant="outline">Book Another Shoot</Button>
          <Button onClick={() => navigate('/shoot-history')}>View All Shoots</Button>
        </div>
      </motion.div>

      {/* Stripe Payment Dialog */}
      <StripePaymentDialog
        isOpen={showPaymentDialog && Boolean(paymentModel)}
        onClose={() => setShowPaymentDialog(false)}
        amount={paymentModel?.amount ?? 0}
        shootId={paymentModel?.shootId}
        shootAddress={paymentModel?.shootAddress ?? shootAddress}
        shootServices={paymentModel?.shootServices ?? shootServices}
        serviceItems={paymentModel?.serviceItems ?? []}
        shootDate={paymentModel?.shootDate ?? formattedDate}
        shootTime={paymentModel?.shootTime ?? time}
        clientName={paymentModel?.clientName ?? clientName}
        clientEmail={paymentModel?.clientEmail ?? clientEmail}
        totalQuote={paymentModel?.totalQuote}
        pricing={paymentModel?.pricing ?? pricing}
        totalPaid={paymentModel?.totalPaid}
        onPaymentSuccess={handlePaymentSuccess}
        clientCanSubmitOfflineIntent
      />
    </>
  );
}
