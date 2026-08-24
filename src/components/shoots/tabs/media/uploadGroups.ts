/* ------------------------------------------------------------------------- *
 * Per-service staging groups
 *
 * A shoot can book several services to one photographer, and each uploaded file
 * belongs to exactly one of them. Staging used to be a single flat queue with
 * one service dropdown, which meant a multi-service shoot had to be uploaded in
 * as many passes as it had services, re-picking the dropdown each time.
 *
 * A group is one service's worth of staged files. The user fills several groups
 * and presses upload once; each group is still sent as its own isolated batch,
 * so nothing about the request shape the backend already validates changes.
 * ------------------------------------------------------------------------- */

import {
  addFilesToClassificationMap,
  createEmptyMediaTypeCounts,
  createUploadBatchId,
  getQueueFileKey,
  getQueueMediaTypeCounts,
  reindexClassificationMap,
  TRACKED_MEDIA_TYPES,
  type QueueClassificationMap,
  type UploadQueueMediaType,
} from './mediaUploadUtils';

export interface StagedUploadGroup {
  /** Stable identity for React keys and for correlating plans back to groups. */
  id: string;
  /** Empty string means "General / Unassigned". */
  serviceId: string;
  files: File[];
  /**
   * Scoped to this group on purpose. `getQueueFileKey` ignores its index
   * argument and keys on name/size/lastModified, so one shared map across groups
   * would let the same file in two groups overwrite the other's classification.
   */
  classifications: QueueClassificationMap;
}

/** One group's worth of upload work, resolved at the moment upload starts. */
export interface UploadGroupPlan {
  groupId: string;
  serviceId: string;
  /**
   * One batch id per group. The backend claims a single bracket offset per batch
   * id, so sharing an id across services would interleave stack numbering.
   */
  uploadBatchId: string;
  /**
   * `null` means the request must omit `bracket_mode` entirely rather than send
   * a value. The upload endpoint writes `bracket_mode` straight onto the shoot
   * when the field is present, so a non-bracket group sending anything would
   * clobber a real HDR setting.
   */
  bracketMode: number | null;
  files: File[];
  classifications: QueueClassificationMap;
}

export interface UploadFileContext {
  serviceId: string;
  bracketMode: number | null;
}

/**
 * What a file was uploaded *as*, remembered per file object.
 *
 * A retry must repeat the original attempt, not whatever the picker happens to
 * show now. The service dropdown auto-advances as soon as files land, so
 * reading current state on retry credited the wrong service. The batch id,
 * index and total do not need recording here: `ensureUploadAttemptIdentity`
 * already pins those on a file's first attempt and replays them afterwards.
 */
const uploadFileContexts = new WeakMap<File, UploadFileContext>();

export function rememberUploadFileContext(file: File, context: UploadFileContext): void {
  uploadFileContexts.set(file, context);
}

export function getUploadFileContext(file: File): UploadFileContext | undefined {
  return uploadFileContexts.get(file);
}

export function createStagedUploadGroup(serviceId: string, id?: string): StagedUploadGroup {
  return {
    id: id ?? createUploadBatchId(),
    serviceId,
    files: [],
    classifications: {},
  };
}

export function addFilesToStagedGroup(
  group: StagedUploadGroup,
  incomingFiles: File[],
  defaultResolver?: (file: File) => UploadQueueMediaType | undefined,
): StagedUploadGroup {
  if (incomingFiles.length === 0) return group;

  const files = [...group.files, ...incomingFiles];
  return {
    ...group,
    files,
    classifications: addFilesToClassificationMap(group.files, files, group.classifications, defaultResolver),
  };
}

export function removeFileFromStagedGroup(group: StagedUploadGroup, indexToRemove: number): StagedUploadGroup {
  const files = group.files.filter((_, index) => index !== indexToRemove);
  return {
    ...group,
    files,
    classifications: reindexClassificationMap(files, group.classifications),
  };
}

export function countStagedFiles(groups: StagedUploadGroup[]): number {
  return groups.reduce((total, group) => total + group.files.length, 0);
}

/** Media-type tallies across every group, for the shoot-wide summary strip. */
export function getStagedMediaTypeCounts(groups: StagedUploadGroup[]): Record<UploadQueueMediaType, number> {
  return groups.reduce((counts, group) => {
    const groupCounts = getQueueMediaTypeCounts(group.files, group.classifications);
    TRACKED_MEDIA_TYPES.forEach((mediaType) => {
      counts[mediaType] += groupCounts[mediaType];
    });
    return counts;
  }, createEmptyMediaTypeCounts());
}

/**
 * Resolve each group into the batch it will be uploaded as. `createBatchId` is
 * injected so this stays deterministic under test.
 */
export function buildUploadGroupPlans(
  groups: StagedUploadGroup[],
  options: {
    resolveBracketMode: (serviceId: string) => number | null;
    createBatchId?: () => string;
  },
): UploadGroupPlan[] {
  const createBatchId = options.createBatchId ?? createUploadBatchId;

  return groups
    .filter((group) => group.files.length > 0)
    .map((group) => ({
      groupId: group.id,
      serviceId: group.serviceId,
      uploadBatchId: createBatchId(),
      bracketMode: options.resolveBracketMode(group.serviceId),
      files: [...group.files],
      classifications: { ...group.classifications },
    }));
}

/**
 * A photographer with more than one assigned service must name one per group:
 * the upload endpoint answers 422 `missing_service_item` otherwise, so letting
 * an unassigned group through would only fail later and less clearly.
 */
export function validateStagedUploadGroups(
  groups: StagedUploadGroup[],
  options: { requireService: boolean; resolveLabel?: (serviceId: string) => string },
): { ok: boolean; message?: string } {
  const staged = groups.filter((group) => group.files.length > 0);
  if (staged.length === 0) {
    return { ok: false, message: 'Add at least one file before uploading.' };
  }

  if (options.requireService) {
    const missing = staged.filter((group) => !group.serviceId);
    if (missing.length > 0) {
      return {
        ok: false,
        message: missing.length === 1
          ? 'One group still has no service selected. Choose the assigned service for it.'
          : `${missing.length} groups still have no service selected. Choose the assigned service for each.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Rebuild the staging queue from the files that failed, keeping each one in the
 * group it was uploaded under so its service is not lost. Groups that fully
 * succeeded disappear.
 */
export function restageFailedUploadGroups(
  plans: UploadGroupPlan[],
  failedFiles: ReadonlySet<File>,
): StagedUploadGroup[] {
  return plans
    .map((plan) => {
      const files = plan.files.filter((file) => failedFiles.has(file));
      if (files.length === 0) return null;

      return {
        id: plan.groupId,
        serviceId: plan.serviceId,
        files,
        classifications: files.reduce<QueueClassificationMap>((map, file, index) => {
          const original = plan.classifications[getQueueFileKey(file, index)];
          if (original) {
            map[getQueueFileKey(file, index)] = original;
          }
          return map;
        }, {}),
      } satisfies StagedUploadGroup;
    })
    .filter((group): group is StagedUploadGroup => group !== null);
}

/** Drop retried files from their groups, removing any group left empty. */
export function removeFilesFromStagedGroups(
  groups: StagedUploadGroup[],
  uploadedFiles: ReadonlySet<File>,
): StagedUploadGroup[] {
  return groups
    .map((group) => {
      const files = group.files.filter((file) => !uploadedFiles.has(file));
      if (files.length === group.files.length) return group;
      return { ...group, files, classifications: reindexClassificationMap(files, group.classifications) };
    })
    .filter((group) => group.files.length > 0);
}

/** The group a file is staged in, used to recover its service on retry. */
export function findStagedGroupForFile(
  groups: StagedUploadGroup[],
  file: File,
): StagedUploadGroup | undefined {
  return groups.find((group) => group.files.includes(file));
}
