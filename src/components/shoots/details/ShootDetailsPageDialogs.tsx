import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { StripePaymentDialog } from '@/components/payments/StripePaymentDialog';
import type { StripePaymentSuccessPayload } from '@/components/payments/StripePaymentForm';
import { MarkAsPaidDialog, MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { RescheduleDialog } from '@/components/dashboard/RescheduleDialog';
import { PauseCircle, Loader2 } from 'lucide-react';
import { ShootData } from '@/types/shoots';

type ShootWithLegacyScheduledAt = ShootData & {
  scheduled_at?: string | null;
};

const hasLegacyScheduledAt = (shoot: ShootData): shoot is ShootWithLegacyScheduledAt => {
  return 'scheduled_at' in shoot;
};

interface ShootDetailsPageDialogsProps {
  shoot: ShootData;
  amountDue: number;
  shootServices: string[];
  formatDate: (value: Date | string | number) => string;
  formatTime: (value: Date | string | number | null | undefined) => string;
  isPaymentDialogOpen: boolean;
  isMarkPaidDialogOpen: boolean;
  isRescheduleDialogOpen: boolean;
  isOnHoldDialogOpen: boolean;
  isHoldApprovalDialogOpen: boolean;
  onHoldReason: string;
  holdDialogTitle: string;
  holdDialogDescription: string;
  holdSubmitLabel: string;
  holdProcessing: boolean;
  onPaymentDialogClose: () => void;
  onMarkPaidDialogClose: () => void;
  onRescheduleClose: () => void;
  onOnHoldDialogChange: (open: boolean) => void;
  onHoldApprovalDialogChange: (open: boolean) => void;
  onOnHoldReasonChange: (value: string) => void;
  onPaymentSuccess: (payment: StripePaymentSuccessPayload) => void;
  onMarkPaidConfirm: (payload: MarkAsPaidPayload) => void | Promise<void>;
  onSubmitHold: () => void;
  onRejectHold: () => void;
  onApproveHold: () => void;
}

export function ShootDetailsPageDialogs({
  shoot,
  amountDue,
  shootServices,
  formatDate,
  formatTime,
  isPaymentDialogOpen,
  isMarkPaidDialogOpen,
  isRescheduleDialogOpen,
  isOnHoldDialogOpen,
  isHoldApprovalDialogOpen,
  onHoldReason,
  holdDialogTitle,
  holdDialogDescription,
  holdSubmitLabel,
  holdProcessing,
  onPaymentDialogClose,
  onMarkPaidDialogClose,
  onRescheduleClose,
  onOnHoldDialogChange,
  onHoldApprovalDialogChange,
  onOnHoldReasonChange,
  onPaymentSuccess,
  onMarkPaidConfirm,
  onSubmitHold,
  onRejectHold,
  onApproveHold,
}: ShootDetailsPageDialogsProps) {
  const legacyScheduledAt = hasLegacyScheduledAt(shoot) ? shoot.scheduled_at : undefined;
  const shootTime = legacyScheduledAt
    ? formatTime(legacyScheduledAt)
    : shoot.time
      ? formatTime(shoot.time)
      : undefined;

  return (
    <>
      <StripePaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={onPaymentDialogClose}
        amount={amountDue}
        shootId={shoot.id}
        shootAddress={shoot.location?.fullAddress || shoot.location?.address}
        shootServices={shootServices}
        shootDate={shoot.scheduledDate ? formatDate(shoot.scheduledDate) : undefined}
        shootTime={shootTime}
        clientName={shoot.client?.name}
        clientEmail={shoot.client?.email}
        totalQuote={shoot.payment?.totalQuote}
        totalPaid={shoot.payment?.totalPaid}
        pricing={shoot.payment ? {
          serviceSubtotal: shoot.payment.serviceSubtotal ?? shoot.payment.baseQuote + (shoot.payment.discountAmount ?? 0),
          discountType: shoot.payment.discountType ?? null,
          discountValue: shoot.payment.discountValue ?? null,
          discountAmount: shoot.payment.discountAmount ?? 0,
          discountedSubtotal: shoot.payment.discountedSubtotal ?? shoot.payment.baseQuote,
          taxAmount: shoot.payment.taxAmount,
          totalQuote: shoot.payment.totalQuote,
          totalPaid: shoot.payment.totalPaid,
        } : undefined}
        onPaymentSuccess={onPaymentSuccess}
      />

      <MarkAsPaidDialog
        isOpen={isMarkPaidDialogOpen}
        onClose={onMarkPaidDialogClose}
        onConfirm={onMarkPaidConfirm}
        title="Mark Shoot as Paid"
        description="Select the payment method and provide any required details."
        confirmLabel="Mark as Paid"
      />

      <RescheduleDialog
        shoot={shoot}
        isOpen={isRescheduleDialogOpen}
        onClose={onRescheduleClose}
      />

      <Dialog open={isOnHoldDialogOpen} onOpenChange={onOnHoldDialogChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{holdDialogTitle}</DialogTitle>
            <DialogDescription>{holdDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="onHoldReason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="onHoldReason"
                placeholder="Enter the reason for this hold..."
                value={onHoldReason}
                onChange={(e) => onOnHoldReasonChange(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOnHoldDialogChange(false);
                onOnHoldReasonChange('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={onSubmitHold}
              disabled={!onHoldReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <PauseCircle className="h-4 w-4 mr-2" />
              {holdSubmitLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isHoldApprovalDialogOpen} onOpenChange={onHoldApprovalDialogChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Hold request</DialogTitle>
            <DialogDescription>
              {shoot?.holdReason
                ? `Reason: ${shoot.holdReason}`
                : 'No reason was provided for this hold request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onHoldApprovalDialogChange(false)}
              disabled={holdProcessing}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={onRejectHold}
              disabled={holdProcessing}
            >
              {holdProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Reject
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={onApproveHold}
              disabled={holdProcessing}
            >
              {holdProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Approve hold
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
