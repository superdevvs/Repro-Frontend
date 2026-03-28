import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShootData } from '@/types/shoots';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Cloud,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  Loader2,
  PauseCircle,
  Send,
  Share2,
  ChevronRight,
} from 'lucide-react';

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
  canShowIssuesTab: boolean;
  canShowToursTab: boolean;
  canShowSettingsTab: boolean;
  canShowNotesTab: boolean;
  canShowActivity: boolean;
  holdActionLabel: string;
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  onBack: () => void;
  onCopyAddress: () => void;
  onOpenInMaps: () => void;
  onOpenHoldDialog: () => void;
  onOpenHoldApprovalDialog: () => void;
  onSendToEditing: () => void;
  onFinalise: () => void;
  onProcessPayment: () => void;
  onDownloadRaw: () => void;
  onGenerateShareLink: () => void;
  rawFileCount: number;
  isEditorDownloading: boolean;
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
  canShowIssuesTab,
  canShowToursTab,
  canShowSettingsTab,
  canShowNotesTab,
  canShowActivity,
  holdActionLabel,
  activeTab,
  onActiveTabChange,
  onBack,
  onCopyAddress,
  onOpenInMaps,
  onOpenHoldDialog,
  onOpenHoldApprovalDialog,
  onSendToEditing,
  onFinalise,
  onProcessPayment,
  onDownloadRaw,
  onGenerateShareLink,
  rawFileCount,
  isEditorDownloading,
  isGeneratingShareLink,
}: ShootDetailsPageHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-background border-b">
      <div className="px-3 sm:px-6 py-1.5 border-b bg-muted/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
            <span className="font-medium text-foreground">Shoot #{shoot.id}</span>
            {workflowBadge && (
              <Badge variant={workflowBadge.variant} className="text-xs px-2 py-0.5 ml-2">
                {workflowBadge.label}
              </Badge>
            )}
            {!isEditor && !isPhotographer && shoot.photographer?.name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                <Camera className="h-3 w-3" />
                <span className="font-medium">{shoot.photographer.name}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="hidden sm:inline">Online</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
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

      <div className="px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate flex-1">
                {shoot.id ? `#${shoot.id} · ` : ''}
                {shoot.location?.address || 'Shoot Details'}
              </h1>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-muted"
                  onClick={onCopyAddress}
                  title="Copy address"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-muted"
                  onClick={onOpenInMaps}
                  title="Open in Maps"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {addressParts.length > 1 && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                {addressParts.slice(1).join(',').trim()}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0 w-full sm:w-auto">
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
              >
                <Send className="h-3 w-3 mr-1.5" />
                <span className="hidden sm:inline">Send to Editing</span>
                <span className="sm:hidden">Send to Editing</span>
              </Button>
            )}
            {canFinalise && (
              <Button
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                onClick={onFinalise}
              >
                <CheckCircle className="h-3 w-3 mr-1.5" />
                <span className="hidden sm:inline">Finalize & Deliver</span>
                <span className="sm:hidden">Finalize</span>
              </Button>
            )}
            {isAdminOrSuperAdmin && !isEditor && !isEditingManager && (
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
            {isEditor && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                  onClick={onDownloadRaw}
                  disabled={isEditorDownloading || rawFileCount === 0}
                >
                  {isEditorDownloading ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3 mr-1.5" />
                  )}
                  <span className="hidden sm:inline">
                    {isEditorDownloading ? 'Downloading...' : `Download RAW (${rawFileCount})`}
                  </span>
                  <span className="sm:hidden">
                    {isEditorDownloading ? '...' : `RAW (${rawFileCount})`}
                  </span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                  onClick={onGenerateShareLink}
                  disabled={isGeneratingShareLink || rawFileCount === 0}
                >
                  {isGeneratingShareLink ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
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
        <div className="px-3 sm:px-6 py-1 border-t bg-muted/20">
          <div className="flex items-center gap-2">
            <Badge variant={paymentBadge.variant} className="text-xs px-2.5 py-1">
              {paymentBadge.label}
            </Badge>
          </div>
        </div>
      )}

      <div className="border-t bg-background shadow-sm flex-shrink-0">
        <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
          <TabsList className="w-full justify-start h-12 sm:h-14 px-3 sm:px-6 bg-transparent gap-1 overflow-x-auto">
            <TabsTrigger
              value="media"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
            >
              Media
            </TabsTrigger>
            {canShowIssuesTab && (
              <TabsTrigger
                value="issues"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
              >
                Requests
              </TabsTrigger>
            )}
            {!isPhotographer && !isEditor && (
              <>
                {canShowToursTab && (
                  <TabsTrigger
                    value="tour"
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                  >
                    Tour
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="slideshow"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                >
                  Slideshow
                </TabsTrigger>
                {canShowSettingsTab && (
                  <TabsTrigger
                    value="settings"
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                  >
                    Settings
                  </TabsTrigger>
                )}
              </>
            )}
            {canShowActivity && (
              <TabsTrigger
                value="activity"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
              >
                <span className="hidden sm:inline">Activity Log</span>
                <span className="sm:hidden">Activity</span>
              </TabsTrigger>
            )}
            {canShowNotesTab && (
              <TabsTrigger
                value="notes"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 sm:h-12 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
              >
                Notes
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
