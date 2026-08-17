import { AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';

type PaymentLoadingStateProps = {
  confirmingPayment: boolean;
};

export function PaymentLoadingState({ confirmingPayment }: PaymentLoadingStateProps) {
  return (
    <div className="min-h-screen bg-[#060a0e] flex items-center justify-center">
      <div className="w-full max-w-md">
        <HorizontalLoader message={confirmingPayment ? "Confirming payment..." : "Loading payment details..."} />
      </div>
    </div>
  );
}

type PaymentErrorStateProps = {
  message: string;
};

export function PaymentErrorState({ message }: PaymentErrorStateProps) {
  return (
    <div className="min-h-screen bg-[#060a0e] flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-[#0a0f1a] border-red-500/30">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Payment</h2>
          <p className="text-gray-400">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function PaymentAlreadyPaidState() {
  return (
    <div className="min-h-screen bg-[#060a0e] flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-[#0a0f1a] border-green-500/30">
        <CardContent className="pt-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-2">Already Paid</h2>
          <p className="text-gray-400">
            This shoot has already been paid in full. Thank you!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
