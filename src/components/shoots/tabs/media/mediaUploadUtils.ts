import type { ShootData, ShootServiceObject } from '@/types/shoots';
import { normalizeShootMediaFile, type MediaFile } from '@/hooks/useShootFiles';
import {
  triggerDashboardOverviewRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
  triggerShootListRefresh,
} from '@/realtime/realtimeRefreshBus';
import type { UploadIssue } from './MediaUploadPanels';

export type ShootMediaServiceObject = {
  name?: string;
  service_name?: string;
  title?: string;
  count?: number | string;
  quantity?: number | string;
  photo_count?: number | string;
};

export type ShootWithMediaServiceObjects = ShootData & {
  serviceObjects?: ShootMediaServiceObject[];
  service_objects?: ShootMediaServiceObject[];
  editor_notes?: string;
  editorNotes?: string;
  expectedRawCount?: number | string;
  expectedFinalCount?: number | string;
  expected_raw_count?: number | string;
  expected_final_count?: number | string;
};

export type UploadQueueMediaType =
  | 'floorplan'
  | 'extra'
  | 'virtual_staging'
  | 'green_grass'
  | 'twilight'
  | 'drone';

export type QueueClassificationMap = Record<string, UploadQueueMediaType | undefined>;

export interface UploadLimitsPayload {
  per_file?: string | number;
  total_request?: string | number;
}

type UnknownRecord = Record<string, unknown>;

export interface CanonicalUploadResult {
  uploadedFiles: MediaFile[];
  errors: UnknownRecord[];
  successCount: number;
  errorCount: number;
  partialSuccess: boolean;
  errorType?: string;
  message?: string;
  uploadLimits?: UploadLimitsPayload;
}

export interface UploadServiceOption {
  id: string;
  label: string;
}

/**
 * A selectable service for one upload batch, carrying everything the picker
 * needs to decide *which* service should be selected by default: how many
 * photos it owes, whether brackets apply to it, and where it sits in the
 * shoot's schedule.
 */
export interface UploadServiceTarget extends UploadServiceOption {
  /** Expected final photo count for this service. 0 when the payload has none. */
  photoCount: number;
  /** Brackets multiply raw counts for photo work only, never for video. */
  isPhotoService: boolean;
  /** Per-service schedule time. Drives "HDR today, vertical video tomorrow". */
  scheduledAt: string | null;
  /** Payload position, used as the tie-break when nothing is scheduled. */
  order: number;
}

export interface UploadActor {
  id?: string | number | null;
  role?: string | null;
}

interface UploadAttemptIdentity {
  idempotencyKey: string;
  batchId: string;
  batchIndex: number;
  batchTotal: number;
}

const uploadAttemptIdentities = new WeakMap<File, UploadAttemptIdentity>();

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readText = (record: UnknownRecord | null, key: string): string | undefined => {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

export function parseCanonicalUploadResponse(responseText?: string): CanonicalUploadResult {
  let payload: UnknownRecord = {};
  if (responseText) {
    try {
      const parsed: unknown = JSON.parse(responseText);
      payload = isRecord(parsed) ? parsed : {};
    } catch {
      payload = {};
    }
  }

  const uploadedFiles = Array.isArray(payload.uploaded_files)
    ? payload.uploaded_files
        .filter(isRecord)
        .map((file) => normalizeShootMediaFile(file))
        .filter((file) => Boolean(file.id))
    : [];
  const errors = Array.isArray(payload.errors) ? payload.errors.filter(isRecord) : [];
  const successCount = Number(payload.success_count ?? uploadedFiles.length);
  const errorCount = Number(payload.error_count ?? errors.length);

  return {
    uploadedFiles,
    errors,
    successCount: Number.isFinite(successCount) ? successCount : uploadedFiles.length,
    errorCount: Number.isFinite(errorCount) ? errorCount : errors.length,
    partialSuccess: Boolean(payload.partial_success),
    errorType: readText(payload, 'error_type'),
    message: readText(payload, 'message'),
    uploadLimits: toUploadLimits(payload.upload_limits),
  };
}

export function ensureUploadAttemptIdentity(
  file: File,
  batchId: string,
  batchIndex: number,
  batchTotal: number,
): UploadAttemptIdentity {
  const existing = uploadAttemptIdentities.get(file);
  if (existing) return existing;

  const identity = {
    idempotencyKey: createUploadBatchId(),
    batchId,
    batchIndex,
    batchTotal,
  };
  uploadAttemptIdentities.set(file, identity);
  return identity;
}

export function rotateUploadAttemptKey(file: File): void {
  const existing = uploadAttemptIdentities.get(file);
  if (!existing) return;
  uploadAttemptIdentities.set(file, {
    ...existing,
    idempotencyKey: createUploadBatchId(),
  });
}

const PHOTO_SERVICE_LANE = 'photo';
const VIDEO_SERVICE_LANE = 'video';

/**
 * `serviceItems` is the authoritative list of pivot rows, but the API does not
 * always populate `photo_count` / `lane` / `scheduled_at` on it — those live on
 * the `services` payload, which normalizes into `serviceObjects`. Index that
 * shape by pivot id so a target can be enriched from whichever side has the
 * field.
 */
const indexServiceObjectsByShootServiceId = (shoot: ShootData): Map<string, ShootServiceObject> => {
  const legacyShoot = shoot as ShootData & { service_objects?: ShootServiceObject[] };
  const objects = Array.isArray(shoot.serviceObjects)
    ? shoot.serviceObjects
    : Array.isArray(legacyShoot.service_objects)
      ? legacyShoot.service_objects
      : [];

  const index = new Map<string, ShootServiceObject>();
  objects.forEach((object) => {
    const key = String(object?.shoot_service_id ?? object?.shootServiceId ?? '');
    if (key && !index.has(key)) {
      index.set(key, object);
    }
  });

  return index;
};

/**
 * Prefer the backend's own lane over guessing from the name: `normalizeLane`
 * already resolved every catalogue category to `photo` or `video`. Only when no
 * lane reached the client (older payloads) fall back to the name.
 */
const resolveIsPhotoService = (name: string, laneCandidates: Array<string | null | undefined>): boolean => {
  for (const candidate of laneCandidates) {
    const lane = String(candidate ?? '').trim().toLowerCase();
    if (lane === PHOTO_SERVICE_LANE) return true;
    if (lane === VIDEO_SERVICE_LANE) return false;
  }

  return !/video/i.test(name);
};

export function resolveUploadServiceTargets(
  shoot: ShootData,
  actor: UploadActor | null | undefined,
  uploadType: 'raw' | 'edited',
): UploadServiceTarget[] {
  const shootWithAssignmentAliases = shoot as ShootData & {
    photographerId?: string | number | null;
    photographer_id?: string | number | null;
  };
  const items = (shoot.serviceItems ?? shoot.service_items ?? shoot.serviceObjects ?? [])
    .filter((item) => Boolean(item?.id));
  const role = String(actor?.role || '').trim().toLowerCase();
  const actorId = String(actor?.id ?? '');
  const adminLike = ['admin', 'superadmin', 'editing_manager'].includes(role);
  const serviceObjectIndex = indexServiceObjectsByShootServiceId(shoot);

  return items
    .filter((item) => {
      if (adminLike) return true;
      if (role === 'photographer' && uploadType === 'raw') {
        const assignedId = item.photographer_id
          ?? item.resolved_photographer_id
          ?? item.photographer?.id;
        const topLevelPhotographerId = String(
          shoot.photographer?.id
          ?? shootWithAssignmentAliases.photographerId
          ?? shootWithAssignmentAliases.photographer_id
          ?? '',
        );
        return Boolean(actorId) && (
          String(assignedId ?? '') === actorId
          || (!assignedId && topLevelPhotographerId === actorId)
        );
      }
      if (role === 'editor' && uploadType === 'edited') {
        if ((item.requires_editing ?? item.requiresEditing) === false) return false;
        if (String(shoot.editor?.id ?? shoot.editorId ?? '') === actorId) return true;
        const assignedId = item.editor_id ?? item.resolved_editor_id ?? item.editor?.id;
        return Boolean(actorId) && String(assignedId ?? '') === actorId;
      }
      return false;
    })
    .map((item, index) => {
      // The upload endpoint validates `shoot_service_id` against the shoot's
      // service-item primary keys, so the option value must be the pivot id.
      // `item.id` is only the same thing for the `serviceItems` shape; on the
      // `services`/`serviceObjects` shape `id` is the catalogue service id, and
      // sending that returned 422 invalid_service_item for every shoot whose
      // pivot id differs from its service id.
      const id = String(item.shoot_service_id ?? item.shootServiceId ?? item.id);
      const label = item.name || `Service #${item.id}`;
      const enriched = serviceObjectIndex.get(id);

      return {
        id,
        label,
        photoCount: toPositiveCount(item.photo_count)
          ?? toPositiveCount(enriched?.photo_count)
          ?? toPositiveCount(item.quantity)
          ?? toPositiveCount(enriched?.quantity)
          ?? 0,
        isPhotoService: resolveIsPhotoService(label, [
          item.lane,
          item.category_key,
          enriched?.lane,
          enriched?.category_key,
        ]),
        scheduledAt: item.scheduled_at
          ?? item.scheduledAt
          ?? enriched?.scheduled_at
          ?? enriched?.scheduledAt
          ?? null,
        order: index,
      };
    });
}

export function resolveEligibleUploadServices(
  shoot: ShootData,
  actor: UploadActor | null | undefined,
  uploadType: 'raw' | 'edited',
): UploadServiceOption[] {
  return resolveUploadServiceTargets(shoot, actor, uploadType)
    .map(({ id, label }) => ({ id, label }));
}

const toScheduleTimestamp = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Schedule order: earliest scheduled service first, unscheduled services last,
 * payload order as the tie-break. This is the order the photographer actually
 * works in, so it is also the order uploads should default to.
 */
export function compareUploadServiceTargets(a: UploadServiceTarget, b: UploadServiceTarget): number {
  const aTime = toScheduleTimestamp(a.scheduledAt);
  const bTime = toScheduleTimestamp(b.scheduledAt);

  if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
  if (aTime !== null && bTime === null) return -1;
  if (aTime === null && bTime !== null) return 1;

  return a.order - b.order;
}

/** Raw files this one service owes. Brackets only multiply photo services. */
export function resolveUploadServiceExpectedCount(
  target: UploadServiceTarget,
  bracketMultiplier: number,
): number {
  if (target.photoCount <= 0) return 0;
  return target.photoCount * (target.isPhotoService ? Math.max(1, bracketMultiplier) : 1);
}

/**
 * Brackets are exposures per final photo, so the picker only means something for
 * a service that actually delivers photos. A video service never brackets, and
 * neither does a deliverable with no photo count of its own — a 2D floor plan or
 * a 3D tour sits in the same shoot as the HDR set but has nothing to stack.
 */
export function bracketAppliesToUploadService(target: UploadServiceTarget): boolean {
  return target.isPhotoService && target.photoCount > 0;
}

export function isUploadServiceFulfilled(
  target: UploadServiceTarget,
  uploadedCount: number,
  bracketMultiplier: number,
): boolean {
  const expected = resolveUploadServiceExpectedCount(target, bracketMultiplier);
  // With no expected count to compare against, "has any file at all" is the only
  // signal available for whether this service has been shot yet.
  return expected > 0 ? uploadedCount >= expected : uploadedCount > 0;
}

/**
 * The service an upload batch should default to: the only one when there is a
 * single option, otherwise the first service in schedule order that still owes
 * files. When every service already has its files, stay on the last one instead
 * of snapping back to the first, so top-ups and re-uploads land where the
 * photographer left off.
 */
export function pickNextUploadServiceId(
  targets: UploadServiceTarget[],
  uploadedCountsByServiceId: Record<string, number>,
  bracketMultiplier: number,
): string {
  if (targets.length === 0) return '';
  if (targets.length === 1) return targets[0].id;

  const ordered = [...targets].sort(compareUploadServiceTargets);
  const nextUnfulfilled = ordered.find((target) => !isUploadServiceFulfilled(
    target,
    uploadedCountsByServiceId[target.id] ?? 0,
    bracketMultiplier,
  ));

  return (nextUnfulfilled ?? ordered[ordered.length - 1]).id;
}

/** How many already-uploaded files each service item holds. */
export function countUploadedFilesByServiceId(files: MediaFile[]): Record<string, number> {
  return files.reduce<Record<string, number>>((counts, file) => {
    const rawKey = file.shoot_service_id ?? file.shootServiceId;
    if (rawKey === null || rawKey === undefined || rawKey === '') return counts;

    const key = String(rawKey);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

const toUploadLimits = (value: unknown): UploadLimitsPayload | undefined => {
  if (!isRecord(value)) return undefined;
  const perFile = value.per_file;
  const totalRequest = value.total_request;
  return {
    per_file: typeof perFile === 'string' || typeof perFile === 'number' ? perFile : undefined,
    total_request: typeof totalRequest === 'string' || typeof totalRequest === 'number' ? totalRequest : undefined,
  };
};

export function parseUploadLimitsResponse(responseText?: string): UploadLimitsPayload | undefined {
  if (!responseText) return undefined;
  try {
    const payload: unknown = JSON.parse(responseText);
    return isRecord(payload) ? toUploadLimits(payload.upload_limits) : undefined;
  } catch {
    return undefined;
  }
}

export type UploadClassificationOption = {
  type: UploadQueueMediaType;
  label: string;
  title: string;
  activeClassName: string;
  inactiveClassName: string;
  photoOnly?: boolean;
};

export const FULL_UPLOAD_ACCEPT = 'image/*,video/*,application/pdf,.pdf,.raw,.cr2,.cr3,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.pef,.rw2,.srw,.3fr,.fff,.iiq,.rwl,.x3f,.erf,.kdc,.mef,.mos,.mrw,.bay,.bmq,.cap,.cine,.dc2,.dcr,.drf,.eip,.gpr,.mdc,.mdf,.mrw,.obm,.ptx,.pxn,.r3d,.rdc,.rmf';

export const TRACKED_MEDIA_TYPES: UploadQueueMediaType[] = [
  'extra',
  'virtual_staging',
  'green_grass',
  'twilight',
  'drone',
  'floorplan',
];

export const DEFAULT_UPLOAD_LIMITS = {
  perFileBytes: 2000 * 1024 * 1024,
  totalRequestBytes: 2200 * 1024 * 1024,
  perFileLabel: '2GB',
  totalRequestLabel: '2.2GB',
} as const;

export const UPLOAD_CLASSIFICATION_OPTIONS: UploadClassificationOption[] = [
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

export const MEDIA_TYPE_CARD_LABELS: Record<UploadQueueMediaType, string> = {
  extra: 'EX',
  virtual_staging: 'VS',
  green_grass: 'GG',
  twilight: 'TW',
  drone: 'DR',
  floorplan: 'FP',
};

export const MEDIA_TYPE_SUMMARY_LABELS: Record<UploadQueueMediaType, string> = {
  extra: 'Extra',
  virtual_staging: 'Virtual Staging',
  green_grass: 'Green Grass',
  twilight: 'Twilight',
  drone: 'Drone',
  floorplan: 'Floorplan',
};

export const createUploadBatchId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const triggerUploadRefreshes = (shootId: string | number) => {
  triggerShootDetailRefresh(shootId);
  triggerShootHistoryRefresh();
  triggerShootListRefresh();
  triggerDashboardOverviewRefresh();
};

export function formatUploadFileSize(bytes?: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function parseUploadLimitToBytes(value: unknown): number | null {
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

export function resolveUploadLimits(uploadLimits?: UploadLimitsPayload) {
  return {
    perFileBytes: parseUploadLimitToBytes(uploadLimits?.per_file) ?? DEFAULT_UPLOAD_LIMITS.perFileBytes,
    totalRequestBytes:
      parseUploadLimitToBytes(uploadLimits?.total_request) ?? DEFAULT_UPLOAD_LIMITS.totalRequestBytes,
    perFileLabel: String(uploadLimits?.per_file || DEFAULT_UPLOAD_LIMITS.perFileLabel),
    totalRequestLabel: String(uploadLimits?.total_request || DEFAULT_UPLOAD_LIMITS.totalRequestLabel),
  };
}

export function buildUploadLimitDescription(uploadLimits?: UploadLimitsPayload): string | undefined {
  const resolved = resolveUploadLimits(uploadLimits);
  return `Limits: up to ${resolved.perFileLabel} per file, ${resolved.totalRequestLabel} per request. RAW formats like .NEF are supported.`;
}

export function buildUploadSummary(issues: UploadIssue[]): string {
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

export function parseUploadIssues(
  file: File,
  index: number,
  responseText?: string,
  fallbackMessage = 'Upload failed',
): { issues: UploadIssue[]; uploadLimits?: UploadLimitsPayload } {
  let parsedPayload: UnknownRecord | null = null;
  if (responseText) {
    try {
      const parsed: unknown = JSON.parse(responseText);
      parsedPayload = isRecord(parsed) ? parsed : null;
    } catch {
      parsedPayload = null;
    }
  }

  const uploadLimits = toUploadLimits(parsedPayload?.upload_limits);
  const structuredErrors = Array.isArray(parsedPayload?.errors) ? parsedPayload.errors : [];

  if (structuredErrors.length > 0) {
    return {
      issues: structuredErrors.map((error, errorIndex: number) => {
        const errorRecord = isRecord(error) ? error : null;
        return {
        id: `${getQueueFileKey(file, index)}::${errorIndex}`,
        fileName: readText(errorRecord, 'file_name') || readText(errorRecord, 'filename') || file.name,
        errorType: readText(errorRecord, 'error_type') || readText(parsedPayload, 'error_type') || 'server_error',
        message: readText(errorRecord, 'message') || readText(errorRecord, 'error') || readText(parsedPayload, 'message') || fallbackMessage,
        retryable: Boolean(errorRecord?.retryable),
        nextStep: readText(errorRecord, 'next_step') || null,
      };
      }),
      uploadLimits,
    };
  }

  return {
    issues: [
      {
        id: getQueueFileKey(file, index),
        fileName: file.name,
        errorType: readText(parsedPayload, 'error_type') || 'server_error',
        message: readText(parsedPayload, 'message') || fallbackMessage,
        retryable: !['oversize', 'invalid_file', 'unsupported_format', 'forbidden', 'invalid_workflow_stage'].includes(
          readText(parsedPayload, 'error_type') || '',
        ),
        nextStep: readText(parsedPayload, 'error_type') === 'oversize'
          ? 'Reduce the file size or split the upload into smaller batches before retrying.'
          : readText(parsedPayload, 'error_type') === 'invalid_workflow_stage'
            ? 'Move the shoot to an uploadable workflow stage before retrying.'
            : null,
      },
    ],
    uploadLimits,
  };
}

export function mergeUploadIssueLists(existingIssues: UploadIssue[], nextIssues: UploadIssue[]): UploadIssue[] {
  const merged = new Map<string, UploadIssue>();
  existingIssues.forEach((issue) => merged.set(issue.id, issue));
  nextIssues.forEach((issue) => merged.set(issue.id, issue));
  return Array.from(merged.values());
}

export function validateFilesAgainstUploadLimits(
  files: File[],
  existingFiles: File[] = [],
  uploadLimits?: UploadLimitsPayload,
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

export function isVideoUpload(file: File): boolean {
  return Boolean(file.type && file.type.toLowerCase().startsWith('video/')) || /\.(mp4|mov|m4v|avi|mkv|wmv|webm|mpg|mpeg|3gp)$/i.test(file.name);
}

export function isEditedFloorplanByName(name: string): boolean {
  const lower = name.toLowerCase();
  return ['floorplan', 'floor-plan', 'floor_plan', 'fp_', 'fp-', 'layout', 'blueprint'].some((p) => lower.includes(p));
}

export function isHdrShoot(services: string[]): boolean {
  return Array.isArray(services) && services.some((service) => /\bhdr\b/i.test(service));
}

export function toPositiveCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function extractPhotoCountFromLabel(label?: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+)\s*photo/i);
  return match ? Number(match[1]) : null;
}

export function getServiceObjects(shoot: ShootData): ShootMediaServiceObject[] {
  const legacyShoot = shoot as ShootWithMediaServiceObjects;
  if (Array.isArray(legacyShoot.serviceObjects)) return legacyShoot.serviceObjects;
  if (Array.isArray(legacyShoot.service_objects)) return legacyShoot.service_objects;
  return [];
}

export function resolveExpectedFinalCount(shoot: ShootData): number {
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

export function resolveExpectedRawCount(shoot: ShootData, bracketMultiplier: number): number {
  const legacyShoot = shoot as ShootWithMediaServiceObjects;
  const directCandidates = [legacyShoot.expectedRawCount, legacyShoot.expected_raw_count];

  for (const candidate of directCandidates) {
    const parsed = toPositiveCount(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }

  return resolveExpectedFinalCount(shoot) * bracketMultiplier;
}

export function extractPhotoServicesFromServiceObjects(shoot: ShootData): Array<{ name: string; count: number }> {
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

export function extractPhotoServicesFromServices(services: string[]): Array<{ name: string; count: number }> {
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

export function isTrackedMediaType(value: string | null | undefined): value is UploadQueueMediaType {
  return TRACKED_MEDIA_TYPES.includes(String(value || '').toLowerCase() as UploadQueueMediaType);
}

export function createEmptyMediaTypeCounts(): Record<UploadQueueMediaType, number> {
  return {
    extra: 0,
    virtual_staging: 0,
    green_grass: 0,
    twilight: 0,
    drone: 0,
    floorplan: 0,
  };
}

export function getQueueFileKey(file: File, _index: number): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function getExistingMediaTypeCounts(files: MediaFile[]): Record<UploadQueueMediaType, number> {
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

export function getQueueMediaTypeCounts(
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

export function getQueueClassification(
  file: File,
  index: number,
  classifications: QueueClassificationMap,
): UploadQueueMediaType | undefined {
  return classifications[getQueueFileKey(file, index)];
}

export function reindexClassificationMap(files: File[], classifications: QueueClassificationMap): QueueClassificationMap {
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

export function addFilesToClassificationMap(
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

export function setQueueClassification(
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

export function getMediaTypeCards(counts: Record<UploadQueueMediaType, number>) {
  return TRACKED_MEDIA_TYPES
    .filter((mediaType) => counts[mediaType] > 0)
    .map((mediaType) => ({
      type: mediaType,
      label: MEDIA_TYPE_CARD_LABELS[mediaType],
      summaryLabel: MEDIA_TYPE_SUMMARY_LABELS[mediaType],
      count: counts[mediaType],
    }));
}
