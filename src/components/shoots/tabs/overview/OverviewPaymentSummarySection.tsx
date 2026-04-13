import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ShootData } from '@/types/shoots';
import { CreditCard, Loader2 } from 'lucide-react';

type OverviewPaymentSummarySectionProps = {
  isEditMode: boolean;
  isAdmin: boolean;
  isClient: boolean;
  editedShoot: Partial<ShootData>;
  shoot: ShootData;
  paymentTotalPaid: number;
  paymentBalance: number;
  editedPaymentBalance: number;
  setTaxAmountDirty: (value: boolean) => void;
  updateField: (field: string, value: unknown) => void;
  onPayNow?: () => void;
  isPaying?: boolean;
};

export function OverviewPaymentSummarySection({
  isEditMode,
  isAdmin,
  isClient,
  editedShoot,
  shoot,
  paymentTotalPaid,
  paymentBalance,
  editedPaymentBalance,
  setTaxAmountDirty,
  updateField,
  onPayNow,
  isPaying = false,
}: OverviewPaymentSummarySectionProps) {
  const formattedPaymentBalance = `$${paymentBalance.toFixed(2)}`;
  const payNowLabel = `Pay ${formattedPaymentBalance}`;

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">Payment</span>
      {isEditMode && isAdmin ? (
        <div className="space-y-1.5 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Base Quote:</span>
            <Input
              type="number"
              step="0.01"
              value={parseFloat(String(editedShoot.payment?.baseQuote ?? shoot.payment?.baseQuote ?? 0)).toFixed(2)}
              onChange={(e) => updateField('payment.baseQuote', parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Tax Amount:</span>
            <Input
              type="number"
              step="0.01"
              value={parseFloat(String(editedShoot.payment?.taxAmount ?? shoot.payment?.taxAmount ?? 0)).toFixed(2)}
              onChange={(e) => {
                const nextValue = parseFloat(parseFloat(e.target.value).toFixed(2));
                setTaxAmountDirty(true);
                updateField('payment.taxAmount', Number.isFinite(nextValue) ? nextValue : 0);
              }}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Total Quote:</span>
            <Input
              type="number"
              step="0.01"
              value={parseFloat(String(editedShoot.payment?.totalQuote ?? shoot.payment?.totalQuote ?? 0)).toFixed(2)}
              onChange={(e) => updateField('payment.totalQuote', parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
              className="h-7 text-xs"
            />
          </div>
          <Separator className="my-1.5" />
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
        </div>
      ) : (
        <div className="space-y-0.5 text-xs">
          {isAdmin ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base:</span>
                <span>${(Number(shoot.payment?.baseQuote) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax:</span>
                <span>${(Number(shoot.payment?.taxAmount) || 0).toFixed(2)}</span>
              </div>
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
            </>
          ) : isClient ? (
            <>
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
    </div>
  );
}
