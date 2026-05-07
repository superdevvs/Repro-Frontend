import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  CheckSquare,
  Download,
  DollarSign as DollarSignIcon,
  FileText,
  Loader2,
  PlayCircle,
  Save,
  Send,
  Upload as UploadIcon,
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { WeatherInfo } from '@/services/weatherService';
import { ShootDetailsOverviewTab } from '../tabs/ShootDetailsOverviewTab';
import { ShootDetailsMediaTab } from '../tabs/ShootDetailsMediaTab';
import { ShootDetailsNotesTab } from '../tabs/ShootDetailsNotesTab';
import { ShootDetailsIssuesTab } from '../tabs/ShootDetailsIssuesTab';
import { ShootDetailsSettingsTab } from '../tabs/ShootDetailsSettingsTab';
import { ShootDetailsActivityLogTab } from '../tabs/ShootDetailsActivityLogTab';

const LazyShootDetailsTourTab = React.lazy(() =>
  import('../tabs/ShootDetailsTourTab').then((module) => ({
    default: module.ShootDetailsTourTab,
  })),
);

const LazyTourAnalyticsPanel = React.lazy(() =>
  import('../TourAnalyticsPanel').then((module) => ({
    default: module.TourAnalyticsPanel,
  })),
);

type VisibleTabId =
  | 'overview'
  | 'notes'
  | 'issues'
  | 'tours'
  | 'settings'
  | 'activity'
  | 'media';

interface ShootDetailsModalBodyProps {
  shoot: ShootData;
  activeTab: VisibleTabId;
  activeMediaDisplayTab: 'uploaded' | 'edited';
  visibleTabs: Array<{ id: string; label: string; disabled?: boolean }>;
  currentUserRole: string;
  weather: WeatherInfo | null;
  isAdmin: boolean;
  isRep: boolean;
  isAdminOrRep: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  isEditingManager: boolean;
  isDelivered: boolean;
  shouldHideClientDetails: boolean;
  isRequestedStatus: boolean;
  isCancelledOrDeclined: boolean;
  isPaid: boolean;
  isClientReleaseLocked: boolean;
  isEditMode: boolean;
  isSavingChanges: boolean;
  editActions: { save: () => void; cancel: () => void } | null;
  isMediaExpanded: boolean;
  showTourAnalytics: boolean;
  canResumeFromHold: boolean;
  canSendToEditing: boolean;
  canFinalise: boolean;
  canShowInvoiceButton: boolean;
  isLoadingInvoice: boolean;
  isSendingToEditing?: boolean;
  isFinalising?: boolean;
  canOpenDeliveredDownloadDialog?: boolean;
  canPrivilegedProgressDownload?: boolean;
  isDownloading?: boolean;
  isPublishingToBrightMls?: boolean;
  canSubmitRaw?: boolean;
  canSubmitEdits?: boolean;
  hasInflightUploads?: boolean;
  isSubmittingRaw?: boolean;
  isSubmittingEdits?: boolean;
  handleSubmitRaw?: () => void;
  handleSubmitEdits?: () => void;
  setShowTourAnalytics: (open: boolean) => void;
  setIsMediaExpanded: (open: boolean) => void;
  setActiveMediaDisplayTab: (tab: 'uploaded' | 'edited') => void;
  setSelectedFileIds: (ids: string[]) => void;
  setEditActions: (actions: { save: () => void; cancel: () => void } | null) => void;
  setIsMarkPaidDialogOpen: (open: boolean) => void;
  setIsDownloadDialogOpen: (open: boolean) => void;
  handleTabChange: (value: string) => void;
  handleProcessPayment: () => void;
  handleShowInvoice: () => void;
  handleProgressMediaDownload: () => void;
  handleSendToBrightMls: () => void;
  handleResumeFromHold: () => void;
  handleSendToEditing: () => void;
  handleFinalise: () => void;
  handleSaveRequest: (updates: Partial<ShootData>) => void;
  handleCancelEdit: () => void;
  refreshShootAndParent: () => Promise<ShootData | null>;
}

export function ShootDetailsModalBody({
  shoot,
  activeTab,
  activeMediaDisplayTab,
  visibleTabs,
  currentUserRole,
  weather,
  isAdmin,
  isRep,
  isAdminOrRep,
  isPhotographer,
  isEditor,
  isClient,
  isEditingManager,
  isDelivered,
  shouldHideClientDetails,
  isRequestedStatus,
  isCancelledOrDeclined,
  isPaid,
  isClientReleaseLocked,
  isEditMode,
  isSavingChanges,
  editActions,
  isMediaExpanded,
  showTourAnalytics,
  canResumeFromHold,
  canSendToEditing,
  canFinalise,
  canShowInvoiceButton,
  isLoadingInvoice,
  isSendingToEditing = false,
  isFinalising = false,
  canOpenDeliveredDownloadDialog = false,
  canPrivilegedProgressDownload = false,
  isDownloading = false,
  isPublishingToBrightMls = false,
  canSubmitRaw = false,
  canSubmitEdits = false,
  hasInflightUploads = false,
  isSubmittingRaw = false,
  isSubmittingEdits = false,
  handleSubmitRaw,
  handleSubmitEdits,
  setShowTourAnalytics,
  setIsMediaExpanded,
  setActiveMediaDisplayTab,
  setSelectedFileIds,
  setEditActions,
  setIsMarkPaidDialogOpen,
  setIsDownloadDialogOpen,
  handleTabChange,
  handleProcessPayment,
  handleShowInvoice,
  handleProgressMediaDownload,
  handleSendToBrightMls,
  handleResumeFromHold,
  handleSendToEditing,
  handleFinalise,
  handleSaveRequest,
  handleCancelEdit,
  refreshShootAndParent,
}: ShootDetailsModalBodyProps) {
  const canMarkPaidOnMobile =
    (currentUserRole === 'superadmin' || currentUserRole === 'admin') &&
    !isEditingManager &&
    !isPaid;
  const canProcessPaymentOnMobile =
    (isAdmin || isRep) && !isPaid && !isPhotographer && !isEditor && !isEditingManager;
  const showSubmitActions =
    activeTab === 'media' &&
    ((activeMediaDisplayTab === 'uploaded' && canSubmitRaw) ||
      (activeMediaDisplayTab === 'edited' && canSubmitEdits));
  const showDesktopDownloadActions = canOpenDeliveredDownloadDialog || canPrivilegedProgressDownload;
  const showDesktopPublishAction = isDelivered && !isEditor && !isPhotographer;
  const showMobileSubmitActions =
    !isEditMode &&
    !isRequestedStatus &&
    !isCancelledOrDeclined &&
    showSubmitActions;
  const showMobilePaymentActions =
    !isEditMode &&
    !isRequestedStatus &&
    !isCancelledOrDeclined &&
    (canMarkPaidOnMobile || canProcessPaymentOnMobile);
  const showMobileEditActions = isEditMode && activeTab === 'overview';
  const showMobileFooter = showMobileSubmitActions || showMobilePaymentActions || showMobileEditActions;

  return (
    <>
      <div className={`flex flex-1 min-h-0 flex-col sm:flex-row overflow-hidden ${showMobileFooter ? 'pb-14' : 'pb-0'} sm:pb-0`}>
        <div
          className={`relative w-full sm:w-[37.5%] border-r sm:border-r border-b sm:border-b-0 ${activeTab === 'media' ? 'hidden sm:flex' : 'flex'} flex-col sm:min-h-0 overflow-hidden bg-muted/30 flex-1 sm:flex-none`}
        >
          <div className="hidden sm:block px-2 sm:px-4 py-1.5 sm:py-2 border-b bg-background flex-shrink-0 overflow-x-auto">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="w-full justify-start h-7 sm:h-8 bg-transparent p-0 min-w-max sm:min-w-0">
                {visibleTabs.filter((tab) => tab.id !== 'media').map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    disabled={tab.disabled}
                    className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none whitespace-nowrap"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pt-2 pb-0 sm:px-4 sm:py-2.5">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsContent value="overview" className="mt-0">
                <ShootDetailsOverviewTab
                  shoot={shoot}
                  isAdmin={isAdmin}
                  isRep={isRep}
                  isPhotographer={isPhotographer}
                  isEditor={isEditor}
                  isClient={isClient}
                  isClientReleaseLocked={isClientReleaseLocked}
                  shouldHideClientDetails={shouldHideClientDetails}
                  role={currentUserRole}
                  onShootUpdate={refreshShootAndParent}
                  weather={weather || null}
                  isEditMode={isEditMode}
                  onSave={handleSaveRequest}
                  onCancel={handleCancelEdit}
                  onRegisterEditActions={(actions) => setEditActions(actions)}
                />
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <ShootDetailsNotesTab
                  shoot={shoot}
                  isAdmin={isAdmin}
                  isPhotographer={isPhotographer}
                  isEditor={isEditor}
                  role={currentUserRole}
                  onShootUpdate={refreshShootAndParent}
                />
              </TabsContent>

              <TabsContent value="issues" className="mt-0">
                <ShootDetailsIssuesTab
                  shoot={shoot}
                  isAdmin={isAdmin}
                  isPhotographer={isPhotographer}
                  isEditor={isEditor}
                  isClient={isClient}
                  role={currentUserRole}
                  onShootUpdate={refreshShootAndParent}
                />
              </TabsContent>

              {(isAdmin || isRep || isClient) && activeTab === 'tours' && (
                <TabsContent value="tours" className="mt-0">
                  <React.Suspense fallback={null}>
                    <LazyShootDetailsTourTab
                      shoot={shoot}
                      isAdmin={isAdmin}
                      isRep={isRep}
                      isClient={isClient}
                      isClientReleaseLocked={isClientReleaseLocked}
                      onShootUpdate={refreshShootAndParent}
                      onShowAnalytics={() => setShowTourAnalytics(true)}
                    />
                  </React.Suspense>
                </TabsContent>
              )}
              {(isAdmin || isRep || isClient) && (
                <TabsContent value="settings" className="mt-0">
                  <ShootDetailsSettingsTab
                    shoot={shoot}
                    isAdmin={isAdmin}
                    isRep={isRep}
                    onShootUpdate={refreshShootAndParent}
                  />
                </TabsContent>
              )}
              {(isAdmin || isRep) && (
                <TabsContent value="activity" className="mt-0">
                  <ShootDetailsActivityLogTab
                    shoot={shoot}
                    isAdmin={isAdmin}
                    onShootUpdate={() => {
                      void refreshShootAndParent();
                    }}
                  />
                </TabsContent>
              )}
            </Tabs>
          </div>

          {!isCancelledOrDeclined && (isAdmin || isRep) && !isPhotographer && !isEditor && !isEditingManager && (
            ((currentUserRole === 'superadmin' || currentUserRole === 'admin') && !isPaid) ||
            ((isAdmin || isRep) && !isPaid)
          ) && (
            <div className="hidden sm:block px-2 sm:px-4 py-2 border-t bg-background flex-shrink-0">
              <div className="hidden sm:flex gap-2 w-full">
                {(currentUserRole === 'superadmin' || currentUserRole === 'admin') && !isPaid && (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-[36px] text-xs px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"
                    onClick={() => setIsMarkPaidDialogOpen(true)}
                  >
                    <DollarSignIcon className="h-3.5 w-3.5 mr-1.5" />
                    <span>Mark as Paid</span>
                  </Button>
                )}
                {(isAdmin || isRep) && !isPaid && (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-[36px] text-xs px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300 dark:border-orange-800"
                    onClick={handleProcessPayment}
                  >
                    <DollarSignIcon className="h-3.5 w-3.5 mr-1.5" />
                    <span>Process payment</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`${activeTab === 'media' ? 'flex' : 'hidden'} sm:hidden flex-1 min-h-0 flex-col bg-background`}>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-2">
            <ShootDetailsMediaTab
              shoot={shoot}
              isAdmin={isAdmin}
              isPhotographer={isPhotographer}
              isEditor={isEditor}
              isClient={isClient}
              isClientReleaseLocked={isClientReleaseLocked}
              role={currentUserRole}
              onShootUpdate={refreshShootAndParent}
              onSelectionChange={setSelectedFileIds}
              displayTab={activeMediaDisplayTab}
              onDisplayTabChange={setActiveMediaDisplayTab}
              isExpanded
            />
          </div>
        </div>

        <div className="hidden sm:flex w-[62.5%] min-h-0 flex-1 flex-col bg-background border-t sm:border-t-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-3">
            {showTourAnalytics ? (
              <React.Suspense fallback={null}>
                <LazyTourAnalyticsPanel shootId={shoot.id} onBack={() => setShowTourAnalytics(false)} />
              </React.Suspense>
            ) : (
              <ShootDetailsMediaTab
                shoot={shoot}
                isAdmin={isAdmin}
                isPhotographer={isPhotographer}
                isEditor={isEditor}
                isClient={isClient}
                isClientReleaseLocked={isClientReleaseLocked}
                role={currentUserRole}
                onShootUpdate={refreshShootAndParent}
                onSelectionChange={setSelectedFileIds}
                displayTab={activeMediaDisplayTab}
                onDisplayTabChange={setActiveMediaDisplayTab}
                isExpanded={isMediaExpanded}
                onToggleExpand={() => setIsMediaExpanded(!isMediaExpanded)}
              />
            )}
          </div>
          {!isEditMode && !isRequestedStatus && !isCancelledOrDeclined && (canResumeFromHold || canSendToEditing || canFinalise || showSubmitActions || showDesktopDownloadActions || showDesktopPublishAction || (canShowInvoiceButton && !isPhotographer && !isEditor)) && (
            <div className="hidden sm:flex border-t bg-background/95 backdrop-blur px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-end gap-2 w-full">
                {canOpenDeliveredDownloadDialog && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                    onClick={() => setIsDownloadDialogOpen(true)}
                    disabled={isDownloading}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    <span>{isDownloading ? 'Downloading...' : 'Downloads'}</span>
                  </Button>
                )}
                {canPrivilegedProgressDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                    onClick={handleProgressMediaDownload}
                    disabled={isDownloading}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    <span>{isDownloading ? 'Downloading...' : 'Downloads'}</span>
                  </Button>
                )}
                {showDesktopPublishAction && (
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
                {activeTab === 'media' && activeMediaDisplayTab === 'uploaded' && canSubmitRaw && handleSubmitRaw && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleSubmitRaw}
                    disabled={isSubmittingRaw || hasInflightUploads}
                  >
                    {isSubmittingRaw ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <UploadIcon className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    <span>{isSubmittingRaw ? 'Submitting…' : 'Submit Raw Files'}</span>
                  </Button>
                )}
                {activeTab === 'media' && activeMediaDisplayTab === 'edited' && canSubmitEdits && handleSubmitEdits && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleSubmitEdits}
                    disabled={isSubmittingEdits || hasInflightUploads}
                  >
                    {isSubmittingEdits ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    <span>{isSubmittingEdits ? 'Submitting…' : 'Submit Edits'}</span>
                  </Button>
                )}
                {canResumeFromHold && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                    onClick={handleResumeFromHold}
                  >
                    <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                    <span>Resume from hold</span>
                  </Button>
                )}
                {(canShowInvoiceButton || (isAdmin && isPaid)) && !isPhotographer && !isEditor && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                    onClick={handleShowInvoice}
                    disabled={isLoadingInvoice}
                  >
                    {isLoadingInvoice ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    <span>{isLoadingInvoice ? '...' : 'Invoice'}</span>
                  </Button>
                )}
                {isAdmin && canSendToEditing && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-800"
                    onClick={handleSendToEditing}
                    disabled={isSendingToEditing}
                  >
                    {isSendingToEditing ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    <span>{isSendingToEditing ? 'Sending...' : 'Send to Editing'}</span>
                  </Button>
                )}
                {canFinalise && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                    onClick={handleFinalise}
                    disabled={isFinalising}
                  >
                    {isFinalising ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    <span>{isFinalising ? 'Finalizing...' : 'Finalize'}</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showMobileFooter && (
        <div className="fixed sm:hidden bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <div className="flex gap-2 w-full overflow-x-auto">
            {showMobileEditActions && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-10 text-sm px-3 whitespace-nowrap"
                  onClick={() => editActions?.save()}
                  disabled={!editActions || isSavingChanges}
                >
                  {isSavingChanges ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 text-sm whitespace-nowrap"
                  onClick={() => editActions?.cancel()}
                  disabled={!editActions || isSavingChanges}
                >
                  Cancel
                </Button>
              </>
            )}
            {activeTab === 'media' && activeMediaDisplayTab === 'uploaded' && canSubmitRaw && handleSubmitRaw && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-9 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                onClick={handleSubmitRaw}
                disabled={isSubmittingRaw || hasInflightUploads}
              >
                {isSubmittingRaw ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <UploadIcon className="h-3.5 w-3.5 mr-1.5" />
                )}
                <span>{isSubmittingRaw ? 'Submitting…' : 'Submit Raw Files'}</span>
              </Button>
            )}
            {activeTab === 'media' && activeMediaDisplayTab === 'edited' && canSubmitEdits && handleSubmitEdits && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-9 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                onClick={handleSubmitEdits}
                disabled={isSubmittingEdits || hasInflightUploads}
              >
                {isSubmittingEdits ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                )}
                <span>{isSubmittingEdits ? 'Submitting…' : 'Submit Edits'}</span>
              </Button>
            )}
            {!isEditMode && canMarkPaidOnMobile && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-9 text-xs px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap"
                onClick={() => setIsMarkPaidDialogOpen(true)}
              >
                <DollarSignIcon className="h-3.5 w-3.5 mr-1.5" />
                <span>Mark as Paid</span>
              </Button>
            )}
            {!isEditMode && canProcessPaymentOnMobile && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-9 text-xs px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300 dark:border-orange-800 whitespace-nowrap"
                onClick={handleProcessPayment}
              >
                <DollarSignIcon className="h-3.5 w-3.5 mr-1.5" />
                <span>Process payment</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
