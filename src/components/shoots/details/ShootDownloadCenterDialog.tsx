import { useMemo } from 'react';
import {
  Archive,
  Download,
  FileArchive,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HorizontalLoader } from '@/components/ui/horizontal-loader';
import { cn } from '@/lib/utils';
import type { ShootData, ShootFileData, ShootTourLinkValue } from '@/types/shoots';
import type { ShootMediaDownloadSize } from '@/utils/shootMediaDownload';
import { getShootServiceItems } from '@/utils/shootServiceItems';

type DownloadTarget = {
  shootServiceId?: string | number | null;
  label?: string;
};

type LinkDownload = {
  id: string;
  label: string;
  subtitle?: string;
  href?: string | null;
  fileId?: string | number;
  kind: 'video' | 'floorplan' | 'file';
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
  onDownloadArchive: (size: ShootMediaDownloadSize, target?: DownloadTarget) => void;
  onDownloadFile?: (fileId: string | number, label?: string) => void;
}

const PHOTO_SIZE_OPTIONS: Array<{
  size: ShootMediaDownloadSize;
  label: string;
  description: string;
}> = [
  {
    size: 'original',
    label: 'Original',
    description: 'Full resolution',
  },
  {
    size: 'small',
    label: 'MLS',
    description: '1800x1200 export',
  },
];

const getStringValue = (value: ShootTourLinkValue): string | null => {
  if (typeof value === 'string' && value.trim() !== '') return value;
  return null;
};

const extensionFromName = (file: Pick<ShootFileData, 'filename' | 'stored_filename' | 'storedFilename' | 'url'>) => {
  const name = String(file.filename || file.stored_filename || file.storedFilename || file.url || '').toLowerCase();
  const match = name.match(/\.([a-z0-9]+)(?:$|[?#])/i);
  return match?.[1] ?? '';
};

const isVideoFile = (file: ShootFileData) => {
  const type = String(file.media_type || file.file_type || file.fileType || '').toLowerCase();
  const ext = extensionFromName(file);
  return type === 'video' || type.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'].includes(ext);
};

const isPdfFile = (file: ShootFileData) => {
  const type = String(file.file_type || file.fileType || '').toLowerCase();
  return type.includes('pdf') || extensionFromName(file) === 'pdf';
};

const isPhotoFile = (file: ShootFileData) => {
  if (isVideoFile(file) || isPdfFile(file)) return false;
  const type = String(file.media_type || file.file_type || file.fileType || '').toLowerCase();
  const ext = extensionFromName(file);
  return (
    type === 'edited' ||
    type.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff'].includes(ext)
  );
};

const isClientDownloadableFile = (file: ShootFileData) => {
  const stage = String(file.workflow_stage || file.workflowStage || '').toLowerCase();
  if (stage) {
    return ['verified', 'final', 'completed', 'delivered', 'client_delivered'].includes(stage);
  }

  const type = String(file.media_type || file.file_type || file.fileType || '').toLowerCase();
  const path = String(file.path || file.url || '').toLowerCase();
  return type === 'edited' || path.includes('/final/') || path.includes('\\final\\');
};

const getFileServiceId = (file: ShootFileData): string | null => {
  const raw = file.shoot_service_id ?? file.shootServiceId;
  return raw === null || raw === undefined || String(raw).trim() === '' ? null : String(raw);
};

const fileName = (file: ShootFileData) =>
  file.filename || file.stored_filename || file.storedFilename || 'Download file';

const dedupeLinks = (links: LinkDownload[]) => {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.kind}:${link.fileId ?? link.href ?? link.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildTourDownloads = (shoot: ShootData): LinkDownload[] => {
  const links: LinkDownload[] = [];
  const tourLinks = shoot.tourLinks ?? {};

  const addTourLink = (key: string, label: string, kind: LinkDownload['kind']) => {
    const url = getStringValue(tourLinks[key]);
    if (!url) return;
    links.push({
      id: `tour-${key}`,
      label,
      subtitle: url.includes('youtu') || url.includes('vimeo') ? 'Hosted video link' : 'Tour asset',
      href: url,
      kind,
    });
  };

  addTourLink('video_link', 'Video', 'video');
  addTourLink('video_branded', 'Branded video', 'video');
  addTourLink('video_mls', 'MLS video', 'video');
  addTourLink('video_generic', 'Generic video', 'video');
  addTourLink('matterport', 'Matterport tour', 'file');
  addTourLink('iGuide', 'iGuide tour', 'file');
  addTourLink('iguide_branded', 'Branded iGuide', 'file');
  addTourLink('iguide_mls', 'MLS iGuide', 'file');

  (shoot.iguideFloorplans ?? []).forEach((floorplan, index) => {
    if (typeof floorplan === 'string') {
      links.push({
        id: `iguide-floorplan-${index}`,
        label: `Floorplan PDF ${index + 1}`,
        subtitle: 'iGuide floorplan',
        href: floorplan,
        kind: 'floorplan',
      });
      return;
    }

    if (floorplan?.url) {
      links.push({
        id: `iguide-floorplan-${index}`,
        label: floorplan.filename || `Floorplan PDF ${index + 1}`,
        subtitle: 'iGuide floorplan',
        href: floorplan.url,
        kind: 'floorplan',
      });
    }
  });

  return links;
};

const startExternalDownload = (url: string) => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.download = '';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export function ShootDownloadCenterDialog({
  shoot,
  open,
  isDownloading,
  downloadStatusMessage,
  isClient = false,
  canDownloadWholeShoot = true,
  canAccessTours = true,
  onOpenChange,
  onDownloadArchive,
  onDownloadFile,
}: ShootDownloadCenterDialogProps) {
  const downloadModel = useMemo(() => {
    const canSeeWholeShoot = !isClient || canDownloadWholeShoot;
    const canSeeTours = !isClient || canAccessTours;

    if (!shoot) {
      return {
        services: [],
        wholeShootPhotoCount: 0,
        unassignedPhotoCount: 0,
        unassignedDownloads: [] as LinkDownload[],
        tourDownloads: [] as LinkDownload[],
        totalItems: 0,
      };
    }

    const serviceItems = getShootServiceItems(shoot);
    const unlockedServiceIds = new Set(
      serviceItems
        .filter((service) => service.isUnlockedForDelivery)
        .map((service) => String(service.id)),
    );
    const visibleServiceItems = canSeeWholeShoot
      ? serviceItems
      : serviceItems.filter((service) => unlockedServiceIds.has(String(service.id)));
    const allFiles = Array.isArray(shoot.files) ? shoot.files : [];
    const clientScopedFiles = isClient ? allFiles.filter(isClientDownloadableFile) : allFiles;
    const files = canSeeWholeShoot
      ? clientScopedFiles
      : clientScopedFiles.filter((file) => {
          const serviceId = getFileServiceId(file);
          return Boolean(serviceId && unlockedServiceIds.has(serviceId));
        });
    const photos = files.filter(isPhotoFile);
    const directFileDownloads: LinkDownload[] = files
      .filter((file) => isVideoFile(file) || isPdfFile(file))
      .map((file) => ({
        id: `file-${file.id}`,
        label: fileName(file),
        subtitle: isVideoFile(file) ? 'Video file' : 'PDF file',
        fileId: file.id,
        kind: isVideoFile(file) ? 'video' : 'floorplan',
      }));

    const serviceRows = visibleServiceItems.map((service) => {
      const serviceId = String(service.id);
      const servicePhotos = photos.filter((file) => getFileServiceId(file) === serviceId);
      const serviceDirectDownloads = directFileDownloads.filter((file) => {
        const source = files.find((candidate) => String(candidate.id) === String(file.fileId));
        return source ? getFileServiceId(source) === serviceId : false;
      });

      return {
        id: service.id,
        name: service.name,
        shootServiceId: service.id,
        photoCount: servicePhotos.length,
        downloads: serviceDirectDownloads,
      };
    }).filter((service) => service.photoCount > 0 || service.downloads.length > 0);

    const assignedServiceIds = new Set(visibleServiceItems.map((service) => String(service.id)));
    const unassignedPhotos = photos.filter((file) => {
      const serviceId = getFileServiceId(file);
      return !serviceId || !assignedServiceIds.has(serviceId);
    });
    const unassignedDownloads = directFileDownloads.filter((download) => {
      const source = files.find((file) => String(file.id) === String(download.fileId));
      const serviceId = source ? getFileServiceId(source) : null;
      return !serviceId || !assignedServiceIds.has(serviceId);
    });
    const tourDownloads = canSeeTours ? dedupeLinks(buildTourDownloads(shoot)) : [];
    const totalItems =
      (canSeeWholeShoot && photos.length > 0 ? 1 : 0) +
      serviceRows.length +
      (unassignedDownloads.length > 0 ? 1 : 0) +
      tourDownloads.length;

    return {
      services: serviceRows,
      wholeShootPhotoCount: canSeeWholeShoot ? photos.length : 0,
      unassignedPhotoCount: unassignedPhotos.length,
      unassignedDownloads,
      tourDownloads,
      totalItems,
    };
  }, [canAccessTours, canDownloadWholeShoot, isClient, shoot]);

  const isWide = downloadModel.totalItems > 4 || downloadModel.services.length > 2;
  const hasDownloads =
    downloadModel.wholeShootPhotoCount > 0 ||
    downloadModel.services.length > 0 ||
    downloadModel.unassignedDownloads.length > 0 ||
    downloadModel.tourDownloads.length > 0;

  const renderArchiveButtons = (
    target: DownloadTarget,
    disabled: boolean,
    compact = false,
  ) => (
    <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'sm:grid-cols-2')}>
      {PHOTO_SIZE_OPTIONS.map((option) => (
        <Button
          key={option.size}
          variant="outline"
          className="h-auto justify-start px-3 py-2 text-left"
          disabled={disabled || isDownloading}
          onClick={() => onDownloadArchive(option.size, target)}
        >
          <Download className="mr-2 h-4 w-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="block text-xs text-muted-foreground">{option.description}</span>
          </span>
        </Button>
      ))}
    </div>
  );

  const renderLinkDownload = (download: LinkDownload) => {
    const Icon = download.kind === 'video' ? Film : download.kind === 'floorplan' ? FileText : FileArchive;
    return (
      <div
        key={download.id}
        className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-3 py-2"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{download.label}</div>
            {download.subtitle && (
              <div className="truncate text-xs text-muted-foreground">{download.subtitle}</div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 px-2"
          disabled={isDownloading}
          onClick={() => {
            if (download.fileId && onDownloadFile) {
              onDownloadFile(download.fileId, download.label);
              return;
            }
            if (download.href) startExternalDownload(download.href);
          }}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[86vh] overflow-hidden p-0',
          isWide ? 'sm:max-w-3xl lg:max-w-4xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex max-h-[86vh] flex-col">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Download Center</DialogTitle>
            <DialogDescription>
              {isDownloading
                ? 'Your download will start automatically when it is ready.'
                : 'Choose a shoot package, service item, video, or floorplan.'}
            </DialogDescription>
          </DialogHeader>

          {isDownloading ? (
            <div className="space-y-4 px-5 py-5">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="space-y-1">
                  <div className="font-medium">Preparing your files</div>
                  <div className="text-sm text-muted-foreground">{downloadStatusMessage}</div>
                </div>
              </div>
              <HorizontalLoader message="Your download will start automatically when the archive is ready." />
            </div>
          ) : (
            <div className="min-h-0 overflow-y-auto px-5 py-4">
              {!hasDownloads ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                  <FileArchive className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <div className="font-medium">No downloadable files yet</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Delivered photos, videos, PDFs, and floorplans will appear here.
                  </div>
                </div>
              ) : (
                <div className={cn('grid gap-3', isWide && 'lg:grid-cols-2')}>
                  {downloadModel.wholeShootPhotoCount > 0 && (
                    <section className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-semibold">
                            <Archive className="h-4 w-4 text-primary" />
                            All photos
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {downloadModel.wholeShootPhotoCount} image{downloadModel.wholeShootPhotoCount === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                      {renderArchiveButtons({ label: 'all photos' }, false)}
                    </section>
                  )}

                  {downloadModel.services.map((service) => (
                    <section key={service.id} className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{service.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {service.photoCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <ImageIcon className="h-3.5 w-3.5" />
                                {service.photoCount} image{service.photoCount === 1 ? '' : 's'}
                              </span>
                            )}
                            {service.downloads.length > 0 && <span>{service.downloads.length} file{service.downloads.length === 1 ? '' : 's'}</span>}
                          </div>
                        </div>
                      </div>
                      {service.photoCount > 0 && renderArchiveButtons({
                        shootServiceId: service.shootServiceId,
                        label: service.name,
                      }, false, true)}
                      {service.downloads.length > 0 && (
                        <div className={cn('space-y-2', service.photoCount > 0 && 'mt-3')}>
                          {service.downloads.map(renderLinkDownload)}
                        </div>
                      )}
                    </section>
                  ))}

                  {downloadModel.unassignedDownloads.length > 0 && (
                    <section className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="mb-3 font-semibold">Other shoot files</div>
                      <div className="space-y-2">
                        {downloadModel.unassignedDownloads.map(renderLinkDownload)}
                      </div>
                    </section>
                  )}

                  {downloadModel.tourDownloads.length > 0 && (
                    <section className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="mb-3 font-semibold">Tours and floorplans</div>
                      <div className="space-y-2">
                        {downloadModel.tourDownloads.map(renderLinkDownload)}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end border-t px-5 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isDownloading ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
