import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CreditCard, CheckIcon, Banknote, MapPin, Package, Loader2 } from "lucide-react";
import { InvoiceData } from '@/utils/invoiceUtils';
import { useToast } from '@/hooks/use-toast';
import { SquarePaymentForm } from '@/components/payments/SquarePaymentForm';
import { MarkAsPaidDialog, MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { formatPaymentMethod } from '@/utils/paymentUtils';

export interface InvoicePaymentCompletePayload {
  invoiceId: string;
  paymentMethod: string;
  amount?: number;
  paymentDetails?: Record<string, any> | null;
  paymentDate?: string | null;
}

interface PaymentDialogProps {
  invoice: InvoiceData | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete?: (payload: InvoicePaymentCompletePayload) => Promise<void> | void;
  // Additional context for display
  shootAddress?: string;
  shootServices?: string[];
  clientEmail?: string;
  clientName?: string;
}

export function PaymentDialog({ 
  invoice, 
  isOpen, 
  onClose, 
  onPaymentComplete,
  shootAddress,
  shootServices,
  clientEmail,
  clientName,
}: PaymentDialogProps) {
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<string>("square");
  const [loading, setLoading] = useState(false);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  
  // Partial payment state
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentAmountInput, setPaymentAmountInput] = useState('0.00');
  const [isPartialPaymentMode, setIsPartialPaymentMode] = useState(false);
  const paymentAmountInputRef = useRef<HTMLInputElement>(null);

  // Reset state when invoice changes
  useEffect(() => {
    if (invoice) {
      setPaymentAmount(invoice.amount);
      setPaymentAmountInput(invoice.amount.toFixed(2));
      setIsPartialPaymentMode(false);
      setIsMarkPaidDialogOpen(false);
    }
  }, [invoice]);

  if (!invoice) return null;

  const outstandingAmount = invoice.amount;
  const remainingBalanceAfterPayment = outstandingAmount - paymentAmount;

  const handleSquarePaymentSuccess = async (payment: any) => {
    try {
      if (onPaymentComplete) {
        await onPaymentComplete({
          invoiceId: invoice.id,
          paymentMethod: 'square',
          amount: invoice.amount,
        });
      }
      toast({
        title: "Payment Successful",
        description: `Payment of $${invoice.amount.toFixed(2)} for invoice ${invoice.id} has been processed.`,
        variant: "default",
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Payment Failed',
        description: error instanceof Error ? error.message : 'Unable to record payment.',
        variant: 'destructive',
      });
    }
  };

  const handleManualPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate payment amount
    if (paymentAmount <= 0 || paymentAmount > outstandingAmount) {
      toast({
        title: 'Invalid Payment Amount',
        description: `Payment amount must be between $0.01 and $${outstandingAmount.toFixed(2)}`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsMarkPaidDialogOpen(true);
  };

  const handleMarkPaidConfirm = async (payload: MarkAsPaidPayload) => {
    setLoading(true);
    try {
      if (onPaymentComplete) {
        await onPaymentComplete({
          invoiceId: invoice.id,
          paymentMethod: payload.paymentMethod,
          paymentDetails: payload.paymentDetails,
          paymentDate: payload.paymentDate,
          amount: paymentAmount,
        });
      }

      const methodLabel = formatPaymentMethod(payload.paymentMethod, payload.paymentDetails);
      toast({
        title: "Payment Recorded",
        description: `${methodLabel} payment of $${paymentAmount.toFixed(2)} for invoice ${invoice.id} has been recorded.${remainingBalanceAfterPayment > 0 ? ` Remaining: $${remainingBalanceAfterPayment.toFixed(2)}` : ''}`,
        variant: "default",
      });
      onClose();
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Unable to record payment.';
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // Check if we have context details to display
  const hasContextDetails = shootAddress || (shootServices && shootServices.length > 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`${hasContextDetails ? 'sm:max-w-[800px]' : 'sm:max-w-[500px]'}`}>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>
              Complete payment for invoice #{invoice.id} totaling ${invoice.amount.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={paymentMethod} onValueChange={setPaymentMethod} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="square" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Card Payment
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Banknote className="h-4 w-4" />
                Manual Payment
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="square" className="space-y-4 py-4">
              <SquarePaymentForm
                amount={invoice.amount}
                currency="USD"
                shootAddress={shootAddress}
                shootServices={shootServices}
                clientEmail={clientEmail}
                clientName={clientName}
                totalQuote={invoice.amount}
                totalPaid={0}
                onPaymentSuccess={handleSquarePaymentSuccess}
              />
            </TabsContent>
            
            <TabsContent value="manual" className="py-4">
              <div className={`grid gap-6 ${hasContextDetails ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Left Column - Context Details */}
                {hasContextDetails && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
                      <div className="space-y-4">
                        {/* Location */}
                        {shootAddress && (
                          <div className="p-4 border rounded-lg bg-muted/30">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <MapPin className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-xs text-muted-foreground mb-1 block">Location</Label>
                                <p className="text-sm font-medium break-words">{shootAddress}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Services */}
                        {shootServices && shootServices.length > 0 && (
                          <div className="p-4 border rounded-lg bg-muted/30">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Package className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-sm font-semibold mb-2 block">Services</Label>
                                <div className="space-y-2">
                                  {shootServices.map((service, index) => (
                                    <div key={index} className="text-sm font-medium text-foreground">
                                      • {service}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Billing Summary */}
                        <div className="p-4 border rounded-lg bg-muted/30">
                          <Label className="text-xs text-muted-foreground mb-2 block">Billing Summary</Label>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between font-medium">
                              <span>Invoice Total:</span>
                              <span>${invoice.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Outstanding:</span>
                              <span className="font-medium text-orange-600">
                                ${outstandingAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Right Column - Payment Form */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Record Payment</h3>
                    <form onSubmit={handleManualPaymentSubmit} className="space-y-4">
                      {/* Payment Amount Input */}
                      <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                        <Label htmlFor="manualPaymentAmount" className="text-sm font-medium">Payment Amount</Label>
                        <div className="space-y-2">
                          <Input
                            ref={paymentAmountInputRef}
                            id="manualPaymentAmount"
                            type="text"
                            inputMode="decimal"
                            value={paymentAmountInput}
                            onChange={(e) => {
                              let inputValue = e.target.value;
                              
                              if (inputValue === '') {
                                setPaymentAmountInput('');
                                setPaymentAmount(0);
                                setIsPartialPaymentMode(true);
                                return;
                              }
                              
                              inputValue = inputValue.replace(/[^0-9.]/g, '');
                              
                              const parts = inputValue.split('.');
                              if (parts.length > 2) {
                                inputValue = parts[0] + '.' + parts.slice(1).join('');
                              }
                              
                              if (parts.length === 2 && parts[1].length > 2) {
                                inputValue = parts[0] + '.' + parts[1].substring(0, 2);
                              }
                              
                              setPaymentAmountInput(inputValue);
                              setIsPartialPaymentMode(true);
                              
                              const numericValue = parseFloat(inputValue);
                              if (!isNaN(numericValue) && numericValue > 0) {
                                if (numericValue <= outstandingAmount) {
                                  setPaymentAmount(numericValue);
                                } else {
                                  setPaymentAmount(outstandingAmount);
                                }
                              } else {
                                setPaymentAmount(0);
                              }
                            }}
                            onFocus={(e) => {
                              e.target.select();
                              setIsPartialPaymentMode(true);
                            }}
                            onBlur={(e) => {
                              const inputValue = e.target.value.trim();
                              
                              if (inputValue === '' || inputValue === '.') {
                                setPaymentAmountInput('0.00');
                                setPaymentAmount(0);
                                return;
                              }
                              
                              const numericValue = parseFloat(inputValue);
                              
                              if (isNaN(numericValue) || numericValue < 0.01) {
                                setPaymentAmountInput('0.00');
                                setPaymentAmount(0);
                              } else if (numericValue > outstandingAmount) {
                                setPaymentAmountInput(outstandingAmount.toFixed(2));
                                setPaymentAmount(outstandingAmount);
                              } else {
                                setPaymentAmountInput(numericValue.toFixed(2));
                                setPaymentAmount(numericValue);
                              }
                            }}
                            className={`text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isPartialPaymentMode ? 'ring-2 ring-inset ring-blue-500 border-blue-500' : ''}`}
                            required
                            placeholder={`Enter amount (max $${outstandingAmount.toFixed(2)})`}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPaymentAmount(outstandingAmount);
                                setPaymentAmountInput(outstandingAmount.toFixed(2));
                                setIsPartialPaymentMode(false);
                              }}
                              className="text-xs"
                            >
                              Pay Full Amount (${outstandingAmount.toFixed(2)})
                            </Button>
                            <Button
                              type="button"
                              variant={isPartialPaymentMode ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setIsPartialPaymentMode(true);
                                const defaultPartial = Math.ceil(outstandingAmount * 0.5 * 100) / 100;
                                setPaymentAmount(defaultPartial);
                                setPaymentAmountInput(defaultPartial.toFixed(2));
                                setTimeout(() => {
                                  paymentAmountInputRef.current?.focus();
                                  paymentAmountInputRef.current?.select();
                                }, 100);
                              }}
                              className={`text-xs ${isPartialPaymentMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                            >
                              Partial Payment
                            </Button>
                          </div>
                          {isPartialPaymentMode && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950 p-2 rounded border border-blue-200 dark:border-blue-800">
                              Partial Payment Mode: Enter your desired amount (between $0.01 and ${outstandingAmount.toFixed(2)})
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>This payment:</span>
                              <span className="font-medium">${paymentAmount.toFixed(2)}</span>
                            </div>
                            {remainingBalanceAfterPayment > 0 && (
                              <div className="flex justify-between">
                                <span>Remaining after this payment:</span>
                                <span className="font-medium text-orange-600">${remainingBalanceAfterPayment.toFixed(2)}</span>
                              </div>
                            )}
                            {remainingBalanceAfterPayment <= 0 && (
                              <div className="flex justify-between text-green-600 font-medium">
                                <span>Balance will be fully paid</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <DialogFooter className="pt-4">
                        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
                        <Button 
                          type="submit" 
                          disabled={loading || paymentAmount <= 0 || paymentAmount > outstandingAmount}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckIcon className="h-4 w-4 mr-2" />
                              Select Payment Method
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <MarkAsPaidDialog
        isOpen={isMarkPaidDialogOpen}
        onClose={() => setIsMarkPaidDialogOpen(false)}
        onConfirm={handleMarkPaidConfirm}
        title="Record Manual Payment"
        description="Select the payment method and provide any required details."
        confirmLabel="Record Payment"
      />
    </>
  );
}
