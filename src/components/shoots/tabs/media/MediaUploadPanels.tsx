import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  Cloud,
  Folder,
  HardDrive,
  ImageIcon,
  Images,
  Link,
  Loader2,
  RefreshCcw,
  RefreshCw,
  Upload,
  UploadCloud,
} from 'lucide-react';

export interface UploadIssue {
  id: string;
  fileName: string;
  errorType: string;
  message: string;
  retryable: boolean;
  nextStep?: string | null;
}

interface UploadProgressCardProps {
  fileCount: number;
  fileNames: string[];
  progress: number;
  note: string;
}

export function UploadProgressCard({
  fileCount,
  fileNames,
  progress,
  note,
}: UploadProgressCardProps) {
  return (
    <div className="space-y-3 border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">
          Uploading {fileCount} file{fileCount !== 1 ? 's' : ''}... {progress}%
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="max-h-32 overflow-y-auto space-y-1">
        {fileNames.map((name, index) => {
          const filesDone = Math.floor((progress / 100) * fileCount);
          const isDone = index < filesDone;
          return (
            <div key={index} className="flex items-center gap-2 text-xs py-1">
              <div className="flex-shrink-0">
                {isDone ? (
                  <svg className="h-4 w-4 text-green-500" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>
              <span className={`truncate flex-1 ${isDone ? 'text-muted-foreground' : ''}`}>{name}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

interface UploadDropzoneProps {
  empty: boolean;
  accept: string;
  inputId: string;
  /**
   * Optional stable `data-testid` for the underlying file `<input>`. Used by the photographer
   * onboarding QA harness selector contract (e.g. `raw-upload-input`). Distinct from `inputId`,
   * which remains the per-shoot HTML element id used by the `<label htmlFor>` association.
   */
  inputTestId?: string;
  title: string;
  description: string;
  buttonLabel: string;
  browseLabel: string;
  onBrowse: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilesPicked?: (files: File[]) => void;
  sourceImport?: UploadSourceImportConfig;
}

type UploadSourceProvider = 'dropbox' | 'google_drive' | 'google_photos' | 'onedrive';

interface UploadSourceImportConfig {
  shootId: string | number;
  uploadType: 'raw' | 'edited';
  getPayload?: () => Record<string, unknown>;
  onImported?: () => void;
  disabled?: boolean;
}

interface UploadSourceStatus {
  provider: UploadSourceProvider;
  label: string;
  configured: boolean;
  connected: boolean;
  account_type?: 'personal' | 'shared' | null;
  account_email?: string | null;
  account_name?: string | null;
  expired?: boolean;
  supports_oauth?: boolean;
  message?: string | null;
}

interface UploadSourceItem {
  id: string;
  name: string;
  path?: string;
  is_folder?: boolean;
  mime_type?: string | null;
  size?: number | null;
  modified?: string | null;
  thumbnail_url?: string | null;
  item_count?: number | null;
}

const SOURCE_PROVIDER_LABELS: Record<UploadSourceProvider, string> = {
  dropbox: 'Dropbox',
  google_drive: 'Google Drive',
  google_photos: 'Google Photos',
  onedrive: 'OneDrive',
};

// External upload sources (cloud providers + "From link") depend on the
// `api/upload-sources` backend route, which is not yet available in production.
// Until that ships, only the client-side sources (device, camera) are shown.
// Flip this back to `true` to restore the full source list.
const EXTERNAL_UPLOAD_SOURCES_ENABLED = false;

const formatSourceFileSize = (bytes?: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getUploadSourceErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function UploadDropzone({
  empty,
  accept,
  inputId,
  inputTestId,
  title,
  description,
  buttonLabel,
  browseLabel,
  onBrowse,
  onDrop,
  onDragOver,
  onFileSelect,
  onFilesPicked,
  sourceImport,
}: UploadDropzoneProps) {
  return empty ? (
    <div className="flex flex-1 min-h-[250px] flex-col gap-3 md:flex-row">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-card p-8 text-center shadow-sm transition-colors hover:border-primary/50"
      >
        <input
          type="file"
          multiple
          accept={accept}
          onChange={onFileSelect}
          className="hidden"
          id={inputId}
          data-testid={inputTestId}
        />
        <label htmlFor={inputId} className="flex w-full cursor-pointer flex-col items-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <ImageIcon className="h-10 w-10 text-primary/60" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">{title}</h3>
          <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">{description}</p>
          <Button
            type="button"
            variant="default"
            size="lg"
            className="bg-primary hover:bg-primary/90"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBrowse();
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        </label>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="cursor-pointer rounded-lg border-2 border-dashed p-3 text-center transition-colors hover:border-primary/50"
      >
        <input
          type="file"
          multiple
          accept={accept}
          onChange={onFileSelect}
          className="hidden"
          id={inputId}
          data-testid={inputTestId}
        />
        <label htmlFor={inputId} className="flex cursor-pointer items-center justify-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <div className="text-xs text-muted-foreground">{browseLabel}</div>
        </label>
      </div>
    </div>
  );
}

function UploadSourceActions({
  compact = false,
  onBrowse,
  onFilesPicked,
  sourceImport,
}: {
  compact?: boolean;
  accept: string;
  inputId: string;
  onBrowse: () => void;
  onFilesPicked?: (files: File[]) => void;
  sourceImport: UploadSourceImportConfig;
}) {
  const { toast } = useToast();
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [browserProvider, setBrowserProvider] = React.useState<UploadSourceProvider | null>(null);
  const [statuses, setStatuses] = React.useState<Record<string, UploadSourceStatus>>({});
  const [loadingStatuses, setLoadingStatuses] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const refreshStatuses = React.useCallback(async () => {
    if (!EXTERNAL_UPLOAD_SOURCES_ENABLED) return;
    setLoadingStatuses(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/upload-sources`, { headers: getApiHeaders() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Could not load upload sources.');
      setStatuses(payload.providers || {});
    } catch (error) {
      toast({
        title: 'Upload sources unavailable',
        description: getUploadSourceErrorMessage(error, 'Could not load connected source accounts.'),
        variant: 'destructive',
      });
    } finally {
      setLoadingStatuses(false);
    }
  }, [toast]);

  React.useEffect(() => {
    refreshStatuses();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'upload-source-connected') {
        refreshStatuses();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refreshStatuses]);

  const importSource = React.useCallback(async (payload: Record<string, unknown>) => {
    setImporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shoots/${sourceImport.shootId}/upload-from-source`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          upload_type: sourceImport.uploadType,
          ...(sourceImport.getPayload?.() || {}),
          ...payload,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.errors?.[0]?.message || 'Source import failed.');
      }
      toast({
        title: data.error_count > 0 ? 'Imported with issues' : 'Source import complete',
        description: `${data.success_count || 0} file${data.success_count === 1 ? '' : 's'} imported${data.error_count ? `, ${data.error_count} failed` : ''}.`,
        variant: data.error_count > 0 ? 'destructive' : undefined,
      });
      sourceImport.onImported?.();
      setLinkOpen(false);
      setBrowserProvider(null);
    } catch (error) {
      toast({
        title: 'Source import failed',
        description: getUploadSourceErrorMessage(error, 'Could not import from this source.'),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }, [sourceImport, toast]);

  const sources = [
    { id: 'device', label: 'From device', icon: Folder, onClick: onBrowse },
    { id: 'link', label: 'From link', icon: Link, onClick: () => setLinkOpen(true) },
    { id: 'camera', label: 'Camera', icon: Camera, onClick: () => setCameraOpen(true) },
    { id: 'dropbox', label: 'Dropbox', icon: Cloud, onClick: () => setBrowserProvider('dropbox') },
    { id: 'google_drive', label: 'Google Drive', icon: HardDrive, onClick: () => setBrowserProvider('google_drive') },
    { id: 'google_photos', label: 'Google Photos', icon: Images, onClick: () => setBrowserProvider('google_photos') },
    { id: 'onedrive', label: 'OneDrive', icon: Cloud, onClick: () => setBrowserProvider('onedrive') },
  ].filter((source) => EXTERNAL_UPLOAD_SOURCES_ENABLED || source.id === 'device');

  return (
    <div className={cn(
      'rounded-lg border bg-background p-2',
      compact ? 'flex flex-wrap gap-1.5' : 'md:w-52 md:shrink-0',
    )}>
      <div className={cn(compact ? 'hidden' : 'mb-2 flex items-center justify-between px-2 text-xs font-medium text-muted-foreground')}>
        <span>Upload from</span>
        {loadingStatuses && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      <div className={cn(compact ? 'flex flex-wrap gap-1.5' : 'flex flex-col gap-1')}>
        {sources.map(({ id, label, icon: Icon, onClick }) => {
          const status = statuses[id];
          return (
            <button
              key={id}
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
                compact && 'border px-2 py-1.5 text-xs',
              )}
              disabled={sourceImport.disabled || importing}
              title={status?.account_email || status?.message || label}
              onClick={onClick}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{label}</span>
              {status?.connected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>

      <LinkImportDialog
        open={linkOpen}
        importing={importing}
        onOpenChange={setLinkOpen}
        onImport={(url) => importSource({ source_type: 'url', urls: [url] })}
      />
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCaptured={(file) => {
          onFilesPicked?.([file]);
          setCameraOpen(false);
        }}
      />
      {browserProvider && (
        <CloudSourceDialog
          provider={browserProvider}
          status={statuses[browserProvider]}
          importing={importing}
          onStatusesRefresh={refreshStatuses}
          onOpenChange={(open) => {
            if (!open) setBrowserProvider(null);
          }}
          onImport={(items) => importSource({ source_type: 'provider', provider: browserProvider, items })}
        />
      )}
    </div>
  );
}

function LinkImportDialog({
  open,
  importing,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  importing: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (url: string) => void;
}) {
  const [url, setUrl] = React.useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import From Link</DialogTitle>
          <DialogDescription>Paste a direct image, video, PDF, or RAW file URL.</DialogDescription>
        </DialogHeader>
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/photo.jpg"
          disabled={importing}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onImport(url.trim())} disabled={importing || !url.trim()}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CameraCaptureDialog({
  open,
  onOpenChange,
  onCaptured,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaptured: (file: File) => void;
}) {
  const { toast } = useToast();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<BlobPart[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [recording, setRecording] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      recordedChunksRef.current = [];
      setRecording(false);
      return;
    }

    setLoading(true);
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((error) => {
        toast({
          title: 'Camera unavailable',
          description: getUploadSourceErrorMessage(error, 'Allow camera access to capture a photo.'),
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [open, toast]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCaptured(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      toast({
        title: 'Video recording unavailable',
        description: 'This browser does not support camera video recording.',
        variant: 'destructive',
      });
      return;
    }

    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
      onCaptured(new File([blob], `camera-${Date.now()}.webm`, { type: blob.type }));
      recordedChunksRef.current = [];
      setRecording(false);
    };
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Camera</DialogTitle>
          <DialogDescription>Capture a photo or short video and add it to the selected upload queue.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border bg-muted">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <video ref={videoRef} className="aspect-video w-full bg-black object-cover" playsInline muted />
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={recording ? stopRecording : startRecording} disabled={loading}>
            {recording ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stop Video
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Record Video
              </>
            )}
          </Button>
          <Button type="button" onClick={capture} disabled={loading || recording}>
            <Camera className="mr-2 h-4 w-4" />
            Capture Photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloudSourceDialog({
  provider,
  status,
  importing,
  onStatusesRefresh,
  onOpenChange,
  onImport,
}: {
  provider: UploadSourceProvider;
  status?: UploadSourceStatus;
  importing: boolean;
  onStatusesRefresh: () => void;
  onOpenChange: (open: boolean) => void;
  onImport: (items: UploadSourceItem[]) => void;
}) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<UploadSourceItem[]>([]);
  const [selected, setSelected] = React.useState<Record<string, UploadSourceItem>>({});
  const [loading, setLoading] = React.useState(false);
  const [location, setLocation] = React.useState<Record<string, string>>({});

  const loadItems = React.useCallback(async (nextLocation = location) => {
    if (!status?.connected) return;
    setLoading(true);
    try {
      const query = new URLSearchParams(nextLocation);
      const response = await fetch(`${API_BASE_URL}/api/upload-sources/${provider}/items?${query}`, {
        headers: getApiHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Could not load source files.');
      setItems(payload.items || []);
      setLocation(nextLocation);
      setSelected({});
    } catch (error) {
      toast({
        title: `${SOURCE_PROVIDER_LABELS[provider]} unavailable`,
        description: getUploadSourceErrorMessage(error, 'Could not browse this source.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [location, provider, status?.connected, toast]);

  React.useEffect(() => {
    loadItems({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, status?.connected]);

  const connect = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/upload-sources/${provider}/connect`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ account_type: 'personal' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Could not start connection.');
      window.open(payload.auth_url, 'upload-source-connect', 'width=720,height=760');
      window.setTimeout(onStatusesRefresh, 1200);
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: getUploadSourceErrorMessage(error, 'Could not start provider connection.'),
        variant: 'destructive',
      });
    }
  };

  const openFolder = (item: UploadSourceItem) => {
    if (provider === 'dropbox') {
      loadItems({ path: item.path || '' });
    } else if (provider === 'google_photos') {
      loadItems({ album_id: item.id });
    } else {
      loadItems({ folder_id: item.id });
    }
  };

  const selectedItems = Object.values(selected);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{SOURCE_PROVIDER_LABELS[provider]}</DialogTitle>
          <DialogDescription>
            {status?.connected
              ? `${status.account_type === 'shared' ? 'Using shared account' : 'Using connected account'}${status.account_email ? `: ${status.account_email}` : ''}.`
              : status?.message || 'Connect an account to browse files.'}
          </DialogDescription>
        </DialogHeader>

        {!status?.connected ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 p-6 text-center">
            <Cloud className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              {status?.configured ? 'Connect your account to choose files.' : status?.message}
            </div>
            <Button type="button" onClick={connect} disabled={!status?.configured}>
              Connect {SOURCE_PROVIDER_LABELS[provider]}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => loadItems({})} disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Root
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => loadItems(location)} disabled={loading}>
                <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              {loading ? (
                <div className="flex min-h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No files found.</div>
              ) : (
                <div className="divide-y">
                  {items.map((item) => {
                    const isSelected = Boolean(selected[item.id]);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted',
                          isSelected && 'bg-primary/10',
                        )}
                        onClick={() => {
                          if (item.is_folder) {
                            openFolder(item);
                            return;
                          }
                          setSelected((current) => {
                            const next = { ...current };
                            if (next[item.id]) delete next[item.id];
                            else next[item.id] = item;
                            return next;
                          });
                        }}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                          {item.is_folder ? <Folder className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{item.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {item.is_folder ? `${item.item_count ?? ''} items` : [item.mime_type, formatSourceFileSize(item.size)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {!item.is_folder && (
                          <span className={cn(
                            'flex h-5 w-5 items-center justify-center rounded border',
                            isSelected && 'border-primary bg-primary text-primary-foreground',
                          )}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          {status?.connected && (
            <Button type="button" onClick={() => onImport(selectedItems)} disabled={importing || selectedItems.length === 0}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Import {selectedItems.length} File{selectedItems.length === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UploadResultsPanelProps {
  title: string;
  issues: UploadIssue[];
  onRetryAll?: () => void;
  onRetryIssue?: (issueId: string) => void;
}

export function UploadResultsPanel({
  title,
  issues,
  onRetryAll,
  onRetryIssue,
}: UploadResultsPanelProps) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
            <AlertTriangle className="h-4 w-4" />
            <span>{title}</span>
          </div>
          <p className="text-xs text-rose-700">
            {issues.length} file{issues.length === 1 ? '' : 's'} need attention.
          </p>
        </div>
        {onRetryAll && issues.some((issue) => issue.retryable) && (
          <Button type="button" size="sm" variant="outline" onClick={onRetryAll}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry Failed
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {issues.map((issue) => (
          <div key={issue.id} className="rounded-md border border-rose-200 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{issue.fileName}</p>
                <p className="mt-1 text-sm text-slate-700">{issue.message}</p>
                {issue.nextStep && (
                  <p className="mt-1 text-xs text-slate-500">{issue.nextStep}</p>
                )}
              </div>
              {issue.retryable && onRetryIssue && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onRetryIssue(issue.id)}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
