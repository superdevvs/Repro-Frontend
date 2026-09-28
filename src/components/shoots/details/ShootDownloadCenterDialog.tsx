import { useMemo, useRef, useState } from 'react';
import { Archive, Copy, Download, ExternalLink, FileText, Film, Link as LinkIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ShootData } from '@/types/shoots';
import type { ShootMediaDownloadSize, ShootMediaFileDownloadOptions } from '@/utils/shootMediaDownload';
import { validateDownloadUrl } from '@/utils/shootDownloadTransfer';
import { useShootUnitScope } from '@/features/shoot-units/useShootUnitScope';
import { ShootUnitScopeBar } from '@/features/shoot-units/ShootUnitScope';
import { projectUnitTour } from '@/features/shoot-units/unitTourData';
import { filterUnitFiles } from '@/features/shoot-units/unitMutations';
import { buildShootDownloadCenterModel, type LinkDownload } from './shootDownloadCenterModel';

export type DownloadTarget = {
  shootServiceId?: string | number | null;
  label?: string;
  assetType?: 'photos';
};

interface ShootDownloadCenterDialogProps {
  shoot: ShootData | null;
  open: boolean;
  isDownloading: boolean;
  downloadStatusMessage: string;
  isClient?: boolean;
  canDownloadWholeShoot?: boolean;
  canAccessTours?: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadArchive: (size: ShootMediaDownloadSize, target?: DownloadTarget) => void | Promise<void>;
  onDownloadFile?: (fileId: string | number, label?: string, options?: ShootMediaFileDownloadOptions) => void | Promise<void>;
}

const PHOTO_SIZE_OPTIONS: Array<{ size: ShootMediaDownloadSize; label: string; description: string }> = [
  { size: 'original', label: 'High res', description: 'Full resolution' },
  { size: 'small', label: 'MLS / small', description: 'Smaller files' },
];

export function ShootDownloadCenterDialog({
  shoot: sourceShoot, open, isDownloading, downloadStatusMessage, isClient = false,
  canDownloadWholeShoot = true, canAccessTours = true, onOpenChange, onDownloadArchive, onDownloadFile,
}: ShootDownloadCenterDialogProps) {
  const { toast } = useToast();
  const scope = useShootUnitScope(sourceShoot ?? undefined);
  const shoot = useMemo(() => sourceShoot && scope.unit ? {
    ...projectUnitTour(sourceShoot, scope.unit),
    files: filterUnitFiles(sourceShoot.files ?? [], sourceShoot, scope.activeUnitId),
  } : sourceShoot, [sourceShoot, scope.unit, scope.activeUnitId]);
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const activeDownloadRef = useRef(false);
  const downloadBusy = isDownloading || activeDownload !== null;
  const runDownload = async (key: string, action: () => void | Promise<void>) => {
    if (isDownloading || activeDownloadRef.current) return;
    activeDownloadRef.current = true;
    setActiveDownload(key);
    try { await action(); }
    catch (error) {
      toast({ title: 'Download failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      activeDownloadRef.current = false;
      setActiveDownload(null);
    }
  };
  const downloadModel = useMemo(() => buildShootDownloadCenterModel(shoot, {
    isClient, canDownloadWholeShoot,
    canAccessTours: !isClient || (scope.isMultiUnit ? Number(scope.unit?.ready_service_count) > 0 : canAccessTours),
    baseUrl: window.location.origin, unitId: scope.activeUnitId,
  }), [canAccessTours, canDownloadWholeShoot, isClient, shoot, scope.isMultiUnit, scope.unit?.ready_service_count, scope.activeUnitId]);

  const renderArchiveButtons = (target: DownloadTarget) => (
    <div className="grid grid-cols-2 gap-2">
      {PHOTO_SIZE_OPTIONS.map((option) => {
        const key = `archive-${target.shootServiceId ?? 'all'}-${option.size}`;
        return <Button key={option.size} variant="outline"
          className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left"
          disabled={downloadBusy} aria-busy={activeDownload === key}
          onClick={() => void runDownload(key, () => onDownloadArchive(option.size, { ...target, assetType: 'photos' }))}>
          {activeDownload === key ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 shrink-0" /> : <Download className="mr-2 h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-medium">{option.label}</span>
            <span className="block break-words text-xs text-muted-foreground">{option.description}</span>
          </span>
        </Button>;
      })}
    </div>
  );

  const copyLink = async (download: LinkDownload) => {
    try {
      await navigator.clipboard.writeText(download.href!);
      toast({ title: 'Link copied', description: download.label });
    } catch {
      toast({ title: 'Could not copy link', description: 'Open the link and copy it from your browser.', variant: 'destructive' });
    }
  };
  const renderDownload = (download: LinkDownload) => {
    const isLink = download.action === 'link';
    const Icon = isLink ? LinkIcon : download.kind === 'video' ? Film : FileText;
    return <div key={download.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/70 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="break-words text-sm font-medium [overflow-wrap:anywhere]">{download.label}</div>
          {download.subtitle && <div className="break-words text-xs text-muted-foreground">{download.subtitle}</div>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {isLink && <Button size="sm" variant="outline" className="h-8 px-2" aria-label={`Copy ${download.label} link`}
          onClick={() => void copyLink(download)}><Copy className="h-3.5 w-3.5" /></Button>}
        {isLink ? <Button asChild size="sm" variant="outline" className="h-8 px-2">
          <a href={download.href!} target="_blank" rel="noopener noreferrer" aria-label={`Open ${download.label}`}><ExternalLink className="h-3.5 w-3.5" /></a>
        </Button> : <Button size="sm" variant="outline" className="h-8 px-2"
          disabled={downloadBusy || (!download.href && (!onDownloadFile || download.fileId == null))}
          aria-label={`Download ${download.label}`} aria-busy={activeDownload === download.id}
          onClick={() => void runDownload(download.id, async () => {
            if (download.fileId != null && onDownloadFile) {
              await onDownloadFile(download.fileId, download.label, download.format ? { format: download.format, page: download.page } : undefined);
            } else if (download.href) {
              const anchor = document.createElement('a');
              anchor.href = validateDownloadUrl(download.href);
              anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.download = '';
              document.body.appendChild(anchor);
              try { anchor.click(); } finally { anchor.remove(); }
            }
          })}>
          {activeDownload === download.id ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        </Button>}
      </div>
    </div>;
  };
  const sections = [
    { title: 'Edited video files', items: downloadModel.editedVideos },
    { title: 'Video only hosted links', items: downloadModel.videoLinks },
    { title: '3D links', items: downloadModel.threeDLinks },
    { title: 'Floorplan PDFs', items: downloadModel.floorplanPdfs },
    { title: 'Floorplan JPGs', items: downloadModel.floorplanJpgs },
    { title: 'Tour links', items: downloadModel.tourLinks },
  ];
  const hasPhotos = downloadModel.wholeShootPhotoCount > 0 || downloadModel.services.length > 0;
  const photoServices = downloadModel.services.filter(service =>
    downloadModel.services.length > 1 || service.photoCount !== downloadModel.wholeShootPhotoCount);
  const hasDownloads = hasPhotos || sections.some(section => section.items.length > 0);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[86vh] overflow-hidden p-0 sm:w-[calc(100%-3rem)] sm:max-w-7xl">
      <div className="flex max-h-[86vh] flex-col">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Download Center</DialogTitle>
          <DialogDescription>{isDownloading ? 'Your download will start automatically when it is ready.'
            : scope.isMultiUnit ? 'Download files and copy links for the selected unit.' : 'Download your delivered files and copy links to share.'}</DialogDescription>
        </DialogHeader>
        {sourceShoot && scope.isMultiUnit && <div className="px-5 pt-3"><ShootUnitScopeBar shoot={sourceShoot} disabled={downloadBusy} /></div>}
        {downloadBusy && <div role="status" className="px-5 pt-3 text-sm text-muted-foreground">{downloadStatusMessage || 'Preparing your download...'}</div>}
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {!hasDownloads ? <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <EmptyState icon="downloads" title={<>No downloads available yet</>} size="compact" />
            <div className="mt-1 text-sm text-muted-foreground">Delivered photos, videos, floorplans, and links will appear here.</div>
          </div> : <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hasPhotos && <section aria-label="Photos" className="min-w-0 rounded-lg border border-border bg-muted/20 p-3">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><Archive className="h-4 w-4 text-primary" />Photos</h3>
              {downloadModel.wholeShootPhotoCount > 0 && <div>
                <div className="mb-2 text-sm text-muted-foreground">{scope.isMultiUnit ? 'All unit photos' : 'All photos'} · {downloadModel.wholeShootPhotoCount} images</div>
                {renderArchiveButtons({ label: 'all photos' })}
              </div>}
              {photoServices.map(service => <div key={service.id} className={cn('mt-3', downloadModel.wholeShootPhotoCount > 0 && 'border-t pt-3')}>
                <div className="mb-2 text-sm font-medium">{service.name} <span className="font-normal text-muted-foreground">· {service.photoCount} images</span></div>
                {renderArchiveButtons({ shootServiceId: service.shootServiceId, label: service.name })}
              </div>)}
            </section>}
            {sections.filter(section => section.items.length > 0).map(section => <section key={section.title} aria-label={section.title} className="min-w-0 rounded-lg border border-border bg-muted/20 p-3">
              <h3 className="mb-3 font-semibold">{section.title}</h3>
              <div className="space-y-2">{section.items.map(renderDownload)}</div>
            </section>)}
          </div>}
        </div>
        <div className="flex justify-end border-t px-5 py-3"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}
