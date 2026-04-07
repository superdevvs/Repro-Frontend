import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { blurActiveElement } from '../dialogFocusUtils';
import {
  Check,
  Download,
  Edit,
  Link2,
  Loader2,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Printer,
  Save,
  Send,
  Share2,
  X,
  XCircle,
} from 'lucide-react';

type VisibleTabId =
  | 'overview'
  | 'notes'
  | 'issues'
  | 'tours'
  | 'settings'
  | 'activity'
  | 'media';

interface ShootDetailsModalActionRailProps {
  shootAddress: string;
  statusBadge: React.ReactNode;
  isEditMode: boolean;
  editActions: { save: () => void; cancel: () => void } | null;
  isSavingChanges: boolean;
  isAdminOrRep: boolean;
  isRequestedStatus: boolean;
  canAdminEdit: boolean;
  isScheduledOrOnHold: boolean;
  canUserPutOnHold: boolean;
  canResumeFromHold: boolean;
  canCancelShoot: boolean;
  canSendToEditing: boolean;
  canFinalise: boolean;
  canStartMmmPunchout: boolean;
  showMmmPunchoutButtons: boolean;
  mmmRedirectUrl: string | null;
  isDelivered: boolean;
  isAdmin: boolean;
  isClient: boolean;
  isEditor: boolean;
  isPhotographer: boolean;
  canClientDownload: boolean;
  isDownloading: boolean;
  isGeneratingShareLink: boolean;
  rawFileCount: number;
  selectedFileIds: string[];
  isPublishingToBrightMls: boolean;
  holdActionLabel: string;
  cancelActionLabel: string;
  isMobileActionsOpen: boolean;
  setIsMobileActionsOpen: (open: boolean) => void;
  setIsApprovalModalOpen: (open: boolean) => void;
  setIsDeclineModalOpen: (open: boolean) => void;
  setIsEditMode: (open: boolean) => void;
  setIsDownloadDialogOpen: (open: boolean) => void;
  setPrintComingSoonOpen: (open: boolean) => void;
  handleMarkOnHoldClick: () => void;
  handleResumeFromHold: () => void;
  handleCancelShootClick: () => void;
  handleSendToEditing: () => void;
  handleFinalise: () => void;
  handleDownloadMedia: (size: 'original' | 'small' | 'medium' | 'large') => void;
  handleSendToBrightMls: () => void;
  handleEditorDownloadRaw: () => void;
  handleGenerateShareLink: () => void;
  onClose: () => void;
}

export function ShootDetailsModalActionRail({
  shootAddress,
  statusBadge,
  isEditMode,
  editActions,
  isSavingChanges,
  isAdminOrRep,
  isRequestedStatus,
  canAdminEdit,
  isScheduledOrOnHold,
  canUserPutOnHold,
  canResumeFromHold,
  canCancelShoot,
  canSendToEditing,
  canFinalise,
  canStartMmmPunchout,
  showMmmPunchoutButtons,
  mmmRedirectUrl,
  isDelivered,
  isAdmin,
  isClient,
  isEditor,
  isPhotographer,
  canClientDownload,
  isDownloading,
  isGeneratingShareLink,
  rawFileCount,
  selectedFileIds,
  isPublishingToBrightMls,
  holdActionLabel,
  cancelActionLabel,
  isMobileActionsOpen,
  setIsMobileActionsOpen,
  setIsApprovalModalOpen,
  setIsDeclineModalOpen,
  setIsEditMode,
  setIsDownloadDialogOpen,
  setPrintComingSoonOpen,
  handleMarkOnHoldClick,
  handleResumeFromHold,
  handleCancelShootClick,
  handleSendToEditing,
  handleFinalise,
  handleDownloadMedia,
  handleSendToBrightMls,
  handleEditorDownloadRaw,
  handleGenerateShareLink,
  onClose,
}: ShootDetailsModalActionRailProps) {
  return (
    <>
      <div className="hidden sm:flex absolute top-4 z-[80] flex-col items-end right-14">
        <div className="flex items-center gap-1.5">
          {isEditMode ? (
            <>
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => editActions?.save()}
                disabled={!editActions || isSavingChanges}
              >
                {isSavingChanges ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => editActions?.cancel()}
                disabled={!editActions || isSavingChanges}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {isAdminOrRep && isRequestedStatus && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      blurActiveElement();
                      setIsApprovalModalOpen(true);
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    <span>Approve</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => {
                      blurActiveElement();
                      setIsDeclineModalOpen(true);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    <span>Decline</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    <span>Modify</span>
                  </Button>
                </>
              )}
              {(canAdminEdit || (isAdminOrRep && isScheduledOrOnHold)) && !isRequestedStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                  onClick={() => setIsEditMode(true)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  <span>Edit</span>
                </Button>
              )}
              {!isEditMode && !isRequestedStatus && canUserPutOnHold && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300 dark:border-amber-800"
                  onClick={handleMarkOnHoldClick}
                >
                  <PauseCircle className="h-3 w-3 mr-1" />
                  <span>{holdActionLabel}</span>
                </Button>
              )}
              {canCancelShoot && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-3 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                  onClick={handleCancelShootClick}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  <span>{cancelActionLabel}</span>
                </Button>
              )}
              {isDelivered && !isEditor && !isPhotographer && (!isClient || canClientDownload) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                  onClick={() => {
                    blurActiveElement();
                    setIsDownloadDialogOpen(true);
                  }}
                  disabled={isDownloading}
                >
                  <Download className="h-3 w-3 mr-1" />
                  <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
                </Button>
              )}
              {isDelivered && isPhotographer && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                  onClick={() => handleDownloadMedia('original')}
                  disabled={isDownloading}
                >
                  <Download className="h-3 w-3 mr-1" />
                  <span>{isDownloading ? 'Downloading...' : 'Download RAW'}</span>
                </Button>
              )}
              {isDelivered && !isEditor && !isPhotographer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={handleSendToBrightMls}
                  disabled={isPublishingToBrightMls}
                >
                  {isPublishingToBrightMls ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <img
                      src="/brightmls-media-sync-button.svg"
                      alt="Publish to Bright MLS"
                      className="h-8 w-auto rounded-full"
                    />
                  )}
                </Button>
              )}
              {showMmmPunchoutButtons && (
                <>
                  {mmmRedirectUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-950 dark:hover:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
                      onClick={() => window.open(mmmRedirectUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      <span>Open MMM</span>
                    </Button>
                  )}
                  {canStartMmmPunchout && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"
                      onClick={() => setPrintComingSoonOpen(true)}
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      <span>Print</span>
                    </Button>
                  )}
                </>
              )}
              {isEditor && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                    onClick={handleEditorDownloadRaw}
                    disabled={isDownloading || (rawFileCount === 0 && selectedFileIds.length === 0)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    <span>
                      {isDownloading
                        ? 'Downloading...'
                        : selectedFileIds.length > 0
                          ? `Download Selected (${selectedFileIds.length})`
                          : `Download All (${rawFileCount})`}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-800"
                    onClick={handleGenerateShareLink}
                    disabled={isGeneratingShareLink || (rawFileCount === 0 && selectedFileIds.length === 0)}
                  >
                    <Share2 className="h-3 w-3 mr-1" />
                    <span>
                      {isGeneratingShareLink
                        ? 'Generating...'
                        : selectedFileIds.length > 0
                          ? `Share Selected (${selectedFileIds.length})`
                          : `Share All (${rawFileCount})`}
                    </span>
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={isMobileActionsOpen} onOpenChange={setIsMobileActionsOpen}>
        <DialogContent className="sm:hidden max-w-[90vw] rounded-2xl p-0 gap-0 [&>button]:hidden">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-base font-semibold">Actions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {shootAddress || 'Shoot'} &middot; {statusBadge}
            </p>
          </div>
          <div className="px-3 pb-3 space-y-1">
            {(canAdminEdit || (isAdminOrRep && isScheduledOrOnHold)) && !isEditMode && !isRequestedStatus && (
              <button
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted transition-colors"
                onClick={() => {
                  setIsMobileActionsOpen(false);
                  setIsEditMode(true);
                }}
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40">
                  <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                Edit shoot
              </button>
            )}
            {canUserPutOnHold && !isEditMode && (
              <button
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted transition-colors"
                onClick={() => {
                  setIsMobileActionsOpen(false);
                  handleMarkOnHoldClick();
                }}
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <PauseCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                {holdActionLabel}
              </button>
            )}
            {canResumeFromHold && !isEditMode && (
              <button
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted transition-colors"
                onClick={() => {
                  setIsMobileActionsOpen(false);
                  handleResumeFromHold();
                }}
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/40">
                  <PlayCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                Resume from hold
              </button>
            )}
            {isAdmin && !isEditMode && canSendToEditing && (
              <button
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted transition-colors"
                onClick={() => {
                  setIsMobileActionsOpen(false);
                  handleSendToEditing();
                }}
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-900/40">
                  <Send className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                Send to Editing
              </button>
            )}
            {canCancelShoot && !isEditMode && (
              <button
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => {
                  setIsMobileActionsOpen(false);
                  handleCancelShootClick();
                }}
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/40">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                {cancelActionLabel}
              </button>
            )}
          </div>
          <div className="px-3 pb-4">
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setIsMobileActionsOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ShootDetailsModalHeaderProps {
  addressTitle: string;
  createdByLabel: string | null;
  statusBadge: React.ReactNode;
  paymentBadge?: React.ReactNode;
  activeTab: VisibleTabId;
  visibleTabs: Array<{ id: string; label: string; disabled?: boolean }>;
  isEditMode: boolean;
  isSavingChanges: boolean;
  editActions: { save: () => void; cancel: () => void } | null;
  handleTabChange: (value: string) => void;
  setIsMobileActionsOpen: (open: boolean) => void;
  onClose: () => void;
}

export function ShootDetailsModalHeader({
  addressTitle,
  createdByLabel,
  statusBadge,
  paymentBadge,
  activeTab,
  visibleTabs,
  isEditMode,
  isSavingChanges,
  editActions,
  handleTabChange,
  setIsMobileActionsOpen,
  onClose,
}: ShootDetailsModalHeaderProps) {
  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 flex-shrink-0">
      <div className="px-3 sm:px-4 pt-2 sm:pt-4 pb-1 sm:pb-1.5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold truncate text-left">{addressTitle}</h2>
              <div className="flex-shrink-0">{statusBadge}</div>
              {paymentBadge ? <div className="flex-shrink-0">{paymentBadge}</div> : null}
            </div>

            {createdByLabel && (
              <div className="hidden sm:flex text-[11px] text-muted-foreground text-left items-center gap-1.5">
                <span>Created by: {createdByLabel}</span>
              </div>
            )}
          </div>

          <div className="sm:hidden flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => {
                blurActiveElement();
                setIsMobileActionsOpen(true);
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isEditMode && (
          <div className="w-full sm:hidden flex items-center justify-end gap-2 mt-2">
            <Button
              variant="default"
              size="sm"
              className="h-8 text-xs px-3"
              onClick={() => editActions?.save()}
              disabled={!editActions || isSavingChanges}
            >
              {isSavingChanges ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-3"
              onClick={() => editActions?.cancel()}
              disabled={!editActions || isSavingChanges}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="sm:hidden px-2 pb-0.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="flex gap-0.5 rounded-lg bg-muted/50 p-0.5 min-w-max">
          {[...visibleTabs.filter((tab) => tab.id !== 'media').slice(0, 1), { id: 'media', label: 'Media' }, ...visibleTabs.filter((tab) => tab.id !== 'media').slice(1)].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.disabled) {
                  return;
                }

                handleTabChange(tab.id);
              }}
              disabled={tab.disabled}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600/10 text-blue-500 ring-1 ring-blue-500/50'
                  : tab.disabled
                    ? 'cursor-not-allowed text-muted-foreground/50'
                    : 'text-muted-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
