import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Calendar, Camera, CheckCircle, ChevronRight, Cloud, Copy, DollarSign, Download, ExternalLink, FileText, Images, MoreHorizontal, PanelTopOpen, PauseCircle, Send, Settings, Share2, SlidersHorizontal, MessageCircle, type LucideIcon } from 'lucide-react';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { ShootActionRequestBanner } from '@/components/shoots/ShootActionRequests';
import type { ShootDetailsPageHeaderProps } from './ShootDetailsPageHeader';

interface HeaderAction {
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  disabled?: boolean;
  busy?: boolean;
}

function PropertyThumbnail({ url, address }: { url?: string; address: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="shoot-property-thumbnail" aria-hidden={!url || failed}>{url && !failed ? <img src={url} alt={`Property at ${address}`} onError={() => setFailed(true)} /> : <Camera className="h-5 w-5 text-primary/70" />}</div>;
}

export function ShootDetailsPageHeader(p: ShootDetailsPageHeaderProps) {
  const { shoot } = p;
  const address = shoot.location?.address || 'Shoot details';
  const actions: HeaderAction[] = [];
  if (p.canDirectHold || p.canRequestHold) actions.push({ label: p.holdActionLabel, icon: PauseCircle, onSelect: p.onOpenHoldDialog });
  if (p.isClient && p.isHoldRequested) actions.push({ label: 'Hold requested', icon: PauseCircle, disabled: true });
  if (p.canReviewHoldRequest) actions.push({ label: 'Review hold request', icon: PauseCircle, onSelect: p.onOpenHoldApprovalDialog });
  if (p.canSendToEditing) actions.push({ label: p.isSendingToEditing ? 'Sending...' : 'Send to Editing', icon: Send, onSelect: p.onSendToEditing, disabled: p.isSendingToEditing, busy: p.isSendingToEditing });
  if (p.canFinalise) actions.push({ label: p.isFinalising ? 'Finalizing...' : p.isFastForwardFinalise ? 'Finalize (fast-forward)' : 'Finalize & Deliver', icon: CheckCircle, onSelect: p.onFinalise, disabled: p.isFinalising, busy: p.isFinalising });
  if (p.canProcessPayment && p.isAdminOrSuperAdmin && !p.isEditor && !p.isEditingManager) actions.push({ label: 'Process Payment', icon: DollarSign, onSelect: p.onProcessPayment });
  if (p.isEditor) actions.push({ label: p.isGeneratingShareLink ? 'Generating...' : 'Share Link', icon: Share2, onSelect: p.onGenerateShareLink, disabled: p.isGeneratingShareLink || p.rawFileCount === 0, busy: p.isGeneratingShareLink });
  const temperature = shoot.weather?.temperature;
  const numericTemperature = typeof temperature === 'number' ? temperature : parseInt(String(temperature), 10);
  const temperatureLabel = Number.isFinite(numericTemperature) ? p.formatTemperature(numericTemperature) : temperature;
  const tabs = [
    { id: 'media', label: 'Media', icon: Images, visible: true },
    { id: 'issues', label: 'Requests', icon: MessageCircle, visible: p.canShowIssuesTab },
    { id: 'tour', label: 'Tour', icon: Camera, visible: !p.isPhotographer && !p.isEditor && p.canShowToursTab, disabled: p.isToursTabDisabled },
    { id: 'slideshow', label: 'Slideshow', icon: SlidersHorizontal, visible: !p.isPhotographer && !p.isEditor },
    { id: 'settings', label: 'Settings', icon: Settings, visible: !p.isPhotographer && !p.isEditor && p.canShowSettingsTab, secondary: true },
    { id: 'activity', label: 'Activity Log', icon: FileText, visible: p.canShowActivity, secondary: true },
    { id: 'notes', label: 'Notes', icon: FileText, visible: p.canShowNotesTab, secondary: true },
  ].filter(tab => tab.visible);
  const firstSecondary = tabs.find(tab => tab.secondary)?.id;
  return (
    <header className="shoot-workspace-header bg-background" data-testid="shoot-workspace-header">
      <ShootActionRequestBanner shoot={shoot} className="mx-3 my-2 sm:mx-6" />
      <div className="shoot-workspace-header-inner">
        <div className="shoot-workspace-breadcrumb text-muted-foreground">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-0 text-xs hover:bg-transparent hover:text-foreground" onClick={p.onBack}><ArrowLeft className="h-3.5 w-3.5" />Shoots</Button>
          <ChevronRight className="h-3 w-3" /><span className="text-xs font-medium text-foreground">Shoot #{shoot.id}</span>
        </div>
        <div className="shoot-workspace-title-row">
          <div className="shoot-property-identity">
            <PropertyThumbnail key={shoot.heroImage || shoot.id} url={shoot.heroImage} address={address} />
            <div className="min-w-0">
              <div className="shoot-property-title">
                <h1 className="select-text text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{address}</h1>
                {p.workflowBadge && <Badge variant={p.workflowBadge.variant} className={`shoot-workflow-badge ${/^(delivered|completed|ready)$/i.test(p.workflowBadge.label) ? 'border-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : ''}`}>{p.workflowBadge.label}</Badge>}
              </div>
              <div className="shoot-property-meta text-muted-foreground">
                {p.addressParts.length > 1 && <span className="select-text">{p.addressParts.slice(1).join(',').trim()}</span>}
                <span className="shoot-schedule-meta"><Calendar className="h-3.5 w-3.5" />{p.formattedDate}{p.formattedTime ? ` · ${p.formattedTime}` : ''}</span>
                {temperature != null && <span className="shoot-weather-meta"><Cloud className="h-3.5 w-3.5" />{temperatureLabel} {shoot.weather?.summary}</span>}
              </div>
            </div>
          </div>
          <div className="shoot-workspace-header-actions">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-xs" onClick={p.onOpenOverview} aria-label="Open shoot overview" data-testid="shoot-overview-button"><PanelTopOpen className="h-4 w-4" />Overview</Button>
            {p.canShowDownloadButton && <Button size="sm" className="h-9 gap-1.5 rounded-lg text-xs" onClick={p.onDownload} disabled={p.isDownloadDisabled || p.isDownloading} aria-busy={p.isDownloading}>{p.isDownloading ? <InlineSpinner aria-hidden="true" className="h-4 w-4" /> : <Download className="h-4 w-4" />}<span>{p.isDownloading ? 'Downloading...' : 'Downloads'}</span></Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-lg" aria-label="Shoot actions" aria-busy={p.isSendingToEditing || p.isFinalising || p.isGeneratingShareLink}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 max-h-[70dvh] overflow-y-auto">
                <DropdownMenuLabel className="text-xs">Shoot actions</DropdownMenuLabel>
                {actions.map(action => <DropdownMenuItem key={action.label} onSelect={action.onSelect} disabled={action.disabled} className="gap-2 py-2.5 text-xs" aria-busy={action.busy}>{action.busy ? <InlineSpinner aria-hidden="true" className="h-4 w-4" /> : <action.icon className="h-4 w-4 text-muted-foreground" />}{action.label}</DropdownMenuItem>)}
                {actions.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={p.onCopyAddress} className="gap-2 py-2.5 text-xs"><Copy className="h-4 w-4 text-muted-foreground" />Copy address</DropdownMenuItem>
                <DropdownMenuItem onSelect={p.onOpenInMaps} className="gap-2 py-2.5 text-xs"><ExternalLink className="h-4 w-4 text-muted-foreground" />Open in Maps</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {p.isAdminOrSuperAdmin && p.paymentBadge && <span className="sr-only">Payment status: {p.paymentBadge.label}</span>}
        <Tabs value={p.activeTab} onValueChange={p.onActiveTabChange}>
          <TabsList className="shoot-workspace-tabs bg-transparent" aria-label="Shoot page sections">
            {tabs.map(tab => <TabsTrigger key={tab.id} value={tab.id} disabled={tab.disabled} className={`shoot-workspace-tab ${tab.id === firstSecondary ? 'shoot-workspace-secondary-tab' : ''}`}><tab.icon className="h-3.5 w-3.5" />{tab.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>
    </header>
  );
}

