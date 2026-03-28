import { ShootData } from '@/types/shoots';

export type ShootDetailsTabId =
  | 'overview'
  | 'notes'
  | 'issues'
  | 'tours'
  | 'settings'
  | 'media';

export type ShootDetailsInitialTab = Exclude<ShootDetailsTabId, 'media'>;

export interface ShootDetailsRoleFlags {
  isEditingManager: boolean;
  isAdmin: boolean;
  isRep: boolean;
  isAdminOrRep: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
}

export interface ShootDetailsCapabilities {
  normalizedStatus: string;
  rawMediaCount: number;
  editedMediaCount: number;
  hasEditedWithoutRaw: boolean;
  isDelivered: boolean;
  isUploadedStatus: boolean;
  isEditingStatus: boolean;
  isCancelledOrDeclined: boolean;
  canShowInvoiceButton: boolean;
  canFinalise: boolean;
  canSendToEditing: boolean;
  mmmRedirectUrl?: string;
  canStartMmmPunchout: boolean;
  showMmmPunchoutButtons: boolean;
  canNotifyClient: boolean;
  canNotifyPhotographer: boolean;
  isScheduledOrOnHold: boolean;
  canAdminEdit: boolean;
  isOnHold: boolean;
  canPutOnHold: boolean;
  isHoldRequested: boolean;
  canDirectHold: boolean;
  canRequestHold: boolean;
  canUserPutOnHold: boolean;
  holdActionLabel: string;
  holdDialogTitle: string;
  holdDialogDescription: string;
  holdSubmitLabel: string;
  canResumeFromHold: boolean;
  canCancelShoot: boolean;
}

export interface ShootDetailsTabDefinition {
  id: Exclude<ShootDetailsTabId, 'media'>;
  label: string;
  isVisible: (input: {
    isAdmin: boolean;
    isClient: boolean;
    isRequestedStatus: boolean;
    shoot: ShootData | null;
  }) => boolean;
}
