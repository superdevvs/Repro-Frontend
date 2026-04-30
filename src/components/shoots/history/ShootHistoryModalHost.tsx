import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Camera,
  Image as ImageIcon,
  Layers,
  Loader2,
  MapPin,
  Trash2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BulkActionsDialog } from '@/components/shoots/BulkActionsDialog';
import { ShootApprovalModal } from '@/components/shoots/ShootApprovalModal';
import { ShootDeclineModal } from '@/components/shoots/ShootDeclineModal';
import { ShootDetailsModal } from '@/components/shoots/ShootDetailsModal';
import { ShootEditModal } from '@/components/shoots/ShootEditModal';
import { BrightMlsImportDialog } from '@/components/integrations/BrightMlsImportDialog';
import { ShootData } from '@/types/shoots';
import type { InvoiceViewDialogInvoice } from '@/types/invoice';
import { formatWorkflowStatus } from '@/utils/status';

const LazyInvoiceViewDialog = lazy(() =>
  import('@/components/invoices/InvoiceViewDialog').then((module) => ({
    default: module.InvoiceViewDialog,
  })),
);

const formatDeleteDate = (value?: string) => {
  if (!value) return 'Not scheduled';

  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatDeleteLabel = (value?: string | null) => {
  if (!value) return 'Not available';

  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const resolveDeleteMediaCount = (shoot: ShootData | null) => {
  if (!shoot) return null;
  if (Array.isArray(shoot.files) && shoot.files.length > 0) return shoot.files.length;

  const hasLoadedCounts = [shoot.rawPhotoCount, shoot.editedPhotoCount, shoot.extraPhotoCount].some(
    (value) => typeof value === 'number',
  );
  if (!hasLoadedCounts) return null;

  return (shoot.rawPhotoCount ?? 0) + (shoot.editedPhotoCount ?? 0) + (shoot.extraPhotoCount ?? 0);
};

interface ShootHistoryModalHostProps {
  selectedShoot: ShootData | null;
  isDetailOpen: boolean;
  openDownloadDialog: boolean;
  onDetailClose: () => void;
  onShootUpdate: () => void;
  shouldHideClientDetails: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEditingManager: boolean;
  isBulkActionsOpen: boolean;
  onBulkActionsClose: () => void;
  bulkShoots: ShootData[];
  bulkShootsLoading: boolean;
  approvalModalShoot: ShootData | null;
  onApprovalModalClose: () => void;
  onApprovalComplete: () => void;
  declineModalShoot: ShootData | null;
  onDeclineModalClose: () => void;
  onDeclineComplete: () => void;
  editModalShoot: ShootData | null;
  onEditModalClose: () => void;
  onEditSaved: () => void;
  photographers: Array<{ id: string | number; name: string; avatar?: string }>;
  deleteShootId: string | number | null;
  deleteShootTarget: ShootData | null;
  onDeleteShootIdChange: (value: string | number | null) => void;
  isDeleting: boolean;
  onConfirmDelete: (options?: { deleteMedia?: boolean }) => void;
  selectedInvoice: InvoiceViewDialogInvoice | null;
  invoiceDialogOpen: boolean;
  onInvoiceClose: () => void;
  brightMlsRedirectUrl: string | null;
  onBrightMlsRedirectUrlChange: (value: string | null) => void;
}

export function ShootHistoryModalHost({
  selectedShoot,
  isDetailOpen,
  openDownloadDialog,
  onDetailClose,
  onShootUpdate,
  shouldHideClientDetails,
  isSuperAdmin,
  isAdmin,
  isEditingManager,
  isBulkActionsOpen,
  onBulkActionsClose,
  bulkShoots,
  bulkShootsLoading,
  approvalModalShoot,
  onApprovalModalClose,
  onApprovalComplete,
  declineModalShoot,
  onDeclineModalClose,
  onDeclineComplete,
  editModalShoot,
  onEditModalClose,
  onEditSaved,
  photographers,
  deleteShootId,
  deleteShootTarget,
  onDeleteShootIdChange,
  isDeleting,
  onConfirmDelete,
  selectedInvoice,
  invoiceDialogOpen,
  onInvoiceClose,
  brightMlsRedirectUrl,
  onBrightMlsRedirectUrlChange,
}: ShootHistoryModalHostProps) {
  const [deleteMedia, setDeleteMedia] = useState(false);

  const mediaCount = useMemo(() => resolveDeleteMediaCount(deleteShootTarget), [deleteShootTarget]);
  const hasKnownMediaCount = typeof mediaCount === 'number';
  const disableMediaDelete = hasKnownMediaCount && mediaCount === 0;
  const statusLabel = deleteShootTarget
    ? formatWorkflowStatus(deleteShootTarget.workflowStatus ?? deleteShootTarget.status ?? '')
    : '';
  const deleteButtonLabel = deleteMedia ? 'Delete Shoot + Media' : 'Delete From Dashboard';
  const primaryAddress =
    deleteShootTarget?.location?.fullAddress ||
    deleteShootTarget?.location?.address ||
    (deleteShootId !== null ? `Shoot #${deleteShootId}` : 'Selected shoot');

  useEffect(() => {
    if (deleteShootId === null) {
      setDeleteMedia(false);
      return;
    }

    if (disableMediaDelete) {
      setDeleteMedia(false);
    }
  }, [deleteShootId, disableMediaDelete]);

  return (
    <>
      {selectedShoot?.id && (
        <ShootDetailsModal
          shootId={selectedShoot.id}
          isOpen={isDetailOpen}
          onClose={onDetailClose}
          onShootUpdate={onShootUpdate}
          openDownloadDialog={openDownloadDialog}
          shouldHideClientDetails={shouldHideClientDetails}
        />
      )}

      {(isSuperAdmin || isAdmin || isEditingManager) && (
        <BulkActionsDialog
          isOpen={isBulkActionsOpen}
          onClose={onBulkActionsClose}
          shoots={bulkShoots}
          isLoading={bulkShootsLoading}
          onComplete={onShootUpdate}
        />
      )}

      {approvalModalShoot && (
        <ShootApprovalModal
          isOpen={!!approvalModalShoot}
          onClose={onApprovalModalClose}
          shootId={approvalModalShoot.id}
          shootAddress={approvalModalShoot.location?.address || ''}
          currentScheduledAt={approvalModalShoot.scheduledDate}
          onApproved={onApprovalComplete}
          photographers={photographers}
        />
      )}

      {declineModalShoot && (
        <ShootDeclineModal
          isOpen={!!declineModalShoot}
          onClose={onDeclineModalClose}
          shootId={declineModalShoot.id}
          shootAddress={declineModalShoot.location?.address || ''}
          onDeclined={onDeclineComplete}
        />
      )}

      {editModalShoot && (
        <ShootEditModal
          isOpen={!!editModalShoot}
          onClose={onEditModalClose}
          shootId={editModalShoot.id}
          onSaved={onEditSaved}
        />
      )}

      <AlertDialog
        open={deleteShootId !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            onDeleteShootIdChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shoot</AlertDialogTitle>
            <AlertDialogDescription>
              Choose whether this should remove only the shoot from the dashboard
              or also purge uploaded media from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteShootTarget && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Property
                  </div>
                  <p className="text-sm font-semibold text-foreground">{primaryAddress}</p>
                </div>
                {statusLabel ? <Badge variant="outline">{statusLabel}</Badge> : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Schedule
                  </div>
                  <p className="text-sm text-foreground">
                    {formatDeleteDate(deleteShootTarget.scheduledDate)}
                    {deleteShootTarget.time ? ` at ${deleteShootTarget.time}` : ''}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Uploaded Media
                  </div>
                  <p className="text-sm text-foreground">
                    {mediaCount === null ? 'Check will remove media if any exists' : `${mediaCount} file${mediaCount === 1 ? '' : 's'}`}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Client
                  </div>
                  <p className="text-sm text-foreground">{deleteShootTarget.client?.name || 'Unknown client'}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Camera className="h-3.5 w-3.5" />
                    Photographer
                  </div>
                  <p className="text-sm text-foreground">{deleteShootTarget.photographer?.name || 'Unassigned'}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    Services
                  </div>
                  <p className="text-sm text-foreground">
                    {deleteShootTarget.services?.length ? `${deleteShootTarget.services.length} service${deleteShootTarget.services.length === 1 ? '' : 's'}` : 'No services'}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Trash2 className="h-3.5 w-3.5" />
                    Payment Status
                  </div>
                  <p className="text-sm text-foreground">
                    {formatDeleteLabel(deleteShootTarget.payment?.paymentStatus)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-red-200/70 bg-red-50/60 p-4 dark:border-red-950/60 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <Checkbox
                id="delete-shoot-media"
                checked={deleteMedia}
                onCheckedChange={(checked) => setDeleteMedia(checked === true)}
                disabled={isDeleting || disableMediaDelete}
                className="mt-0.5"
              />
              <div className="space-y-1.5">
                <Label htmlFor="delete-shoot-media" className="text-sm font-semibold text-foreground">
                  Also delete uploaded shoot media
                </Label>
                <p className="text-sm text-muted-foreground">
                  {disableMediaDelete
                    ? 'No uploaded media was found for this shoot.'
                    : hasKnownMediaCount
                      ? `Delete ${mediaCount} uploaded media file${mediaCount === 1 ? '' : 's'} from storage before the shoot record is removed.`
                      : 'If media exists for this shoot, it will be deleted from storage before the shoot record is removed.'}
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Notes, messages, share links, and album records tied to this shoot are cleaned up automatically when the
            shoot is deleted. Leave the checkbox off if you only want to remove the shoot entry from the dashboard.
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => onConfirmDelete({ deleteMedia })}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteButtonLabel}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {invoiceDialogOpen && selectedInvoice && (
        <Suspense fallback={null}>
          <LazyInvoiceViewDialog
            isOpen={invoiceDialogOpen}
            onClose={onInvoiceClose}
            invoice={selectedInvoice}
          />
        </Suspense>
      )}

      <BrightMlsImportDialog
        redirectUrl={brightMlsRedirectUrl}
        onRedirectUrlChange={onBrightMlsRedirectUrlChange}
      />
    </>
  );
}
