import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Banknote, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  createOfflinePaymentIntent,
  type OfflinePaymentMethod,
} from '@/services/offlinePaymentService';

interface OfflinePaymentIntentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shootId: number | string;
  outstandingAmount: number;
  onSubmitted?: () => void;
}

export function OfflinePaymentIntentDialog({
  isOpen,
  onClose,
  shootId,
  outstandingAmount,
  onSubmitted,
}: OfflinePaymentIntentDialogProps) {
  const { toast } = useToast();
  const [method, setMethod] = useState<OfflinePaymentMethod>('cash');
  const [amountInput, setAmountInput] = useState('0.00');
  const [amount, setAmount] = useState(0);
  const [checkNumber, setCheckNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPartialMode, setIsPartialMode] = useState(false);

  const safeOutstanding = Math.max(outstandingAmount, 0);

  useEffect(() => {
    if (!isOpen) return;
    setMethod('cash');
    setAmount(safeOutstanding);
    setAmountInput(safeOutstanding.toFixed(2));
    setCheckNumber('');
    setPaymentDate('');
    setNotes('');
    setError(null);
    setIsSubmitting(false);
    setIsPartialMode(false);
  }, [isOpen, safeOutstanding]);

  const canSubmit = useMemo(() => {
    if (amount <= 0 || amount > safeOutstanding + 0.01) return false;
    if (method === 'check' && checkNumber.trim() === '') return false;
    if (method === 'check' && !paymentDate) return false;
    return true;
  }, [amount, checkNumber, method, paymentDate, safeOutstanding]);

  const updateAmountFromInput = (raw: string) => {
    let value = raw.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
    if (parts.length === 2 && parts[1].length > 2) value = parts[0] + '.' + parts[1].substring(0, 2);
    setAmountInput(value);
    setIsPartialMode(true);
    const numeric = parseFloat(value);
    if (!Number.isNaN(numeric) && numeric > 0) {
      setAmount(Math.min(numeric, safeOutstanding));
    } else {
      setAmount(0);
    }
  };

  const normalizeAmount = (raw: string) => {
    const numeric = parseFloat(raw);
    if (Number.isNaN(numeric) || numeric < 0.01) {
      setAmount(safeOutstanding);
      setAmountInput(safeOutstanding.toFixed(2));
      setIsPartialMode(false);
      return;
    }
    const clamped = Math.min(numeric, safeOutstanding);
    setAmount(clamped);
    setAmountInput(clamped.toFixed(2));
    setIsPartialMode(clamped + 0.01 < safeOutstanding);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Please complete the required fields.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createOfflinePaymentIntent(shootId, {
        paymentMethod: method,
        amount,
        paymentDate: method === 'check' ? paymentDate : undefined,
        checkNumber: method === 'check' ? checkNumber : undefined,
        notes: notes || undefined,
      });
      toast({
        title: 'Payment submitted',
        description: 'Awaiting admin confirmation. Your balance will update once approved.',
      });
      onSubmitted?.();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to submit payment.';
      const responseMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(responseMessage ?? message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Submit Cash or Cheque Payment
          </DialogTitle>
          <DialogDescription>
            Record an offline payment. Your shoot balance will update only after the admin confirms receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-sm">Payment Method</Label>
            <RadioGroup
              value={method}
              onValueChange={(value) => setMethod(value as OfflinePaymentMethod)}
              className="grid gap-3 sm:grid-cols-2"
            >
              {[
                { value: 'cash' as const, label: 'Cash', helper: 'Pay in person' },
                { value: 'check' as const, label: 'Cheque', helper: 'Mail or hand a cheque' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                    method === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-1" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.helper}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="offline-payment-amount" className="text-sm">
                Payment Amount
              </Label>
              <span className="text-xs text-muted-foreground">Max ${safeOutstanding.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-lg font-semibold">$</span>
                <Input
                  id="offline-payment-amount"
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => updateAmountFromInput(event.target.value)}
                  onFocus={(event) => {
                    event.target.select();
                    setIsPartialMode(true);
                  }}
                  onBlur={(event) => normalizeAmount(event.target.value)}
                  className="h-10 text-lg font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-auto">
                <Button
                  type="button"
                  variant={!isPartialMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setAmount(safeOutstanding);
                    setAmountInput(safeOutstanding.toFixed(2));
                    setIsPartialMode(false);
                  }}
                >
                  Full
                </Button>
                <Button
                  type="button"
                  variant={isPartialMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const half = Math.ceil(safeOutstanding * 0.5 * 100) / 100;
                    setAmount(half);
                    setAmountInput(half.toFixed(2));
                    setIsPartialMode(true);
                  }}
                >
                  Partial
                </Button>
              </div>
            </div>
            {amount > 0 && amount + 0.01 < safeOutstanding && (
              <p className="text-xs text-muted-foreground">
                Remaining after this payment is confirmed:{' '}
                <span className="font-medium text-orange-600">
                  ${(safeOutstanding - amount).toFixed(2)}
                </span>
              </p>
            )}
          </div>

          {method === 'check' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cheque-number">Cheque Number</Label>
                <Input
                  id="cheque-number"
                  value={checkNumber}
                  onChange={(event) => setCheckNumber(event.target.value)}
                  placeholder="Enter cheque number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cheque-date">Cheque Date</Label>
                <Input
                  id="cheque-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="offline-payment-notes">Notes (optional)</Label>
            <Textarea
              id="offline-payment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Add any details that will help the admin confirm this payment"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Payment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
