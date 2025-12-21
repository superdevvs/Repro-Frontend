
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCardIcon, CheckIcon, QrCodeIcon } from "lucide-react";
import { InvoiceData } from '@/utils/invoiceUtils';
import { useToast } from '@/hooks/use-toast';
import { SquarePaymentForm } from '@/components/payments/SquarePaymentForm';

interface PaymentDialogProps {
  invoice: InvoiceData | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete?: (invoiceId: string, paymentMethod: string) => void;
}

export function PaymentDialog({ invoice, isOpen, onClose, onPaymentComplete }: PaymentDialogProps) {
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<string>("square");
  const [loading, setLoading] = useState(false);

  if (!invoice) return null;

  const handleSquarePaymentSuccess = (payment: any) => {
    if (onPaymentComplete) {
      onPaymentComplete(invoice.id, 'Square Payment');
    }
    toast({
      title: "Payment Successful",
      description: `Payment for invoice ${invoice.id} has been processed.`,
      variant: "default",
    });
    onClose();
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Get the display name for the payment method
    const paymentMethodDisplay = 
      paymentMethod === "credit-card" ? "Credit Card" : 
      paymentMethod === "bank-transfer" ? "Bank Transfer" : 
      paymentMethod === "square-upi" ? "Square UPI" : "Cash";
    
    // Simulate payment processing
    setTimeout(() => {
      setLoading(false);
      
      // Call the onPaymentComplete callback to update the invoice status and payment method
      if (onPaymentComplete) {
        onPaymentComplete(invoice.id, paymentMethodDisplay);
      }
      
      toast({
        title: "Payment Successful",
        description: `Payment for invoice ${invoice.id} has been processed.`,
        variant: "default",
      });
      onClose();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>
            Complete payment for invoice #{invoice.id} totaling ${invoice.amount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={paymentMethod} onValueChange={setPaymentMethod} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="square">Square Payment</TabsTrigger>
            <TabsTrigger value="manual">Manual Payment</TabsTrigger>
          </TabsList>
          
          <TabsContent value="square" className="space-y-4 py-4">
            <SquarePaymentForm
              amount={invoice.amount}
              currency="USD"
              onPaymentSuccess={handleSquarePaymentSuccess}
            />
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4 py-4">
            <form onSubmit={handlePayment} className="space-y-4">
          <div className="space-y-2">
                <Label htmlFor="manual-payment-method">Payment Method</Label>
            <Select 
                  value={paymentMethod === "manual" ? "cash" : paymentMethod} 
                  onValueChange={(value) => setPaymentMethod(value)}
            >
                  <SelectTrigger id="manual-payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {paymentMethod === "bank-transfer" && (
            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number</Label>
              <Input id="reference" placeholder="Enter reference number" required />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <Input 
              id="amount" 
              type="number" 
              step="0.01" 
              defaultValue={invoice.amount.toFixed(2)} 
              required 
            />
          </div>
          
          <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                    <CheckIcon className="h-4 w-4 mr-2" />
                  Process Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
