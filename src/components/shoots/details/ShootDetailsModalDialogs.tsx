import React, { lazy, Suspense } from 'react';
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
import type { InvoiceData } from '@/types/invoice';
import { BrightMlsImportDialog } from '@/components/integrations/BrightMlsImportDialog';
import { MmmPunchoutDialog } from '@/components/integrations/MmmPunchoutDialog';
import { ShootApprovalModal } from '../ShootApprovalModal';
import { ShootDeclineModal } from '../ShootDeclineModal';
import { Loader2, PauseCircle, XCircle } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { getShootServiceItems } from '@/utils/shootServiceItems';
import { ShootDownloadCenterDialog } from './ShootDownloadCenterDialog';

const LazyInvoiceViewDialog = lazy(() =>
  import('@/components/invoices/InvoiceViewDialog').then((module) => ({
    default: module.InvoiceViewDialog,
  })),
);

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
  canClientDownloadWholeShoot?: boolean;
  canClientAccessTours?: boolean;
  isDownloadDialogOpen: boolean;
  isDownloading: boolean;
  downloadStatusMessage: string;
  isApprovalModalOpen: boolean;
  isDeclineModalOpen: boolean;
  selectedInvoice: InvoiceData | null;
  isInvoiceDialogOpen: boolean;
  brightMlsRedirectUrl: string | null;
  isMmmDialogOpen: boolean;
  isStartingMmmPunchout: boolean;
  mmmDialogRedirectUrl: string | null;
  mmmDialogError: string | null;
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
  setIsMmmDialogOpen: (open: boolean) => void;
  setMmmDialogError: (message: string | null) => void;
  handlePaymentSuccess: () => void;
  handleMarkPaidConfirm: (payload: MarkAsPaidPayload) => Promise<void>;
  handleConfirmSave: () => void;
  handleCancellationFeeConfirm: () => void;
  handleMarkOnHold: () => void;
  handleCancelShoot: () => void;
  handleDownloadMedia: (size: 'original' | 'small' | 'medium' | 'large', target?: { shootServiceId?: string | number | null; label?: string }) => void;
  handleDownloadFile?: (fileId: string | number, label?: string) => void;
  handleStartMmmPunchout: () => void | Promise<void>;
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
  canClientDownloadWholeShoot = true,
  canClientAccessTours = true,
  isDownloadDialogOpen,
  isDownloading,
  downloadStatusMessage,
  isApprovalModalOpen,
  isDeclineModalOpen,
  selectedInvoice,
  isInvoiceDialogOpen,
  brightMlsRedirectUrl,
  isMmmDialogOpen,
  isStartingMmmPunchout,
  mmmDialogRedirectUrl,
  mmmDialogError,
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
  setIsMmmDialogOpen,
  setMmmDialogError,
  handlePaymentSuccess,
  handleMarkPaidConfirm,
  handleConfirmSave,
  handleCancellationFeeConfirm,
  handleMarkOnHold,
  handleCancelShoot,
  handleDownloadMedia,
  handleDownloadFile,
  handleStartMmmPunchout,
  onShootUpdate,
  onClose,
  formatTime,
}: ShootDetailsModalDialogsProps) {
  type ShootServiceOption = string | { name?: string; label?: string };
  const shootServices = Array.isArray(shoot?.services)
    ? (shoot.services as ShootServiceOption[])
        .map((service) =>
          typeof service === 'string'
            ? service
            : service.name || service.label || String(service)
        )
        .filter(Boolean)
    : [];
  const paymentServiceItems = getShootServiceItems(shoot).filter((item) => item.balanceDue > 0.01);

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
          serviceItems={paymentServiceItems}
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
        serviceItems={paymentServiceItems}
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

      <ShootDownloadCenterDialog
        shoot={shoot}
        open={isDownloadDialogOpen}
        isDownloading={isDownloading}
        downloadStatusMessage={downloadStatusMessage}
        isClient={isClient}
        canDownloadWholeShoot={canClientDownloadWholeShoot}
        canAccessTours={canClientAccessTours}
        onOpenChange={setIsDownloadDialogOpen}
        onDownloadArchive={handleDownloadMedia}
        onDownloadFile={handleDownloadFile}
      />

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

      {isInvoiceDialogOpen && selectedInvoice && (
        <Suspense fallback={null}>
          <LazyInvoiceViewDialog
            isOpen={isInvoiceDialogOpen}
            onClose={() => {
              setIsInvoiceDialogOpen(false);
              setSelectedInvoice(null);
            }}
            invoice={selectedInvoice}
          />
        </Suspense>
      )}

      <BrightMlsImportDialog
        redirectUrl={brightMlsRedirectUrl}
        onRedirectUrlChange={setBrightMlsRedirectUrl}
      />

      <MmmPunchoutDialog
        open={isMmmDialogOpen}
        isLaunching={isStartingMmmPunchout}
        redirectUrl={mmmDialogRedirectUrl}
        errorMessage={mmmDialogError}
        shootId={shoot?.id ?? null}
        onStartSession={handleStartMmmPunchout}
        onOpenChange={(open) => {
          setIsMmmDialogOpen(open);
          if (!open) {
            setMmmDialogError(null);
          }
        }}
      />
    </>
  );
}
