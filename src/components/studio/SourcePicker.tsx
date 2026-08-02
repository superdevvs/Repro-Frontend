import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Search, Trash2, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  studioService,
  type SourceMedia,
  type StudioShootRef,
  type UploadedMedia,
  type WorkflowId,
} from '@/services/studioService';

import { SectionError } from './feedback/StudioFeedback';

export interface StudioSourceSelection {
  sourceType: 'shoot' | 'upload';
  shoot?: StudioShootRef;
  fileIds?: number[];
  uploads?: UploadedMedia[];
}

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'];

export function acceptedMimeTypesForWorkflow(workflowId: WorkflowId): readonly string[] {
  return ['video-cleanup', 'listing-video', 'reel-generator'].includes(workflowId)
    ? VIDEO_MIME_TYPES
    : PHOTO_MIME_TYPES;
}

/** Shared by file-control and drag/drop so both entry paths accept identical inputs. */
export function partitionSourceFiles(files: readonly File[], workflowId: WorkflowId) {
  const allowed = acceptedMimeTypesForWorkflow(workflowId);
  return files.reduce<{ accepted: File[]; rejected: File[] }>(
    (result, file) => {
      result[allowed.includes(file.type) ? 'accepted' : 'rejected'].push(file);
      return result;
    },
    { accepted: [], rejected: [] },
  );
}

export function pendingUploadRefs(uploads: readonly UploadedMedia[]): string[] {
  return uploads.map((upload) => upload.mediaRef);
}

export function SourcePicker({
  workflowId,
  value,
  onChange,
  className,
}: {
  workflowId: WorkflowId;
  value: StudioSourceSelection | null;
  onChange: (value: StudioSourceSelection | null) => void;
  className?: string;
}) {
  const [sourceType, setSourceType] = useState<'shoot' | 'upload'>(
    value?.sourceType ?? 'shoot',
  );
  const [shootQuery, setShootQuery] = useState('');
  const [shoots, setShoots] = useState<StudioShootRef[]>([]);
  const [selectedShoot, setSelectedShoot] = useState<StudioShootRef | null>(
    value?.shoot ?? null,
  );
  const [media, setMedia] = useState<SourceMedia[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(value?.fileIds ?? []),
  );
  const [uploads, setUploads] = useState<UploadedMedia[]>(value?.uploads ?? []);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [rejections, setRejections] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (shootQuery.trim().length < 2) {
      setShoots([]);
      return;
    }
    const timer = window.setTimeout(() => {
      studioService
        .searchShoots(shootQuery)
        .then(setShoots)
        .catch(() => setError('Shoot search could not be loaded.'))
    }, 220);
    return () => window.clearTimeout(timer);
  }, [shootQuery]);

  useEffect(() => {
    if (!selectedShoot) {
      setMedia([]);
      return;
    }
    setBusy(true);
    studioService
      .getShootMedia(selectedShoot.id, workflowId)
      .then(setMedia)
      .catch(() => setError('Source media for this shoot could not be loaded.'))
      .finally(() => setBusy(false));
  }, [selectedShoot, workflowId]);

  useEffect(() => {
    if (sourceType === 'shoot') {
      onChange(
        selectedShoot && selectedIds.size > 0
          ? { sourceType, shoot: selectedShoot, fileIds: [...selectedIds] }
          : null,
      );
    } else {
      onChange(uploads.length > 0 ? { sourceType, uploads } : null);
    }
  }, [onChange, selectedIds, selectedShoot, sourceType, uploads]);

  const accept = useMemo(
    () => acceptedMimeTypesForWorkflow(workflowId).join(','),
    [workflowId],
  );

  const uploadFiles = async (files: File[]) => {
    const partition = partitionSourceFiles(files, workflowId);
    setRejections(partition.rejected.map((file) => `${file.name}: unsupported file type`));
    if (partition.accepted.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await studioService.upload(partition.accepted, workflowId, (id, pct) =>
        setProgress((current) => ({ ...current, [id]: pct })),
      );
      setUploads((current) => [...current, ...result.accepted]);
      setRejections((current) => [
        ...current,
        ...result.rejected.map(
          (file) => `${file.filename}: ${file.violations.map((item) => item.message).join(', ')}`,
        ),
      ]);
    } catch {
      setError('Upload failed. Choose the files again to retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn('space-y-4', className)} aria-labelledby="source-picker-heading">
      <div>
        <h3 id="source-picker-heading" className="text-sm font-semibold">
          Source media
        </h3>
        <p className="text-xs text-muted-foreground">
          Choose an authorized shoot or upload files for this workflow.
        </p>
      </div>
      <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
        {(['shoot', 'upload'] as const).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={sourceType === type}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium',
              sourceType === type ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => setSourceType(type)}
          >
            {type === 'shoot' ? 'From a shoot' : 'Upload files'}
          </button>
        ))}
      </div>

      {sourceType === 'shoot' ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={shootQuery}
              className="pl-9"
              placeholder="Search property ID or address"
              aria-label="Search authorized shoots"
              onChange={(event) => setShootQuery(event.target.value)}
            />
          </div>
          {shoots.length > 0 && !selectedShoot ? (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
              {shoots.map((shoot) => (
                <button
                  key={shoot.id}
                  type="button"
                  className="block w-full border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
                  onClick={() => {
                    setSelectedShoot(shoot);
                    setSelectedIds(new Set());
                  }}
                >
                  <span className="block font-medium">{shoot.label}</span>
                  <span className="block text-xs text-muted-foreground">{shoot.location}</span>
                </button>
              ))}
            </div>
          ) : null}
          {selectedShoot ? (
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{selectedShoot.label}</p>
                  <p className="text-xs text-muted-foreground">{selectedShoot.location}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedShoot(null)}>
                  Change
                </Button>
              </div>
              {busy ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Loading supported media…
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {media.map((item) => {
                    const checked = selectedIds.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={checked}
                        className={cn(
                          'relative aspect-[4/3] overflow-hidden rounded-lg border-2 bg-muted',
                          checked ? 'border-primary' : 'border-transparent',
                        )}
                        onClick={() =>
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                      >
                        <img src={item.thumbnailUrl} alt={item.filename} className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={cn(
              'flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center',
              dragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/20',
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void uploadFiles([...event.dataTransfer.files]);
            }}
          >
            <UploadCloud className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">Drop files here</p>
            <p className="mt-1 text-xs text-muted-foreground">{accept}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => fileInput.current?.click()}>
              <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Choose files
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={accept}
              className="sr-only"
              onChange={(event) => void uploadFiles([...(event.target.files ?? [])])}
            />
          </div>
          {Object.entries(progress).map(([id, pct]) => (
            <div key={id} className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading</span><span>{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          ))}
          {uploads.map((upload) => (
            <div key={upload.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{upload.filename}</p>
                <p className="text-xs text-muted-foreground">Ready</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${upload.filename}`}
                onClick={() => setUploads((current) => current.filter((item) => item.id !== upload.id))}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {rejections.length > 0 ? (
        <ul className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100">
          {rejections.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : null}
      {error ? <SectionError message={error} title="Source media needs attention" /> : null}
    </section>
  );
}

export default SourcePicker;

