import { ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InvoiceViewDialog } from '@/components/invoices/InvoiceViewDialog';
import { BulkActionsDialog } from '@/components/shoots/BulkActionsDialog';
import { ShootApprovalModal } from '@/components/shoots/ShootApprovalModal';
import { ShootDeclineModal } from '@/components/shoots/ShootDeclineModal';
import { ShootDetailsModal } from '@/components/shoots/ShootDetailsModal';
import { ShootEditModal } from '@/components/shoots/ShootEditModal';
import { ShootData } from '@/types/shoots';

interface ShootHistoryModalHostProps {
  selectedShoot: ShootData | null;
  isDetailOpen: boolean;
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
  onDeleteShootIdChange: (value: string | number | null) => void;
  isDeleting: boolean;
  onConfirmDelete: () => void;
  selectedInvoice: any;
  invoiceDialogOpen: boolean;
  onInvoiceClose: () => void;
  brightMlsRedirectUrl: string | null;
  onBrightMlsRedirectUrlChange: (value: string | null) => void;
}

export function ShootHistoryModalHost({
  selectedShoot,
  isDetailOpen,
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
  onDeleteShootIdChange,
  isDeleting,
  onConfirmDelete,
  selectedInvoice,
  invoiceDialogOpen,
  onInvoiceClose,
  brightMlsRedirectUrl,
  onBrightMlsRedirectUrlChange,
}: ShootHistoryModalHostProps) {
  return (
    <>
      {selectedShoot?.id && (
        <ShootDetailsModal
          shootId={selectedShoot.id}
          isOpen={isDetailOpen}
          onClose={onDetailClose}
          onShootUpdate={onShootUpdate}
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
        onOpenChange={(open) => !open && onDeleteShootIdChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shoot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shoot? This action cannot be
              undone and will permanently delete all associated files and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
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
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedInvoice && (
        <InvoiceViewDialog
          isOpen={invoiceDialogOpen}
          onClose={onInvoiceClose}
          invoice={selectedInvoice}
        />
      )}

      <Dialog
        open={!!brightMlsRedirectUrl}
        onOpenChange={(open) => {
          if (!open) {
            onBrightMlsRedirectUrlChange(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[90vw] h-[80vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-base">Bright MLS Import</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Complete the import in the Bright MLS portal below
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  if (brightMlsRedirectUrl) {
                    window.open(brightMlsRedirectUrl, '_blank');
                  }
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" /> Open in Browser
              </Button>
            </div>
          </DialogHeader>
          {brightMlsRedirectUrl && (
            <iframe
              src={brightMlsRedirectUrl}
              className="w-full flex-1 border-0"
              style={{ height: 'calc(80vh - 60px)' }}
              title="Bright MLS Import"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-storage-access-by-user-activation"
              allow="clipboard-write"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
