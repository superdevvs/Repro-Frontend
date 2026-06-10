import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertCircle,
  Download,
  Image as ImageIcon,
  Loader2,
  Play,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { API_BASE_URL } from '@/config/env';
import { getImageUrl, type ImageUrlFields } from '@/utils/imageUrl';
import {
  useCancelReelJob,
  useReelJob,
  useReelJobs,
  useSubmitReel,
} from '@/hooks/useReel';
import type { ReelJob, ReelOutput } from '@/services/reelService';
import { cn } from '@/lib/utils';

// Reels are short-form vertical videos; keep a sensible client-side selection
// range. The backend remains the source of truth and surfaces 422 validation
// errors for anything outside its accepted bounds (Req 10.4).
const MIN_PICK = 3;
const MAX_PICK = 15;

interface ShootOption {
  id: number;
  address: string;
  status: string;
  photo_count?: number;
  thumbnail?: string | null;
  created_at: string;
}

interface MediaFile extends ImageUrlFields {
  id: number;
  filename: string;
  fileType?: string;
  mediaType?: string;
  created_at?: string;
}

const STATUS_LABEL: Record<ReelJob['status'], string> = {
  queued: 'Queued',
  processing: 'Processing',
  stitching: 'Stitching',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const isActiveJob = (job?: ReelJob | null) =>
  Boolean(job && ['queued', 'processing', 'stitching'].includes(job.status));

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${API_BASE_URL}/${value.replace(/^\/+/, '')}`;
};

const parseShoots = (responses: any[]): ShootOption[] => {
  const shootsById = new Map<number, ShootOption>();
  responses.forEach((response) => {
    const items = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    items.forEach((shoot: any) => {
      const id = Number(shoot.id);
      if (!Number.isFinite(id)) return;
      shootsById.set(id, {
        id,
        address: shoot.address || shoot.property_address || `Shoot #${id}`,
        status: shoot.workflowStatus || shoot.workflow_status || shoot.status || 'pending',
        photo_count:
          shoot.photo_count ??
          shoot.photoCount ??
          shoot.edited_photo_count ??
          shoot.raw_photo_count ??
          shoot.media_summary?.editedUploaded ??
          shoot.files_count ??
          0,
        thumbnail:
          shoot.thumbnail ||
          shoot.hero_image ||
          shoot.heroImage ||
          shoot.cover_image ||
          (Array.isArray(shoot.preview_images) ? shoot.preview_images[0] : null),
        created_at: shoot.created_at || shoot.createdAt || new Date().toISOString(),
      });
    });
  });

  return Array.from(shootsById.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

const isSupportedImageFile = (file: any) => {
  const name = String(file.filename || file.stored_filename || '').toLowerCase();
  const mime = String(file.fileType || file.file_type || file.mime_type || '').toLowerCase();
  return mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|tiff|tif|heic|heif)$/i.test(name);
};

function ReelJobPanel({ jobId }: { jobId: number | null }) {
  const { data: job } = useReelJob(jobId);
  if (!job) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4" />
            Reel #{job.id}
          </CardTitle>
          <CardDescription>{job.shoot?.address || `Shoot #${job.shoot_id}`}</CardDescription>
        </div>
        <Badge variant={job.status === 'failed' ? 'destructive' : job.status === 'completed' ? 'default' : 'secondary'}>
          {STATUS_LABEL[job.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isActiveJob(job) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              {job.status === 'stitching' ? 'Assembling your reel' : 'Generating reel from selected media'}
            </span>
          </div>
        )}

        {job.status === 'failed' && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>{job.error_message || 'Reel generation failed.'}</span>
          </div>
        )}

        {job.status === 'completed' && job.outputs && <OutputLinks outputs={job.outputs} />}
      </CardContent>
    </Card>
  );
}

function OutputLinks({ outputs }: { outputs: Record<string, ReelOutput> }) {
  const entries = Object.entries(outputs);
  if (entries.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, output]) => (
        <Button key={key} asChild variant="outline" className="h-auto justify-start gap-2 py-3">
          <a href={resolveAssetUrl(output.url)} target="_blank" rel="noopener noreferrer" download>
            <Download className="h-4 w-4" />
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{output.label || key}</span>
              <span className="block text-xs text-muted-foreground">Download MP4</span>
            </span>
          </a>
        </Button>
      ))}
    </div>
  );
}

function ReelJobsList({ onSelectJob }: { onSelectJob: (jobId: number) => void }) {
  const { data, isLoading } = useReelJobs({ per_page: 20 });
  const cancelJob = useCancelReelJob();
  const jobs = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
        <Video className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">No reels yet</h3>
          <p className="text-sm text-muted-foreground">Create a short-form vertical reel from a shoot's media.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Card key={job.id} className="transition-shadow hover:shadow-sm">
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => onSelectJob(job.id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                {job.selected_files?.[0]?.thumb_url ? (
                  <img
                    src={resolveAssetUrl(job.selected_files[0].thumb_url)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Video className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                {isActiveJob(job) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                {job.status === 'completed' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <Play className="h-5 w-5 fill-white text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{job.shoot?.address || `Shoot #${job.shoot_id}`}</p>
                  <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {STATUS_LABEL[job.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {job.selected_file_ids?.length || 0} clips · {format(new Date(job.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </button>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              {job.status === 'completed' && job.outputs && (
                <Button size="sm" variant="outline" onClick={() => onSelectJob(job.id)}>
                  Downloads
                </Button>
              )}
              {isActiveJob(job) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => cancelJob.mutate(job.id)}
                  disabled={cancelJob.isPending}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ReelGenerator() {
  const { toast } = useToast();
  const submitReel = useSubmitReel();

  const [shoots, setShoots] = useState<ShootOption[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [shootSearch, setShootSearch] = useState('');
  const [selectedShoot, setSelectedShoot] = useState<ShootOption | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [loadingShoots, setLoadingShoots] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadShoots = async () => {
      setLoadingShoots(true);
      try {
        const responses = await Promise.all([
          apiClient.get('/shoots', { params: { per_page: 200, tab: 'scheduled', no_cache: true } }),
          apiClient.get('/shoots', { params: { per_page: 200, tab: 'completed', no_cache: true } }),
          apiClient.get('/shoots', { params: { per_page: 200, tab: 'delivered', no_cache: true } }),
        ]);
        if (mounted) setShoots(parseShoots(responses.map((response) => response.data)));
      } catch (error) {
        console.error('Failed to load shoots for reels', error);
        toast({ title: 'Error', description: 'Failed to load shoots.', variant: 'destructive' });
      } finally {
        if (mounted) setLoadingShoots(false);
      }
    };
    void loadShoots();
    return () => {
      mounted = false;
    };
  }, [toast]);

  useEffect(() => {
    if (!selectedShoot) {
      setFiles([]);
      setSelectedFileIds([]);
      return;
    }

    let mounted = true;
    const loadFiles = async () => {
      setLoadingFiles(true);
      try {
        const responses = await Promise.all([
          apiClient.get(`/shoots/${selectedShoot.id}/files`, { params: { type: 'raw' } }),
          apiClient.get(`/shoots/${selectedShoot.id}/files`, { params: { type: 'edited' } }),
        ]);
        const filesById = new Map<number, MediaFile>();
        responses.forEach((response) => {
          const items = Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
          items.filter(isSupportedImageFile).forEach((file: any) => {
            const id = Number(file.id);
            if (!Number.isFinite(id) || filesById.has(id)) return;
            filesById.set(id, {
              id,
              filename: file.filename || file.stored_filename || `file-${id}`,
              url: file.url,
              path: file.path,
              thumb_url: file.thumb_url || file.thumb || file.thumbnail_url,
              medium_url: file.medium_url || file.medium || file.web_url,
              large_url: file.large_url || file.large || file.original_url,
              original_url: file.original_url || file.original,
              fileType: file.fileType || file.file_type,
              mediaType: file.mediaType || file.media_type,
              created_at: file.created_at || file.createdAt,
            });
          });
        });
        if (mounted) setFiles(Array.from(filesById.values()));
      } catch (error) {
        console.error('Failed to load reel source files', error);
        toast({ title: 'Error', description: 'Failed to load shoot photos.', variant: 'destructive' });
      } finally {
        if (mounted) setLoadingFiles(false);
      }
    };
    void loadFiles();
    return () => {
      mounted = false;
    };
  }, [selectedShoot, toast]);

  const filteredShoots = useMemo(() => {
    const term = shootSearch.trim().toLowerCase();
    if (!term) return shoots;
    return shoots.filter((shoot) => shoot.address.toLowerCase().includes(term) || String(shoot.id).includes(term));
  }, [shootSearch, shoots]);

  const selectedCount = selectedFileIds.length;
  const canSubmit = Boolean(selectedShoot) && selectedCount >= MIN_PICK && selectedCount <= MAX_PICK && !submitReel.isPending;

  const toggleFile = (fileId: number) => {
    setValidationError(null);
    setSelectedFileIds((current) => {
      if (current.includes(fileId)) {
        return current.filter((id) => id !== fileId);
      }
      if (current.length >= MAX_PICK) {
        return current;
      }
      return [...current, fileId];
    });
  };

  const handleSubmit = async () => {
    if (!selectedShoot || !canSubmit) return;
    setValidationError(null);

    try {
      const job = await submitReel.mutateAsync({
        shoot_id: selectedShoot.id,
        selected_file_ids: selectedFileIds,
      });
      setActiveJobId(job.id);
      toast({
        title: 'Reel started',
        description: `Generating a reel from ${selectedFileIds.length} selected media files.`,
      });
    } catch (error: any) {
      // Surface backend validation (422) inline and via toast; create no job.
      if (error?.response?.status === 422) {
        const errors = error.response.data?.errors;
        const firstFieldError =
          errors && typeof errors === 'object'
            ? (Object.values(errors)[0] as string[] | undefined)?.[0]
            : undefined;
        const message =
          firstFieldError || error.response.data?.message || 'The reel request failed validation.';
        setValidationError(message);
        toast({ title: 'Invalid reel request', description: message, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Failed to start reel',
        description: error?.response?.data?.message || error?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="h-5 w-5" />
              AI reel generator
            </CardTitle>
            <CardDescription>
              Pick a shoot and {MIN_PICK}-{MAX_PICK} photos to produce a short-form vertical reel.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            fal.ai
          </Badge>
        </CardHeader>
      </Card>

      <ReelJobPanel jobId={activeJobId} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">1. Choose a shoot</CardTitle>
                <CardDescription>Select the property that contains the source photos.</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={shootSearch}
                  onChange={(event) => setShootSearch(event.target.value)}
                  placeholder="Search shoots..."
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingShoots ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                  {filteredShoots.map((shoot) => {
                    const thumbUrl = resolveAssetUrl(shoot.thumbnail);
                    const selected = selectedShoot?.id === shoot.id;
                    return (
                      <button
                        key={shoot.id}
                        type="button"
                        onClick={() => {
                          setSelectedShoot(shoot);
                          setSelectedFileIds([]);
                          setValidationError(null);
                        }}
                        className={cn(
                          'flex gap-3 rounded-lg border bg-card p-2 text-left transition hover:border-primary/40',
                          selected && 'border-primary ring-2 ring-primary/30',
                        )}
                      >
                        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                          {thumbUrl ? (
                            <img src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold">{shoot.address}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{shoot.photo_count || 0} photos</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">2. Pick photos in order</CardTitle>
                <CardDescription>
                  Tap {MIN_PICK}-{MAX_PICK} photos. The badge number is the reel sequence.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedCount >= MIN_PICK ? 'default' : 'secondary'}>
                  {selectedCount}/{MAX_PICK}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={selectedCount === 0}
                  onClick={() => setSelectedFileIds([])}
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedShoot ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Choose a shoot first.</p>
                </div>
              ) : loadingFiles ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
                  ))}
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No supported image files found for this shoot.</p>
                </div>
              ) : (
                <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {files.map((file) => {
                    const order = selectedFileIds.indexOf(file.id);
                    const selected = order >= 0;
                    const imageUrl = getImageUrl(file, 'thumb');
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => toggleFile(file.id)}
                        className={cn(
                          'group relative overflow-hidden rounded-lg border bg-muted transition',
                          selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/40',
                        )}
                      >
                        <div className="aspect-[4/3]">
                          {imageUrl ? (
                            <img src={imageUrl} alt={file.filename} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {selected && (
                          <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {order + 1}
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-left text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {file.filename}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Generate reel</CardTitle>
              <CardDescription>We assemble a short-form vertical reel from your selected media.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Selected clips</span>
                  <span className="font-semibold">{selectedCount}</span>
                </div>
              </div>

              {selectedCount < MIN_PICK && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                  <span>
                    Select {MIN_PICK - selectedCount} more photo{MIN_PICK - selectedCount === 1 ? '' : 's'} to continue.
                  </span>
                </div>
              )}

              {validationError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                  <span>{validationError}</span>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!canSubmit}>
                {submitReel.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate reel
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent reels</CardTitle>
              <CardDescription>Track progress and download completed reels.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReelJobsList onSelectJob={setActiveJobId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ReelGenerator;
