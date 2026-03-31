import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { BrightMlsImportDialog } from '@/components/integrations/BrightMlsImportDialog';
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

      <BrightMlsImportDialog
        redirectUrl={brightMlsRedirectUrl}
        onRedirectUrlChange={onBrightMlsRedirectUrlChange}
      />
    </>
  );
}
