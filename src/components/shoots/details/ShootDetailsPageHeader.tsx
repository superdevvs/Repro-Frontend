import type { ShootData } from '@/types/shoots';

export interface ShootDetailsPageHeaderProps {
  shoot: ShootData;
  workflowBadge?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  paymentBadge?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive';
  };
  formattedDate: string;
  formattedTime: string;
  addressParts: string[];
  formatTemperature: (tempC: number, tempF?: number | null) => string;
  isEditor: boolean;
  isPhotographer: boolean;
  isEditingManager: boolean;
  isAdminOrSuperAdmin: boolean;
  isClient: boolean;
  canDirectHold: boolean;
  canRequestHold: boolean;
  isHoldRequested: boolean;
  canReviewHoldRequest: boolean;
  canSendToEditing: boolean;
  canFinalise: boolean;
  isFastForwardFinalise?: boolean;
  isSendingToEditing?: boolean;
  isFinalising?: boolean;
  canShowIssuesTab: boolean;
  canShowToursTab: boolean;
  isToursTabDisabled: boolean;
  canShowSettingsTab: boolean;
  canShowNotesTab: boolean;
  canShowActivity: boolean;
  holdActionLabel: string;
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  onBack: () => void;
  onOpenOverview: () => void;
  onCopyAddress: () => void;
  onOpenInMaps: () => void;
  onOpenHoldDialog: () => void;
  onOpenHoldApprovalDialog: () => void;
  onSendToEditing: () => void;
  onFinalise: () => void;
  onProcessPayment: () => void;
  canProcessPayment: boolean;
  canShowDownloadButton: boolean;
  onDownload: () => void;
  isDownloadDisabled: boolean;
  onGenerateShareLink: () => void;
  rawFileCount: number;
  isDownloading: boolean;
  isGeneratingShareLink: boolean;
}

export { ShootDetailsPageHeader } from './ShootDetailsPageHeaderView';
