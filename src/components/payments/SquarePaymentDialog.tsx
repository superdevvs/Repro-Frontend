import React, { useCallback, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SquarePaymentForm, type SquarePaymentFormHandle, type SquarePaymentSuccessPayload } from './SquarePaymentForm';
import type { PricingBreakdown } from '@/utils/pricing';
import type { NormalizedShootServiceItem } from '@/utils/shootServiceItems';
import { Banknote, CreditCard } from 'lucide-react';
import { MarkAsPaidDialog, type MarkAsPaidPayload } from './MarkAsPaidDialog';
import { OfflinePaymentIntentDialog } from './OfflinePaymentIntentDialog';
import { useToast } from '@/hooks/use-toast';

interface SquarePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency?: string;
  shootId?: string;
  shootIds?: string[];
  shootAddress?: string;
  shootServices?: string[];
  serviceItems?: NormalizedShootServiceItem[];
  shootDate?: string;
  shootTime?: string;
  clientEmail?: string;
  clientName?: string;
  totalQuote?: number;
  totalPaid?: number;
  pricing?: PricingBreakdown;
  onPaymentSuccess?: (payment: SquarePaymentSuccessPayload) => void;
  onPaymentError?: (error: unknown) => void;
  onManualPaymentConfirm?: (payload: MarkAsPaidPayload) => Promise<void> | void;
  /**
   * When true, exposes a Cash/Cheque button that creates a pending offline
   * payment intent (does NOT mark the shoot paid). Used for client users.
   */
  clientCanSubmitOfflineIntent?: boolean;
  /**
   * Callback fired after the client successfully submits an offline intent.
   * Caller should refresh shoot/payment data so the pending intent is visible.
   */
  onOfflineIntentSubmitted?: () => void;
}

export function SquarePaymentDialog({
  isOpen,
  onClose,
  amount,
  currency = 'USD',
  shootId,
  shootIds,
  shootAddress,
  shootServices,
  serviceItems,
  shootDate,
  shootTime,
  clientEmail,
  clientName,
  totalQuote,
  totalPaid,
  pricing,
  onPaymentSuccess,
  onPaymentError,
  onManualPaymentConfirm,
  clientCanSubmitOfflineIntent = false,
  onOfflineIntentSubmitted,
}: SquarePaymentDialogProps) {
  const { toast } = useToast();
  const [successfulPayment, setSuccessfulPayment] = useState<SquarePaymentSuccessPayload | null>(null);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [isManualPaymentDialogOpen, setIsManualPaymentDialogOpen] = useState(false);
  const [isClientOfflineDialogOpen, setIsClientOfflineDialogOpen] = useState(false);
  const [pendingChargeRemainder, setPendingChargeRemainder] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<SquarePaymentFormHandle>(null);

  const handleCheckoutActiveChange = useCallback((active: boolean) => {
    setCheckoutActive(active);
  }, []);

  const handleCheckoutMounted = useCallback(() => {
    // Auto-scroll to Stripe checkout on mobile after it actually renders
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  const handlePaymentSuccess = (payment: SquarePaymentSuccessPayload) => {
    setSuccessfulPayment(payment);
    if (onPaymentSuccess) {
      onPaymentSuccess(payment);
    }
    // Auto-close after 2 seconds on success
    setTimeout(() => {
      onClose();
      setSuccessfulPayment(null);
    }, 2000);
  };

  const handleClose = () => {
    if (!successfulPayment) {
      onClose();
    }
  };

  // Check if we have shoot details to display (determines dialog width)
  const hasShootDetails = shootAddress || (shootServices && shootServices.length > 0) || totalQuote !== undefined || pricing !== undefined || clientName || shootDate;

  const dialogWidth = checkoutActive
    ? 'sm:max-w-[95vw] lg:max-w-[1300px]'
    : hasShootDetails
      ? 'sm:max-w-[850px]'
      : 'sm:max-w-[450px]';
  const canRecordManualPayment = Boolean(onManualPaymentConfirm) && !shootIds?.length;
  const canSubmitOfflineIntent = clientCanSubmitOfflineIntent && Boolean(shootId) && !shootIds?.length;

  const handleManualPaymentConfirm = async (payload: MarkAsPaidPayload) => {
    await onManualPaymentConfirm?.(payload);
    setIsManualPaymentDialogOpen(false);

    // Sequential cash → Stripe: if admin recorded a partial cash/cheque/etc.,
    // offer to charge the remaining balance via Stripe inside the same dialog.
    const recordedAmount = typeof payload.amount === 'number' ? payload.amount : 0;
    const remainingAfter = Math.max(amount - recordedAmount, 0);
    if (recordedAmount > 0 && remainingAfter > 0.01) {
      setPendingChargeRemainder(remainingAfter);
    } else {
      onClose();
    }
  };

  const handleChargeRemainderViaStripe = useCallback(() => {
    setPendingChargeRemainder(null);
    formRef.current?.chargeOutstandingViaStripe();
  }, []);

  const handleSkipRemainder = () => {
    setPendingChargeRemainder(null);
    toast({
      title: 'Cash payment recorded',
      description: 'Outstanding balance updated. Charge the remainder later from this shoot.',
    });
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className={`${dialogWidth} transition-all duration-300 flex flex-col h-[100dvh] sm:h-auto ${checkoutActive ? 'lg:h-[90dvh]' : ''} sm:max-h-[90dvh] rounded-none sm:rounded-lg`}>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>
              {shootAddress ? (
                <>Complete payment for shoot at {shootAddress}</>
              ) : (
                <>Enter your payment information to complete the transaction</>
              )}
            </DialogDescription>
          </DialogHeader>

          {(canRecordManualPayment || canSubmitOfflineIntent) && !successfulPayment && !checkoutActive && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-2">
              <Button type="button" variant="default" size="sm" className="justify-center gap-2">
                <CreditCard className="h-4 w-4" />
                Card
              </Button>
              {canRecordManualPayment ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-center gap-2"
                  onClick={() => setIsManualPaymentDialogOpen(true)}
                >
                  <Banknote className="h-4 w-4" />
                  Cash / Manual
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-center gap-2"
                  onClick={() => setIsClientOfflineDialogOpen(true)}
                >
                  <Banknote className="h-4 w-4" />
                  Cash / Cheque
                </Button>
              )}
            </div>
          )}

          {pendingChargeRemainder !== null && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
              <p className="font-medium">
                Cash payment recorded. Charge the remaining ${pendingChargeRemainder.toFixed(2)} via Stripe?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The cash payment is already saved. If you skip, you can charge the balance later.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={handleChargeRemainderViaStripe}>
                  Charge ${pendingChargeRemainder.toFixed(2)} via Stripe
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleSkipRemainder}>
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          <div ref={scrollContainerRef} className="pt-2 flex-1 min-h-0 overflow-y-auto lg:overflow-visible">
            {successfulPayment ? (
              <div className="text-center py-8">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
                <p className="text-sm text-muted-foreground">
                  Your payment of ${successfulPayment.amount.toFixed(2)} has been processed successfully.
                </p>
              </div>
            ) : (
              <SquarePaymentForm
                ref={formRef}
                amount={amount}
                currency={currency}
                shootId={shootId}
                shootIds={shootIds}
                clientEmail={clientEmail}
                clientName={clientName}
                shootAddress={shootAddress}
                shootServices={shootServices}
                serviceItems={serviceItems}
                shootDate={shootDate}
                shootTime={shootTime}
                totalQuote={totalQuote}
                totalPaid={totalPaid}
                pricing={pricing}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={onPaymentError}
                onCheckoutActiveChange={handleCheckoutActiveChange}
                onCheckoutMounted={handleCheckoutMounted}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {canRecordManualPayment && (
        <MarkAsPaidDialog
          isOpen={isManualPaymentDialogOpen}
          onClose={() => setIsManualPaymentDialogOpen(false)}
          onConfirm={handleManualPaymentConfirm}
          serviceItems={serviceItems}
          outstandingAmount={amount}
          showAmountControls
          title="Record Offline Payment"
          description="Select Cash, Zelle, Cheque, ACH, or Other and enter the amount received."
          confirmLabel="Record Payment"
        />
      )}

      {canSubmitOfflineIntent && shootId && (
        <OfflinePaymentIntentDialog
          isOpen={isClientOfflineDialogOpen}
          onClose={() => setIsClientOfflineDialogOpen(false)}
          shootId={shootId}
          outstandingAmount={amount}
          onSubmitted={() => {
            onOfflineIntentSubmitted?.();
            onClose();
          }}
        />
      )}
    </>
  );
}
