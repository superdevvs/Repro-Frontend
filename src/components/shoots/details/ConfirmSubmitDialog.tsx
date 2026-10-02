import React from 'react';
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
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';

export type ConfirmSubmitKind = 'raw' | 'edited';

interface ConfirmSubmitDialogProps {
  open: boolean;
  kind: ConfirmSubmitKind | null;
  submittingRole: string;
  fileCount: number;
  isSubmitting: boolean;
  hasInflightUploads: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  keepsDeliveryStatus?: boolean;
  allowLinkSubmission?: boolean;
}

export function ConfirmSubmitDialog({
  open,
  kind,
  submittingRole,
  fileCount,
  isSubmitting,
  hasInflightUploads,
  onCancel,
  onConfirm,
  keepsDeliveryStatus = false,
  allowLinkSubmission = false,
}: ConfirmSubmitDialogProps) {
  const isRaw = kind === 'raw';
  const title = isRaw ? 'Submit raw files?' : 'Submit edited files?';
  const canSubmitReady = ['admin', 'superadmin', 'super_admin', 'editing_manager'].includes(submittingRole.trim().toLowerCase());
  const newStatusLabel = isRaw ? 'Uploaded' : canSubmitReady ? 'Ready' : 'In Review';
  const roleContext = isRaw ? 'editing team' : canSubmitReady ? 'admin' : 'review team';

  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {!isRaw && keepsDeliveryStatus ? <p>This submits your assigned edits while keeping the shoot delivered.</p>
                : !isRaw && submittingRole.trim().toLowerCase() === 'editor' ? <p>This submits your assigned edits. Once all editing assignments are submitted, the shoot moves to <strong>In Review</strong> for the review team.</p> : <p>
                This will move the shoot to <strong>{newStatusLabel}</strong> and notify the {roleContext}.
                Make sure <strong>all</strong> files have finished uploading before continuing.
              </p>}
              {allowLinkSubmission && fileCount === 0 ? <p>Your saved video links will be submitted for review.</p> :
              <p>
                <strong>{fileCount}</strong>{' '}
                {isRaw ? 'raw' : 'edited'} file{fileCount === 1 ? '' : 's'} currently attached to this shoot.
              </p>}
              {hasInflightUploads && (
                <p className="text-amber-600 dark:text-amber-400">
                  An upload is still in progress. Please wait for it to finish before submitting.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={isSubmitting || hasInflightUploads || (fileCount <= 0 && !allowLinkSubmission)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5" />
                Submitting…
              </>
            ) : (
              <>Yes, submit</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
