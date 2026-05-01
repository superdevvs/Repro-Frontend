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
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentDetailMap, PaymentDetails } from '@/utils/paymentUtils';
import type { NormalizedShootServiceItem } from '@/utils/shootServiceItems';
import { formatServiceItemStatus } from '@/utils/shootServiceItems';

export type MarkAsPaidMethod = 'zelle' | 'cash' | 'check' | 'ach' | 'other';

export interface MarkAsPaidPayload {
  paymentMethod: MarkAsPaidMethod;
  amount?: number;
  shootServiceIds?: string[];
  allocationStrategy?: 'selected_services';
  paymentDetails?: PaymentDetails;
  paymentDate?: string | null;
}

interface MarkAsPaidDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: MarkAsPaidPayload) => Promise<void> | void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  serviceItems?: NormalizedShootServiceItem[];
}

const methodOptions: Array<{ value: MarkAsPaidMethod; label: string; helper: string }> = [
  { value: 'zelle', label: 'Zelle', helper: 'Record a Zelle transfer' },
  { value: 'cash', label: 'Cash', helper: 'Record a cash payment' },
  { value: 'check', label: 'Cheque', helper: 'Add cheque number + date' },
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
  serviceItems = [],
}: MarkAsPaidDialogProps) {
  const [method, setMethod] = useState<MarkAsPaidMethod>('zelle');
  const [checkNumber, setCheckNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentScope, setPaymentScope] = useState<'full' | 'selected'>('full');
  const [selectedServiceItemIds, setSelectedServiceItemIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const payableServiceItems = useMemo(
    () => serviceItems.filter((item) => item.id && item.balanceDue > 0.01),
    [serviceItems],
  );
  const selectedServiceAmount = useMemo(
    () => payableServiceItems
      .filter((item) => selectedServiceItemIds.includes(item.id))
      .reduce((sum, item) => sum + item.balanceDue, 0),
    [payableServiceItems, selectedServiceItemIds],
  );

  useEffect(() => {
    if (!isOpen) return;
    setMethod('zelle');
    setCheckNumber('');
    setPaymentDate('');
    setNotes('');
    setPaymentScope('full');
    setSelectedServiceItemIds([]);
    setError(null);
    setIsSubmitting(false);
  }, [isOpen]);

  useEffect(() => {
    if (paymentScope !== 'selected') return;
    setSelectedServiceItemIds((currentIds) => {
      const validIds = new Set(payableServiceItems.map((item) => item.id));
      const retained = currentIds.filter((id) => validIds.has(id));
      if (retained.length > 0 || payableServiceItems.length === 0) {
        return retained;
      }
      return [payableServiceItems[0].id];
    });
  }, [payableServiceItems, paymentScope]);

  const requiresDate = method === 'check' || method === 'ach';
  const requiresCheckNumber = method === 'check';
  const requiresNotes = method === 'other';

  const canSubmit = useMemo(() => {
    if (requiresCheckNumber && !checkNumber.trim()) return false;
    if (requiresDate && !paymentDate) return false;
    if (requiresNotes && !notes.trim()) return false;
    if (paymentScope === 'selected' && selectedServiceItemIds.length === 0) return false;
    return true;
  }, [checkNumber, paymentDate, paymentScope, requiresCheckNumber, requiresDate, requiresNotes, notes, selectedServiceItemIds.length]);

  const handleConfirm = async () => {
    if (!canSubmit) {
      setError('Please fill out the required fields before continuing.');
      return;
    }

    const details: PaymentDetailMap = {};
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
        amount: paymentScope === 'selected' ? selectedServiceAmount : undefined,
        shootServiceIds: paymentScope === 'selected' ? selectedServiceItemIds : undefined,
        allocationStrategy: paymentScope === 'selected' ? 'selected_services' : undefined,
        paymentDetails: Object.keys(details).length ? details : null,
        paymentDate: requiresDate ? paymentDate : null,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to record payment details.');
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

          {payableServiceItems.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm">Payment Scope</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={paymentScope === 'full' ? 'default' : 'outline'}
                  onClick={() => setPaymentScope('full')}
                >
                  Full Order
                </Button>
                <Button
                  type="button"
                  variant={paymentScope === 'selected' ? 'default' : 'outline'}
                  onClick={() => setPaymentScope('selected')}
                >
                  Selected Services
                </Button>
              </div>
              {paymentScope === 'selected' && (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  {payableServiceItems.map((item) => {
                    const checked = selectedServiceItemIds.includes(item.id);
                    return (
                      <label key={item.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            setSelectedServiceItemIds((currentIds) => {
                              if (value) {
                                return currentIds.includes(item.id) ? currentIds : [...currentIds, item.id];
                              }
                              return currentIds.filter((id) => id !== item.id);
                            });
                          }}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatServiceItemStatus(item.paymentStatus)} · ${item.balanceDue.toFixed(2)} due
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                    <span>Selected total</span>
                    <span>${selectedServiceAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {method === 'check' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="check-number">Cheque Number</Label>
                <Input
                  id="check-number"
                  value={checkNumber}
                  onChange={(event) => setCheckNumber(event.target.value)}
                  placeholder="Enter cheque number"
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
