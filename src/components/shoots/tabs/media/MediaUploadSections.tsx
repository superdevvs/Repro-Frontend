import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { UploadDropzone, UploadProgressCard, UploadResultsPanel, type UploadIssue } from './MediaUploadPanels';

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

const DEFAULT_UPLOAD_LIMITS = {
  perFileBytes: 2000 * 1024 * 1024,
  totalRequestBytes: 2200 * 1024 * 1024,
  perFileLabel: '2GB',
  totalRequestLabel: '2.2GB',
} as const;

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

const MEDIA_TYPE_SUMMARY_LABELS: Record<UploadQueueMediaType, string> = {
  extra: 'Extra',
  virtual_staging: 'Virtual Staging',
  green_grass: 'Green Grass',
  twilight: 'Twilight',
  drone: 'Drone',
  floorplan: 'Floorplan',
};

const createUploadBatchId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const triggerUploadRefreshes = (shootId: string | number) => {
  triggerShootDetailRefresh(shootId);
  triggerShootHistoryRefresh();
  triggerShootListRefresh();
  triggerDashboardOverviewRefresh();
};

function formatUploadFileSize(bytes?: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function parseUploadLimitToBytes(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^([\d.]+)\s*(b|kb|mb|gb)?$/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = (match[2] || 'b').toLowerCase();
  const multiplierMap: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  return Math.round(amount * (multiplierMap[unit] || 1));
}

function resolveUploadLimits(uploadLimits?: any) {
  return {
    perFileBytes: parseUploadLimitToBytes(uploadLimits?.per_file) ?? DEFAULT_UPLOAD_LIMITS.perFileBytes,
    totalRequestBytes:
      parseUploadLimitToBytes(uploadLimits?.total_request) ?? DEFAULT_UPLOAD_LIMITS.totalRequestBytes,
    perFileLabel: String(uploadLimits?.per_file || DEFAULT_UPLOAD_LIMITS.perFileLabel),
    totalRequestLabel: String(uploadLimits?.total_request || DEFAULT_UPLOAD_LIMITS.totalRequestLabel),
  };
}

function buildUploadLimitDescription(uploadLimits?: any): string | undefined {
  const resolved = resolveUploadLimits(uploadLimits);
  return `Limits: up to ${resolved.perFileLabel} per file, ${resolved.totalRequestLabel} per request. RAW formats like .NEF are supported.`;
}

function buildUploadSummary(issues: UploadIssue[]): string {
  if (issues.length === 0) {
    return 'Upload failed.';
  }

  const groupedCounts = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.errorType] = (acc[issue.errorType] || 0) + 1;
    return acc;
  }, {});
  const [primaryErrorType] = Object.entries(groupedCounts).sort((a, b) => b[1] - a[1])[0] || ['server_error'];
  const labelMap: Record<string, string> = {
    oversize: 'upload size limit exceeded',
    invalid_file: 'the files were rejected before upload completed',
    unsupported_format: 'unsupported file format',
    forbidden: 'you do not have permission to upload these files',
    invalid_workflow_stage: 'this shoot is not in an uploadable stage',
    storage_failure: 'storage processing failed after transfer',
    network_failure: 'the upload connection was interrupted',
    server_error: 'the server could not finish processing the files',
  };

  return `${issues.length} file${issues.length === 1 ? '' : 's'} failed: ${labelMap[primaryErrorType] || 'upload failed'}.`;
}

function parseUploadIssues(
  file: File,
  index: number,
  responseText?: string,
  fallbackMessage = 'Upload failed',
): { issues: UploadIssue[]; uploadLimits?: any } {
  let parsedPayload: any = null;
  if (responseText) {
    try {
      parsedPayload = JSON.parse(responseText);
    } catch {
      parsedPayload = null;
    }
  }

  const uploadLimits = parsedPayload?.upload_limits;
  const structuredErrors = Array.isArray(parsedPayload?.errors) ? parsedPayload.errors : [];

  if (structuredErrors.length > 0) {
    return {
      issues: structuredErrors.map((error: any, errorIndex: number) => ({
        id: `${getQueueFileKey(file, index)}::${errorIndex}`,
        fileName: error?.file_name || error?.filename || file.name,
        errorType: error?.error_type || parsedPayload?.error_type || 'server_error',
        message: error?.message || error?.error || parsedPayload?.message || fallbackMessage,
        retryable: Boolean(error?.retryable),
        nextStep: error?.next_step || null,
      })),
      uploadLimits,
    };
  }

  return {
    issues: [
      {
        id: getQueueFileKey(file, index),
        fileName: file.name,
        errorType: parsedPayload?.error_type || 'server_error',
        message: parsedPayload?.message || fallbackMessage,
        retryable: !['oversize', 'invalid_file', 'unsupported_format', 'forbidden', 'invalid_workflow_stage'].includes(
          parsedPayload?.error_type || '',
        ),
        nextStep: parsedPayload?.error_type === 'oversize'
          ? 'Reduce the file size or split the upload into smaller batches before retrying.'
          : parsedPayload?.error_type === 'invalid_workflow_stage'
            ? 'Move the shoot to an uploadable workflow stage before retrying.'
            : null,
      },
    ],
    uploadLimits,
  };
}

function mergeUploadIssueLists(existingIssues: UploadIssue[], nextIssues: UploadIssue[]): UploadIssue[] {
  const merged = new Map<string, UploadIssue>();
  existingIssues.forEach((issue) => merged.set(issue.id, issue));
  nextIssues.forEach((issue) => merged.set(issue.id, issue));
  return Array.from(merged.values());
}

function validateFilesAgainstUploadLimits(
  files: File[],
  existingFiles: File[] = [],
  uploadLimits?: any,
): { acceptedFiles: File[]; rejectedIssues: UploadIssue[] } {
  const resolved = resolveUploadLimits(uploadLimits);
  const acceptedFiles: File[] = [];
  const rejectedIssues: UploadIssue[] = [];
  let runningTotal = existingFiles.reduce((sum, file) => sum + (file.size || 0), 0);

  files.forEach((file, index) => {
    if ((file.size || 0) > resolved.perFileBytes) {
      rejectedIssues.push({
        id: getQueueFileKey(file, index),
        fileName: file.name,
        errorType: 'oversize',
        message: `${file.name} is ${formatUploadFileSize(file.size)} and exceeds the ${resolved.perFileLabel} per-file limit.`,
        retryable: false,
        nextStep: `Reduce the file size or split the work into smaller exports before retrying. The current per-file limit is ${resolved.perFileLabel}.`,
      });
      return;
    }

    if (runningTotal + (file.size || 0) > resolved.totalRequestBytes) {
      rejectedIssues.push({
        id: getQueueFileKey(file, index),
        fileName: file.name,
        errorType: 'oversize',
        message: `Adding ${file.name} would push this upload above the ${resolved.totalRequestLabel} total request limit.`,
        retryable: false,
        nextStep: `Split the upload into smaller batches that stay under ${resolved.totalRequestLabel} total per request.`,
      });
      return;
    }

    acceptedFiles.push(file);
    runningTotal += file.size || 0;
  });

  return { acceptedFiles, rejectedIssues };
}

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
      summaryLabel: MEDIA_TYPE_SUMMARY_LABELS[mediaType],
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
  className = '',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'info';
  className?: string;
}) {
  const toneClassName =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10'
      : tone === 'info'
        ? 'border-primary/30 bg-primary/10'
        : 'border-border bg-card';

  return (
    <div className={`rounded-lg border p-3 ${toneClassName} ${className}`.trim()}>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SummaryBadge({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1">
      <span className="text-[11px] font-medium text-foreground/90">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
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
  showInlineProgress = true,
}: {
  shoot: ShootData;
  onUploadComplete: () => void;
  isEditor?: boolean;
  editedFiles?: MediaFile[];
  showInlineProgress?: boolean;
}) {
  const { toast } = useToast();
  const { trackUpload } = useUpload();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [queueClassifications, setQueueClassifications] = useState<QueueClassificationMap>({});
  const [uploadIssues, setUploadIssues] = useState<UploadIssue[]>([]);
  const [uploadLimitHint, setUploadLimitHint] = useState<string | undefined>(buildUploadLimitDescription({
    per_file: '2GB',
    total_request: '2.2GB',
  }));
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
    setUploadIssues([]);
    setUploadProgress(0);
    setIsUploading(false);
    setNotes('');
    setUploadLimitHint(buildUploadLimitDescription({
      per_file: '2GB',
      total_request: '2.2GB',
    }));
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

    const validation = validateFilesAgainstUploadLimits(incomingFiles, selectedFiles);

    if (validation.rejectedIssues.length > 0) {
      setUploadIssues((currentIssues) => mergeUploadIssueLists(currentIssues, validation.rejectedIssues));
      toast({
        title: validation.acceptedFiles.length > 0 ? 'Some files were skipped' : 'Files skipped',
        description: buildUploadSummary(validation.rejectedIssues),
        variant: 'destructive',
      });
    }

    if (validation.acceptedFiles.length === 0) {
      return;
    }

    const nextFiles = [...selectedFiles, ...validation.acceptedFiles];
    setSelectedFiles(nextFiles);
    setQueueClassifications((currentMap) =>
      addFilesToClassificationMap(selectedFiles, nextFiles, currentMap, (file) =>
        !isVideoUpload(file) && isEditedFloorplanByName(file.name) ? 'floorplan' : undefined,
      ),
    );
  };

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((_, index) => index !== indexToRemove);
      setQueueClassifications((currentMap) => reindexClassificationMap(nextFiles, currentMap));
      return nextFiles;
    });
  };

  const startUpload = (overrideFiles?: File[], overrideClassifications?: QueueClassificationMap) => {
    const nextFiles = overrideFiles ?? selectedFiles;
    if (nextFiles.length === 0 || isUploading) {
      return;
    }

    const preflightValidation = validateFilesAgainstUploadLimits(nextFiles);
    if (preflightValidation.rejectedIssues.length > 0) {
      setUploadIssues((currentIssues) => mergeUploadIssueLists(currentIssues, preflightValidation.rejectedIssues));
      toast({
        title: preflightValidation.acceptedFiles.length > 0 ? 'Some files were skipped' : 'Upload blocked',
        description: buildUploadSummary(preflightValidation.rejectedIssues),
        variant: 'destructive',
      });
    }

    if (preflightValidation.acceptedFiles.length === 0) {
      setSelectedFiles([]);
      setQueueClassifications({});
      setIsUploading(false);
      setUploadProgress(0);
      return;
    }

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];

    toast({
      title: 'Edited upload started',
      description: `${nextFiles.length} file${nextFiles.length !== 1 ? 's are' : ' is'} uploading in background.`,
    });

    setIsUploading(true);
    setUploadProgress(0);
    setUploadIssues([]);

    const filesForUpload = [...preflightValidation.acceptedFiles];
    const classificationsForUpload = reindexClassificationMap(
      filesForUpload,
      { ...(overrideClassifications ?? queueClassifications) },
    );
    const uploadNote = notes.trim();

    const uploadBatchId = filesForUpload.length > 1 ? createUploadBatchId() : null;

    trackUpload({
      shootId: String(shoot.id),
      shootAddress: shoot.location?.fullAddress || shoot.location?.address || `Shoot #${shoot.id}`,
      fileCount: filesForUpload.length,
      fileNames: filesForUpload.map((file) => file.name),
      uploadType: 'edited',
      uploadFn: async (onProgress) => {
        try {
          const uploadOne = (file: File, index: number): Promise<{ success: boolean; issues: UploadIssue[]; file: File; originalIndex: number; uploadLimits?: any }> =>
            new Promise((resolve) => {
              const formData = new FormData();
              const mediaType = getQueueClassification(file, index, classificationsForUpload);
              formData.append('files[]', file);
              formData.append('upload_type', 'edited');
              if (uploadBatchId) {
                formData.append('upload_batch_id', uploadBatchId);
                formData.append('upload_batch_total', String(filesForUpload.length));
                formData.append('upload_batch_index', String(index));
              }
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
                  let payload: any = {};
                  if (xhr.responseText) {
                    try {
                      payload = JSON.parse(xhr.responseText || '{}');
                    } catch {
                      payload = {};
                    }
                  }
                  setUploadLimitHint((currentHint) => buildUploadLimitDescription(payload?.upload_limits) || currentHint);
                  resolve({ success: true, issues: [], file, originalIndex: index, uploadLimits: payload?.upload_limits });
                  return;
                }

                const parsed = parseUploadIssues(file, index, xhr.responseText, 'Upload failed');
                resolve({ success: false, issues: parsed.issues, file, originalIndex: index, uploadLimits: parsed.uploadLimits });
              });
              xhr.addEventListener('error', () => resolve({
                success: false,
                issues: [
                  {
                    id: getQueueFileKey(file, index),
                    fileName: file.name,
                    errorType: 'network_failure',
                    message: 'The upload connection was interrupted before this file finished transferring.',
                    retryable: true,
                    nextStep: 'Retry this file after checking the network connection.',
                  },
                ],
                file,
                originalIndex: index,
              }));
              xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
              if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
              if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
              xhr.send(formData);
            });

          const concurrentUploads = 1;
          let completed = 0;
          const issues: UploadIssue[] = [];
          const failedFileEntries: Array<{ file: File; originalIndex: number }> = [];
          let latestUploadLimits: any = null;

          for (let index = 0; index < filesForUpload.length; index += concurrentUploads) {
            const batch = filesForUpload.slice(index, index + concurrentUploads);
            const results = await Promise.all(batch.map((file, batchIndex) => uploadOne(file, index + batchIndex)));
            results.forEach((result) => {
              completed += 1;
              if (result.uploadLimits) {
                latestUploadLimits = result.uploadLimits;
              }
              if (!result.success && result.issues.length > 0) {
                issues.push(...result.issues);
                failedFileEntries.push({ file: result.file, originalIndex: result.originalIndex });
              }
            });

            const progressValue = Math.round((completed / filesForUpload.length) * 100);
            setUploadProgress(progressValue);
            onProgress(progressValue);
          }

          const limitHint = buildUploadLimitDescription(latestUploadLimits) || uploadLimitHint;
          setUploadLimitHint(limitHint);

          if (failedFileEntries.length === filesForUpload.length) {
            setUploadIssues(issues);
            toast({
              title: 'Upload failed',
              description: buildUploadSummary(issues),
              variant: 'destructive',
            });
            throw new Error(issues[0]?.message || 'All files failed to upload');
          }

          triggerUploadRefreshes(shoot.id);
          if (failedFileEntries.length > 0) {
            setUploadIssues(issues);
            toast({
              title: 'Upload needs attention',
              description: buildUploadSummary(issues),
              variant: 'destructive',
            });
            const failedFiles = failedFileEntries.map((entry) => entry.file);
            const failedClassificationMap = failedFileEntries.reduce<QueueClassificationMap>((map, entry, failedIndex) => {
              const failedKey = getQueueFileKey(entry.file, failedIndex);
              const originalClassification = getQueueClassification(entry.file, entry.originalIndex, classificationsForUpload);

              if (originalClassification) {
                map[failedKey] = originalClassification;
              } else if (!isVideoUpload(entry.file) && isEditedFloorplanByName(entry.file.name)) {
                map[failedKey] = 'floorplan';
              }

              return map;
            }, {});
            setSelectedFiles(failedFiles);
            setQueueClassifications(failedClassificationMap);
            return;
          }

          setSelectedFiles([]);
          setQueueClassifications({});
          setUploadIssues([]);
          setNotes('');
          onUploadComplete();
        } finally {
          setIsUploading(false);
        }
      },
    });
  };

  const handleUpload = () => {
    startUpload();
  };

  const progressValue = expectedCount > 0 ? Math.min(100, Math.round((uploadedCount / expectedCount) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3 md:space-y-0 md:flex md:items-stretch md:gap-3">
        <SummaryCard label="Expected" value={expectedCount} className="md:w-[170px] md:shrink-0" />
        <SummaryCard label="Uploaded" value={uploadedCount} tone="info" className="md:w-[170px] md:shrink-0" />
        {specialCountCards.length > 0 && (
          <div className="min-w-0 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 md:flex-1">
            <div className="flex h-full flex-wrap items-center gap-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:mr-1">
                Tagged counts
              </div>
              {specialCountCards.map((card) => (
                <SummaryBadge key={card.type} label={card.summaryLabel} value={card.count} />
              ))}
            </div>
          </div>
        )}
      </div>

      {showInlineProgress && isUploading && selectedFiles.length > 0 && (
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

      <UploadResultsPanel
        title="Edited upload results"
        issues={uploadIssues}
        onRetryAll={selectedFiles.length > 0 ? handleUpload : undefined}
        onRetryIssue={(issueId) => {
          const matchingEntry = selectedFiles
            .map((file, index) => ({ file, index, key: getQueueFileKey(file, index) }))
            .find((entry) => issueId.startsWith(entry.key));

          if (!matchingEntry) {
            return;
          }

          const singleFile = [matchingEntry.file];
          const nextMap: QueueClassificationMap = {};
          const existingClassification = getQueueClassification(
            matchingEntry.file,
            matchingEntry.index,
            queueClassifications,
          );
          if (existingClassification) {
            nextMap[getQueueFileKey(matchingEntry.file, 0)] = existingClassification;
          }

          setSelectedFiles(singleFile);
          setQueueClassifications(nextMap);
          setUploadIssues((currentIssues) => currentIssues.filter((issue) => !issue.id.startsWith(matchingEntry.key)));
          startUpload(singleFile, nextMap);
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
  showInlineProgress = true,
}: {
  shoot: ShootData;
  onUploadComplete: () => void;
  showInlineProgress?: boolean;
}) {
  const { toast } = useToast();
  const { trackUpload, uploads } = useUpload();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [queueClassifications, setQueueClassifications] = useState<QueueClassificationMap>({});
  const [uploadIssues, setUploadIssues] = useState<UploadIssue[]>([]);
  const [uploadLimitHint, setUploadLimitHint] = useState<string | undefined>(buildUploadLimitDescription({
    per_file: '2GB',
    total_request: '2.2GB',
  }));
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
  const defaultBracketMultiplierRef = useRef(defaultBracketMultiplier);
  defaultBracketMultiplierRef.current = defaultBracketMultiplier;
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
    setUploadIssues([]);
    setUploadProgress(0);
    setIsUploading(false);
    setNotes('');
    setUploadLimitHint(buildUploadLimitDescription({
      per_file: '2GB',
      total_request: '2.2GB',
    }));
    setBracketMultiplier(Math.max(1, defaultBracketMultiplierRef.current));
    // Only reset queue when the user switches to a different shoot.
    // Re-fetches of the same shoot (background refreshes) must NOT wipe the
    // in-progress upload queue – that was causing the "first drag/drop does
    // nothing, second time works" bug when bracketMode/services flipped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shoot.id]);

  const mergeSelectedFiles = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;

    const validation = validateFilesAgainstUploadLimits(incomingFiles, selectedFiles);

    if (validation.rejectedIssues.length > 0) {
      setUploadIssues((currentIssues) => mergeUploadIssueLists(currentIssues, validation.rejectedIssues));
      toast({
        title: validation.acceptedFiles.length > 0 ? 'Some files were skipped' : 'Files skipped',
        description: buildUploadSummary(validation.rejectedIssues),
        variant: 'destructive',
      });
    }

    if (validation.acceptedFiles.length === 0) {
      return;
    }

    const nextFiles = [...selectedFiles, ...validation.acceptedFiles];
    setSelectedFiles(nextFiles);
    setQueueClassifications((currentMap) =>
      addFilesToClassificationMap(selectedFiles, nextFiles, currentMap, (file) =>
        !isVideoUpload(file) && isEditedFloorplanByName(file.name) ? 'floorplan' : undefined,
      ),
    );
  };

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((_, index) => index !== indexToRemove);
      setQueueClassifications((currentMap) => reindexClassificationMap(nextFiles, currentMap));
      return nextFiles;
    });
  };

  const startUpload = (overrideFiles?: File[], overrideClassifications?: QueueClassificationMap) => {
    const nextFiles = overrideFiles ?? selectedFiles;
    if (nextFiles.length === 0 || isUploading) {
      return;
    }

    const preflightValidation = validateFilesAgainstUploadLimits(nextFiles);
    if (preflightValidation.rejectedIssues.length > 0) {
      setUploadIssues((currentIssues) => mergeUploadIssueLists(currentIssues, preflightValidation.rejectedIssues));
      toast({
        title: preflightValidation.acceptedFiles.length > 0 ? 'Some files were skipped' : 'Upload blocked',
        description: buildUploadSummary(preflightValidation.rejectedIssues),
        variant: 'destructive',
      });
    }

    if (preflightValidation.acceptedFiles.length === 0) {
      setSelectedFiles([]);
      setQueueClassifications({});
      setIsUploading(false);
      setUploadProgress(0);
      return;
    }

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];
    const filesForUpload = [...preflightValidation.acceptedFiles];
    const classificationsForUpload = reindexClassificationMap(
      filesForUpload,
      { ...(overrideClassifications ?? queueClassifications) },
    );
    const noteValue = notes.trim();

    toast({
      title: 'Raw upload started',
      description: `${nextFiles.length} file${nextFiles.length !== 1 ? 's are' : ' is'} uploading in background.`,
    });

    setIsUploading(true);
    setUploadProgress(0);
    setUploadIssues([]);

    // Always allocate a batch id for raw uploads. The backend uses (batch_offset +
    // batch_index) to assign deterministic bracket_group/sequence values across
    // parallel XHR requests; a missing batch id falls back to the racy count-based
    // path that can collapse multiple files into the same bracket_group.
    const uploadBatchId = createUploadBatchId();

    trackUpload({
      shootId: String(shoot.id),
      shootAddress: shoot.location?.fullAddress || shoot.location?.address || `Shoot #${shoot.id}`,
      fileCount: filesForUpload.length,
      fileNames: filesForUpload.map((file) => file.name),
      uploadType: 'raw',
      uploadFn: async (onProgress) => {
        try {
          const uploadOne = (file: File, index: number): Promise<{ success: boolean; issues: UploadIssue[]; file: File; originalIndex: number; uploadLimits?: any }> =>
            new Promise((resolve) => {
              const formData = new FormData();
              const mediaType = getQueueClassification(file, index, classificationsForUpload);
              formData.append('files[]', file);
              formData.append('upload_type', 'raw');
              formData.append('bracket_mode', String(bracketMultiplier));
              formData.append('upload_batch_id', uploadBatchId);
              formData.append('upload_batch_total', String(filesForUpload.length));
              formData.append('upload_batch_index', String(index));
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
                  let payload: any = {};
                  if (xhr.responseText) {
                    try {
                      payload = JSON.parse(xhr.responseText || '{}');
                    } catch {
                      payload = {};
                    }
                  }
                  setUploadLimitHint((currentHint) => buildUploadLimitDescription(payload?.upload_limits) || currentHint);
                  resolve({ success: true, issues: [], file, originalIndex: index, uploadLimits: payload?.upload_limits });
                  return;
                }

                const parsed = parseUploadIssues(file, index, xhr.responseText, 'Upload failed');
                resolve({ success: false, issues: parsed.issues, file, originalIndex: index, uploadLimits: parsed.uploadLimits });
              });
              xhr.addEventListener('error', () => resolve({
                success: false,
                issues: [
                  {
                    id: getQueueFileKey(file, index),
                    fileName: file.name,
                    errorType: 'network_failure',
                    message: 'The upload connection was interrupted before this file finished transferring.',
                    retryable: true,
                    nextStep: 'Retry this file after checking the network connection.',
                  },
                ],
                file,
                originalIndex: index,
              }));
              xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
              if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
              if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
              xhr.send(formData);
            });

          const concurrentUploads = 1;
          let completed = 0;
          const issues: UploadIssue[] = [];
          const failedFileEntries: Array<{ file: File; originalIndex: number }> = [];
          let latestUploadLimits: any = null;

          for (let index = 0; index < filesForUpload.length; index += concurrentUploads) {
            const batch = filesForUpload.slice(index, index + concurrentUploads);
            const results = await Promise.all(batch.map((file, batchIndex) => uploadOne(file, index + batchIndex)));
            results.forEach((result) => {
              completed += 1;
              if (result.uploadLimits) {
                latestUploadLimits = result.uploadLimits;
              }
              if (!result.success && result.issues.length > 0) {
                issues.push(...result.issues);
                failedFileEntries.push({ file: result.file, originalIndex: result.originalIndex });
              }
            });

            const progressValue = Math.round((completed / filesForUpload.length) * 100);
            setUploadProgress(progressValue);
            onProgress(progressValue);
          }

          const limitHint = buildUploadLimitDescription(latestUploadLimits) || uploadLimitHint;
          setUploadLimitHint(limitHint);

          if (failedFileEntries.length === filesForUpload.length) {
            setUploadIssues(issues);
            toast({
              title: 'Upload failed',
              description: buildUploadSummary(issues),
              variant: 'destructive',
            });
            throw new Error(issues[0]?.message || 'All files failed to upload');
          }

          triggerUploadRefreshes(shoot.id);
          if (failedFileEntries.length > 0) {
            setUploadIssues(issues);
            toast({
              title: 'Upload needs attention',
              description: buildUploadSummary(issues),
              variant: 'destructive',
            });
            const failedFiles = failedFileEntries.map((entry) => entry.file);
            const failedClassificationMap = failedFileEntries.reduce<QueueClassificationMap>((map, entry, failedIndex) => {
              const failedKey = getQueueFileKey(entry.file, failedIndex);
              const originalClassification = getQueueClassification(entry.file, entry.originalIndex, classificationsForUpload);

              if (originalClassification) {
                map[failedKey] = originalClassification;
              } else if (!isVideoUpload(entry.file) && isEditedFloorplanByName(entry.file.name)) {
                map[failedKey] = 'floorplan';
              }

              return map;
            }, {});
            setSelectedFiles(failedFiles);
            setQueueClassifications(failedClassificationMap);
            return;
          }

          setSelectedFiles([]);
          setQueueClassifications({});
          setUploadIssues([]);
          setNotes('');
          onUploadComplete();
        } finally {
          setIsUploading(false);
        }
      },
    });
  };

  const handleUpload = () => {
    startUpload();
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col space-y-3">
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

      {/* Summary tiles split into two grouped rows so each fits on a single line
          on typical desktop widths:
            1. Counters (Expected / Existing / Selected) with subtle separators.
            2. Tagged media types (Extras + Virtual Staging / Green Grass / Twilight /
               Drone / Floorplan) with separators. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-stretch divide-x divide-border/60 overflow-hidden rounded-md border bg-muted/40 text-xs">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
            <div className="text-muted-foreground truncate">Expected</div>
            <div className="text-base font-semibold text-foreground">{expectedCount}</div>
            {photoServices.length > 0 && (
              <div className="mt-0.5 space-y-0.5 text-[10px] text-muted-foreground">
                {photoServices.map((service) => (
                  <div key={`${service.name}-${service.count}`} className="truncate">
                    {service.name}: {shootRequiresBrackets ? service.count * bracketMultiplier : service.count}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
            <div className="text-muted-foreground truncate">Existing</div>
            <div className="text-base font-semibold text-foreground">{totalRawCount}</div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
            <div className="text-muted-foreground truncate">Selected</div>
            <div className="text-base font-semibold text-foreground">{uploadedCount}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch divide-x divide-border/60 overflow-hidden rounded-md border bg-muted/40 text-xs">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
            <div className="text-muted-foreground truncate">Extras</div>
            <div className="text-base font-semibold text-foreground">{queueCounts.extra}</div>
          </div>
          {specialCountCards
            .filter((card) => card.type !== 'extra')
            .map((card) => (
              <div key={card.type} className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
                <div className="text-muted-foreground truncate" title={card.summaryLabel}>
                  {card.summaryLabel}
                </div>
                <div className="text-base font-semibold text-foreground">{card.count}</div>
              </div>
            ))}
        </div>
      </div>

      {missingCount > 0 && totalRawCount > 0 && (
        <div className="rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
          {missingCount} photo(s) missing. Expected {expectedCount}
          {shootRequiresBrackets ? ` (${resolveExpectedFinalCount(shoot)} final x ${bracketMultiplier} brackets)` : ''}
          , but only {totalRawCount} selected or uploaded so far.
        </div>
      )}

      {showInlineProgress && (activeUploads.length > 0
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
          ))}

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

      <UploadResultsPanel
        title="Raw upload results"
        issues={uploadIssues}
        onRetryAll={selectedFiles.length > 0 ? handleUpload : undefined}
        onRetryIssue={(issueId) => {
          const matchingEntry = selectedFiles
            .map((file, index) => ({ file, index, key: getQueueFileKey(file, index) }))
            .find((entry) => issueId.startsWith(entry.key));

          if (!matchingEntry) {
            return;
          }

          const singleFile = [matchingEntry.file];
          const nextMap: QueueClassificationMap = {};
          const existingClassification = getQueueClassification(
            matchingEntry.file,
            matchingEntry.index,
            queueClassifications,
          );
          if (existingClassification) {
            nextMap[getQueueFileKey(matchingEntry.file, 0)] = existingClassification;
          }

          setSelectedFiles(singleFile);
          setQueueClassifications(nextMap);
          setUploadIssues((currentIssues) => currentIssues.filter((issue) => !issue.id.startsWith(matchingEntry.key)));
          startUpload(singleFile, nextMap);
        }}
      />

      {selectedFiles.length > 0 && (
        // Flex column that fills the remaining vertical space inside the upload tab.
        // The selected-files list takes flex-1 (uses every available pixel and scrolls
        // internally) so the user sees as many files as possible without the page
        // expanding. Notes textarea sits at fixed height directly below, and the
        // primary "Upload Raw Files" action button is anchored at the bottom — sitting
        // just above the modal footer instead of floating mid-page.
        <div className="flex flex-1 min-h-0 flex-col space-y-2">
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <span>Selected Files ({selectedFiles.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              (FP = floorplan, VS = virtual staging, GG = green grass, TW = twilight, DR = drone, EX = extra)
            </span>
          </div>
          <div className="flex-1 min-h-0 space-y-1 overflow-y-auto rounded-md border p-2">
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

          <div className="flex-shrink-0 space-y-1.5">
            <div className="text-sm font-medium text-foreground">Notes for Editor (Optional)</div>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any notes for the editor..."
              className="min-h-[60px] max-h-[84px] resize-none"
            />
          </div>

          <Button
            type="button"
            className="flex-shrink-0 w-full"
            onClick={handleUpload}
            disabled={isUploading || selectedFiles.length === 0}
          >
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
