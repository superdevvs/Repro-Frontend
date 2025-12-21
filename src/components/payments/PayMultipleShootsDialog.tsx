import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ShootData } from '@/types/shoots';
import { DollarSign, FileText, CreditCard, Loader2 } from 'lucide-react';
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

  // Filter shoots with pending payments
  const unpaidShoots = shoots.filter(
    (shoot) =>
      (shoot.payment?.totalPaid ?? 0) < (shoot.payment?.totalQuote ?? 0)
  );

  useEffect(() => {
    if (isOpen) {
      // By default, no shoots are selected - user must manually select
      setSelectedShoots(new Set());
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

  const handleProcessPayment = async (method?: 'square' | 'mark-paid') => {
    const methodToUse = method || paymentMethod;
    
    if (selectedShootsData.length === 0) {
      toast({
        title: 'No shoots selected',
        description: 'Please select at least one shoot to pay for.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      if (methodToUse === 'square') {
        // Create Square checkout for multiple shoots
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
        // Mark as paid (manual payment)
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const promises = selectedShootsData.map((shoot) =>
          axios.post(
            `${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`,
            {
              payment_type: 'manual',
              amount: shoot.payment?.totalQuote ?? 0,
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
          description: `${selectedShootsData.length} shoot(s) marked as paid.`,
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay for Multiple Shoots</DialogTitle>
          <DialogDescription>
            Select shoots with pending payments and process payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Method Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <div className="flex gap-4">
              <Button
                variant={paymentMethod === 'square' ? 'default' : 'outline'}
                onClick={() => {
                  setPaymentMethod('square');
                  // If shoots are selected, process payment immediately
                  if (selectedShootsData.length > 0 && !processing) {
                    handleProcessPayment('square');
                  }
                }}
                disabled={processing || selectedShootsData.length === 0}
                className="flex-1"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Square Payment
              </Button>
              <Button
                variant={paymentMethod === 'mark-paid' ? 'default' : 'outline'}
                onClick={() => {
                  setPaymentMethod('mark-paid');
                  // If shoots are selected, process payment immediately
                  if (selectedShootsData.length > 0 && !processing) {
                    handleProcessPayment('mark-paid');
                  }
                }}
                disabled={processing || selectedShootsData.length === 0}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                Mark as Paid
              </Button>
            </div>
          </div>

          <Separator />

          {/* Shoots List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {unpaidShoots.length} shoot(s) with pending payment
              </span>
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

            {unpaidShoots.map((shoot) => {
              const isSelected = selectedShoots.has(shoot.id);
              const quote = shoot.payment?.totalQuote ?? 0;
              const paid = shoot.payment?.totalPaid ?? 0;
              const remaining = quote - paid;

              return (
                <Card
                  key={shoot.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => toggleShoot(shoot.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleShoot(shoot.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {shoot.location.fullAddress}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {shoot.scheduledDate && !isNaN(new Date(shoot.scheduledDate).getTime())
                                ? format(
                                    new Date(shoot.scheduledDate),
                                    'MMM d, yyyy'
                                  )
                                : 'Date TBD'}{' '}
                              • {shoot.client.name}
                            </p>
                          </div>
                          <Badge variant="outline" className="flex-shrink-0">
                            ${remaining.toFixed(2)} remaining
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span>Total: ${quote.toFixed(2)}</span>
                          <span>Paid: ${paid.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Separator />

          {/* Summary */}
          {selectedShootsData.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {selectedShootsData.length} shoot(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={processing}>
              Cancel
            </Button>
            <Button
              onClick={handleProcessPayment}
              disabled={processing || selectedShootsData.length === 0}
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
      </DialogContent>
    </Dialog>
  );
}
