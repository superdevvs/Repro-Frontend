
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircleIcon, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { SquarePaymentDialog } from '@/components/payments/SquarePaymentDialog';
import { useToast } from '@/hooks/use-toast';

interface BookingCompleteProps {
  date: Date | undefined;
  time: string;
  resetForm: () => void;
  isClientRequest?: boolean;
  shootId?: string | number;
  totalAmount?: number;
  shootAddress?: string;
  shootServices?: string[];
  clientName?: string;
  clientEmail?: string;
}

export function BookingComplete({ 
  date, 
  time, 
  resetForm, 
  isClientRequest = false, 
  shootId, 
  totalAmount = 0,
  shootAddress,
  shootServices = [],
  clientName,
  clientEmail,
}: BookingCompleteProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(3);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [countdownComplete, setCountdownComplete] = useState(false);
  
  // Format the date properly to ensure correct display
  const formattedDate = date ? format(new Date(
    date.getFullYear(),
    date.getMonth(), 
    date.getDate(),
    12 // Set to noon to avoid timezone issues
  ), 'MMMM d, yyyy') : '';

  // Countdown effect for client bookings
  useEffect(() => {
    if (!isClientRequest || countdownComplete) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCountdownComplete(true);
      setShowPaymentDialog(true);
    }
  }, [countdown, isClientRequest, countdownComplete]);

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
        
        {/* Payment countdown for client requests */}
        {isClientRequest && !countdownComplete && (
          <motion.div 
            className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Taking you to payment in{' '}
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-lg font-bold text-white bg-blue-500 rounded-full animate-pulse">
                {countdown}
              </span>
            </p>
          </motion.div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={resetForm} variant="outline">Book Another Shoot</Button>
          <Button onClick={() => navigate('/shoot-history')}>View All Shoots</Button>
        </div>
      </motion.div>

      {/* Square Payment Dialog */}
      <SquarePaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount={totalAmount}
        shootId={shootId ? String(shootId) : undefined}
        shootAddress={shootAddress}
        shootServices={shootServices}
        shootDate={formattedDate}
        shootTime={time}
        clientName={clientName}
        clientEmail={clientEmail}
        totalQuote={totalAmount}
        totalPaid={0}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </>
  );
}
