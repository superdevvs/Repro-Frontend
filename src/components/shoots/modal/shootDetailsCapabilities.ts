import { ShootData } from '@/types/shoots';
import {
  ShootDetailsCapabilities,
  ShootDetailsRoleFlags,
} from './shootDetailsTypes';

interface GetShootDetailsCapabilitiesInput {
  shoot: ShootData | null;
  currentUserRole: string;
  roleFlags: ShootDetailsRoleFlags;
  userId?: string | number | null;
}

export const normalizeShootDetailsStatus = (status?: string | null) => {
  const key = String(status || '').toLowerCase().trim();
  const map: Record<string, string> = {
    booked: 'scheduled',
    completed: 'uploaded',
    delivered_to_client: 'delivered',
    editing_complete: 'review',
    editing_issue: 'review',
    pending_review: 'review',
    ready_for_review: 'review',
    qc: 'review',
    ready_for_client: 'delivered',
    admin_verified: 'delivered',
  };

  return map[key] || key;
};

export const getShootDetailsCapabilities = ({
  shoot,
  currentUserRole,
  roleFlags,
  userId,
}: GetShootDetailsCapabilitiesInput): ShootDetailsCapabilities => {
  const {
    isAdmin,
    isAdminOrRep,
    isClient,
    isEditor,
    isEditingManager,
    isPhotographer,
    isRep,
  } = roleFlags;

  const normalizedStatus = normalizeShootDetailsStatus(
    shoot?.workflowStatus || shoot?.status,
  );
  const rawMediaCount = Number(
    shoot?.rawPhotoCount ??
      (shoot as any)?.raw_photo_count ??
      shoot?.mediaSummary?.rawUploaded ??
      0,
  );
  const editedMediaCount = Number(
    shoot?.editedPhotoCount ??
      (shoot as any)?.edited_photo_count ??
      shoot?.mediaSummary?.editedUploaded ??
      0,
  );
  const hasEditedWithoutRaw = editedMediaCount > 0 && rawMediaCount === 0;
  const isDelivered = normalizedStatus === 'delivered';
  const isUploadedStatus = normalizedStatus === 'uploaded';
  const isEditingStatus = normalizedStatus === 'editing';
  const isCancelledOrDeclined = ['cancelled', 'canceled', 'declined'].includes(
    normalizedStatus,
  );
  const canShowInvoiceButton = isUploadedStatus || isEditingStatus;
  const canFinalise =
    isAdmin &&
    !isDelivered &&
    ['uploaded', 'editing', 'ready'].includes(normalizedStatus);
  const canSendToEditing =
    isAdmin &&
    !isDelivered &&
    !hasEditedWithoutRaw &&
    normalizedStatus === 'uploaded';
  const mmmRedirectUrl =
    shoot?.mmmRedirectUrl || (shoot as any)?.mmm_redirect_url || undefined;
  const canStartMmmPunchout =
    currentUserRole === 'superadmin' || isAdmin || isRep || isClient;
  const showMmmPunchoutButtons =
    isDelivered && (canStartMmmPunchout || Boolean(mmmRedirectUrl));
  const canNotifyClient = Boolean(shoot?.client?.email);
  const canNotifyPhotographer = Boolean(
    shoot?.photographer?.email &&
      (!shoot?.client?.id || shoot?.photographer?.id !== shoot?.client?.id),
  );
  const isScheduledOrOnHold = Boolean(
    shoot &&
      (shoot.status === 'scheduled' ||
        shoot.status === 'booked' ||
        shoot.status === 'on_hold' ||
        shoot.workflowStatus === 'on_hold' ||
        shoot.workflowStatus === 'booked' ||
        !shoot.photographer?.id),
  );
  const canAdminEdit =
    Boolean(shoot) &&
    isAdminOrRep &&
    !['cancelled', 'declined'].includes(normalizedStatus);
  const isOnHold = Boolean(
    shoot &&
      (shoot.status === 'on_hold' ||
        shoot.status === 'hold_on' ||
        shoot.workflowStatus === 'on_hold'),
  );
  const isCancellationRequested = Boolean(shoot?.cancellationRequestedAt);
  const canPutOnHold = Boolean(
    shoot &&
      !isOnHold &&
      (normalizedStatus === 'requested' ||
        shoot.status === 'scheduled' ||
        shoot.status === 'booked' ||
        shoot.workflowStatus === 'booked' ||
        normalizedStatus === 'editing' ||
        normalizedStatus === 'uploaded'),
  );
  const isHoldRequested = Boolean(shoot?.holdRequestedAt);
  const canDirectHold =
    isAdminOrRep &&
    !isEditor &&
    !isEditingManager &&
    canPutOnHold &&
    !isHoldRequested;
  const canRequestHold = isClient && canPutOnHold && !isHoldRequested;
  const canUserPutOnHold = canDirectHold || canRequestHold;
  const holdActionLabel = isClient ? 'Request hold' : 'Mark on hold';
  const holdDialogTitle = isClient ? 'Request hold' : 'Mark on hold';
  const holdDialogDescription = isClient
    ? 'Tell us why you need to put this shoot on hold. Your request will be reviewed by an admin.'
    : 'Please provide a reason for putting this shoot on hold. This will help track why the shoot was paused.';
  const holdSubmitLabel = isClient ? 'Submit request' : 'Mark on hold';
  const canResumeFromHold = Boolean(
    isOnHold &&
      (isAdminOrRep ||
        (isPhotographer &&
          shoot?.photographer?.id != null &&
          String(shoot.photographer.id) === String(userId ?? ''))),
  );
  const canWithdrawRequestedShoot = Boolean(
    shoot &&
      isClient &&
      normalizedStatus === 'requested' &&
      !isCancellationRequested,
  );
  const canRequestCancellation = Boolean(
    shoot &&
      isClient &&
      !isCancellationRequested &&
      ['scheduled', 'booked', 'on_hold', 'editing', 'uploaded'].includes(normalizedStatus),
  );
  const canCancelShoot = Boolean(
    (isAdmin &&
      shoot &&
      !['cancelled', 'canceled', 'declined'].includes(normalizedStatus)) ||
      canWithdrawRequestedShoot ||
      canRequestCancellation,
  );
  const cancelActionLabel = isAdmin
    ? (isDelivered ? 'Delete shoot' : 'Cancel shoot')
    : canWithdrawRequestedShoot
      ? 'Cancel shoot'
      : 'Request cancellation';
  const cancelDialogTitle = isAdmin
    ? (isDelivered ? 'Delete Shoot' : 'Cancel Shoot')
    : canWithdrawRequestedShoot
      ? 'Cancel Shoot Request'
      : 'Request Shoot Cancellation';
  const cancelDialogDescription = isAdmin
    ? (isDelivered
      ? 'This will permanently delete the shoot and all associated data.'
      : 'This will permanently cancel the shoot. The client will be notified of the cancellation.')
    : canWithdrawRequestedShoot
      ? 'This will cancel your unapproved shoot request immediately.'
      : 'Tell us why you want to cancel this scheduled shoot. Your request will be reviewed by an admin.';
  const cancelSubmitLabel = isAdmin
    ? (isDelivered ? 'Delete Shoot' : 'Cancel Shoot')
    : canWithdrawRequestedShoot
      ? 'Cancel Shoot'
      : 'Submit request';

  return {
    normalizedStatus,
    rawMediaCount,
    editedMediaCount,
    hasEditedWithoutRaw,
    isDelivered,
    isUploadedStatus,
    isEditingStatus,
    isCancelledOrDeclined,
    canShowInvoiceButton,
    canFinalise,
    canSendToEditing,
    mmmRedirectUrl,
    canStartMmmPunchout,
    showMmmPunchoutButtons,
    canNotifyClient,
    canNotifyPhotographer,
    isScheduledOrOnHold,
    canAdminEdit,
    isOnHold,
    canPutOnHold,
    isHoldRequested,
    canDirectHold,
    canRequestHold,
    canUserPutOnHold,
    holdActionLabel,
    holdDialogTitle,
    holdDialogDescription,
    holdSubmitLabel,
    canResumeFromHold,
    isCancellationRequested,
    canWithdrawRequestedShoot,
    canRequestCancellation,
    canCancelShoot,
    cancelActionLabel,
    cancelDialogTitle,
    cancelDialogDescription,
    cancelSubmitLabel,
  };
};
