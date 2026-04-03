import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, X } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useUpload } from '@/context/UploadContext';
import {
  triggerDashboardOverviewRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
  triggerShootListRefresh,
} from '@/realtime/realtimeRefreshBus';
import { UploadDropzone, UploadProgressCard } from './MediaUploadPanels';

type ShootMediaServiceObject = {
  name?: string;
  service_name?: string;
  title?: string;
  count?: number | string;
  quantity?: number | string;
  photo_count?: number | string;
};

type ShootWithMediaServiceObjects = ShootData & {
  serviceObjects?: ShootMediaServiceObject[];
  service_objects?: ShootMediaServiceObject[];
  editor_notes?: string;
  editorNotes?: string;
  expectedRawCount?: number | string;
  expectedFinalCount?: number | string;
  expected_raw_count?: number | string;
  expected_final_count?: number | string;
};

type UploadQueueMediaType =
  | 'floorplan'
  | 'extra'
  | 'virtual_staging'
  | 'green_grass'
  | 'twilight'
  | 'drone';

type QueueClassificationMap = Record<string, UploadQueueMediaType | undefined>;

type UploadClassificationOption = {
  type: UploadQueueMediaType;
  label: string;
  title: string;
  activeClassName: string;
  inactiveClassName: string;
  photoOnly?: boolean;
};

const FULL_UPLOAD_ACCEPT = 'image/*,video/*,application/pdf,.pdf,.raw,.cr2,.cr3,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.pef,.rw2,.srw,.3fr,.fff,.iiq,.rwl,.x3f,.erf,.kdc,.mef,.mos,.mrw,.bay,.bmq,.cap,.cine,.dc2,.dcr,.drf,.eip,.gpr,.mdc,.mdf,.mrw,.obm,.ptx,.pxn,.r3d,.rdc,.rmf';

const TRACKED_MEDIA_TYPES: UploadQueueMediaType[] = [
  'extra',
  'virtual_staging',
  'green_grass',
  'twilight',
  'drone',
  'floorplan',
];

const UPLOAD_CLASSIFICATION_OPTIONS: UploadClassificationOption[] = [
  {
    type: 'floorplan',
    label: 'FP',
    title: 'Floorplan',
    activeClassName: 'bg-blue-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
    photoOnly: true,
  },
  {
    type: 'virtual_staging',
    label: 'VS',
    title: 'Virtual Staging',
    activeClassName: 'bg-violet-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
    photoOnly: true,
  },
  {
    type: 'green_grass',
    label: 'GG',
    title: 'Green Grass',
    activeClassName: 'bg-emerald-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
    photoOnly: true,
  },
  {
    type: 'twilight',
    label: 'TW',
    title: 'Twilight',
    activeClassName: 'bg-indigo-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
    photoOnly: true,
  },
  {
    type: 'drone',
    label: 'DR',
    title: 'Drone',
    activeClassName: 'bg-sky-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
  {
    type: 'extra',
    label: 'EX',
    title: 'Extra',
    activeClassName: 'bg-amber-500 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
];

const MEDIA_TYPE_CARD_LABELS: Record<UploadQueueMediaType, string> = {
  extra: 'EX',
  virtual_staging: 'VS',
  green_grass: 'GG',
  twilight: 'TW',
  drone: 'DR',
  floorplan: 'FP',
};

const triggerUploadRefreshes = (shootId: string | number) => {
  triggerShootDetailRefresh(shootId);
  triggerShootHistoryRefresh();
  triggerShootListRefresh();
  triggerDashboardOverviewRefresh();
};

function isVideoUpload(file: File): boolean {
  return Boolean(file.type && file.type.toLowerCase().startsWith('video/')) || /\.(mp4|mov|m4v|avi|mkv|wmv|webm|mpg|mpeg|3gp)$/i.test(file.name);
}

function isEditedFloorplanByName(name: string): boolean {
  const lower = name.toLowerCase();
  return ['floorplan', 'floor-plan', 'floor_plan', 'fp_', 'fp-', 'layout', 'blueprint'].some((p) => lower.includes(p));
}

function isHdrShoot(services: string[]): boolean {
  return Array.isArray(services) && services.some((service) => /\bhdr\b/i.test(service));
}

function toPositiveCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function extractPhotoCountFromLabel(label?: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+)\s*photo/i);
  return match ? Number(match[1]) : null;
}

function getServiceObjects(shoot: ShootData): ShootMediaServiceObject[] {
  const legacyShoot = shoot as ShootWithMediaServiceObjects;
  if (Array.isArray(legacyShoot.serviceObjects)) return legacyShoot.serviceObjects;
  if (Array.isArray(legacyShoot.service_objects)) return legacyShoot.service_objects;
  return [];
}

function resolveExpectedFinalCount(shoot: ShootData): number {
  const legacyShoot = shoot as ShootWithMediaServiceObjects;
  const directCandidates = [
    legacyShoot.expectedFinalCount,
    legacyShoot.expected_final_count,
    shoot.package?.expectedDeliveredCount,
  ];

  for (const candidate of directCandidates) {
    const parsed = toPositiveCount(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }

  const serviceObjects = getServiceObjects(shoot);
  const serviceObjectCount = serviceObjects.reduce((sum, service) => {
    const count = toPositiveCount(service.photo_count ?? service.count ?? service.quantity);
    return sum + (count ?? 0);
  }, 0);
  if (serviceObjectCount > 0) return serviceObjectCount;

  const services = Array.isArray(shoot.services) ? shoot.services : [];
  const serviceCount = services.reduce((sum, service) => sum + (extractPhotoCountFromLabel(service) ?? 0), 0);
  return serviceCount > 0 ? serviceCount : 0;
}

function resolveExpectedRawCount(shoot: ShootData, bracketMultiplier: number): number {
  const legacyShoot = shoot as ShootWithMediaServiceObjects;
  const directCandidates = [legacyShoot.expectedRawCount, legacyShoot.expected_raw_count];

  for (const candidate of directCandidates) {
    const parsed = toPositiveCount(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }

  return resolveExpectedFinalCount(shoot) * bracketMultiplier;
}

function extractPhotoServicesFromServiceObjects(shoot: ShootData): Array<{ name: string; count: number }> {
  const photoServices: Array<{ name: string; count: number }> = [];
  const serviceObjects = getServiceObjects(shoot);
  if (!Array.isArray(serviceObjects)) return photoServices;

  serviceObjects.forEach((service) => {
    const name = String(service?.name || service?.service_name || service?.title || '').trim();
    const count = toPositiveCount(service?.photo_count ?? service?.count ?? service?.quantity);
    if (name && count && count > 0 && !/video/i.test(name)) {
      photoServices.push({ name, count });
    }
  });

  return photoServices;
}

function extractPhotoServicesFromServices(services: string[]): Array<{ name: string; count: number }> {
  return (services || [])
    .map((service) => String(service || '').trim())
    .filter(Boolean)
    .filter((service) => !/video/i.test(service))
    .map((service) => {
      const count = extractPhotoCountFromLabel(service);
      return count ? { name: service, count } : null;
    })
    .filter((service): service is { name: string; count: number } => service !== null);
}

function isTrackedMediaType(value: string | null | undefined): value is UploadQueueMediaType {
  return TRACKED_MEDIA_TYPES.includes(String(value || '').toLowerCase() as UploadQueueMediaType);
}

function createEmptyMediaTypeCounts(): Record<UploadQueueMediaType, number> {
  return {
    extra: 0,
    virtual_staging: 0,
    green_grass: 0,
    twilight: 0,
    drone: 0,
    floorplan: 0,
  };
}

function getQueueFileKey(file: File, _index: number): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function getExistingMediaTypeCounts(files: MediaFile[]): Record<UploadQueueMediaType, number> {
  return files.reduce((counts, file) => {
    const mediaType = String(file.media_type || '').toLowerCase();
    if (isTrackedMediaType(mediaType)) {
      counts[mediaType] += 1;
      return counts;
    }

    if (file.isExtra) {
      counts.extra += 1;
    }

    return counts;
  }, createEmptyMediaTypeCounts());
}

function getQueueMediaTypeCounts(
  files: File[],
  classifications: QueueClassificationMap,
): Record<UploadQueueMediaType, number> {
  return files.reduce((counts, file, index) => {
    const classification = classifications[getQueueFileKey(file, index)];
    if (classification) {
      counts[classification] += 1;
    }
    return counts;
  }, createEmptyMediaTypeCounts());
}

function getQueueClassification(
  file: File,
  index: number,
  classifications: QueueClassificationMap,
): UploadQueueMediaType | undefined {
  return classifications[getQueueFileKey(file, index)];
}

function reindexClassificationMap(files: File[], classifications: QueueClassificationMap): QueueClassificationMap {
  const nextMap: QueueClassificationMap = {};
  files.forEach((file, index) => {
    const key = getQueueFileKey(file, index);
    const existingValue = classifications[key];
    if (existingValue) {
      nextMap[key] = existingValue;
    }
  });
  return nextMap;
}

function addFilesToClassificationMap(
  currentFiles: File[],
  nextFiles: File[],
  classifications: QueueClassificationMap,
  defaultResolver?: (file: File) => UploadQueueMediaType | undefined,
): QueueClassificationMap {
  const preservedMap = reindexClassificationMap(currentFiles, classifications);
  const nextMap: QueueClassificationMap = { ...preservedMap };

  nextFiles.forEach((file, index) => {
    const key = getQueueFileKey(file, index);
    if (nextMap[key]) {
      return;
    }

    const defaultType = defaultResolver?.(file);
    if (defaultType) {
      nextMap[key] = defaultType;
    }
  });

  return nextMap;
}

function setQueueClassification(
  file: File,
  index: number,
  mediaType: UploadQueueMediaType,
  classifications: QueueClassificationMap,
): QueueClassificationMap {
  const nextMap = { ...classifications };
  const key = getQueueFileKey(file, index);
  if (nextMap[key] === mediaType) {
    delete nextMap[key];
  } else {
    nextMap[key] = mediaType;
  }
  return nextMap;
}

function getMediaTypeCards(counts: Record<UploadQueueMediaType, number>) {
  return TRACKED_MEDIA_TYPES
    .filter((mediaType) => counts[mediaType] > 0)
    .map((mediaType) => ({
      type: mediaType,
      label: MEDIA_TYPE_CARD_LABELS[mediaType],
      count: counts[mediaType],
    }));
}

function CircularProgress({ progress }: { progress: number }) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="3" className="text-muted/30" fill="none" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        stroke="currentColor"
        strokeWidth="3"
        className="text-primary"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="24" textAnchor="middle" className="fill-current text-[10px] font-semibold text-foreground">
        {safeProgress}%
      </text>
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'info';
}) {
  const toneClassName =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10'
      : tone === 'info'
        ? 'border-primary/30 bg-primary/10'
        : 'border-border bg-card';

  return (
    <div className={`rounded-lg border p-3 ${toneClassName}`}>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function UploadClassificationButtons({
  file,
  index,
  classifications,
  onToggle,
  compact = false,
}: {
  file: File;
  index: number;
  classifications: QueueClassificationMap;
  onToggle: (file: File, index: number, mediaType: UploadQueueMediaType) => void;
  compact?: boolean;
}) {
  const isVideo = isVideoUpload(file);
  const buttonClassName = compact ? 'rounded px-1.5 py-0.5 text-[9px]' : 'rounded px-2 py-1 text-[10px]';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {UPLOAD_CLASSIFICATION_OPTIONS.map((option) => {
        const isActive = getQueueClassification(file, index, classifications) === option.type;
        const isDisabled = Boolean(isVideo && option.photoOnly);

        return (
          <button
            key={option.type}
            type="button"
            className={`${buttonClassName} font-semibold transition-colors ${
              isActive ? option.activeClassName : option.inactiveClassName
            } ${isDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
            onClick={() => {
              if (isDisabled) return;
              onToggle(file, index, option.type);
            }}
            disabled={isDisabled}
            title={isDisabled ? `${option.title} is only available for photo uploads` : option.title}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function EditedUploadSection({
  shoot,
  onUploadComplete,
  isEditor,
  editedFiles = [],
}: {
  shoot: ShootData;
  onUploadComplete: () => void;
  isEditor?: boolean;
  editedFiles?: MediaFile[];
}) {
  const { toast } = useToast();
  const { trackUpload } = useUpload();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [queueClassifications, setQueueClassifications] = useState<QueueClassificationMap>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const inputId = `edited-upload-input-${shoot.id}`;

  const expectedCount = useMemo(() => resolveExpectedFinalCount(shoot), [shoot]);
  const existingCounts = useMemo(() => getExistingMediaTypeCounts(editedFiles), [editedFiles]);
  const queueCounts = useMemo(
    () => getQueueMediaTypeCounts(selectedFiles, queueClassifications),
    [queueClassifications, selectedFiles],
  );

  useEffect(() => {
    setSelectedFiles([]);
    setQueueClassifications({});
    setUploadProgress(0);
    setIsUploading(false);
    setNotes('');
  }, [shoot.id]);

  const combinedCounts = useMemo(() => {
    const nextCounts = createEmptyMediaTypeCounts();
    TRACKED_MEDIA_TYPES.forEach((mediaType) => {
      nextCounts[mediaType] = existingCounts[mediaType] + queueCounts[mediaType];
    });
    return nextCounts;
  }, [existingCounts, queueCounts]);

  const uploadedCount = editedFiles.length + selectedFiles.length;
  const specialCountCards = useMemo(() => getMediaTypeCards(combinedCounts), [combinedCounts]);

  const mergeSelectedFiles = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;

    setSelectedFiles((currentFiles) => {
      const nextFiles = [...currentFiles, ...incomingFiles];
      setQueueClassifications((currentMap) =>
        addFilesToClassificationMap(currentFiles, nextFiles, currentMap, (file) =>
          !isVideoUpload(file) && isEditedFloorplanByName(file.name) ? 'floorplan' : undefined,
        ),
      );
      return nextFiles;
    });
  };

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((_, index) => index !== indexToRemove);
      setQueueClassifications((currentMap) => reindexClassificationMap(nextFiles, currentMap));
      return nextFiles;
    });
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0 || isUploading) {
      return;
    }

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];

    toast({
      title: 'Edited upload started',
      description: `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's are' : ' is'} uploading in background.`,
    });

    setIsUploading(true);
    setUploadProgress(0);

    const filesForUpload = [...selectedFiles];
    const classificationsForUpload = { ...queueClassifications };
    const uploadNote = notes.trim();

    trackUpload({
      shootId: String(shoot.id),
      shootAddress: shoot.location?.fullAddress || shoot.location?.address || `Shoot #${shoot.id}`,
      fileCount: filesForUpload.length,
      fileNames: filesForUpload.map((file) => file.name),
      uploadType: 'edited',
      uploadFn: async (onProgress) => {
        try {
          const uploadOne = (file: File, index: number): Promise<{ success: boolean; error?: string }> =>
            new Promise((resolve) => {
              const formData = new FormData();
              const mediaType = getQueueClassification(file, index, classificationsForUpload);
              formData.append('files[]', file);
              formData.append('upload_type', 'edited');
              if (uploadNote) {
                formData.append('editor_notes', uploadNote);
              }
              if (isVideoUpload(file)) {
                formData.append('service_category', 'video');
              }
              if (mediaType) {
                formData.append('media_type', mediaType);
                if (mediaType === 'extra') {
                  formData.append('is_extra', '1');
                }
              }

              const xhr = new XMLHttpRequest();
              xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve({ success: true });
                  return;
                }

                let message = 'Upload failed';
                try {
                  message = JSON.parse(xhr.responseText).message || message;
                } catch {
                  // Keep generic message when server response is not JSON.
                }
                resolve({ success: false, error: `${file.name}: ${message}` });
              });
              xhr.addEventListener('error', () => resolve({ success: false, error: `${file.name}: Network error` }));
              xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
              if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
              if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
              xhr.send(formData);
            });

          const concurrentUploads = 1;
          let completed = 0;
          const errors: string[] = [];

          for (let index = 0; index < filesForUpload.length; index += concurrentUploads) {
            const batch = filesForUpload.slice(index, index + concurrentUploads);
            const results = await Promise.all(batch.map((file, batchIndex) => uploadOne(file, index + batchIndex)));
            results.forEach((result) => {
              completed += 1;
              if (!result.success && result.error) {
                errors.push(result.error);
              }
            });

            const progressValue = Math.round((completed / filesForUpload.length) * 100);
            setUploadProgress(progressValue);
            onProgress(progressValue);
          }

          if (errors.length === filesForUpload.length) {
            throw new Error(errors[0] || 'All files failed to upload');
          }

          triggerUploadRefreshes(shoot.id);
          setSelectedFiles([]);
          setQueueClassifications({});
          setNotes('');
          onUploadComplete();
        } finally {
          setIsUploading(false);
        }
      },
    });
  };

  const progressValue = expectedCount > 0 ? Math.min(100, Math.round((uploadedCount / expectedCount) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Expected" value={expectedCount} />
        <SummaryCard label="Uploaded" value={uploadedCount} tone="info" />
        {specialCountCards.map((card) => (
          <SummaryCard key={card.type} label={card.label} value={card.count} tone="success" />
        ))}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <CircularProgress progress={progressValue} />
            <div>
              <div className="text-sm font-medium text-foreground">Edited delivery progress</div>
              <div className="text-xs text-muted-foreground">
                {expectedCount > 0
                  ? `${uploadedCount} of ${expectedCount} expected edited files ready`
                  : `${uploadedCount} edited file${uploadedCount !== 1 ? 's' : ''} queued or uploaded`}
              </div>
            </div>
          </div>
          {isEditor && (
            <div className="text-xs text-muted-foreground">
              Editors can mark deliverables here before uploading, and those tags remain editable afterward.
            </div>
          )}
        </div>
      </div>

      {isUploading && selectedFiles.length > 0 && (
        <UploadProgressCard
          fileCount={selectedFiles.length}
          fileNames={selectedFiles.map((file) => file.name)}
          progress={uploadProgress}
          note="Edited files are uploading in the background. You can switch shoots and continue working."
        />
      )}

      <UploadDropzone
        empty={selectedFiles.length === 0}
        accept={FULL_UPLOAD_ACCEPT}
        inputId={inputId}
        title="Upload Edited Media"
        description="Drag and drop edited deliverables here. Use the quick markers below to tag VS, GG, TW, DR, FP, or EX before sending."
        buttonLabel="Choose Edited Files"
        browseLabel="Drag and drop more edited files here or click to browse"
        onBrowse={() => document.getElementById(inputId)?.click()}
        onDrop={(event) => {
          event.preventDefault();
          mergeSelectedFiles(Array.from(event.dataTransfer.files || []));
        }}
        onDragOver={(event) => event.preventDefault()}
        onFileSelect={(event) => {
          mergeSelectedFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }}
      />

      {selectedFiles.length > 0 && (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Selected Files ({selectedFiles.length})</div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={getQueueFileKey(file, index)} className="rounded-lg border bg-background px-3 py-2">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {isVideoUpload(file) ? 'Video file' : 'Photo / image file'}
                    </div>
                  </div>
                  <UploadClassificationButtons
                    file={file}
                    index={index}
                    classifications={queueClassifications}
                    onToggle={(targetFile, targetIndex, mediaType) =>
                      setQueueClassifications((currentMap) =>
                        setQueueClassification(targetFile, targetIndex, mediaType, currentMap),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeSelectedFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Notes (Optional)</div>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any notes about this edited upload..."
              className="min-h-[96px]"
            />
          </div>

          <Button type="button" className="w-full" onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading Edited Files
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Edited Files
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export function RawUploadSection({
  shoot,
  onUploadComplete,
}: {
  shoot: ShootData;
  onUploadComplete: () => void;
}) {
  const { toast } = useToast();
  const { trackUpload, uploads } = useUpload();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [queueClassifications, setQueueClassifications] = useState<QueueClassificationMap>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const inputId = `raw-upload-input-${shoot.id}`;
  const shootServices = Array.isArray(shoot.services) ? shoot.services : [];
  const shootRequiresBrackets = isHdrShoot(shootServices);
  const shootHasVideoService = useMemo(
    () => shootServices.some((service) => /video/i.test(String(service))),
    [shootServices],
  );

  const serviceObjects = useMemo(() => extractPhotoServicesFromServiceObjects(shoot), [shoot]);
  const photoServices = useMemo(() => {
    if (serviceObjects.length > 0) {
      return serviceObjects;
    }

    return extractPhotoServicesFromServices(shootServices);
  }, [serviceObjects, shootServices]);

  const defaultBracketMultiplier =
    toPositiveCount(shoot.bracketMode ?? shoot.package?.bracketMode) ??
    (shootRequiresBrackets ? 5 : 1);
  const [bracketMultiplier, setBracketMultiplier] = useState<number>(Math.max(1, defaultBracketMultiplier));

  const existingCounts = useMemo(() => createEmptyMediaTypeCounts(), []);
  const queueCounts = useMemo(
    () => getQueueMediaTypeCounts(selectedFiles, queueClassifications),
    [queueClassifications, selectedFiles],
  );
  const expectedCount = useMemo(
    () => resolveExpectedRawCount(shoot, bracketMultiplier),
    [bracketMultiplier, shoot],
  );
  const uploadedCount = selectedFiles.length;
  const existingRawCount = toPositiveCount(shoot.rawPhotoCount) ?? 0;
  const totalRawCount = existingRawCount + uploadedCount;
  const missingCount = expectedCount > 0 ? Math.max(0, expectedCount - totalRawCount) : 0;
  const combinedCounts = useMemo(() => {
    const nextCounts = createEmptyMediaTypeCounts();
    TRACKED_MEDIA_TYPES.forEach((mediaType) => {
      nextCounts[mediaType] = existingCounts[mediaType] + queueCounts[mediaType];
    });
    return nextCounts;
  }, [existingCounts, queueCounts]);
  const specialCountCards = useMemo(() => getMediaTypeCards(combinedCounts), [combinedCounts]);
  const activeUploads = useMemo(
    () => uploads.filter((upload) => upload.shootId === String(shoot.id) && upload.uploadType === 'raw' && upload.status === 'uploading'),
    [shoot.id, uploads],
  );

  useEffect(() => {
    setSelectedFiles([]);
    setQueueClassifications({});
    setUploadProgress(0);
    setIsUploading(false);
    setNotes('');
    setBracketMultiplier(Math.max(1, defaultBracketMultiplier));
  }, [defaultBracketMultiplier, shoot.id]);

  const mergeSelectedFiles = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;

    setSelectedFiles((currentFiles) => {
      const nextFiles = [...currentFiles, ...incomingFiles];
      setQueueClassifications((currentMap) =>
        addFilesToClassificationMap(currentFiles, nextFiles, currentMap, (file) =>
          !isVideoUpload(file) && isEditedFloorplanByName(file.name) ? 'floorplan' : undefined,
        ),
      );
      return nextFiles;
    });
  };

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((_, index) => index !== indexToRemove);
      setQueueClassifications((currentMap) => reindexClassificationMap(nextFiles, currentMap));
      return nextFiles;
    });
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0 || isUploading) {
      return;
    }

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];
    const filesForUpload = [...selectedFiles];
    const classificationsForUpload = { ...queueClassifications };
    const noteValue = notes.trim();

    toast({
      title: 'Raw upload started',
      description: `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's are' : ' is'} uploading in background.`,
    });

    setIsUploading(true);
    setUploadProgress(0);

    trackUpload({
      shootId: String(shoot.id),
      shootAddress: shoot.location?.fullAddress || shoot.location?.address || `Shoot #${shoot.id}`,
      fileCount: filesForUpload.length,
      fileNames: filesForUpload.map((file) => file.name),
      uploadType: 'raw',
      uploadFn: async (onProgress) => {
        try {
          const uploadOne = (file: File, index: number): Promise<{ success: boolean; error?: string }> =>
            new Promise((resolve) => {
              const formData = new FormData();
              const mediaType = getQueueClassification(file, index, classificationsForUpload);
              formData.append('files[]', file);
              formData.append('upload_type', 'raw');
              formData.append('bracket_mode', String(bracketMultiplier));
              if (noteValue) {
                formData.append('photographer_notes', noteValue);
              }
              if (isVideoUpload(file)) {
                formData.append('service_category', 'video');
              }
              if (mediaType) {
                formData.append('media_type', mediaType);
                if (mediaType === 'extra') {
                  formData.append('is_extra', '1');
                }
              }

              const xhr = new XMLHttpRequest();
              xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve({ success: true });
                  return;
                }

                let message = 'Upload failed';
                try {
                  message = JSON.parse(xhr.responseText).message || message;
                } catch {
                  // Keep the generic message when the upload response is not JSON.
                }
                resolve({ success: false, error: `${file.name}: ${message}` });
              });
              xhr.addEventListener('error', () => resolve({ success: false, error: `${file.name}: Network error` }));
              xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
              if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
              if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
              xhr.send(formData);
            });

          const concurrentUploads = 1;
          let completed = 0;
          const errors: string[] = [];

          for (let index = 0; index < filesForUpload.length; index += concurrentUploads) {
            const batch = filesForUpload.slice(index, index + concurrentUploads);
            const results = await Promise.all(batch.map((file, batchIndex) => uploadOne(file, index + batchIndex)));
            results.forEach((result) => {
              completed += 1;
              if (!result.success && result.error) {
                errors.push(result.error);
              }
            });

            const progressValue = Math.round((completed / filesForUpload.length) * 100);
            setUploadProgress(progressValue);
            onProgress(progressValue);
          }

          if (errors.length === filesForUpload.length) {
            throw new Error(errors[0] || 'All files failed to upload');
          }

          triggerUploadRefreshes(shoot.id);
          setSelectedFiles([]);
          setQueueClassifications({});
          setNotes('');
          onUploadComplete();
        } finally {
          setIsUploading(false);
        }
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col space-y-3">
      {shootRequiresBrackets && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium text-foreground">Bracket Type</div>
          <div className="flex flex-wrap gap-2">
            {[3, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  bracketMultiplier === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setBracketMultiplier(value)}
              >
                {value}-Bracket
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border bg-muted/40 p-2">
          <div className="text-muted-foreground">Expected</div>
          <div className="text-base font-semibold text-foreground">{expectedCount}</div>
          {photoServices.length > 0 && (
            <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
              {photoServices.map((service) => (
                <div key={`${service.name}-${service.count}`}>
                  {service.name}: {shootRequiresBrackets ? service.count * bracketMultiplier : service.count}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-md border bg-muted/40 p-2">
          <div className="text-muted-foreground">Existing</div>
          <div className="text-base font-semibold text-foreground">{totalRawCount}</div>
        </div>
        <div className="rounded-md border bg-muted/40 p-2">
          <div className="text-muted-foreground">Selected</div>
          <div className="text-base font-semibold text-foreground">{uploadedCount}</div>
        </div>
        <div className="rounded-md border bg-muted/40 p-2">
          <div className="text-muted-foreground">Tagged Extras</div>
          <div className="text-base font-semibold text-foreground">{queueCounts.extra}</div>
        </div>
        {specialCountCards
          .filter((card) => card.type !== 'extra')
          .map((card) => (
            <div key={card.type} className="rounded-md border bg-muted/40 p-2">
              <div className="text-muted-foreground">{card.label}</div>
              <div className="text-base font-semibold text-foreground">{card.count}</div>
            </div>
          ))}
      </div>

      {missingCount > 0 && totalRawCount > 0 && (
        <div className="rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
          {missingCount} photo(s) missing. Expected {expectedCount}
          {shootRequiresBrackets ? ` (${resolveExpectedFinalCount(shoot)} final x ${bracketMultiplier} brackets)` : ''}
          , but only {totalRawCount} selected or uploaded so far.
        </div>
      )}

      {activeUploads.length > 0
        ? activeUploads.map((activeUpload) => (
            <UploadProgressCard
              key={activeUpload.id}
              fileCount={activeUpload.fileCount}
              fileNames={activeUpload.fileNames}
              progress={activeUpload.progress}
              note="You can close this dialog while upload continues in the background."
            />
          ))
        : isUploading && selectedFiles.length > 0 && (
            <UploadProgressCard
              fileCount={selectedFiles.length}
              fileNames={selectedFiles.map((file) => file.name)}
              progress={uploadProgress}
              note="Raw uploads continue in the background. You can leave this shoot and keep working elsewhere."
            />
          )}

      <UploadDropzone
        empty={selectedFiles.length === 0}
        accept={FULL_UPLOAD_ACCEPT}
        inputId={inputId}
        title="No uploaded files yet"
        description={`${
          shootHasVideoService ? 'Upload photos and videos to get started.' : 'Upload photos to get started.'
        } You can drag and drop files or use the upload button.`}
        buttonLabel="Upload Files"
        browseLabel="Drag and drop more raw files here or click to browse"
        onBrowse={() => document.getElementById(inputId)?.click()}
        onDrop={(event) => {
          event.preventDefault();
          mergeSelectedFiles(Array.from(event.dataTransfer.files || []));
        }}
        onDragOver={(event) => event.preventDefault()}
        onFileSelect={(event) => {
          mergeSelectedFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }}
      />

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <span>Selected Files ({selectedFiles.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              (FP = floorplan, VS = virtual staging, GG = green grass, TW = twilight, DR = drone, EX = extra)
            </span>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
            {selectedFiles.map((file, index) => (
              <div key={getQueueFileKey(file, index)} className="rounded-md p-2 transition-colors hover:bg-muted/40">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs">{file.name}</div>
                  </div>
                  <UploadClassificationButtons
                    file={file}
                    index={index}
                    classifications={queueClassifications}
                    compact
                    onToggle={(targetFile, targetIndex, mediaType) =>
                      setQueueClassifications((currentMap) =>
                        setQueueClassification(targetFile, targetIndex, mediaType, currentMap),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeSelectedFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="text-sm font-medium text-foreground">Notes for Editor (Optional)</div>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any notes for the editor..."
              className="min-h-[60px] max-h-[84px] resize-none"
            />
          </div>

          <Button type="button" className="w-full" onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading Raw Files
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Raw Files
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
