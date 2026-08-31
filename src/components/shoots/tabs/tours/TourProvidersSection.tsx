import React, { useEffect, useState } from 'react';
import {
  Box,
  Check,
  ChevronDown,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileArchive,
  Home,
  Loader2,
  MapPinned,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type {
  NormalizedIguideOfflinePackage,
  NormalizedIguideSync,
} from '@/utils/shootTourData';
import { IguideOfflinePackageDialog } from './IguideOfflinePackageDialog';
import {
  downloadIguideOfflinePackage,
  formatFileSize,
  getIguidePackageStatusLabel,
} from './iguideOfflinePackage';

type ProviderId = 'matterport' | 'iguide' | 'cubicasa' | 'zillow';
type Managed3DLinkKey =
  | 'matterport_branded'
  | 'matterport_mls'
  | 'iguide_branded'
  | 'iguide_mls'
  | 'zillow_3d';

interface CubicasaSyncView {
  brandedUrl?: string | null;
  data?: Record<string, unknown>;
  externalId?: string | number | null;
  floorplans?: Array<string | Record<string, unknown>>;
  lastSyncedAt?: string | null;
  orderId?: string | number | null;
  productType?: string | null;
  status?: string | null;
  unbrandedUrl?: string | null;
}

interface TourProvidersSectionProps {
  cancelEdit3D: () => void;
  confirmDelete3D: (key: Managed3DLinkKey) => void | Promise<void>;
  copyLink: (key: string) => void;
  createCubicasaOrderButton?: React.ReactNode;
  cubicasaExternalIdInput?: string;
  cubicasaOrderIdInput?: string;
  cubicasaSync?: CubicasaSyncView | null;
  editing3DKey: Managed3DLinkKey | null;
  editing3DValue: string;
  iguidePropertyIdInput?: string;
  iguideSync: NormalizedIguideSync;
  iguideWorkOrderIdInput?: string;
  isAdmin: boolean;
  isClientView: boolean;
  isDeleting3D: Managed3DLinkKey | null;
  isSaving3D: boolean;
  isSavingCubicasaIdentifiers: boolean;
  isSavingIguideIdentifiers: boolean;
  isSyncingCubicasa: boolean;
  isSyncingIguide: boolean;
  onShootUpdate: () => void;
  openLink: (key: string) => void;
  save3DTour: () => void | Promise<void>;
  saveCubicasaIdentifiers?: () => void | Promise<void>;
  saveIguideIdentifiers?: () => void | Promise<void>;
  setCubicasaExternalIdInput?: (value: string) => void;
  setCubicasaOrderIdInput?: (value: string) => void;
  setEditing3DValue: (value: string) => void;
  setIguidePropertyIdInput?: (value: string) => void;
  setIguideWorkOrderIdInput?: (value: string) => void;
  shareLink: (key: string) => void;
  shootId: number | string;
  showIguideSection: boolean;
  showMatterportSection: boolean;
  show3dTours: boolean;
  showZillowSection: boolean;
  startEdit3D: (key: Managed3DLinkKey) => void;
  syncCubicasaNow?: () => void | Promise<void>;
  syncIguideNow?: () => void | Promise<void>;
  tourLinks: Record<string, string>;
  visibleIguideKeys: readonly Managed3DLinkKey[];
  visibleMatterportKeys: readonly Managed3DLinkKey[];
}

interface ProviderRowProps {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: React.ReactNode;
  id: ProviderId;
  menu?: React.ReactNode;
  onToggle: (id: ProviderId) => void;
  open: boolean;
  status?: React.ReactNode;
  summary: string;
  title: string;
}

const openExternal = (url?: string | null) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const getFloorplanUrl = (floorplan: string | Record<string, unknown>) =>
  typeof floorplan === 'string' ? floorplan : String(floorplan.url ?? '');

const getFloorplanLabel = (floorplan: string | Record<string, unknown>, index: number) =>
  typeof floorplan === 'string'
    ? `Floor plan ${index + 1}`
    : String(floorplan.label ?? floorplan.filename ?? `Floor plan ${index + 1}`);

const formatSyncTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

function ProviderStatus({ kind, children }: { kind: 'ready' | 'working' | 'failed' | 'empty'; children: React.ReactNode }) {
  const className = kind === 'ready'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : kind === 'working'
      ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
      : kind === 'failed'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border bg-muted/40 text-muted-foreground';

  return <Badge variant="outline" className={`h-5 rounded-full px-2 text-[10px] font-medium ${className}`}>{children}</Badge>;
}

function ProviderRow({
  action,
  children,
  icon,
  id,
  menu,
  onToggle,
  open,
  status,
  summary,
  title,
}: ProviderRowProps) {
  return (
    <div data-testid={`tour-provider-${id}`}>
      <div className="flex min-h-[58px] items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={open}
          aria-controls={`tour-provider-panel-${id}`}
          onClick={() => onToggle(id)}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium">{title}</span>
              {status}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {action}
        {menu}
      </div>
      {open && (
        <div id={`tour-provider-panel-${id}`} className="border-t bg-muted/15 px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

function ProviderMenu({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`${label} actions`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LinkEditor({
  cancelEdit3D,
  editing3DKey,
  editing3DValue,
  isSaving3D,
  label,
  linkKey,
  save3DTour,
  setEditing3DValue,
  startEdit3D,
  tourLinks,
  isAdmin,
}: Pick<TourProvidersSectionProps,
  'cancelEdit3D' | 'editing3DKey' | 'editing3DValue' | 'isSaving3D' | 'save3DTour'
  | 'setEditing3DValue' | 'startEdit3D' | 'tourLinks' | 'isAdmin'> & {
    label: string;
    linkKey: Managed3DLinkKey;
  }) {
  const isEditing = editing3DKey === linkKey;
  const url = tourLinks[linkKey] || '';

  return (
    <div className="min-w-0 py-1.5 first:pt-0 last:pb-0">
      {isEditing ? (
        <div className="space-y-2">
          <Label className="text-[11px]">{label}</Label>
          <Input
            value={editing3DValue}
            onChange={(event) => setEditing3DValue(event.target.value)}
            placeholder="https://"
            className="h-8 text-xs"
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit3D}>
              <X className="mr-1 h-3.5 w-3.5" />Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => void save3DTour()} disabled={isSaving3D}>
              {isSaving3D ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium">{label}</p>
            <p className="truncate text-[11px] text-muted-foreground" title={url || undefined}>{url || 'Not set'}</p>
          </div>
          {isAdmin && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => startEdit3D(linkKey)}>
              <Edit3 className="mr-1 h-3.5 w-3.5" />{url ? 'Edit' : 'Add'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function TourProvidersSection(props: TourProvidersSectionProps) {
  const {
    cancelEdit3D,
    confirmDelete3D,
    copyLink,
    createCubicasaOrderButton,
    cubicasaExternalIdInput,
    cubicasaOrderIdInput,
    cubicasaSync,
    editing3DKey,
    editing3DValue,
    iguidePropertyIdInput,
    iguideSync,
    iguideWorkOrderIdInput,
    isAdmin,
    isClientView,
    isDeleting3D,
    isSaving3D,
    isSavingCubicasaIdentifiers,
    isSavingIguideIdentifiers,
    isSyncingCubicasa,
    isSyncingIguide,
    onShootUpdate,
    openLink,
    save3DTour,
    saveCubicasaIdentifiers,
    saveIguideIdentifiers,
    setCubicasaExternalIdInput,
    setCubicasaOrderIdInput,
    setEditing3DValue,
    setIguidePropertyIdInput,
    setIguideWorkOrderIdInput,
    shareLink,
    shootId,
    show3dTours,
    showIguideSection,
    showMatterportSection,
    showZillowSection,
    startEdit3D,
    syncCubicasaNow,
    syncIguideNow,
    tourLinks,
    visibleIguideKeys,
    visibleMatterportKeys,
  } = props;
  const { toast } = useToast();
  const [openProvider, setOpenProvider] = useState<ProviderId | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [offlinePackage, setOfflinePackage] = useState<NormalizedIguideOfflinePackage>(iguideSync.offlinePackage);
  const cubicasa = cubicasaSync || {};
  const cubicasaFloorplans = Array.isArray(cubicasa.floorplans) ? cubicasa.floorplans : [];
  const hasCubicasaData = Boolean(
    cubicasa.status || cubicasa.orderId || cubicasa.externalId || cubicasa.brandedUrl
      || cubicasa.unbrandedUrl || cubicasaFloorplans.length,
  );
  const renderCubicasa = isClientView ? show3dTours && hasCubicasaData : true;
  const renderIguide = showIguideSection || (!isClientView && (
    Boolean(iguideSync.url) || iguideSync.floorplans.length > 0 || offlinePackage.exists
  ));

  useEffect(() => {
    setOfflinePackage(iguideSync.offlinePackage);
  }, [iguideSync.offlinePackage]);

  useEffect(() => {
    if (!['queued', 'scanning'].includes(offlinePackage.status)) return undefined;
    const timer = window.setInterval(() => onShootUpdate(), 5000);
    return () => window.clearInterval(timer);
  }, [offlinePackage.status, onShootUpdate]);

  useEffect(() => {
    if (!editing3DKey) return;
    if (editing3DKey.startsWith('matterport')) setOpenProvider('matterport');
    else if (editing3DKey.startsWith('iguide')) setOpenProvider('iguide');
    else setOpenProvider('zillow');
  }, [editing3DKey]);

  const matterportKeys = visibleMatterportKeys.filter((key) => key.startsWith('matterport'));
  const iguideKeys = visibleIguideKeys.filter((key) => key.startsWith('iguide'));
  const matterportReadyKeys = matterportKeys.filter((key) => Boolean(tourLinks[key]));
  const iguideReadyKeys = iguideKeys.filter((key) => Boolean(tourLinks[key]));
  const preferredMatterportKey = matterportReadyKeys[0] || matterportKeys[0] || 'matterport_branded';
  const preferredIguideKey = iguideReadyKeys[0] || iguideKeys[0] || 'iguide_branded';
  const iguideDeliverableCount = iguideSync.floorplans.length
    + Number(Boolean(iguideSync.pdfImperialUrl))
    + Number(Boolean(iguideSync.pdfMetricUrl));
  const iguidePackageLabel = getIguidePackageStatusLabel(offlinePackage);
  const packageWorking = offlinePackage.status === 'queued' || offlinePackage.status === 'scanning';
  const previousReadyPackage = offlinePackage.previousReady?.status === 'ready'
    && offlinePackage.previousReady.fileId
    ? offlinePackage.previousReady
    : null;
  const downloadablePackage = offlinePackage.status === 'ready' && offlinePackage.fileId
    ? offlinePackage
    : previousReadyPackage;
  const packageStatusKind = offlinePackage.status === 'ready'
    ? 'ready'
    : offlinePackage.status === 'failed'
      ? 'failed'
      : packageWorking
        ? 'working'
        : 'empty';
  const cubicasaStatus = String(cubicasa.status || '').toLowerCase();
  const cubicasaStatusKind = cubicasaStatus === 'ready'
    ? 'ready'
    : cubicasaStatus === 'fixing' || cubicasaStatus === 'failed'
      ? 'failed'
      : cubicasaStatus
        ? 'working'
        : 'empty';
  const showAnyProvider = showMatterportSection || renderIguide || renderCubicasa || showZillowSection;

  const linkMenuItems = (links: Array<{ key: Managed3DLinkKey; label: string }>) => links.flatMap(({ key, label }, index) => {
    const url = tourLinks[key] || '';
    const items: React.ReactNode[] = [];
    if (index > 0) items.push(<DropdownMenuSeparator key={`${key}-separator`} />);
    items.push(<DropdownMenuLabel key={`${key}-label`} className="text-[10px] uppercase text-muted-foreground">{label}</DropdownMenuLabel>);
    if (url) {
      items.push(
        <DropdownMenuItem key={`${key}-copy`} onSelect={() => copyLink(key)}>
          <Copy className="mr-2 h-3.5 w-3.5" />Copy link
        </DropdownMenuItem>,
        <DropdownMenuItem key={`${key}-share`} onSelect={() => shareLink(key)}>
          <Share2 className="mr-2 h-3.5 w-3.5" />Share link
        </DropdownMenuItem>,
      );
    }
    if (isAdmin) {
      items.push(
        <DropdownMenuItem key={`${key}-edit`} onSelect={() => startEdit3D(key)}>
          <Edit3 className="mr-2 h-3.5 w-3.5" />{url ? 'Edit link' : 'Add link'}
        </DropdownMenuItem>,
      );
      if (url) {
        items.push(
          <DropdownMenuItem
            key={`${key}-delete`}
            className="text-destructive focus:text-destructive"
            disabled={isDeleting3D === key}
            onSelect={() => void confirmDelete3D(key)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />Remove link
          </DropdownMenuItem>,
        );
      }
    }
    return items;
  });

  const downloadOfflinePackage = async () => {
    if (!downloadablePackage?.fileId) {
      toast({
        title: 'Download is not ready',
        description: 'The package is still being prepared. Refresh after it reaches Ready.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await downloadIguideOfflinePackage({
        shootId,
        fileId: downloadablePackage.fileId,
        filename: downloadablePackage.originalFilename || undefined,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Could not download the iGUIDE ZIP.',
        variant: 'destructive',
      });
    }
  };

  if (!showAnyProvider) return null;

  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="tour-providers-title">
      <div className="border-b px-3 py-2.5">
        <div className="min-w-0">
          <h3 id="tour-providers-title" className="text-sm font-semibold">3D &amp; floor plans</h3>
          <p className="truncate text-[11px] text-muted-foreground">Tours, provider sync, and offline packages</p>
        </div>
      </div>

      <div className="divide-y">
        {showMatterportSection && (
          <ProviderRow
            id="matterport"
            title="Matterport"
            summary={matterportReadyKeys.length ? `${matterportReadyKeys.length} link${matterportReadyKeys.length === 1 ? '' : 's'} ready` : 'No tour links connected'}
            icon={<Box className="h-4 w-4" />}
            status={<ProviderStatus kind={matterportReadyKeys.length ? 'ready' : 'empty'}>{matterportReadyKeys.length ? 'Ready' : 'Not set'}</ProviderStatus>}
            open={openProvider === 'matterport'}
            onToggle={(id) => setOpenProvider((current) => current === id ? null : id)}
            action={matterportReadyKeys.length ? (
              <Button size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={() => openLink(preferredMatterportKey)}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />Open
              </Button>
            ) : isAdmin ? (
              <Button size="sm" variant="outline" className="h-8 shrink-0 px-3 text-xs" onClick={() => startEdit3D(preferredMatterportKey)}>
                Add link
              </Button>
            ) : undefined}
            menu={<ProviderMenu label="Matterport">{linkMenuItems(matterportKeys.map((key) => ({
              key,
              label: key === 'matterport_branded' ? 'Branded' : 'MLS',
            })))}</ProviderMenu>}
          >
            <div className="divide-y divide-border/70">
              {matterportKeys.map((key) => (
                <LinkEditor
                  key={key}
                  {...props}
                  isAdmin={isAdmin}
                  linkKey={key}
                  label={key === 'matterport_branded' ? 'Branded tour' : 'MLS tour'}
                />
              ))}
            </div>
          </ProviderRow>
        )}

        {renderIguide && (
          <ProviderRow
            id="iguide"
            title="iGUIDE"
            summary={iguideSync.url
              ? `${iguideDeliverableCount} deliverable${iguideDeliverableCount === 1 ? '' : 's'}${iguideSync.lastSyncedAt ? ` · synced ${formatSyncTime(iguideSync.lastSyncedAt)}` : ''}`
              : offlinePackage.exists
                ? `${iguidePackageLabel}${offlinePackage.originalFilename ? ` · ${offlinePackage.originalFilename}` : ''}`
                : 'No tour or offline package'}
            icon={<Home className="h-4 w-4" />}
            status={<ProviderStatus kind={iguideSync.url || offlinePackage.status === 'ready' ? 'ready' : packageStatusKind}>
              {iguideSync.url ? 'Ready' : iguidePackageLabel}
            </ProviderStatus>}
            open={openProvider === 'iguide'}
            onToggle={(id) => setOpenProvider((current) => current === id ? null : id)}
            action={iguideReadyKeys.length || iguideSync.url ? (
              <Button
                size="sm"
                className="h-8 shrink-0 px-3 text-xs"
                onClick={() => iguideReadyKeys.length ? openLink(preferredIguideKey) : openExternal(iguideSync.url)}
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" />Open
              </Button>
            ) : !isClientView && downloadablePackage?.fileId ? (
              <Button size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={() => void downloadOfflinePackage()}>
                <Download className="mr-1 h-3.5 w-3.5" />Download
              </Button>
            ) : isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 px-3 text-xs"
                disabled={packageWorking}
                onClick={() => setUploadDialogOpen(true)}
              >
                {packageWorking ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1 h-3.5 w-3.5" />}
                {packageWorking ? 'Scanning' : offlinePackage.exists ? 'Replace' : 'Upload ZIP'}
              </Button>
            ) : undefined}
            menu={(
              <ProviderMenu label="iGUIDE">
                {linkMenuItems(iguideKeys.map((key) => ({
                  key,
                  label: key === 'iguide_branded' ? 'Branded' : 'MLS',
                })))}
                {!isClientView && offlinePackage.exists && <DropdownMenuSeparator />}
                {!isClientView && downloadablePackage?.fileId && (
                  <DropdownMenuItem onSelect={() => void downloadOfflinePackage()}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {previousReadyPackage ? 'Download previous ZIP' : 'Download offline ZIP'}
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuItem disabled={isSyncingIguide} onSelect={() => void syncIguideNow?.()}>
                      <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isSyncingIguide ? 'animate-spin' : ''}`} />Sync from iGUIDE
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={packageWorking} onSelect={() => setUploadDialogOpen(true)}>
                      <UploadCloud className="mr-2 h-3.5 w-3.5" />{offlinePackage.exists ? 'Replace offline ZIP' : 'Upload offline ZIP'}
                    </DropdownMenuItem>
                  </>
                )}
              </ProviderMenu>
            )}
          >
            <div className="space-y-3">
              {!isClientView && offlinePackage.exists && (
                <div className="flex min-w-0 items-center gap-2 rounded-md bg-background/70 px-2.5 py-2">
                  <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{offlinePackage.originalFilename || 'Offline iGUIDE package'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {iguidePackageLabel}{offlinePackage.sizeBytes !== null ? ` · ${formatFileSize(offlinePackage.sizeBytes)}` : ''}
                    </p>
                    {offlinePackage.status === 'failed' && offlinePackage.error && (
                      <p className="mt-1 text-[10px] text-destructive">{offlinePackage.error}</p>
                    )}
                  </div>
                  {downloadablePackage?.fileId && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void downloadOfflinePackage()}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      {previousReadyPackage ? 'Download previous' : 'Download'}
                    </Button>
                  )}
                </div>
              )}

              {(iguideSync.embedImageUrl || iguideSync.url || iguideSync.unbrandedUrl || iguideSync.manageUrl) && (
                <div className="flex gap-2.5">
                  {iguideSync.embedImageUrl && (
                    <button type="button" onClick={() => openExternal(iguideSync.url || iguideSync.embedImageUrl)} className="h-14 w-20 shrink-0 overflow-hidden rounded-md border">
                      <img src={iguideSync.embedImageUrl} alt="iGUIDE preview" className="h-full w-full object-cover" />
                    </button>
                  )}
                  <div className="flex min-w-0 flex-1 flex-wrap content-start gap-x-3 gap-y-1 text-xs">
                    {iguideSync.url && <a href={iguideSync.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Public tour</a>}
                    {iguideSync.unbrandedUrl && <a href={iguideSync.unbrandedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Unbranded</a>}
                    {iguideSync.embeddedUrl && <a href={iguideSync.embeddedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Embed page</a>}
                    {isAdmin && iguideSync.manageUrl && <a href={iguideSync.manageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Manage on iGUIDE</a>}
                    {iguideSync.pdfImperialUrl && <a href={iguideSync.pdfImperialUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Imperial PDF</a>}
                    {iguideSync.pdfMetricUrl && <a href={iguideSync.pdfMetricUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Metric PDF</a>}
                    {iguideSync.offlineZipUrl && <a href={iguideSync.offlineZipUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Vendor ZIP</a>}
                  </div>
                </div>
              )}

              {iguideSync.floorplans.length > 0 && (
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {iguideSync.floorplans.map((floorplan, index) => (
                    <a key={`${floorplan.url}-${index}`} href={floorplan.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-primary hover:underline">
                      {floorplan.label || floorplan.filename || `Floor plan ${index + 1}`}
                    </a>
                  ))}
                </div>
              )}

              <div className="divide-y divide-border/70">
                {iguideKeys.map((key) => (
                  <LinkEditor
                    key={key}
                    {...props}
                    isAdmin={isAdmin}
                    linkKey={key}
                    label={key === 'iguide_branded' ? 'Branded tour' : 'MLS tour'}
                  />
                ))}
              </div>

              {isAdmin && saveIguideIdentifiers && (
                <div className="border-t pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Advanced matching</p>
                    {iguideSync.lastSyncedAt && <span className="text-[10px] text-muted-foreground">Last sync {formatSyncTime(iguideSync.lastSyncedAt)}</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Property ID</Label>
                      <Input className="h-8 text-xs" value={iguidePropertyIdInput || ''} onChange={(event) => setIguidePropertyIdInput?.(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Work order ID</Label>
                      <Input className="h-8 text-xs" value={iguideWorkOrderIdInput || ''} onChange={(event) => setIguideWorkOrderIdInput?.(event.target.value)} />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" className="h-7 text-xs" onClick={() => void saveIguideIdentifiers()} disabled={isSavingIguideIdentifiers}>
                      {isSavingIguideIdentifiers && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Save matching
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ProviderRow>
        )}

        {renderCubicasa && (
          <ProviderRow
            id="cubicasa"
            title="CubiCasa"
            summary={hasCubicasaData
              ? `${cubicasaFloorplans.length} floor plan${cubicasaFloorplans.length === 1 ? '' : 's'}${cubicasa.productType ? ` · ${cubicasa.productType}` : ''}`
              : 'No order connected'}
            icon={<MapPinned className="h-4 w-4" />}
            status={<ProviderStatus kind={cubicasaStatusKind}>{cubicasa.status || 'Not linked'}</ProviderStatus>}
            open={openProvider === 'cubicasa'}
            onToggle={(id) => setOpenProvider((current) => current === id ? null : id)}
            action={cubicasa.brandedUrl || cubicasa.unbrandedUrl ? (
              <Button size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={() => openExternal(cubicasa.brandedUrl || cubicasa.unbrandedUrl)}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />Open
              </Button>
            ) : isAdmin ? createCubicasaOrderButton : undefined}
            menu={isAdmin ? (
              <ProviderMenu label="CubiCasa">
                <DropdownMenuItem disabled={isSyncingCubicasa} onSelect={() => void syncCubicasaNow?.()}>
                  <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isSyncingCubicasa ? 'animate-spin' : ''}`} />Sync CubiCasa
                </DropdownMenuItem>
              </ProviderMenu>
            ) : undefined}
          >
            <div className="space-y-3">
              {(cubicasa.brandedUrl || cubicasa.unbrandedUrl) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {cubicasa.brandedUrl && <a href={cubicasa.brandedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Branded tour</a>}
                  {cubicasa.unbrandedUrl && <a href={cubicasa.unbrandedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MLS-compliant</a>}
                </div>
              )}
              {cubicasaFloorplans.length > 0 && (
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {cubicasaFloorplans.map((floorplan, index) => {
                    const url = getFloorplanUrl(floorplan);
                    return url ? (
                      <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-primary hover:underline">
                        {getFloorplanLabel(floorplan, index)}
                      </a>
                    ) : null;
                  })}
                </div>
              )}
              {(isAdmin || (!isClientView && cubicasa.lastSyncedAt)) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {isAdmin && cubicasa.orderId && <span>Order <strong className="font-mono text-foreground">{cubicasa.orderId}</strong></span>}
                  {isAdmin && cubicasa.externalId && <span>External <strong className="font-mono text-foreground">{cubicasa.externalId}</strong></span>}
                  {cubicasa.lastSyncedAt && <span>Synced {formatSyncTime(cubicasa.lastSyncedAt)}</span>}
                </div>
              )}
              {isAdmin && saveCubicasaIdentifiers && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Advanced matching</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Order ID</Label>
                      <Input className="h-8 text-xs font-mono" value={cubicasaOrderIdInput || ''} onChange={(event) => setCubicasaOrderIdInput?.(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">External ID</Label>
                      <Input className="h-8 text-xs font-mono" value={cubicasaExternalIdInput || ''} onChange={(event) => setCubicasaExternalIdInput?.(event.target.value)} />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" className="h-7 text-xs" onClick={() => void saveCubicasaIdentifiers()} disabled={isSavingCubicasaIdentifiers}>
                      {isSavingCubicasaIdentifiers && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Save matching
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ProviderRow>
        )}

        {showZillowSection && (
          <ProviderRow
            id="zillow"
            title="Zillow 3D"
            summary={tourLinks.zillow_3d ? 'Home tour connected' : 'No tour link connected'}
            icon={<MapPinned className="h-4 w-4" />}
            status={<ProviderStatus kind={tourLinks.zillow_3d ? 'ready' : 'empty'}>{tourLinks.zillow_3d ? 'Ready' : 'Not set'}</ProviderStatus>}
            open={openProvider === 'zillow'}
            onToggle={(id) => setOpenProvider((current) => current === id ? null : id)}
            action={tourLinks.zillow_3d ? (
              <Button size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={() => openLink('zillow_3d')}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />Open
              </Button>
            ) : isAdmin ? (
              <Button size="sm" variant="outline" className="h-8 shrink-0 px-3 text-xs" onClick={() => startEdit3D('zillow_3d')}>
                Add link
              </Button>
            ) : undefined}
            menu={<ProviderMenu label="Zillow 3D">{linkMenuItems([{ key: 'zillow_3d', label: 'Tour link' }])}</ProviderMenu>}
          >
            <LinkEditor {...props} isAdmin={isAdmin} linkKey="zillow_3d" label="Zillow 3D Home Tour" />
          </ProviderRow>
        )}
      </div>

      <IguideOfflinePackageDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        shootId={shootId}
        currentPackage={offlinePackage}
        onUploaded={(nextPackage) => {
          setOfflinePackage(nextPackage);
          toast({
            title: 'iGUIDE ZIP uploaded',
            description: nextPackage.status === 'ready'
              ? 'The offline package is ready.'
              : 'The package is queued for security scanning.',
          });
          onShootUpdate();
        }}
      />
    </section>
  );
}
