import type { ShootData } from '@/types/shoots';
import { ManualNotificationDialog } from '@/components/messaging/ManualNotificationDialog;
import { getShootAssignedPhotographers } from '@/utils/shootPhotographerAssignments';
import { ConfirmSubmitDialog } from './ConfirmSubmitDialog';
import { ResumeFromHoldScheduleDialog } from './ResumeFromHoldScheduleDialog';
import type { ResumeSchedulePayload } from '@/utils/shootResumeSchedule';
import { getShootSubmitFileCount } from './shootDetailsModalHelpers';

type ShootDetailsModalTransientDialogsProps = {
  shoot: ShootData | null;
  submitConfirm: { kind: 'raw' | 'edited' } | null;
  submittingRole: string;
  isSubmittingRaw: boolean;
  isSubmittingEdits: boolean;
  hasInflightUploads: boolean;
  onCancelSubmit: () => void;
  onConfirmSubmit: () => void;
  canSendManualNotification: boolean;
  isManualNotificationOpen: boolean;
  onCloseManualNotification: () => void;
  isResumeScheduleDialogOpen?: boolean;
  isResumingFromHold?: boolean;
  onResumeScheduleOpenChange?: (open: boolean) => void;
  onConfirmResumeSchedule?: (payload: ResumeSchedulePayload) => void | Promise<void>;
};

export function ShootDetailsModalTransientDialogs({
  shoot,
  submitConfirm,
  submittingRole,
  isSubmittingRaw,
  isSubmittingEdits,
  hasInflightUploads,
  onCancelSubmit,
  onConfirmSubmit,
  canSendManualNotification,
  isManualNotificationOpen,
  onCloseManualNotification,
  isResumeScheduleDialogOpen = false,
  isResumingFromHold = false,
  onResumeScheduleOpenChange,
  onConfirmResumeSchedule,
}: ShootDetailsModalTransientDialogsProps) {
  if (!shoot) return null;

  return (
    <>
      {submitConfirm && (
        <ConfirmSubmitDialog
          open
          kind={submitConfirm.kind}
          submittingRole={submittingRole}
          fileCount={getShootSubmitFileCount(shoot, submitConfirm.kind)}
          isSubmitting={submitConfirm.kind === 'raw' ? isSubmittingRaw : isSubmittingEdits}
          hasInflightUploads={hasInflightUploads}
          onCancel={onCancelSubmit}
          onConfirm={onConfirmSubmit}
        />
      )}
      {canSendManualNotification && (
        <ManualNotificationDialog
          shootId={Number(shoot.id)}
          shootLabel={shoot.location?.fullAddress || shoot.location?.address || `#${shoot.id}`}
          open={isManualNotificationOpen}
          onClose={onCloseManualNotification}
          assignedPhotographers={getShootAssignedPhotographers(shoot)}
        />
      )}
      {isResumeScheduleDialogOpen && onResumeScheduleOpenChange && onConfirmResumeSchedule && (
        <ResumeFromHoldScheduleDialog
          open={isResumeScheduleDialogOpen}
          shoot={shoot}
          isSubmitting={isResumingFromHold}
          onOpenChange={onResumeScheduleOpenChange}
          onConfirm={onConfirmResumeSchedule}
        />
      )}
    </>
  );
}
