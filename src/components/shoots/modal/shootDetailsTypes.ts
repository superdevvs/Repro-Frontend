import { ShootData } from '@/types/shoots';
import type { WeatherInfo } from '@/services/weatherService';

export type ShootDetailsTabId =
  | 'overview'
  | 'notes'
  | 'issues'
  | 'tours'
  | 'settings'
  | 'activity'
  | 'media';

export type ShootDetailsInitialTab = Exclude<ShootDetailsTabId, 'media'>;

export interface ShootDetailsModalProps {
  shootId: string | number;
  isOpen: boolean;
  onClose: () => void;
  currentRole?: string;
  onShootUpdate?: () => void;
  initialWeather?: WeatherInfo | null;
  onModify?: () => void;
  photographers?: Array<{ id: string | number; name: string; avatar?: string }>;
  initialTab?: ShootDetailsTabId;
  openDownloadDialog?: boolean;
  shouldHideClientDetails?: boolean;
  initialFocus?: 'schedule_assignments';
}

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
  canFastForwardFinalise: boolean;
  isFastForwardFinalise: boolean;
  canSendToEditing: boolean;
  canApproveEditingReview: boolean;
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
  isCancellationRequested: boolean;
  canWithdrawRequestedShoot: boolean;
  canRequestCancellation: boolean;
  canCancelShoot: boolean;
  cancelActionLabel: string;
  cancelDialogTitle: string;
  cancelDialogDescription: string;
  cancelSubmitLabel: string;
}

export interface ShootDetailsTabDefinition {
  id: Exclude<ShootDetailsTabId, 'media'>;
  label: string;
  isVisible: (input: {
    isAdmin: boolean;
    isRep: boolean;
    isClient: boolean;
    isRequestedStatus: boolean;
    isClientReleaseLocked: boolean;
    shoot: ShootData | null;
  }) => boolean;
  isDisabled?: (input: {
    isAdmin: boolean;
    isRep: boolean;
    isClient: boolean;
    isRequestedStatus: boolean;
    isClientReleaseLocked: boolean;
    shoot: ShootData | null;
  }) => boolean;
}

export interface ShootDetailsVisibleTab {
  id: Exclude<ShootDetailsTabId, 'media'>;
  label: string;
  disabled?: boolean;
}
