import type { ShootData, ShootServiceObject } from '@/types/shoots';
import { normalizeShootMediaFile, type MediaFile } from '@/hooks/useShootFiles';
import {
  triggerDashboardOverviewRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
  triggerShootListRefresh,
} from '@/realtime/realtimeRefreshBus';
import type { UploadIssue } from './MediaUploadPanels';
import type {
  QueueClassificationMap,
  UploadQueueMediaType,
} from './uploadClassificationOptions';
import {
  DEFAULT_UPLOAD_LIMITS,
  MEDIA_TYPE_CARD_LABELS,
  MEDIA_TYPE_SUMMARY_LABELS,
  TRACKED_MEDIA_TYPES,
} from './uploadClassificationOptions';
import type { UploadIntakeType, UploadLane } from './uploadIntakeLanes';
import {
  UPLOAD_LANE_PHOTO,
  UPLOAD_LANE_VIDEO,
  intakeTypeSupportsLane,
  readUploadIntakeType,
} from './uploadIntakeLanes';

// Re-exported so existing import paths and the public API of this module are unchanged.
export * from './uploadIntakeLanes';
export * from './uploadClassificationOptions';

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
  /**
   * Contracted final photo count, or null when the product does not fix one.
   *
   * Null is not zero. Booking `quantity` is deliberately never substituted here:
   * it is 1 on effectively every booked row, so reading it as a count is what
   * produced the fictional "5 raw files" expectation for floor plans, virtual
   * staging and drone. A null count must be surfaced as unset.
   */
  photoCount: number | null;
  /** Declared upload capability from the catalogue. */
  intakeType: UploadIntakeType;
  /** Whether the photo raw lane may select this service. */
  supportsPhotoIntake: boolean;
  /** Whether the video raw lane may select this service. */
  supportsVideoIntake: boolean;
  /** Brackets multiply raw counts for photo work only, never for video. */
  isPhotoService: boolean;
  /**
   * Whether this deliverable is captured as multi-exposure bracket stacks, from
   * `services.uses_hdr_brackets`. This is catalogue data, not a guess from the
   * name or photo count: drone photography sits in the Photography category with
   * a positive photo count and does not bracket.
   */
  usesHdrBrackets: boolean;
  /**
   * Exposures per stack for this service on this shoot, or null when it does not
   * bracket. Resolved by the backend from the service item's own recorded value,
   * then the assigned photographer's preference, then 5 — so two services on one
   * shoot can legitimately differ.
   */
  bracketMode: number | null;
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

// Imported for use inside this module; also re-exported below for existing callers.
import {
  DEFAULT_BRACKET_MODE,
  isUploadServiceFulfilled,
  resolveUploadServiceExpectedCount,
} from './uploadBrackets';

const readText = (record: UnknownRecord | null, key: string): string | undefined => {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/**
 * Booleans arrive as real booleans, as 0/1 from MySQL, or as "0"/"1" strings
 * depending on the serializer. `undefined` is returned for an absent value so a
 * caller can fall through to another source rather than defaulting too early.
 */
const readBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes'].includes(normalized)) return true;
    if (['0', 'false', 'no'].includes(normalized)) return false;
  }
  return undefined;
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
 * The execution row id the upload endpoint requires.
 *
 * Returns null rather than falling back to `item.id`. On the `serviceItems` shape
 * `id` is the pivot id, but on the `services`/`serviceObjects` shape it is the
 * *catalogue* id, and submitting that silently addressed the wrong row — or a row on
 * another shoot entirely. An unresolvable pivot is a real problem and has to surface
 * as one, not be guessed at.
 */
/**
 * A contracted count, or null when none is configured.
 *
 * Only a strictly positive value counts. Zero is how the catalogue records "variable
 * or not yet configured", and treating it as a real count would present an exact
 * denominator of nothing.
 */
const readContractedCount = (value: unknown): number | null => {
  const parsed = toPositiveCount(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const readPivotId = (item: {
  shoot_service_id?: string | number | null;
  shootServiceId?: string | number | null;
}): string | null => {
  const candidate = item.shoot_service_id ?? item.shootServiceId;
  if (candidate === null || candidate === undefined || candidate === '') return null;

  const asString = String(candidate).trim();
  return asString === '' ? null : asString;
};

/**
 * Selectable services for one upload batch.
 *
 * Eligibility has two independent halves and both must hold:
 *
 *   1. assignment — is this actor allowed to upload for this execution row
 *   2. capability — does the row's catalogue service declare the lane(s) in play
 *
 * The second half is new. Previously an admin-like actor received every booked row
 * and a photographer received everything assigned to them, so fees, travel, digital
 * enhancements, floor plans, virtual staging and dedicated 3D tour products all
 * appeared as raw upload targets and invented raw expectations. Capability now comes
 * from `services.upload_intake_type` and nothing here inspects a service name.
 *
 * `lanes` is the set of lanes the batch actually needs. A target must support *every*
 * one of them, matching the backend's own check, so a mixed photo+video batch only
 * offers services that genuinely cover both.
 *
 * Lane capability is applied to raw capture only. Edited uploads are gated by the
 * separate requires-editing capability, which is a different question.
 */
export function resolveUploadServiceTargets(
  shoot: ShootData,
  actor: UploadActor | null | undefined,
  uploadType: 'raw' | 'edited',
  lanes: UploadLane[] = [UPLOAD_LANE_PHOTO],
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
  const requiredLanes = lanes.length > 0 ? lanes : [UPLOAD_LANE_PHOTO];

  const readIntakeTypeFor = (
    item: { upload_intake_type?: string | null; uploadIntakeType?: string | null },
    pivotId: string,
  ): UploadIntakeType => {
    const enriched = serviceObjectIndex.get(pivotId);
    const declared = item.upload_intake_type
      ?? item.uploadIntakeType
      ?? enriched?.upload_intake_type
      ?? enriched?.uploadIntakeType;

    return readUploadIntakeType(declared);
  };

  return items
    .filter((item) => {
      // An option with no execution row id is unusable, because that id is the value
      // the upload endpoint validates. Dropping it is deliberate: the alternative was
      // falling back to the catalogue id, which addressed the wrong row.
      const pivotId = readPivotId(item);
      if (!pivotId) return false;

      // Capability next, and it applies to every role. An admin is not exempt: the
      // question is whether the service can receive this media at all, not who is
      // asking. Invoice-adjustment rows have no catalogue service and so are `none`.
      if (uploadType === 'raw') {
        const intakeType = readIntakeTypeFor(item, pivotId);
        if (!requiredLanes.every((lane) => intakeTypeSupportsLane(intakeType, lane))) {
          return false;
        }
      }

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
      // execution-row primary keys, so the option value must be the pivot id and
      // never the catalogue service id.
      const id = readPivotId(item) ?? '';
      const label = item.name || `Service #${item.id}`;
      const enriched = serviceObjectIndex.get(id);
      const intakeType = readUploadIntakeType(
        item.upload_intake_type
        ?? item.uploadIntakeType
        ?? enriched?.upload_intake_type
        ?? enriched?.uploadIntakeType,
      );

      return {
        id,
        label,
        intakeType,
        supportsPhotoIntake: intakeTypeSupportsLane(intakeType, UPLOAD_LANE_PHOTO),
        supportsVideoIntake: intakeTypeSupportsLane(intakeType, UPLOAD_LANE_VIDEO),
        // Only the contracted photo count, and only when it is genuinely positive.
        // Booking quantity is not a fallback: it is 1 on essentially every row, and
        // using it invented a raw expectation for services that owe no photos at all.
        // Zero is treated as unspecified, not as "owes nothing" — the difference is
        // carried by capability instead.
        photoCount: readContractedCount(item.photo_count)
          ?? readContractedCount(enriched?.photo_count)
          ?? null,
        // Derived from declared capability, not from the label. A photo-capable
        // service is treated as photo work; video-only is not.
        isPhotoService: intakeTypeSupportsLane(intakeType, UPLOAD_LANE_PHOTO),
        usesHdrBrackets: readBoolean(item.uses_hdr_brackets ?? item.usesHdrBrackets)
          ?? readBoolean(enriched?.uses_hdr_brackets ?? enriched?.usesHdrBrackets)
          ?? false,
        bracketMode: toPositiveCount(item.effective_bracket_mode ?? item.effectiveBracketMode)
          ?? toPositiveCount(enriched?.effective_bracket_mode ?? enriched?.effectiveBracketMode)
          ?? toPositiveCount(item.bracket_mode ?? item.bracketMode)
          ?? toPositiveCount(enriched?.bracket_mode ?? enriched?.bracketMode)
          ?? null,
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
  lanes: UploadLane[] = [UPLOAD_LANE_PHOTO],
): UploadServiceOption[] {
  return resolveUploadServiceTargets(shoot, actor, uploadType, lanes)
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

// Bracket arithmetic lives in ./uploadBrackets. Re-exported here so the many
// existing import sites keep working while the helpers stay in one cohesive place.
export {
  BRACKET_MODE_OPTIONS,
  DEFAULT_BRACKET_MODE,
  bracketAppliesToUploadService,
  isUploadServiceFulfilled,
  resolveUploadServiceBracketMode,
  resolveUploadServiceExpectedCount,
} from './uploadBrackets';

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
  /** Per-service overrides, keyed by service id. Falls back to each target's own size. */
  bracketOverrides?: Record<string, number | null>,
): string {
  if (targets.length === 0) return '';
  if (targets.length === 1) return targets[0].id;

  const ordered = [...targets].sort(compareUploadServiceTargets);
  const nextUnfulfilled = ordered.find((target) => !isUploadServiceFulfilled(
    target,
    uploadedCountsByServiceId[target.id] ?? 0,
    bracketOverrides?.[target.id] ?? target.bracketMode,
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

/**
 * Raw files a whole shoot owes, as the sum over its services.
 *
 * `targets` carries each service's own bracket size, so a shoot running Exterior
 * at 5x and Interior at 3x resolves to 30x5 + 12x3 = 186. The previous form
 * multiplied one shoot-wide final count by one multiplier, which cannot express
 * that and also inflated non-bracket work like drone photography.
 *
 * The shoot-level `expected_raw_count` is now derived server-side from the same
 * per-service arithmetic, so preferring it when present stays consistent; it is
 * only ignored when it is absent or zero, which is what un-migrated payloads send.
 */
export function resolveExpectedRawCount(
  shoot: ShootData,
  targets?: UploadServiceTarget[],
  bracketOverrides?: Record<string, number | null>,
): number {
  if (targets && targets.length > 0) {
    return targets.reduce(
      (sum, target) => sum + (resolveUploadServiceExpectedCount(
        target,
        bracketOverrides?.[target.id] ?? target.bracketMode,
      ) ?? 0),
      0,
    );
  }

  const legacyShoot = shoot as ShootWithMediaServiceObjects;
  const directCandidates = [legacyShoot.expectedRawCount, legacyShoot.expected_raw_count];

  for (const candidate of directCandidates) {
    const parsed = toPositiveCount(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }

  // Deliberately 0, not `expectedFinalCount x 5`. That fallback multiplied a
  // shoot-wide final count by a shoot-wide bracket size, which cannot express a shoot
  // running two different sizes and inflated every non-bracket service. With no
  // per-service data there is no honest number to report, so report none.
  return 0;
}

/**
 * Whether every eligible target contributes a known quantity.
 *
 * False means the aggregate is a floor, not an exact figure, and must be presented
 * that way rather than implying precision the data does not support.
 */
export function isExpectedRawCountExact(targets?: UploadServiceTarget[]): boolean {
  if (!targets || targets.length === 0) return false;

  return targets.every((target) => resolveUploadServiceExpectedCount(target) !== null);
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
