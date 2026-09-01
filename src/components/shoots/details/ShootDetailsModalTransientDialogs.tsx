import type { ShootData } from '@/types/shoots';
import { ManualNotificationDialog } from '@/components/messaging/ManualNotificationDialog';
import { ConfirmSubmitDialog } from './ConfirmSubmitDialog';
import { getShootSubmitFileCount } from './shootDetailsModalHelpers';

type ShootDetailsModalTransientDialogsProps = {
  shoot: ShootData | null;
  submitConfirm: { kind: 'raw' | 'edited' } | null;
  isSubmittingRaw: boolean;
  isSubmittingEdits: boolean;
  hasInflightUploads: boolean;
  onCancelSubmit: () => void;
  onConfirmSubmit: () => void;
  canSendManualNotification: boolean;
  isManualNotificationOpen: boolean;
  onCloseManualNotification: () => void;
};

export function ShootDetailsModalTransientDialogs({
  shoot,
  submitConfirm,
  isSubmittingRaw,
  isSubmittingEdits,
  hasInflightUploads,
  onCancelSubmit,
  onConfirmSubmit,
  canSendManualNotification,
  isManualNotificationOpen,
  onCloseManualNotification,
}: ShootDetailsModalTransientDialogsProps) {
  if (!shoot) return null;

  return (
    <>
      {submitConfirm && (
        <ConfirmSubmitDialog
          open
          kind={submitConfirm.kind}
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
        />
      )}
    </>
  );
}
