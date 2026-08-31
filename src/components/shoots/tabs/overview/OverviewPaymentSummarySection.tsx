import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ShootData } from '@/types/shoots';
import { CreditCard, Loader2 } from 'lucide-react';
import { PendingPaymentIntentsCard } from '@/components/payments/PendingPaymentIntentsCard';
import { calculateDiscountAmount } from '@/utils/pricing';

/**
 * Resolve the discount amount for a payment object. Prefers a precomputed
 * `discountAmount` (camelCase or snake_case), otherwise derives it from the
 * discount type/value against the service subtotal (mirroring how the main
 * ShootEditModal computes it). Returns 0 when there is no discount.
 */
const resolveDiscountAmount = (payment?: ShootData['payment'] | null): number => {
  if (!payment) return 0;
  const raw = payment as unknown as Record<string, unknown>;
  const precomputed =
    Number(payment.discountAmount ?? (raw.discount_amount as number | undefined) ?? 0) || 0;
  if (precomputed > 0.005) return precomputed;

  const discountType =
    payment.discountType ?? (raw.discount_type as ShootData['payment']['discountType']) ?? null;
  const discountValue =
    Number(payment.discountValue ?? (raw.discount_value as number | undefined) ?? 0) || 0;
  if (!discountValue) return 0;

  const serviceSubtotal =
    Number(
      payment.serviceSubtotal ??
        (raw.service_subtotal as number | undefined) ??
        payment.baseQuote ??
        0,
    ) || 0;
  return calculateDiscountAmount(serviceSubtotal, discountType, discountValue);
};

const resolveInvoiceAdjustmentsTotal = (payment?: ShootData['payment'] | null): number => {
  if (!payment) return 0;
  const raw = payment as unknown as Record<string, unknown>;
  return Math.max(
    Number(
      payment.invoiceAdjustmentsTotal ??
        (raw.invoice_adjustments_total as number | string | undefined) ??
        0,
    ) || 0,
    0,
  );
};

type OverviewPaymentSummarySectionProps = {
  isEditMode: boolean;
  isAdmin: boolean;
  isRep: boolean;
  isClient: boolean;
  isClientReleaseLocked: boolean;
  editedShoot: Partial<ShootData>;
  shoot: ShootData;
  paymentTotalPaid: number;
  paymentBalance: number;
  updateField: (field: string, value: unknown) => void;
  onPayNow?: () => void;
  isPaying?: boolean;
  /** Triggered after admin confirms/declines a pending intent */
  onPendingIntentsChanged?: () => void;
  /** Whether the viewer can confirm/decline pending intents */
  canModeratePendingIntents?: boolean;
};

export function OverviewPaymentSummarySection({
  isEditMode,
  isAdmin,
  isRep,
  isClient,
  editedShoot,
  shoot,
  paymentTotalPaid,
  paymentBalance,
  updateField,
  onPayNow,
  isPaying = false,
  onPendingIntentsChanged,
  canModeratePendingIntents = false,
}: OverviewPaymentSummarySectionProps) {
  const pendingPayments = shoot.payment?.pendingPayments ?? [];
  const formattedPaymentBalance = `$${paymentBalance.toFixed(2)}`;
  const payNowLabel = `Pay ${formattedPaymentBalance}`;
  const isCancellationFeeOnly = Boolean(shoot.payment?.isCancellationFeeOnly);
  const originalServiceSubtotal = Number(shoot.payment?.originalServiceSubtotal || 0);
  const cancellationFee = Number(shoot.payment?.cancellationFee || shoot.payment?.totalQuote || 0);
  const shouldShowCancelledServiceCharges = isCancellationFeeOnly && originalServiceSubtotal > 0;

  // Discount derived from the client's pricing settings; informational (not
  // directly editable) but surfaced so the breakdown reconciles with the total.
  const discountAmount = resolveDiscountAmount(shoot.payment);
  const editedDiscountAmount = resolveDiscountAmount(
    (editedShoot.payment as ShootData['payment'] | undefined) ?? shoot.payment,
  );
  const hasDiscount = discountAmount > 0.005;
  const hasEditedDiscount = editedDiscountAmount > 0.005;
  const invoiceAdjustmentsTotal = resolveInvoiceAdjustmentsTotal(shoot.payment);
  const editedInvoiceAdjustmentsTotal = resolveInvoiceAdjustmentsTotal(
    (editedShoot.payment as ShootData['payment'] | undefined) ?? shoot.payment,
  );
  const hasInvoiceAdjustments = invoiceAdjustmentsTotal > 0.005;
  const hasEditedInvoiceAdjustments = editedInvoiceAdjustmentsTotal > 0.005;
  const serviceSubtotal = Number(shoot.payment?.serviceSubtotal ?? shoot.payment?.baseQuote ?? 0) || 0;
  const editedServiceSubtotal = Number(
    editedShoot.payment?.serviceSubtotal
      ?? shoot.payment?.serviceSubtotal
      ?? editedShoot.payment?.baseQuote
      ?? shoot.payment?.baseQuote
      ?? 0,
  ) || 0;
  const editedBaseQuote = Number(editedShoot.payment?.baseQuote ?? shoot.payment?.baseQuote ?? 0) || 0;
  const editedTaxAmount = Number(editedShoot.payment?.taxAmount ?? shoot.payment?.taxAmount ?? 0) || 0;
  const automaticEditedTotal = Number(
    (editedBaseQuote + editedTaxAmount + editedInvoiceAdjustmentsTotal).toFixed(2),
  );
  const adjustedTotal = editedShoot.adminAdjustedTotalQuote;
  const hasAdjustedTotal = adjustedTotal !== null
    && adjustedTotal !== undefined
    && Number.isFinite(Number(adjustedTotal));
  const editedOrderTotal = hasAdjustedTotal ? Number(adjustedTotal) : automaticEditedTotal;
  const editedPaymentBalance = Math.max(editedOrderTotal - paymentTotalPaid, 0);
  const overpaymentAmount = Math.max(
    Number(
      shoot.overpaymentAmount
        ?? shoot.overpayment_amount
        ?? shoot.payment?.overpaymentAmount
        ?? shoot.payment?.overpayment_amount
        ?? (paymentTotalPaid - Number(shoot.payment?.totalQuote ?? 0)),
    ) || 0,
    0,
  );
  const editedOverpaymentAmount = Math.max(paymentTotalPaid - editedOrderTotal, 0);
  const canAdjustOrderTotal = Boolean(shoot.canRemoveAllServices ?? shoot.can_remove_all_services);

  // Admin and sales reps see the full editable/detailed breakdown.
  const canViewFullBreakdown = isAdmin || isRep;

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Payment</span>
      {isEditMode && canViewFullBreakdown ? (
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Services:</span>
            <span>${editedServiceSubtotal.toFixed(2)}</span>
          </div>
          {hasEditedDiscount && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount:</span>
              <span className="text-emerald-600">-${editedDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {hasEditedDiscount && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">After discount:</span>
              <span>${editedBaseQuote.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax:</span>
            <span>${editedTaxAmount.toFixed(2)}</span>
          </div>
          {hasEditedInvoiceAdjustments && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice adjustments:</span>
              <span>${editedInvoiceAdjustmentsTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>Calculated total:</span>
            <span>${automaticEditedTotal.toFixed(2)}</span>
          </div>
          {canAdjustOrderTotal && (
            <div className="flex flex-col gap-1 pt-1">
              <span className="font-medium">Adjusted Total (optional)</span>
              <Input
                aria-label="Adjusted Total"
                type="number"
                min={editedInvoiceAdjustmentsTotal}
                step="0.01"
                placeholder={automaticEditedTotal.toFixed(2)}
                value={hasAdjustedTotal ? String(adjustedTotal) : ''}
                onChange={(event) => {
                  const rawValue = event.target.value;
                  updateField(
                    'adminAdjustedTotalQuote',
                    rawValue === '' ? null : Math.max(Number(rawValue) || 0, 0),
                  );
                }}
                className="h-7 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">
                Leave blank to use server pricing. The adjusted total includes invoice adjustments.
              </span>
            </div>
          )}
          <Separator className="my-1.5" />
          <div className="flex justify-between font-semibold">
            <span>Final total:</span>
            <span>${editedOrderTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid:</span>
            <span>${paymentTotalPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Balance:</span>
            <span className={editedPaymentBalance > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
              ${editedPaymentBalance.toFixed(2)}
            </span>
          </div>
          {editedOverpaymentAmount > 0.005 && (
            <div className="flex justify-between font-semibold text-rose-700 dark:text-rose-300">
              <span>Refund/credit due:</span>
              <span>${editedOverpaymentAmount.toFixed(2)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-0.5 text-xs">
          {canViewFullBreakdown ? (
            <>
              {shouldShowCancelledServiceCharges ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Services:</span>
                    <span className="text-muted-foreground line-through">
                      ${originalServiceSubtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cancellation fee:</span>
                    <span>${cancellationFee.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Services:</span>
                  <span>${serviceSubtotal.toFixed(2)}</span>
                </div>
              )}
              {hasDiscount && !shouldShowCancelledServiceCharges && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="text-emerald-600">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              {hasDiscount && !shouldShowCancelledServiceCharges && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">After discount:</span>
                  <span>${(Number(shoot.payment?.baseQuote) || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax:</span>
                <span>${(Number(shoot.payment?.taxAmount) || 0).toFixed(2)}</span>
              </div>
              {hasInvoiceAdjustments && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice adjustments:</span>
                  <span>${invoiceAdjustmentsTotal.toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-1.5" />
              <div className="flex justify-between font-medium">
                <span>Total:</span>
                <span>${(Number(shoot.payment?.totalQuote) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid:</span>
                <span>${paymentTotalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance:</span>
                <span className={paymentBalance > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                  ${paymentBalance.toFixed(2)}
                </span>
              </div>
              {overpaymentAmount > 0.005 && (
                <div className="flex justify-between font-semibold text-rose-700 dark:text-rose-300">
                  <span>Refund/credit due:</span>
                  <span>${overpaymentAmount.toFixed(2)}</span>
                </div>
              )}
            </>
          ) : isClient ? (
            <>
              {shouldShowCancelledServiceCharges && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Services:</span>
                  <span className="text-muted-foreground line-through">
                    ${originalServiceSubtotal.toFixed(2)}
                  </span>
                </div>
              )}
              {shouldShowCancelledServiceCharges && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cancellation fee:</span>
                  <span>${cancellationFee.toFixed(2)}</span>
                </div>
              )}
              {hasDiscount && !shouldShowCancelledServiceCharges && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="text-emerald-600">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              {hasInvoiceAdjustments && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice adjustments:</span>
                  <span>${invoiceAdjustmentsTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <span>Total:</span>
                <span>${(Number(shoot.payment?.totalQuote) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid:</span>
                <span>${paymentTotalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding:</span>
                <span className={paymentBalance > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                  {formattedPaymentBalance}
                </span>
              </div>
              {overpaymentAmount > 0.005 && (
                <div className="flex justify-between font-semibold text-rose-700 dark:text-rose-300">
                  <span>Refund/credit due:</span>
                  <span>${overpaymentAmount.toFixed(2)}</span>
                </div>
              )}
              {paymentBalance > 0.01 && onPayNow && (
                <div className="mt-3 border-t pt-3">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full justify-center bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={onPayNow}
                    disabled={isPaying}
                  >
                    {isPaying ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    {payNowLabel}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground">Not available</div>
          )}
        </div>
      )}

      {pendingPayments.length > 0 && (
        <div className="mt-2.5">
          <PendingPaymentIntentsCard
            shootId={shoot.id}
            pendingPayments={pendingPayments}
            canModerate={canModeratePendingIntents}
            onChanged={onPendingIntentsChanged}
          />
        </div>
      )}
    </div>
  );
}
