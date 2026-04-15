import React from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MarkAsPaidDialog, MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';
import { StripePaymentDialog } from '@/components/payments/StripePaymentDialog';
import { InvoiceViewDialog } from '@/components/invoices/InvoiceViewDialog';
import { InvoiceData } from '@/utils/invoiceUtils';
import { BrightMlsImportDialog } from '@/components/integrations/BrightMlsImportDialog';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import { ShootApprovalModal } from '../ShootApprovalModal';
import { ShootDeclineModal } from '../ShootDeclineModal';
import { FileText, Loader2, PauseCircle, Printer, XCircle } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import {
  ShootMediaDownloadSize,
} from '@/utils/shootMediaDownload';

interface ShootDetailsModalDialogsProps {
  shoot: ShootData | null;
  shouldHideClientDetails: boolean;
  photographers: Array<{ id: string | number; name: string; avatar?: string }>;
  amountDue: number;
  isPaymentDialogOpen: boolean;
  isMarkPaidDialogOpen: boolean;
  isSaveConfirmOpen: boolean;
  notifyClientOnSave: boolean;
  notifyPhotographerOnSave: boolean;
  canNotifyClient: boolean;
  canNotifyPhotographer: boolean;
  isSavingChanges: boolean;
  isCancellationFeeDialogOpen: boolean;
  shouldAddCancellationFee: boolean;
  isOnHoldDialogOpen: boolean;
  onHoldReason: string;
  holdDialogTitle: string;
  holdDialogDescription: string;
  holdSubmitLabel: string;
  isCancelShootDialogOpen: boolean;
  isDelivered: boolean;
  cancelDialogTitle: string;
  cancelDialogDescription: string;
  cancelSubmitLabel: string;
  cancelShootReason: string;
  isWithinCancellationFeeWindow: boolean;
  isCancellingShoot: boolean;
  isClient: boolean;
  isDownloadDialogOpen: boolean;
  isDownloading: boolean;
  downloadStatusMessage: string;
  isApprovalModalOpen: boolean;
  isDeclineModalOpen: boolean;
  selectedInvoice: InvoiceData | null;
  isInvoiceDialogOpen: boolean;
  brightMlsRedirectUrl: string | null;
  printComingSoonOpen: boolean;
  pendingUpdates: Partial<ShootData> | null;
  setIsPaymentDialogOpen: (open: boolean) => void;
  setIsMarkPaidDialogOpen: (open: boolean) => void;
  setIsSaveConfirmOpen: (open: boolean) => void;
  setPendingUpdates: (updates: Partial<ShootData> | null) => void;
  setNotifyClientOnSave: (value: boolean) => void;
  setNotifyPhotographerOnSave: (value: boolean) => void;
  setIsCancellationFeeDialogOpen: (open: boolean) => void;
  setShouldAddCancellationFee: (value: boolean) => void;
  setPendingAction: (value: 'hold' | 'cancel' | null) => void;
  setIsOnHoldDialogOpen: (open: boolean) => void;
  setOnHoldReason: (reason: string) => void;
  setIsCancelShootDialogOpen: (open: boolean) => void;
  setCancelShootReason: (reason: string) => void;
  setIsDownloadDialogOpen: (open: boolean) => void;
  setIsApprovalModalOpen: (open: boolean) => void;
  setIsDeclineModalOpen: (open: boolean) => void;
  setIsInvoiceDialogOpen: (open: boolean) => void;
  setSelectedInvoice: (invoice: InvoiceData | null) => void;
  setBrightMlsRedirectUrl: (url: string | null) => void;
  setPrintComingSoonOpen: (open: boolean) => void;
  handlePaymentSuccess: () => void;
  handleMarkPaidConfirm: (payload: MarkAsPaidPayload) => Promise<void>;
  handleConfirmSave: () => void;
  handleCancellationFeeConfirm: () => void;
  handleMarkOnHold: () => void;
  handleCancelShoot: () => void;
  handleDownloadMedia: (size: 'original' | 'small' | 'medium' | 'large') => void;
  onShootUpdate?: () => void;
  onClose: () => void;
  formatTime: (value: string) => string;
}

export function ShootDetailsModalDialogs({
  shoot,
  shouldHideClientDetails,
  photographers,
  amountDue,
  isPaymentDialogOpen,
  isMarkPaidDialogOpen,
  isSaveConfirmOpen,
  notifyClientOnSave,
  notifyPhotographerOnSave,
  canNotifyClient,
  canNotifyPhotographer,
  isSavingChanges,
  isCancellationFeeDialogOpen,
  shouldAddCancellationFee,
  isOnHoldDialogOpen,
  onHoldReason,
  holdDialogTitle,
  holdDialogDescription,
  holdSubmitLabel,
  isCancelShootDialogOpen,
  isDelivered,
  cancelDialogTitle,
  cancelDialogDescription,
  cancelSubmitLabel,
  cancelShootReason,
  isWithinCancellationFeeWindow,
  isCancellingShoot,
  isClient,
  isDownloadDialogOpen,
  isDownloading,
  downloadStatusMessage,
  isApprovalModalOpen,
  isDeclineModalOpen,
  selectedInvoice,
  isInvoiceDialogOpen,
  brightMlsRedirectUrl,
  printComingSoonOpen,
  pendingUpdates,
  setIsPaymentDialogOpen,
  setIsMarkPaidDialogOpen,
  setIsSaveConfirmOpen,
  setPendingUpdates,
  setNotifyClientOnSave,
  setNotifyPhotographerOnSave,
  setIsCancellationFeeDialogOpen,
  setShouldAddCancellationFee,
  setPendingAction,
  setIsOnHoldDialogOpen,
  setOnHoldReason,
  setIsCancelShootDialogOpen,
  setCancelShootReason,
  setIsDownloadDialogOpen,
  setIsApprovalModalOpen,
  setIsDeclineModalOpen,
  setIsInvoiceDialogOpen,
  setSelectedInvoice,
  setBrightMlsRedirectUrl,
  setPrintComingSoonOpen,
  handlePaymentSuccess,
  handleMarkPaidConfirm,
  handleConfirmSave,
  handleCancellationFeeConfirm,
  handleMarkOnHold,
  handleCancelShoot,
  handleDownloadMedia,
  onShootUpdate,
  onClose,
  formatTime,
}: ShootDetailsModalDialogsProps) {
  type ShootServiceOption = string | { name?: string; label?: string };
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
  const shootServices = Array.isArray(shoot?.services)
    ? (shoot.services as ShootServiceOption[])
        .map((service) =>
          typeof service === 'string'
            ? service
            : service.name || service.label || String(service)
        )
        .filter(Boolean)
    : [];

  return (
    <>
      {shoot && (
        <StripePaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => setIsPaymentDialogOpen(false)}
          amount={amountDue || Number(shoot.payment?.totalQuote || 0)}
          shootId={shoot.id}
          shootAddress={shoot.location?.fullAddress || shoot.location?.address}
          shootServices={shootServices}
          shootDate={shoot.scheduledDate}
          shootTime={shoot.time ? formatTime(shoot.time) : undefined}
          clientName={shouldHideClientDetails ? undefined : shoot.client?.name}
          clientEmail={shouldHideClientDetails ? undefined : shoot.client?.email}
          totalQuote={shoot.payment?.totalQuote}
          totalPaid={shoot.payment?.totalPaid}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      <MarkAsPaidDialog
        isOpen={isMarkPaidDialogOpen}
        onClose={() => setIsMarkPaidDialogOpen(false)}
        onConfirm={handleMarkPaidConfirm}
        title="Mark Shoot as Paid"
        description="Select the payment method and provide any required details."
        confirmLabel="Mark as Paid"
      />

      <Dialog
        open={isSaveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSaveConfirmOpen(false);
            setPendingUpdates(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Confirm update</DialogTitle>
            <DialogDescription>
              Choose who should receive update notifications for this shoot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Client</p>
                <p className="text-xs text-muted-foreground">
                  {shoot?.client?.email || 'No client email on file'}
                </p>
              </div>
              <Checkbox
                checked={notifyClientOnSave}
                onCheckedChange={(value) => setNotifyClientOnSave(Boolean(value))}
                disabled={!canNotifyClient}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Photographer</p>
                <p className="text-xs text-muted-foreground">
                  {shoot?.photographer?.email || 'No photographer email on file'}
                </p>
              </div>
              <Checkbox
                checked={notifyPhotographerOnSave}
                onCheckedChange={(value) => setNotifyPhotographerOnSave(Boolean(value))}
                disabled={!canNotifyPhotographer}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsSaveConfirmOpen(false);
                setPendingUpdates(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} disabled={isSavingChanges || !pendingUpdates}>
              {isSavingChanges ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancellationFeeDialogOpen} onOpenChange={setIsCancellationFeeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cancellation Fee Notice</DialogTitle>
            <DialogDescription>
              This shoot is scheduled within 3-4 hours. A cancellation fee of $60 may apply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Notice:</strong> This shoot is scheduled within 3-4 hours. According to our policy, a cancellation fee of $60 may be charged.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addCancellationFee">Add cancellation fee to invoice?</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="addCancellationFee"
                  checked={shouldAddCancellationFee}
                  onChange={(e) => setShouldAddCancellationFee(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <Label htmlFor="addCancellationFee" className="text-sm font-normal cursor-pointer">
                  Yes, add $60 cancellation fee to the invoice
                </Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCancellationFeeDialogOpen(false);
                setShouldAddCancellationFee(false);
                setPendingAction(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCancellationFeeConfirm} className="bg-amber-600 hover:bg-amber-700">
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOnHoldDialogOpen} onOpenChange={setIsOnHoldDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{holdDialogTitle}</DialogTitle>
            <DialogDescription>{holdDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="onHoldReason">Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="onHoldReason"
                placeholder="Enter the reason for putting this shoot on hold..."
                value={onHoldReason}
                onChange={(e) => setOnHoldReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsOnHoldDialogOpen(false);
                setOnHoldReason('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkOnHold} disabled={!onHoldReason.trim()} className="bg-amber-600 hover:bg-amber-700">
              <PauseCircle className="h-4 w-4 mr-2" />
              {holdSubmitLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelShootDialogOpen} onOpenChange={setIsCancelShootDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{cancelDialogTitle}</DialogTitle>
            <DialogDescription>{cancelDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Warning:</strong> {isDelivered
                  ? 'This action cannot be undone. The shoot and all associated files will be permanently deleted.'
                  : isClient
                    ? 'Your request will be processed immediately for unapproved shoots, or sent for admin review for scheduled shoots.'
                    : 'This action cannot be undone. The shoot will be marked as cancelled and the client will be notified.'}
              </p>
            </div>
            {!isDelivered && (
              <div className="space-y-2">
                <Label htmlFor="cancelShootReason">{isClient ? 'Reason' : 'Reason (optional)'}</Label>
                <Textarea
                  id="cancelShootReason"
                  placeholder={isClient ? 'Tell us why you want to cancel this shoot...' : 'Enter the reason for cancelling this shoot...'}
                  value={cancelShootReason}
                  onChange={(e) => setCancelShootReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            )}
            {!isDelivered && isWithinCancellationFeeWindow && (
              <div className="space-y-2">
                <Label htmlFor="addCancellationFeeCancelDialog">Add cancellation fee to invoice?</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="addCancellationFeeCancelDialog"
                    checked={shouldAddCancellationFee}
                    onChange={(e) => setShouldAddCancellationFee(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <Label htmlFor="addCancellationFeeCancelDialog" className="text-sm font-normal cursor-pointer">
                    Yes, add $60 cancellation fee to the invoice
                  </Label>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCancelShootDialogOpen(false);
                setCancelShootReason('');
                setShouldAddCancellationFee(false);
              }}
              disabled={isCancellingShoot}
            >
              Keep Shoot
            </Button>
            <Button onClick={handleCancelShoot} disabled={isCancellingShoot} className="bg-red-600 hover:bg-red-700">
              {isCancellingShoot ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isDelivered ? 'Deleting...' : 'Cancelling...'}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  {cancelSubmitLabel}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download Media</DialogTitle>
            <DialogDescription>
              {isDownloading
                ? 'Your download will open automatically when it is ready.'
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
              <HorizontalLoader message="A new tab will open automatically when the archive is ready." />
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {clientDownloadOptions.map(({ size, label, description }) => (
                <Button
                  key={size}
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                  onClick={() => handleDownloadMedia(size)}
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
            <Button variant="outline" onClick={() => setIsDownloadDialogOpen(false)}>
              {isDownloading ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isApprovalModalOpen && shoot && (
        <ShootApprovalModal
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          shootId={shoot.id}
          shootAddress={shoot.location?.address || ''}
          currentScheduledAt={shoot.scheduledDate}
          onApproved={() => {
            setIsApprovalModalOpen(false);
            onShootUpdate?.();
            onClose();
          }}
          photographers={photographers}
        />
      )}

      {isDeclineModalOpen && shoot && (
        <ShootDeclineModal
          isOpen={isDeclineModalOpen}
          onClose={() => setIsDeclineModalOpen(false)}
          shootId={shoot.id}
          shootAddress={shoot.location?.address || ''}
          onDeclined={() => {
            setIsDeclineModalOpen(false);
            onShootUpdate?.();
            onClose();
          }}
        />
      )}

      {selectedInvoice && (
        <InvoiceViewDialog
          isOpen={isInvoiceDialogOpen}
          onClose={() => {
            setIsInvoiceDialogOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
        />
      )}

      <BrightMlsImportDialog
        redirectUrl={brightMlsRedirectUrl}
        onRedirectUrlChange={setBrightMlsRedirectUrl}
      />

      <Dialog open={printComingSoonOpen} onOpenChange={setPrintComingSoonOpen}>
        <DialogContent className="max-w-lg w-[90vw] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-base">Print Marketing Materials</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Order professional print materials for your listing</DialogDescription>
            </div>
          </DialogHeader>
          <div className="relative">
            <div className="p-5 space-y-4 blur-[2px] opacity-60 pointer-events-none select-none" aria-hidden="true">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Property Flyer', '8.5" × 11" full color'],
                  ['Postcards', '4" × 6" double-sided'],
                  ['Brochure', 'Tri-fold, premium stock'],
                  ['Yard Sign', '18" × 24" weatherproof'],
                ].map(([title, description]) => (
                  <div key={title} className="border rounded-lg p-3 space-y-1.5">
                    <div className="h-20 bg-muted rounded flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs font-medium">{title}</p>
                    <p className="text-[10px] text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-9 bg-muted rounded" />
                <div className="w-24 h-9 bg-emerald-200 dark:bg-emerald-800 rounded" />
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <div className="bg-card border shadow-lg rounded-xl px-6 py-4 text-center space-y-2">
                <Printer className="h-8 w-8 mx-auto text-emerald-500" />
                <h3 className="text-lg font-semibold">Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-[260px]">Print marketing materials will be available in a future update.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
