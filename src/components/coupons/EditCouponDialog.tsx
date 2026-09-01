import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Coupon, CouponType, CouponUpdatePayload } from './couponTypes';

interface EditCouponDialogProps {
  coupon: Coupon;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CouponUpdatePayload) => Promise<unknown>;
}

const toDateInputValue = (value?: string | null) => {
  if (!value) return '';
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? '';
};

export function EditCouponDialog({
  coupon,
  open,
  isSaving,
  onOpenChange,
  onSave,
}: EditCouponDialogProps) {
  const [code, setCode] = React.useState(coupon.code);
  const [type, setType] = React.useState<CouponType>(coupon.type);
  const [amount, setAmount] = React.useState(String(coupon.amount));
  const [maxUses, setMaxUses] = React.useState(
    coupon.max_uses == null ? '' : String(coupon.max_uses),
  );
  const [validUntil, setValidUntil] = React.useState(toDateInputValue(coupon.valid_until));
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCode(coupon.code);
    setType(coupon.type);
    setAmount(String(coupon.amount));
    setMaxUses(coupon.max_uses == null ? '' : String(coupon.max_uses));
    setValidUntil(toDateInputValue(coupon.valid_until));
    setValidationError(null);
  }, [coupon, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedCode = code.trim().toUpperCase();
    const normalizedAmount = Number(amount);
    const normalizedMaxUses = maxUses.trim() === '' ? null : Number(maxUses);

    if (normalizedCode.length < 3) {
      setValidationError('Discount code must be at least 3 characters.');
      return;
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      setValidationError('Discount amount must be zero or greater.');
      return;
    }

    if (type === 'percentage' && normalizedAmount > 100) {
      setValidationError('Percentage discounts cannot exceed 100%.');
      return;
    }

    if (
      normalizedMaxUses !== null &&
      (!Number.isInteger(normalizedMaxUses) || normalizedMaxUses < 1)
    ) {
      setValidationError('Uses limit must be a whole number greater than zero.');
      return;
    }

    if (normalizedMaxUses !== null && normalizedMaxUses < (coupon.current_uses ?? 0)) {
      setValidationError(`Uses limit cannot be lower than the ${coupon.current_uses ?? 0} uses already recorded.`);
      return;
    }

    setValidationError(null);
    try {
      await onSave({
        code: normalizedCode,
        type,
        amount: normalizedAmount,
        max_uses: normalizedMaxUses,
        valid_until: validUntil || null,
      });
    } catch {
      // The mutation owns API error messaging and intentionally leaves the dialog open.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Edit discount</DialogTitle>
          <DialogDescription>
            Update the code, value, expiry, or usage limit.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`coupon-code-${coupon.id}`}>Discount code</Label>
            <Input
              id={`coupon-code-${coupon.id}`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="uppercase"
              autoComplete="off"
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(value: CouponType) => setType(value)}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`coupon-amount-${coupon.id}`}>Amount</Label>
              <Input
                id={`coupon-amount-${coupon.id}`}
                type="number"
                min="0"
                max={type === 'percentage' ? '100' : undefined}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`coupon-expiry-${coupon.id}`}>Valid through</Label>
              <Input
                id={`coupon-expiry-${coupon.id}`}
                type="date"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`coupon-uses-${coupon.id}`}>Uses limit</Label>
              <Input
                id={`coupon-uses-${coupon.id}`}
                type="number"
                min={Math.max(1, coupon.current_uses ?? 0)}
                step="1"
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                placeholder="Unlimited"
                disabled={isSaving}
              />
            </div>
          </div>

          {validationError && (
            <p role="alert" className="text-sm text-destructive">
              {validationError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
