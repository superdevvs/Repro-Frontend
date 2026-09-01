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
import { getCompReshootReasonLabel } from './model';
import type { CompReshootBookingController } from './useCompReshootBooking';

export function CompReasonChangeDialog({ controller }: { controller: CompReshootBookingController }) {
  return (
    <AlertDialog open={controller.reasonConfirmationOpen} onOpenChange={controller.setReasonConfirmationOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apply suggested compensation?</AlertDialogTitle>
          <AlertDialogDescription>
            Changing the reason to {getCompReshootReasonLabel(controller.pendingReasonCode)} can update the staff compensation and responsibility choices. You already changed one or more choices.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={controller.confirmReasonKeepChoices}>Keep current choices</AlertDialogCancel>
          <AlertDialogAction onClick={controller.confirmReasonWithSuggestions}>Apply suggestions</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
