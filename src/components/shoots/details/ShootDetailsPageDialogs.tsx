import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { StripePaymentDialog } from '@/components/payments/StripePaymentDialog';
import type { StripePaymentSuccessPayload } from '@/components/payments/StripePaymentForm';
import { MarkAsPaidDialog, MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { RescheduleDialog } from '@/components/dashboard/RescheduleDialog';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import { PauseCircle, Loader2 } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { ShootMediaDownloadSize } from '@/utils/shootMediaDownload';

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
  isDownloadDialogOpen: boolean;
  isDownloading: boolean;
  downloadStatusMessage: string;
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
  onDownloadDialogChange: (open: boolean) => void;
  onOnHoldReasonChange: (value: string) => void;
  onPaymentSuccess: (payment: StripePaymentSuccessPayload) => void;
  onMarkPaidConfirm: (payload: MarkAsPaidPayload) => void | Promise<void>;
  onSubmitHold: () => void;
  onRejectHold: () => void;
  onApproveHold: () => void;
  onDownloadMedia: (size: ShootMediaDownloadSize) => void;
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
  isDownloadDialogOpen,
  isDownloading,
  downloadStatusMessage,
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
  onDownloadDialogChange,
  onOnHoldReasonChange,
  onPaymentSuccess,
  onMarkPaidConfirm,
  onSubmitHold,
  onRejectHold,
  onApproveHold,
  onDownloadMedia,
}: ShootDetailsPageDialogsProps) {
  const legacyScheduledAt = hasLegacyScheduledAt(shoot) ? shoot.scheduled_at : undefined;
  const shootTime = legacyScheduledAt
    ? formatTime(legacyScheduledAt)
    : shoot.time
      ? formatTime(shoot.time)
      : undefined;
  const clientDownloadOptions: Array<{
    size: ShootMediaDownloadSize;
    label: string;
    description: string;
  }> = [
    {
      size: 'original',
      label: 'Full Size',
      description: 'Original-resolution export',
    },
    {
      size: 'small',
      label: 'MLS',
      description: '1800x1200px, MLS-ready export',
    },
  ];

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

      <Dialog open={isDownloadDialogOpen} onOpenChange={onDownloadDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download Media</DialogTitle>
            <DialogDescription>
              {isDownloading
                ? 'Your download will start automatically when it is ready.'
                : 'Select the image size you want to download'}
            </DialogDescription>
          </DialogHeader>
          {isDownloading ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="space-y-1">
                  <div className="font-medium">Preparing your files</div>
                  <div className="text-sm text-muted-foreground">{downloadStatusMessage}</div>
                </div>
              </div>
              <HorizontalLoader message="Your download will start automatically when the archive is ready." />
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {clientDownloadOptions.map(({ size, label, description }) => (
                <Button
                  key={size}
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                  onClick={() => onDownloadMedia(size)}
                  disabled={isDownloading}
                >
                  <div className="flex flex-col items-start">
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                </Button>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onDownloadDialogChange(false)}>
              {isDownloading ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
