import React, { useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileArchive,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  normalizeIguideOfflinePackage,
  type NormalizedIguideOfflinePackage,
  type NormalizedIguideSync,
} from '@/utils/shootTourData';
import { IguideOfflinePackageDialog } from '../tours/IguideOfflinePackageDialog';
import {
  downloadIguideOfflinePackage,
  formatFileSize,
  getIguidePackageStatusLabel,
  openIguideOfflineViewer,
} from '../tours/iguideOfflinePackage';

interface IguideMediaPanelProps {
  iguideUrl?: string;
  iguideSync?: NormalizedIguideSync | null;
  isAdmin: boolean;
  isClient: boolean;
  isEditor: boolean;
  onShootUpdate: () => void;
  shootId: number | string;
}

const emptyOfflinePackage = () => normalizeIguideOfflinePackage(null);

export function IguideMediaPanel({
  iguideUrl = '',
  iguideSync,
  isAdmin,
  isClient,
  isEditor,
  onShootUpdate,
  shootId,
}: IguideMediaPanelProps) {
  const { toast } = useToast();
  const sync = iguideSync || ({} as NormalizedIguideSync);
  const embedUrl = sync.embeddedUrl || iguideUrl;
  const billing = sync.billing;
  const staffCanSeeOffline = isAdmin && !isClient && !isEditor;
  const [offlinePackage, setOfflinePackage] = useState<NormalizedIguideOfflinePackage>(
    staffCanSeeOffline ? sync.offlinePackage || emptyOfflinePackage() : emptyOfflinePackage(),
  );
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setOfflinePackage(
      staffCanSeeOffline ? sync.offlinePackage || emptyOfflinePackage() : emptyOfflinePackage(),
    );
  }, [staffCanSeeOffline, sync.offlinePackage]);

  useEffect(() => {
    if (!['queued', 'scanning'].includes(offlinePackage.status)) return undefined;
    const timer = window.setInterval(onShootUpdate, 5000);
    return () => window.clearInterval(timer);
  }, [offlinePackage.status, onShootUpdate]);

  const previousReadyPackage = offlinePackage.previousReady?.status === 'ready'
    && offlinePackage.previousReady.fileId
    ? offlinePackage.previousReady
    : null;
  const downloadablePackage = offlinePackage.status === 'ready' && offlinePackage.fileId
    ? offlinePackage
    : previousReadyPackage;
  const packageReady = offlinePackage.status === 'ready' && Boolean(offlinePackage.fileId);
  const packageWorking = offlinePackage.status === 'queued' || offlinePackage.status === 'scanning';
  const packageStatusLabel = getIguidePackageStatusLabel(offlinePackage);
  const packageStatusClass = packageReady
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : packageWorking
      ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
      : offlinePackage.status === 'failed'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border bg-muted/40 text-muted-foreground';

  const downloadLinks: Array<{ label: string; url: string }> = [];
  if (sync.pdfImperialUrl) downloadLinks.push({ label: 'Floor plan PDF (Imperial)', url: sync.pdfImperialUrl });
  if (sync.pdfMetricUrl) downloadLinks.push({ label: 'Floor plan PDF (Metric)', url: sync.pdfMetricUrl });
  if (sync.galleryZipUrl) downloadLinks.push({ label: 'Gallery (ZIP)', url: sync.galleryZipUrl });
  if (sync.galleryLowResZipUrl) downloadLinks.push({ label: 'Gallery low-res (ZIP)', url: sync.galleryLowResZipUrl });
  if (sync.sphereZipUrl) downloadLinks.push({ label: 'Spheres (ZIP)', url: sync.sphereZipUrl });
  if (sync.offlineZipUrl) downloadLinks.push({ label: 'Vendor offline tour (ZIP)', url: sync.offlineZipUrl });

  const handleOpenOffline = async () => {
    if (!packageReady || isOpening) return;
    setIsOpening(true);
    try {
      await openIguideOfflineViewer(shootId);
    } catch (error) {
      toast({
        title: 'Could not open iGUIDE',
        description: error instanceof Error ? error.message : 'The viewer could not be opened.',
        variant: 'destructive',
      });
    } finally {
      setIsOpening(false);
    }
  };

  const handleDownloadOffline = async () => {
    if (!downloadablePackage?.fileId || isDownloading) return;
    setIsDownloading(true);
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
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="m-2.5 space-y-4 rounded-lg border bg-card p-4">
        {staffCanSeeOffline && offlinePackage.exists && (
          <section
            className="flex flex-col gap-3 rounded-md border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center"
            data-testid="iguide-offline-package"
            aria-label="Offline iGUIDE package"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm">
              <FileArchive className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">Offline iGUIDE</h4>
                <Badge variant="outline" className={`h-5 rounded-full px-2 text-[10px] font-medium ${packageStatusClass}`}>
                  {packageStatusLabel}
                </Badge>
              </div>
              <p className="truncate text-xs font-medium" title={offlinePackage.originalFilename || undefined}>
                {offlinePackage.originalFilename || 'iGUIDE offline package'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {offlinePackage.sizeBytes !== null ? formatFileSize(offlinePackage.sizeBytes) : 'Package uploaded'}
                {packageWorking ? ' · Security check in progress' : packageReady ? ' · Ready to view' : ''}
              </p>
              {offlinePackage.status === 'failed' && offlinePackage.error && (
                <p className="mt-1 text-[11px] text-destructive">{offlinePackage.error}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {packageReady && (
                <Button size="sm" className="h-8 px-3 text-xs" onClick={() => void handleOpenOffline()} disabled={isOpening}>
                  {isOpening ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
                  {isOpening ? 'Opening' : 'Open iGUIDE'}
                </Button>
              )}
              {downloadablePackage?.fileId && (
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => void handleDownloadOffline()} disabled={isDownloading}>
                  {isDownloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                  {previousReadyPackage ? 'Previous ZIP' : 'Download'}
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setUploadDialogOpen(true)} disabled={packageWorking}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Replace
                </Button>
              )}
            </div>
          </section>
        )}

        {iguideUrl && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">Published iGUIDE</h4>
                <a
                  href={iguideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open published tour <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                {sync.unbrandedUrl && (
                  <a href={sync.unbrandedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Unbranded <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {sync.manageUrl && (
                  <a href={sync.manageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Manage <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {billing && (
              <div className="flex flex-wrap gap-1.5">
                {billing.iguideType && <Badge variant="secondary" className="text-[10px] uppercase">{billing.iguideType}</Badge>}
                {Array.isArray(billing.addons) && billing.addons.map((addon: string) => (
                  <Badge key={addon} variant="outline" className="text-[10px] uppercase">{addon}</Badge>
                ))}
                {typeof billing.billableAreaSqFeet === 'number' && (
                  <Badge variant="outline" className="text-[10px]">{Math.round(billing.billableAreaSqFeet).toLocaleString()} sqft</Badge>
                )}
                {typeof billing.billableAreaSqMeters === 'number' && (
                  <Badge variant="outline" className="text-[10px]">{Math.round(billing.billableAreaSqMeters).toLocaleString()} m²</Badge>
                )}
              </div>
            )}

            {embedUrl && (
              <div className="aspect-video w-full overflow-hidden rounded-lg border">
                <iframe src={embedUrl} className="h-full w-full" allowFullScreen title="iGUIDE 3D Tour" />
              </div>
            )}
          </section>
        )}

        {downloadLinks.length > 0 && (
          <section className="space-y-1.5 border-t pt-3">
            <h5 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deliverables</h5>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {downloadLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 truncate text-xs text-primary hover:underline">
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {sync.lastSyncedAt && (
          <p className="text-[10px] text-muted-foreground">Last synced from youriguide.com: {new Date(sync.lastSyncedAt).toLocaleString()}</p>
        )}
      </div>

      {staffCanSeeOffline && (
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
                ? 'The offline package is ready to open.'
                : 'The package is being checked before it becomes available.',
            });
            onShootUpdate();
          }}
        />
      )}
    </div>
  );
}
