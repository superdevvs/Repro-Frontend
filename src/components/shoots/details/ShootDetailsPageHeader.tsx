import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ShootData } from '@/types/shoots';
import { ArrowLeft, Camera, CheckCircle, Cloud, Copy, DollarSign, Download, ExternalLink, PanelTopOpen, PauseCircle, Send, Share2, ChevronRight, FileText, Images, MessageCircle, MoreVertical, Settings, SlidersHorizontal } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';

interface ShootDetailsPageHeaderProps {
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

export function ShootDetailsPageHeader({
  shoot,
  workflowBadge,
  paymentBadge,
  formattedDate,
  formattedTime,
  addressParts,
  formatTemperature,
  isEditor,
  isPhotographer,
  isEditingManager,
  isAdminOrSuperAdmin,
  isClient,
  canDirectHold,
  canRequestHold,
  isHoldRequested,
  canReviewHoldRequest,
  canSendToEditing,
  canFinalise,
  isFastForwardFinalise = false,
  isSendingToEditing = false,
  isFinalising = false,
  canShowIssuesTab,
  canShowToursTab,
  isToursTabDisabled,
  canShowSettingsTab,
  canShowNotesTab,
  canShowActivity,
  holdActionLabel,
  activeTab,
  onActiveTabChange,
  onBack,
  onOpenOverview,
  onCopyAddress,
  onOpenInMaps,
  onOpenHoldDialog,
  onOpenHoldApprovalDialog,
  onSendToEditing,
  onFinalise,
  onProcessPayment,
  canProcessPayment,
  canShowDownloadButton,
  onDownload,
  isDownloadDisabled,
  onGenerateShareLink,
  rawFileCount,
  isDownloading,
  isGeneratingShareLink,
}: ShootDetailsPageHeaderProps) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const hasMobileActions = (
    canDirectHold || canRequestHold || (isClient && isHoldRequested) || canReviewHoldRequest
    || canSendToEditing || canFinalise
    || (canProcessPayment && isAdminOrSuperAdmin && !isEditor && !isEditingManager)
    || canShowDownloadButton || isEditor
  );
  const closeActions = () => setIsActionsOpen(false);

  return (
    <div className="sticky top-0 z-50 bg-background border-b">
      <div className="px-2 sm:px-6 py-1 sm:py-1.5 border-b bg-muted/30">
        <div className="flex flex-row items-center justify-between gap-2 sm:gap-0">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={onBack}
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Shoots</span>
            </Button>
            <ChevronRight className="h-3 w-3" />
            <span className="min-w-0 truncate font-medium text-foreground">Shoot #{shoot.id}</span>
            {workflowBadge && (
              <Badge variant={workflowBadge.variant} className="shrink-0 text-xs px-2 py-0.5 ml-1 sm:ml-2">
                {workflowBadge.label}
              </Badge>
            )}
            {isAdminOrSuperAdmin && paymentBadge && (
              <Badge variant={paymentBadge.variant} className="sm:hidden shrink-0 text-[10px] px-1.5 py-0">
                {paymentBadge.label}
              </Badge>
            )}
            {!isEditor && !isPhotographer && shoot.photographer?.name && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                <Camera className="h-3 w-3" />
                <span className="font-medium">{shoot.photographer.name}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="hidden sm:inline">Online</span>
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="whitespace-nowrap">{formattedDate}</span>
            {formattedTime && <span className="hidden sm:inline">•</span>}
            {formattedTime && <span className="whitespace-nowrap">{formattedTime}</span>}
            {shoot.weather?.temperature && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Cloud className="h-3 w-3" />
                  <span className="hidden sm:inline">
                    {(() => {
                      const num =
                        typeof shoot.weather?.temperature === 'number'
                          ? shoot.weather.temperature
                          : parseInt(String(shoot.weather?.temperature), 10);
                      return Number.isFinite(num)
                        ? formatTemperature(num)
                        : shoot.weather?.temperature;
                    })()}{' '}
                    {shoot.weather?.summary}
                  </span>
                  <span className="sm:hidden">
                    {(() => {
                      const num =
                        typeof shoot.weather?.temperature === 'number'
                          ? shoot.weather.temperature
                          : parseInt(String(shoot.weather?.temperature), 10);
                      return Number.isFinite(num)
                        ? formatTemperature(num)
                        : shoot.weather?.temperature;
                    })()}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-6 py-1.5 sm:py-3">
        <div className="flex flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-2">
              <h1 className="text-base sm:text-2xl font-bold text-foreground truncate flex-1 select-text">
                <span className="hidden sm:inline">{shoot.id ? `#${shoot.id} · ` : ''}</span>
                <span className="select-text cursor-text">{shoot.location?.address || 'Shoot Details'}</span>
              </h1>
              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted"
                  onClick={onOpenOverview}
                  title="Open overview"
                  aria-label="Open shoot overview"
                >
                  <PanelTopOpen className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted"
                  onClick={onCopyAddress}
                  title="Copy address"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted"
                  onClick={onOpenInMaps}
                  title="Open in Maps"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {hasMobileActions && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="sm:hidden h-7 w-7 rounded-full"
                    onClick={() => setIsActionsOpen(true)}
                    aria-label="Shoot actions"
                    aria-expanded={isActionsOpen}
                    aria-busy={isDownloading || isGeneratingShareLink || isSendingToEditing || isFinalising}
                  >
                    {(isDownloading || isGeneratingShareLink || isSendingToEditing || isFinalising) ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <MoreVertical className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            {addressParts.length > 1 && (
              <p className="select-text cursor-text text-xs sm:text-sm text-muted-foreground">
                {addressParts.slice(1).join(',').trim()}
              </p>
            )}
          </div>

          <div className="hidden sm:flex flex-row items-center gap-2 flex-shrink-0 w-auto">
            {(canDirectHold || canRequestHold) && (
              <Button
                variant="default"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
                onClick={onOpenHoldDialog}
              >
                <PauseCircle className="h-3 w-3 mr-1.5" />
                <span className="hidden sm:inline">{holdActionLabel}</span>
                <span className="sm:hidden">Hold</span>
              </Button>
            )}
            {isClient && isHoldRequested && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled
              >
                <PauseCircle className="h-3 w-3 mr-1.5" />
                <span className="hidden sm:inline">Hold requested</span>
                <span className="sm:hidden">Requested</span>
              </Button>
            )}
            {canReviewHoldRequest && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-200 text-amber-700 hover:bg-amber-50 w-full sm:w-auto"
                onClick={onOpenHoldApprovalDialog}
              >
                <PauseCircle className="h-3 w-3 mr-1.5" />
                <span className="hidden sm:inline">Review hold request</span>
                <span className="sm:hidden">Review hold</span>
              </Button>
            )}
            {canSendToEditing && (
              <Button
                variant="default"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                onClick={onSendToEditing}
                disabled={isSendingToEditing}
              >
                {isSendingToEditing ? (
                  <Loader2 aria-hidden="true" className="h-3 w-3 mr-1.5" />
                ) : (
                  <Send className="h-3 w-3 mr-1.5" />
                )}
                <span className="hidden sm:inline">{isSendingToEditing ? 'Sending...' : 'Send to Editing'}</span>
                <span className="sm:hidden">{isSendingToEditing ? 'Sending...' : 'Send to Editing'}</span>
              </Button>
            )}
            {canFinalise && (
              <Button
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                onClick={onFinalise}
                disabled={isFinalising}
              >
                {isFinalising ? (
                  <Loader2 aria-hidden="true" className="h-3 w-3 mr-1.5" />
                ) : (
                  <CheckCircle className="h-3 w-3 mr-1.5" />
                )}
                <span className="hidden sm:inline">{isFinalising ? 'Finalizing...' : isFastForwardFinalise ? 'Finalize (fast-forward)' : 'Finalize & Deliver'}</span>
                <span className="sm:hidden">{isFinalising ? 'Finalizing...' : 'Finalize'}</span>
              </Button>
            )}
            {canProcessPayment && isAdminOrSuperAdmin && !isEditor && !isEditingManager && (
              <Button
                variant="default"
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
                onClick={onProcessPayment}
              >
                <DollarSign className="h-3 w-3 mr-1.5" />
                <span className="hidden sm:inline">Process Payment</span>
                <span className="sm:hidden">Payment</span>
              </Button>
            )}
            {canShowDownloadButton && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                  onClick={onDownload}
                  disabled={isDownloadDisabled || isDownloading}
                  aria-busy={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 aria-hidden="true" className="h-3 w-3 mr-1.5" />
                  ) : (
                    <Download className="h-3 w-3 mr-1.5" />
                  )}
                  <span className="hidden sm:inline">
                    {isDownloading ? 'Downloading...' : 'Downloads'}
                  </span>
                  <span className="sm:hidden">
                    {isDownloading ? '...' : 'Downloads'}
                  </span>
                </Button>
              </>
            )}
            {isEditor && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                  onClick={onGenerateShareLink}
                  disabled={isGeneratingShareLink || rawFileCount === 0}
                >
                  {isGeneratingShareLink ? (
                    <Loader2 aria-hidden="true" className="h-3 w-3 mr-1.5" />
                  ) : (
                    <Share2 className="h-3 w-3 mr-1.5" />
                  )}
                  <span className="hidden sm:inline">
                    {isGeneratingShareLink ? 'Generating...' : 'Share Link'}
                  </span>
                  <span className="sm:hidden">
                    {isGeneratingShareLink ? '...' : 'Share'}
                  </span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {isAdminOrSuperAdmin && paymentBadge && (
        <div className="hidden sm:block px-3 sm:px-6 py-1 border-t bg-muted/20">
          <div className="flex items-center gap-2">
            <Badge variant={paymentBadge.variant} className="text-xs px-2.5 py-1">
              {paymentBadge.label}
            </Badge>
          </div>
        </div>
      )}

      <div className="border-t bg-background shadow-sm flex-shrink-0">
        <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
          <TabsList className="flex w-full justify-start h-9 sm:h-14 px-1 sm:px-6 bg-transparent gap-0 sm:gap-1 overflow-hidden sm:overflow-x-auto">
            <TabsTrigger
              value="media"
              className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto justify-center gap-0 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-8 sm:h-12 px-0 sm:px-4 text-[11px] sm:text-sm tracking-tight sm:tracking-normal whitespace-nowrap"
            >
              <Images className="hidden sm:block h-3.5 w-3.5" />
              Media
            </TabsTrigger>
            {canShowIssuesTab && (
              <TabsTrigger
                value="issues"
                className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto justify-center gap-0 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-8 sm:h-12 px-0 sm:px-4 text-[11px] sm:text-sm tracking-tight sm:tracking-normal whitespace-nowrap"
              >
                <MessageCircle className="hidden sm:block h-3.5 w-3.5" />
                Requests
              </TabsTrigger>
            )}
            {!isPhotographer && !isEditor && (
              <>
                {canShowToursTab && (
                  <TabsTrigger
                    value="tour"
                    disabled={isToursTabDisabled}
                    className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto justify-center gap-0 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-8 sm:h-12 px-0 sm:px-4 text-[11px] sm:text-sm tracking-tight sm:tracking-normal whitespace-nowrap"
                  >
                    <Camera className="hidden sm:block h-3.5 w-3.5" />
                    Tour
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="slideshow"
                  className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto justify-center gap-0 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-8 sm:h-12 px-0 sm:px-4 text-[11px] sm:text-sm tracking-tight sm:tracking-normal whitespace-nowrap"
                >
                  <SlidersHorizontal className="hidden sm:block h-3.5 w-3.5" />
                  <span className="sm:hidden">Slides</span>
                  <span className="hidden sm:inline">Slideshow</span>
                </TabsTrigger>
                {canShowSettingsTab && (
                  <TabsTrigger
                    value="settings"
                    className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto justify-center gap-0 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-8 sm:h-12 px-0 sm:px-4 text-[11px] sm:text-sm tracking-tight sm:tracking-normal whitespace-nowrap"
                  >
                    <Settings className="hidden sm:block h-3.5 w-3.5" />
                    Settings
                  </TabsTrigger>
                )}
              </>
            )}
            {canShowActivity && (
              <TabsTrigger
                value="activity"
                className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto justify-center gap-0 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-8 sm:h-12 px-0 sm:px-4 text-[11px] sm:text-sm tracking-tight sm:tracking-normal whitespace-nowrap"
              >
                <FileText className="hidden sm:block h-3.5 w-3.5" />
                <span className="hidden sm:inline">Activity Log</span>
                <span className="sm:hidden">Activity</span>
              </TabsTrigger>
            )}
            {canShowNotesTab && (
              <TabsTrigger
                value="notes"
                className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto justify-center gap-0 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-8 sm:h-12 px-0 sm:px-4 text-[11px] sm:text-sm tracking-tight sm:tracking-normal whitespace-nowrap"
              >
                <FileText className="hidden sm:block h-3.5 w-3.5" />
                Notes
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

{isActionsOpen ? (
            <Drawer open={isActionsOpen} onOpenChange={setIsActionsOpen} shouldScaleBackground={false}>
        <DrawerContent className="z-[80] max-h-[85dvh] sm:hidden">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-base">Actions</DrawerTitle>
            <DrawerDescription className="text-xs">
              {shoot.location?.address || `Shoot #${shoot.id}`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-1 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
            {(canDirectHold || canRequestHold) && (
              <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted" onClick={() => { closeActions(); onOpenHoldDialog(); }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><PauseCircle className="h-4 w-4" /></span>
                {holdActionLabel}
              </button>
            )}
            {isClient && isHoldRequested && (
              <button type="button" disabled className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium opacity-60">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><PauseCircle className="h-4 w-4" /></span>
                Hold requested
              </button>
            )}
            {canReviewHoldRequest && (
              <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted" onClick={() => { closeActions(); onOpenHoldApprovalDialog(); }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><PauseCircle className="h-4 w-4" /></span>
                Review hold request
              </button>
            )}
            {canSendToEditing && (
              <button type="button" disabled={isSendingToEditing} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted disabled:opacity-60" onClick={() => { closeActions(); onSendToEditing(); }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {isSendingToEditing ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </span>
                {isSendingToEditing ? 'Sending...' : 'Send to Editing'}
              </button>
            )}
            {canFinalise && (
              <button type="button" disabled={isFinalising} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted disabled:opacity-60" onClick={() => { closeActions(); onFinalise(); }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  {isFinalising ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                </span>
                {isFinalising ? 'Finalizing...' : 'Finalize'}
              </button>
            )}
            {canProcessPayment && isAdminOrSuperAdmin && !isEditor && !isEditingManager && (
              <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted" onClick={() => { closeActions(); onProcessPayment(); }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"><DollarSign className="h-4 w-4" /></span>
                Payment
              </button>
            )}
            {canShowDownloadButton && (
              <button type="button" disabled={isDownloadDisabled || isDownloading} aria-busy={isDownloading} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted disabled:opacity-60" onClick={() => { closeActions(); onDownload(); }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  {isDownloading ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                </span>
                {isDownloading ? 'Downloading...' : 'Downloads'}
              </button>
            )}
            {isEditor && (
              <button type="button" disabled={isGeneratingShareLink || rawFileCount === 0} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted disabled:opacity-60" onClick={() => { closeActions(); onGenerateShareLink(); }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  {isGeneratingShareLink ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                </span>
                {isGeneratingShareLink ? 'Generating...' : 'Share Link'}
              </button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      ) : null}
    </div>
  );
}
