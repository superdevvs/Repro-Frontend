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

import type { UploadServiceTarget } from './mediaUploadUtils';
import type { PendingRestack } from './useServiceBracketMode';

/**
 * Extracted verbatim from `RawUploadSection` to keep that component under the
 * repository file-size limit. Copy, scoping and behaviour are unchanged.
 */
export function ChangeRestackDialog({
  pendingRestack,
  setPendingRestack,
  isSavingBracketMode,
  serviceTargets,
  confirmRestack,
}: {
  pendingRestack: PendingRestack;
  setPendingRestack: (value: PendingRestack) => void;
  isSavingBracketMode: boolean;
  serviceTargets: UploadServiceTarget[];
  confirmRestack: () => Promise<void>;
}) {
  return (
    /* Changing a size under frames that are already stacked has to be deliberate:
       the divisor decides how those frames were grouped, so moving it re-cuts them.
       Scoped to the one service, so another photographer's work is untouched. */
    <AlertDialog open={pendingRestack !== null} onOpenChange={(open) => { if (!open) setPendingRestack(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change &amp; Restack this service?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingRestack && (
              <>
                {serviceTargets.find((target) => target.id === pendingRestack.serviceId)?.label ?? 'This service'}
                {' already has raw files stacked at its current size. Switching to '}
                {pendingRestack.mode}x re-cuts those frames into new stacks.
                {' Only this service is affected — other services on this shoot keep their own size and stacks.'}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSavingBracketMode}>Keep current size</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSavingBracketMode}
            onClick={(event) => {
              // Kept open until the request settles so a failure is visible here.
              event.preventDefault();
              void confirmRestack();
            }}
          >
            {isSavingBracketMode ? 'Restacking…' : 'Change & Restack'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
