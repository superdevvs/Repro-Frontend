import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Cloud,
  Image as ImageIcon,
  Layers,
  Loader2,
  Move3D,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { autoenhanceService } from '@/services/autoenhanceService';
import { getImageUrl, normalizeImageUrl, type ImageUrlFields } from '@/utils/imageUrl';
import type { EnhancementModeId } from '@/components/studio/types';
import { cn } from '@/lib/utils';

/**
 * Maximum number of files a single batch may contain. Mirrors `MAX_BATCH_SIZE`
 * in `AiEditing.tsx`; kept here (and exported) so the pure validation helper and
 * its tests can share the bound without importing the page module (Req 11.5).
 */
export const MAX_BATCH_SIZE = 100;

export interface BatchValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Pure client-side guard for a batch submission. Rejects an empty selection
 * (Req 11.4) and a selection larger than {@link MAX_BATCH_SIZE} (Req 11.5)
 * before any request is made. Exactly {@link MAX_BATCH_SIZE} files is accepted.
 *
 * Exported on its own so it can be unit/property tested in isolation (task 9.2).
 */
export function validateBatchSelection(fileIds: readonly number[] | null | undefined): BatchValidationResult {
  const count = fileIds?.length ?? 0;
  if (count === 0) {
    return { ok: false, error: 'Select at least one photo before submitting a batch.' };
  }
  if (count > MAX_BATCH_SIZE) {
    return {
      ok: false,
      error: `A batch is limited to ${MAX_BATCH_SIZE} photos — remove ${count - MAX_BATCH_SIZE} to continue.`,
    };
  }
  return { ok: true };
}

interface BatchEnhancementMode {
  id: EnhancementModeId;
  name: string;
  description: string;
  icon: React.ElementType;
}

// The enhancement modes available for a batch submission. Mirrors the photo
// workspace modes; HDR bracket merge is intentionally excluded since batches
// submit one job per file rather than grouping files into brackets.
const BATCH_MODES: BatchEnhancementMode[] = [
  { id: 'enhance', name: 'Enhance', description: 'Balanced AI enhancement for listing photos.', icon: Sparkles },
  { id: 'sky_replace', name: 'Sky Replacement', description: 'Swap dull skies for clear blue or twilight.', icon: Cloud },
  { id: 'vertical_correction', name: 'Vertical Correction', description: 'Straighten converging vertical lines.', icon: Move3D },
  { id: 'window_pull', name: 'Window Pull', description: 'Recover blown-out window exteriors.', icon: Sun },
];

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
  isAiEdited?: boolean;
}

interface BatchJobsPanelProps {
  /** Enhancement mode preselected when arriving from a feature card. */
  initialMode?: EnhancementModeId;
  /** Shoot preselected when arriving from a deep-link. */
  initialShoot?: { id: number; address: string } | null;
  /** Notify the parent when a batch was submitted (e.g. to refresh activity). */
  onSubmitted?: (submittedCount: number) => void;
}

const ALLOWED_EXT = /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif|nef|cr2|cr3|crw|arw|dng|raf|orf|rw2|nrw|sr2|srf|pef|x3f|3fr|fff|iiq|mrw|mef|kdc|dcr|erf|rwl)$/i;

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
          shoot.raw_photo_count ??
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

const buildBatchParams = (mode: EnhancementModeId): Record<string, any> => {
  const params: Record<string, any> = {
    editing_options: [mode],
    enhance: mode === 'enhance',
    vertical_correction: mode === 'vertical_correction',
    lens_correction: true,
  };
  if (mode === 'sky_replace') {
    params.sky_replacement = true;
    params.cloud_type = 'CLEAR';
  }
  if (mode === 'window_pull') {
    params.window_pull_type = 'ONLY_WINDOWS';
  }
  return params;
};

/**
 * Batch AI Jobs surface (Req 11.1–11.5). Lets a Client pick a shoot, select up
 * to {@link MAX_BATCH_SIZE} files and an enhancement mode, then submits a single
 * `autoenhanceService.submitEditing` request — the backend creates one
 * `AiEditingJob` per file — and reports the submitted count. Rendered in place
 * under the Photo Subtab when the batch capability is active.
 */
export function BatchJobsPanel({ initialMode = 'enhance', initialShoot, onSubmitted }: BatchJobsPanelProps) {
  const { toast } = useToast();

  const [shoots, setShoots] = useState<ShootOption[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [shootSearch, setShootSearch] = useState('');
  const [selectedShoot, setSelectedShoot] = useState<ShootOption | null>(
    initialShoot ? { id: initialShoot.id, address: initialShoot.address, status: 'pending', created_at: new Date().toISOString() } : null,
  );
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<EnhancementModeId>(initialMode);
  const [loadingShoots, setLoadingShoots] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        console.error('Failed to load shoots for batch jobs', error);
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
      setSelectedFileIds(new Set());
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
        responses.forEach((response, payloadIndex) => {
          const items = Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data)
              ? response.data
              : [];
          items
            .filter((file: any) => ALLOWED_EXT.test(file.filename || file.stored_filename || ''))
            .forEach((file: any) => {
              const id = Number(file.id);
              if (!Number.isFinite(id)) return;
              // Keep the raw-bucket entry if the edited pass repeats the id.
              if (filesById.has(id) && payloadIndex === 1) return;
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
                isAiEdited: file.is_ai_edited === true,
              });
            });
        });
        if (mounted) {
          // Prefer raw (un-edited) source files for batch enhancement.
          const all = Array.from(filesById.values());
          const raw = all.filter((file) => !file.isAiEdited);
          setFiles(raw.length > 0 ? raw : all);
          setSelectedFileIds(new Set());
        }
      } catch (error) {
        console.error('Failed to load batch source files', error);
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

  const selectedCount = selectedFileIds.size;
  const validation = useMemo(() => validateBatchSelection(Array.from(selectedFileIds)), [selectedFileIds]);
  const canSubmit = Boolean(selectedShoot) && validation.ok && !submitting;

  const toggleFile = (fileId: number) => {
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const selectFirstUpToMax = () => {
    if (files.length === 0) return;
    if (files.length > MAX_BATCH_SIZE) {
      toast({
        title: 'Large batch',
        description: `Selecting ${MAX_BATCH_SIZE} of ${files.length} photos. Submit additional batches if needed.`,
      });
    }
    setSelectedFileIds(new Set(files.slice(0, MAX_BATCH_SIZE).map((file) => file.id)));
  };

  const handleSubmit = async () => {
    if (!selectedShoot) return;

    const fileIds = Array.from(selectedFileIds);
    // Client-side guard — block invalid submissions before any request (Req 11.4, 11.5).
    const result = validateBatchSelection(fileIds);
    if (!result.ok) {
      toast({ title: 'Cannot submit batch', description: result.error, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // The backend creates one AiEditingJob per file id, so a single call
      // submits the whole batch (Req 11.2).
      await autoenhanceService.submitEditing({
        shoot_id: selectedShoot.id,
        file_ids: fileIds,
        editing_type: mode,
        params: buildBatchParams(mode),
      });
      // Report the count of jobs successfully submitted (Req 11.3).
      toast({
        title: 'Batch submitted',
        description: `${fileIds.length} job${fileIds.length === 1 ? '' : 's'} queued. Track progress in Activity.`,
      });
      setSelectedFileIds(new Set());
      onSubmitted?.(fileIds.length);
    } catch (error: any) {
      const description =
        error?.response?.data?.message || error?.message || 'Failed to submit the batch.';
      toast({ title: 'Submission failed', description, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Layers className="h-5 w-5" />
              Batch AI jobs
            </CardTitle>
            <CardDescription>
              Pick a shoot and up to {MAX_BATCH_SIZE} photos, choose a mode, and submit them all at once.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            Up to {MAX_BATCH_SIZE}
          </Badge>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
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
                    const thumbUrl = normalizeImageUrl(shoot.thumbnail);
                    const selected = selectedShoot?.id === shoot.id;
                    return (
                      <button
                        key={shoot.id}
                        type="button"
                        onClick={() => {
                          setSelectedShoot(shoot);
                          setSelectedFileIds(new Set());
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
                <CardTitle className="text-base">2. Select photos</CardTitle>
                <CardDescription>Tap photos to include them in the batch.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={validation.ok ? 'default' : 'secondary'}>
                  {selectedCount}/{MAX_BATCH_SIZE}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={files.length === 0}
                  onClick={selectFirstUpToMax}
                >
                  Select all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={selectedCount === 0}
                  onClick={() => setSelectedFileIds(new Set())}
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
                  <p className="text-sm text-muted-foreground">No supported photos found for this shoot.</p>
                </div>
              ) : (
                <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {files.map((file) => {
                    const selected = selectedFileIds.has(file.id);
                    const imageUrl = getImageUrl(file, 'thumb');
                    const atCap = !selected && selectedCount >= MAX_BATCH_SIZE;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => toggleFile(file.id)}
                        disabled={atCap}
                        className={cn(
                          'group relative overflow-hidden rounded-lg border bg-muted transition',
                          selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/40',
                          atCap && 'opacity-50 cursor-not-allowed',
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
                          <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            ✓
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
              <CardTitle className="text-base">3. Enhancement mode</CardTitle>
              <CardDescription>Applied to every photo in the batch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {BATCH_MODES.map((option) => {
                const Icon = option.icon;
                const active = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(option.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition',
                      active ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background',
                        active ? 'border-primary text-primary' : 'border-border text-foreground/80',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{option.name}</span>
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Submit batch</CardTitle>
              <CardDescription>One job is created per selected photo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Selected photos</span>
                  <span className="font-semibold">{selectedCount}</span>
                </div>
              </div>

              {!validation.ok && validation.error && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                  <span>{validation.error}</span>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Submit batch
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default BatchJobsPanel;
