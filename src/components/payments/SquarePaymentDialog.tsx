import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SquarePaymentForm } from './SquarePaymentForm';

interface SquarePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency?: string;
  shootId?: string;
  shootAddress?: string;
  shootServices?: string[];
  shootDate?: string;
  shootTime?: string;
  clientEmail?: string;
  clientName?: string;
  totalQuote?: number;
  totalPaid?: number;
  onPaymentSuccess?: (payment: any) => void;
  onPaymentError?: (error: any) => void;
}

export function SquarePaymentDialog({
  isOpen,
  onClose,
  amount,
  currency = 'USD',
  shootId,
  shootAddress,
  shootServices,
  shootDate,
  shootTime,
  clientEmail,
  clientName,
  totalQuote,
  totalPaid,
  onPaymentSuccess,
  onPaymentError,
}: SquarePaymentDialogProps) {
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleCheckoutActiveChange = useCallback((active: boolean) => {
    setCheckoutActive(active);
    if (active && scrollContainerRef.current) {
      // Auto-scroll to Stripe checkout on mobile
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 300);
    }
  }, []);

  const handlePaymentSuccess = (payment: any) => {
    setPaymentCompleted(true);
    if (onPaymentSuccess) {
      onPaymentSuccess(payment);
    }
    // Auto-close after 2 seconds on success
    setTimeout(() => {
      onClose();
      setPaymentCompleted(false);
    }, 2000);
  };

  const handleClose = () => {
    if (!paymentCompleted) {
      onClose();
    }
  };

  // Check if we have shoot details to display (determines dialog width)
  const hasShootDetails = shootAddress || (shootServices && shootServices.length > 0) || totalQuote !== undefined || clientName || shootDate;

  const dialogWidth = checkoutActive
    ? 'sm:max-w-[95vw] lg:max-w-[1300px]'
    : hasShootDetails
      ? 'sm:max-w-[850px]'
      : 'sm:max-w-[450px]';

  return (
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

        <div ref={scrollContainerRef} className="pt-2 flex-1 min-h-0 overflow-y-auto lg:overflow-visible">
          {paymentCompleted ? (
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
                Your payment of ${amount.toFixed(2)} has been processed successfully.
              </p>
            </div>
          ) : (
            <SquarePaymentForm
              amount={amount}
              currency={currency}
              shootId={shootId}
              clientEmail={clientEmail}
              clientName={clientName}
              shootAddress={shootAddress}
              shootServices={shootServices}
              shootDate={shootDate}
              shootTime={shootTime}
              totalQuote={totalQuote}
              totalPaid={totalPaid}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={onPaymentError}
              onCheckoutActiveChange={handleCheckoutActiveChange}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
