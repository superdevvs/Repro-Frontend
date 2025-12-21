import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SquarePaymentForm } from './SquarePaymentForm';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SquarePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency?: string;
  shootId?: string;
  shootAddress?: string;
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
  onPaymentSuccess,
  onPaymentError,
}: SquarePaymentDialogProps) {
  const [paymentCompleted, setPaymentCompleted] = useState(false);

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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            {shootAddress ? (
              <>Payment for shoot at {shootAddress}</>
            ) : (
              <>Enter your payment information to complete the transaction</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
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
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={onPaymentError}
            />
          )}
        </div>

        {!paymentCompleted && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


