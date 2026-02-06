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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MarkAsPaidMethod = 'zelle' | 'cash' | 'check' | 'ach' | 'other';

export interface MarkAsPaidPayload {
  paymentMethod: MarkAsPaidMethod;
  paymentDetails?: Record<string, any> | null;
  paymentDate?: string | null;
}

interface MarkAsPaidDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: MarkAsPaidPayload) => Promise<void> | void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

const methodOptions: Array<{ value: MarkAsPaidMethod; label: string; helper: string }> = [
  { value: 'zelle', label: 'Zelle', helper: 'Record a Zelle transfer' },
  { value: 'cash', label: 'Cash', helper: 'Record a cash payment' },
  { value: 'check', label: 'Check', helper: 'Add check number + date' },
  { value: 'ach', label: 'ACH', helper: 'Add transfer date' },
  { value: 'other', label: 'Other', helper: 'Add required notes' },
];

export function MarkAsPaidDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Mark as Paid',
  description = 'Choose a payment method and capture the details for this payment.',
  confirmLabel = 'Mark as Paid',
}: MarkAsPaidDialogProps) {
  const [method, setMethod] = useState<MarkAsPaidMethod>('zelle');
  const [checkNumber, setCheckNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMethod('zelle');
    setCheckNumber('');
    setPaymentDate('');
    setNotes('');
    setError(null);
    setIsSubmitting(false);
  }, [isOpen]);

  const requiresDate = method === 'check' || method === 'ach';
  const requiresCheckNumber = method === 'check';
  const requiresNotes = method === 'other';

  const canSubmit = useMemo(() => {
    if (requiresCheckNumber && !checkNumber.trim()) return false;
    if (requiresDate && !paymentDate) return false;
    if (requiresNotes && !notes.trim()) return false;
    return true;
  }, [checkNumber, paymentDate, requiresCheckNumber, requiresDate, requiresNotes, notes]);

  const handleConfirm = async () => {
    if (!canSubmit) {
      setError('Please fill out the required fields before continuing.');
      return;
    }

    const details: Record<string, any> = {};
    if (method === 'check') {
      details.check_number = checkNumber.trim();
    }
    if (notes.trim()) {
      details.notes = notes.trim();
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        paymentMethod: method,
        paymentDetails: Object.keys(details).length ? details : null,
        paymentDate: requiresDate ? paymentDate : null,
      });
      onClose();
    } catch (submitError: any) {
      setError(submitError?.message || 'Unable to record payment details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-sm">Payment Method</Label>
            <RadioGroup
              value={method}
              onValueChange={(value) => {
                setMethod(value as MarkAsPaidMethod);
                setError(null);
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              {methodOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                    method === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
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

          {method === 'check' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="check-number">Check Number</Label>
                <Input
                  id="check-number"
                  value={checkNumber}
                  onChange={(event) => setCheckNumber(event.target.value)}
                  placeholder="Enter check number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check-date">Payment Date</Label>
                <Input
                  id="check-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
            </div>
          )}

          {method === 'ach' && (
            <div className="space-y-2">
              <Label htmlFor="ach-date">Payment Date</Label>
              <Input
                id="ach-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>
          )}

          {(method === 'zelle' || method === 'cash' || method === 'ach') && (
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (optional)</Label>
              <Textarea
                id="payment-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add any reference details"
                rows={3}
              />
            </div>
          )}

          {method === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="other-notes">Notes <span className="text-destructive">*</span></Label>
              <Textarea
                id="other-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Describe the payment method"
                rows={3}
              />
            </div>
          )}

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
          <Button onClick={handleConfirm} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
