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
import { Loader2 } from 'lucide-react';

export type ConfirmSubmitKind = 'raw' | 'edited';

interface ConfirmSubmitDialogProps {
  open: boolean;
  kind: ConfirmSubmitKind | null;
  fileCount: number;
  isSubmitting: boolean;
  hasInflightUploads: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmSubmitDialog({
  open,
  kind,
  fileCount,
  isSubmitting,
  hasInflightUploads,
  onCancel,
  onConfirm,
}: ConfirmSubmitDialogProps) {
  const isRaw = kind === 'raw';
  const title = isRaw ? 'Submit raw files?' : 'Submit edited files?';
  const newStatusLabel = isRaw ? 'Uploaded' : 'Ready';
  const roleContext = isRaw ? 'editing team' : 'admin';

  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                This will move the shoot to <strong>{newStatusLabel}</strong> and notify the {roleContext}.
                Make sure <strong>all</strong> files have finished uploading before continuing.
              </p>
              <p>
                <strong>{fileCount}</strong>{' '}
                {isRaw ? 'raw' : 'edited'} file{fileCount === 1 ? '' : 's'} currently attached to this shoot.
              </p>
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
            disabled={isSubmitting || hasInflightUploads || fileCount <= 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
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
