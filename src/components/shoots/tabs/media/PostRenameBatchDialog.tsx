import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PostRenameBatchPlan, PostRenameSuccess } from '@/features/media-filename-rename/postRenameBatchPlan';

interface PostRenameBatchDialogProps {
  prompt: PostRenameSuccess | null;
  plan: PostRenameBatchPlan | null;
  onOpenChange: (open: boolean) => void;
  onApplySelected: () => Promise<void> | void;
  onApplyAll: () => Promise<void> | void;
}

/**
 * Shown after a successful single filename rename. Offers applying the same
 * find→replace change to other selected files or every eligible file in view.
 * Portal z-index sits above the media lightbox (inline z-index 100).
 */
export function PostRenameBatchDialog({
  prompt,
  plan,
  onOpenChange,
  onApplySelected,
  onApplyAll,
}: PostRenameBatchDialogProps) {
  const [submitting, setSubmitting] = useState<'selected' | 'all' | null>(null);
  const open = Boolean(prompt && plan);

  const run = async (scope: 'selected' | 'all', action: () => Promise<void> | void) => {
    setSubmitting(scope);
    try {
      await action();
      onOpenChange(false);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && !submitting) onOpenChange(false); }}>
      <AlertDialogPortal>
        <AlertDialogOverlay className="z-[130]" />
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-[130] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Rename more files?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Saved{' '}
                  <span className="font-medium text-foreground">{prompt?.nextFilename}</span>
                  . Apply the same change (
                  <span className="font-mono text-foreground">{plan?.find}</span>
                  {' → '}
                  <span className="font-mono text-foreground">{plan?.replace || '(remove)'}</span>
                  ) to other files?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              disabled={!plan?.selectedFileIds.length || Boolean(submitting)}
              onClick={() => { void run('selected', onApplySelected); }}
            >
              {submitting === 'selected'
                ? 'Renaming…'
                : `Rename selected (${plan?.selectedFileIds.length ?? 0})`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!plan?.allFileIds.length || Boolean(submitting)}
              onClick={() => { void run('all', onApplyAll); }}
            >
              {submitting === 'all'
                ? 'Renaming…'
                : `Rename all in view (${plan?.allFileIds.length ?? 0})`}
            </Button>
            <AlertDialogCancel disabled={Boolean(submitting)}>Just this file</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogPrimitive.Content>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
