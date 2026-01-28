import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ShootData } from '@/types/shoots';
import { DollarSign, FileText, CreditCard, Loader2, MapPin, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { API_BASE_URL } from '@/config/env';
import axios from 'axios';

interface PayMultipleShootsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shoots: ShootData[];
  onPaymentComplete?: () => void;
}

export function PayMultipleShootsDialog({
  isOpen,
  onClose,
  shoots,
  onPaymentComplete,
}: PayMultipleShootsDialogProps) {
  const { toast } = useToast();
  const [selectedShoots, setSelectedShoots] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'square' | 'mark-paid'>('square');
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);

  // Filter shoots with pending payments
  const unpaidShoots = shoots.filter(
    (shoot) =>
      (shoot.payment?.totalPaid ?? 0) < (shoot.payment?.totalQuote ?? 0)
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedShoots(new Set());
      setPaymentMethod('square');
    }
  }, [isOpen]);

  const toggleShoot = (shootId: string) => {
    setSelectedShoots((prev) => {
      const next = new Set(prev);
      if (next.has(shootId)) {
        next.delete(shootId);
      } else {
        next.add(shootId);
      }
      return next;
    });
  };

  const selectedShootsData = unpaidShoots.filter((s) =>
    selectedShoots.has(s.id)
  );

  const totalAmount = selectedShootsData.reduce((sum, shoot) => {
    const quote = shoot.payment?.totalQuote ?? 0;
    const paid = shoot.payment?.totalPaid ?? 0;
    return sum + (quote - paid);
  }, 0);

  const handlePaymentClick = () => {
    if (selectedShootsData.length === 0) {
      toast({
        title: 'No shoots selected',
        description: 'Please select at least one shoot to pay for.',
        variant: 'destructive',
      });
      return;
    }
    setShowConfirmationDialog(true);
  };

  const handleConfirmPayment = async () => {
    setShowConfirmationDialog(false);
    setProcessing(true);

    try {
      if (paymentMethod === 'square') {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.post(
          `${API_BASE_URL}/api/payments/multiple-shoots`,
          {
            shoot_ids: Array.from(selectedShoots),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data?.checkoutUrl) {
          window.open(response.data.checkoutUrl, '_blank');
          toast({
            title: 'Payment window opened',
            description: 'Complete payment in the new window.',
          });
          onClose();
        }
      } else {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const promises = selectedShootsData.map((shoot) =>
          axios.post(
            `${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`,
            {
              payment_type: 'manual',
              amount: (shoot.payment?.totalQuote ?? 0) - (shoot.payment?.totalPaid ?? 0),
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          )
        );

        await Promise.all(promises);

        toast({
          title: 'Success',
          description: `${selectedShootsData.length} shoot(s) marked as paid. Total: $${totalAmount.toFixed(2)}`,
        });

        if (onPaymentComplete) {
          onPaymentComplete();
        }
        onClose();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description:
          error.response?.data?.message ||
          'Failed to process payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pay for Multiple Shoots</DialogTitle>
            <DialogDescription>
              Select shoots with pending payments and process them together
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
            {/* Left Column - Shoots Selection */}
            <div className="space-y-4 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Pending Shoots</h3>
                  <p className="text-sm text-muted-foreground">
                    {unpaidShoots.length} shoot(s) with pending payment
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedShoots.size === unpaidShoots.length) {
                      setSelectedShoots(new Set());
                    } else {
                      setSelectedShoots(new Set(unpaidShoots.map((s) => s.id)));
                    }
                  }}
                >
                  {selectedShoots.size === unpaidShoots.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>

              {/* Shoots List */}
              <div className="space-y-2 overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(70vh - 200px)' }}>
                {unpaidShoots.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">All shoots are paid!</p>
                    <p className="text-sm">No pending payments found.</p>
                  </div>
                ) : (
                  unpaidShoots.map((shoot) => {
                    const isSelected = selectedShoots.has(shoot.id);
                    const quote = shoot.payment?.totalQuote ?? 0;
                    const paid = shoot.payment?.totalPaid ?? 0;
                    const remaining = quote - paid;

                    return (
                      <Card
                        key={shoot.id}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'hover:bg-muted/50 hover:border-muted-foreground/30'
                        }`}
                        onClick={() => toggleShoot(shoot.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleShoot(shoot.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <p className="font-medium truncate text-sm">
                                      {shoot.location.fullAddress}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {shoot.scheduledDate && !isNaN(new Date(shoot.scheduledDate).getTime())
                                        ? format(new Date(shoot.scheduledDate), 'MMM d, yyyy')
                                        : 'Date TBD'}
                                    </span>
                                    <span>•</span>
                                    <span>{shoot.client.name}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-muted-foreground">Quote: ${quote.toFixed(2)}</span>
                                  <span className="text-green-600">Paid: ${paid.toFixed(2)}</span>
                                </div>
                                <Badge 
                                  variant="outline" 
                                  className={`flex-shrink-0 ${isSelected ? 'bg-primary/10 border-primary text-primary' : 'bg-orange-50 border-orange-200 text-orange-700'}`}
                                >
                                  ${remaining.toFixed(2)} due
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column - Payment Summary & Actions */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Payment Summary</h3>
                
                {/* Selected Summary */}
                <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Selected Shoots:</span>
                    <span className="font-semibold">{selectedShootsData.length}</span>
                  </div>
                  
                  {selectedShootsData.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {selectedShootsData.map((shoot) => {
                          const remaining = (shoot.payment?.totalQuote ?? 0) - (shoot.payment?.totalPaid ?? 0);
                          return (
                            <div key={shoot.id} className="flex items-center justify-between text-sm">
                              <span className="truncate flex-1 mr-2 text-muted-foreground">
                                {shoot.location.fullAddress.split(',')[0]}
                              </span>
                              <span className="font-medium">${remaining.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <Separator />
                    </>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Amount:</span>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Payment Method</Label>
                <div className="grid grid-cols-1 gap-3">
                  <Card
                    className={`cursor-pointer transition-all ${
                      paymentMethod === 'square'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setPaymentMethod('square')}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        paymentMethod === 'square' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Card Payment</p>
                        <p className="text-sm text-muted-foreground">Pay via Square checkout</p>
                      </div>
                      {paymentMethod === 'square' && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card
                    className={`cursor-pointer transition-all ${
                      paymentMethod === 'mark-paid'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setPaymentMethod('mark-paid')}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        paymentMethod === 'mark-paid' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Mark as Paid</p>
                        <p className="text-sm text-muted-foreground">Record manual payment</p>
                      </div>
                      {paymentMethod === 'mark-paid' && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Warning if no selection */}
              {selectedShootsData.length === 0 && unpaidShoots.length > 0 && (
                <div className="flex items-start gap-3 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No shoots selected</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Select at least one shoot from the list to proceed with payment.</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onClose} disabled={processing} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handlePaymentClick}
                  disabled={processing || selectedShootsData.length === 0}
                  className="flex-1"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : paymentMethod === 'square' ? (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay ${totalAmount.toFixed(2)}
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Mark as Paid
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm Batch Payment</DialogTitle>
            <DialogDescription>
              Please review the payment details before confirming.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Number of Shoots:</span>
                <span className="font-semibold">{selectedShootsData.length}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Payment:</span>
                <span className="font-semibold text-lg">${totalAmount.toFixed(2)}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="font-medium capitalize">
                  {paymentMethod === 'square' ? 'Card (Square)' : 'Mark as Paid'}
                </span>
              </div>
            </div>

            {paymentMethod === 'square' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  You will be redirected to Square checkout to complete the payment.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmationDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPayment}
              disabled={processing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm ${paymentMethod === 'square' ? 'Payment' : 'Mark as Paid'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
