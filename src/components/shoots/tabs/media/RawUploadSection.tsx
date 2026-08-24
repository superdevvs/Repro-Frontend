import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import type { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useUpload } from '@/context/UploadContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { mergeAcceptedShootFiles, type MediaFile } from '@/hooks/useShootFiles';
import {
  UploadDropzone,
  UploadProgressCard,
  UploadResultsPanel,
  type UploadIssue,
} from './MediaUploadPanels';
import {
  FULL_UPLOAD_ACCEPT,
  TRACKED_MEDIA_TYPES,
  bracketAppliesToUploadService,
  compareUploadServiceTargets,
  resolveClassificationUploadFields,
  buildUploadLimitDescription,
  buildUploadSummary,
  countUploadedFilesByServiceId,
  createUploadBatchId,
  ensureUploadAttemptIdentity,
  createEmptyMediaTypeCounts,
  getExistingMediaTypeCounts,
  extractPhotoServicesFromServiceObjects,
  extractPhotoServicesFromServices,
  getMediaTypeCards,
  getQueueClassification,
  getQueueFileKey,
  isHdrShoot,
  isEditedFloorplanByName,
  isVideoUpload,
  mergeUploadIssueLists,
  parseUploadLimitsResponse,
  parseUploadIssues,
  parseCanonicalUploadResponse,
  pickNextUploadServiceId,
  resolveExpectedRawCount,
  resolveUploadLanesForFiles,
  resolveUploadServiceExpectedCount,
  resolveUploadServiceTargets,
  rotateUploadAttemptKey,
  setQueueClassification,
  triggerUploadRefreshes,
  validateFilesAgainstUploadLimits,
  type QueueClassificationMap,
  type UploadLimitsPayload,
  type UploadQueueMediaType,
} from './mediaUploadUtils';
import {
  addFilesToStagedGroup,
  buildUploadGroupPlans,
  countStagedFiles,
  createStagedUploadGroup,
  getStagedMediaTypeCounts,
  getUploadFileContext,
  rememberUploadFileContext,
  removeFileFromStagedGroup,
  removeFilesFromStagedGroups,
  restageFailedUploadGroups,
  validateStagedUploadGroups,
  type StagedUploadGroup,
  type UploadGroupPlan,
} from './uploadGroups';
import {
  RawUploadCommitBar,
  RawUploadSummaryStrip,
  StagedGroupCard,
} from './RawUploadStagingViews';
import { ChangeRestackDialog } from './ChangeRestackDialog';
import { useServiceBracketMode } from './useServiceBracketMode';

export function RawUploadSection({
  shoot,
  onUploadComplete,
  rawFiles = [],
  showInlineProgress = true,
}: {
  shoot: ShootData;
  onUploadComplete: () => void;
  rawFiles?: MediaFile[];
  showInlineProgress?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { trackUpload, uploads } = useUpload();
  /**
   * One staging group per service. A shoot can book several services to the same
   * photographer, and each file belongs to exactly one of them. The queue used to
   * be flat with a single service dropdown, so a three-service shoot had to be
   * uploaded three times, re-picking the dropdown between passes.
   */
  const [groups, setGroups] = useState<StagedUploadGroup[]>([]);
  /** Exactly one group is expanded for filling; the rest collapse to a summary. */
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [uploadIssues, setUploadIssues] = useState<UploadIssue[]>([]);
  const [uploadLimitHint, setUploadLimitHint] = useState<string | undefined>(buildUploadLimitDescription({
    per_file: '2GB',
    total_request: '2.2GB',
  }));
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  /** Set once the user picks a service by hand, which stops the auto-selection. */
  const serviceSelectionTouchedRef = useRef(false);
  const inputId = `raw-upload-input-${shoot.id}`;
  const shootServices = useMemo(() => (Array.isArray(shoot.services) ? shoot.services : []), [shoot.services]);
  const shootRequiresBrackets = isHdrShoot(shootServices);
  const shootHasVideoService = useMemo(
    () => shootServices.some((service) => /video/i.test(String(service))),
    [shootServices],
  );
  /**
   * The lane(s) the staged batch actually needs, from the files' MIME types.
   *
   * The selector is capability-gated per lane, so staging a video narrows the list to
   * services that declare video intake. With nothing staged this is the photo lane,
   * which is what a raw capture batch defaults to. It deliberately mirrors the
   * backend's own rule, so the dropdown cannot offer a service the API would refuse.
   */
  const stagedLanes = useMemo(
    () => resolveUploadLanesForFiles(groups.flatMap((group) => group.files)),
    [groups],
  );
  const serviceTargets = useMemo(
    () => resolveUploadServiceTargets(shoot, user, 'raw', stagedLanes),
    [shoot, stagedLanes, user],
  );
  const normalizedRole = String(user?.role || '').toLowerCase();
  const requiresServiceSelection = normalizedRole === 'photographer' && serviceTargets.length > 1;
  const selectedTarget = useMemo(
    () => serviceTargets.find((target) => target.id === selectedServiceId) ?? null,
    [selectedServiceId, serviceTargets],
  );
  /** Files already on the shoot, per service item — the "what is already shot" signal. */
  const uploadedCountsByServiceId = useMemo(
    () => countUploadedFilesByServiceId(rawFiles),
    [rawFiles],
  );
  const serviceObjects = useMemo(() => extractPhotoServicesFromServiceObjects(shoot), [shoot]);
  const photoServices = useMemo(() => {
    if (serviceObjects.length > 0) {
      return serviceObjects;
    }

    return extractPhotoServicesFromServices(shootServices);
  }, [serviceObjects, shootServices]);

  const {
    bracketOverrides,
    setBracketOverrides,
    pendingRestack,
    setPendingRestack,
    isSavingBracketMode,
    setServiceBracketMode,
    confirmRestack,
    resolveBracketModeForService,
    buildBracketOptionsForService,
  } = useServiceBracketMode({ shoot, serviceTargets, shootRequiresBrackets });

  const existingCounts = useMemo(() => getExistingMediaTypeCounts(rawFiles), [rawFiles]);
  const queueCounts = useMemo(() => getStagedMediaTypeCounts(groups), [groups]);
  const expectedCount = useMemo(
    () => resolveExpectedRawCount(shoot, serviceTargets, bracketOverrides),
    [bracketOverrides, serviceTargets, shoot],
  );
  const stagedFileCount = useMemo(() => countStagedFiles(groups), [groups]);
  const stagedGroups = useMemo(() => groups.filter((group) => group.files.length > 0), [groups]);
  const openGroup = useMemo(
    () => groups.find((group) => group.id === openGroupId) ?? null,
    [groups, openGroupId],
  );
  const serviceLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    serviceTargets.forEach((target) => labels.set(target.id, target.label));
    return labels;
  }, [serviceTargets]);
  const resolveServiceLabel = useCallback(
    (serviceId: string) => (serviceId ? serviceLabelById.get(serviceId) ?? `Service #${serviceId}` : 'General / Unassigned'),
    [serviceLabelById],
  );
  const uploadedCount = stagedFileCount;

  /** Whether any staged group brackets at all, which is what gates bracket UI. */
  const bracketApplies = useMemo(() => {
    if (stagedGroups.length > 0) {
      return stagedGroups.some((group) => resolveBracketModeForService(group.serviceId) !== null);
    }
    return resolveBracketModeForService(selectedServiceId) !== null;
  }, [resolveBracketModeForService, selectedServiceId, stagedGroups]);
  const existingRawCount = rawFiles.length;
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

  /**
   * Batch progress: the four numbers that describe "how far along is this
   * upload", kept together as one block. Missing is one of them rather than a
   * separate banner, because it is just Expected minus what is here.
   */
  const primaryStats = useMemo(
    () => [
      { key: 'expected', label: 'Expected', value: expectedCount },
      { key: 'existing', label: 'Existing', value: totalRawCount },
      { key: 'selected', label: 'Selected', value: uploadedCount },
      // Extras sits with the progress counters rather than the per-service tags:
      // it is a property of the batch, not a purchased service. Counted the same
      // way as Existing (already on the shoot plus newly tagged) so the two
      // numbers are read on the same basis.
      { key: 'extras', label: 'Extras', value: combinedCounts.extra },
      { key: 'missing', label: 'Missing', value: missingCount, alert: missingCount > 0 },
    ],
    [combinedCounts.extra, expectedCount, missingCount, totalRawCount, uploadedCount],
  );

  /**
   * Per-service tallies (Virtual Staging / Green Grass / Twilight / Drone /
   * Floorplan) in their own row, since they answer a different question than the
   * progress counters: which services were tagged, not how much is left.
   * `getMediaTypeCards` already drops zero counts, so the row disappears
   * entirely on a shoot with nothing tagged instead of rendering lone zeros.
   */
  const tagStats = useMemo(
    () => specialCountCards
      .filter((card) => card.type !== 'extra')
      .map((card) => ({ key: card.type, label: card.summaryLabel, value: card.count })),
    [specialCountCards],
  );

  /**
   * The per-service make-up of `Expected` on one line instead of one line per
   * service. Full text stays available via the title attribute when it has to
   * truncate.
   */
  const expectedBreakdown = useMemo(() => {
    // Built from the service targets so each service shows its own size. The old
    // form applied one multiplier to every service and then printed a single
    // "N final x M brackets" summary, which misstates a shoot running two sizes.
    const photoTargets = serviceTargets.filter((target) => target.supportsPhotoIntake);
    if (photoTargets.length === 0) {
      return '';
    }

    return photoTargets
      .map((target) => {
        const mode = bracketOverrides[target.id] ?? target.bracketMode;
        const expected = resolveUploadServiceExpectedCount(target, mode);

        // An unconfigured count is reported as unset. Printing a number derived from
        // booking quantity is what made floor plans and virtual staging appear to owe
        // five raw files each.
        if (expected === null) {
          return `${target.label} not set`;
        }

        const suffix = bracketAppliesToUploadService(target) && mode ? ` (${target.photoCount}x${mode})` : '';

        return `${target.label} ${expected}${suffix}`;
      })
      .join(' · ');
  }, [bracketOverrides, serviceTargets]);

  const activeUploads = useMemo(
    () => uploads.filter((upload) => upload.shootId === String(shoot.id) && upload.uploadType === 'raw' && upload.status === 'uploading'),
    [shoot.id, uploads],
  );

  useEffect(() => {
    setGroups([]);
    setOpenGroupId(null);
    setUploadIssues([]);
    setUploadProgress(0);
    setIsUploading(false);
    setNotes('');
    setSelectedServiceId('');
    serviceSelectionTouchedRef.current = false;
    setUploadLimitHint(buildUploadLimitDescription({
      per_file: '2GB',
      total_request: '2.2GB',
    }));
    // Drop any per-service size the user changed, so the next shoot starts from
    // what its own services say.
    setBracketOverrides({});
    // Only reset queue when the user switches to a different shoot.
    // Re-fetches of the same shoot (background refreshes) must NOT wipe the
    // in-progress upload queue – that was causing the "first drag/drop does
    // nothing, second time works" bug when bracketMode/services flipped.
    // `setBracketOverrides` is a useState setter and so has a stable identity;
    // listing it satisfies the lint rule without widening when this effect runs.
  }, [shoot.id, user?.id, setBracketOverrides]);

  /**
   * Keep the service picker on the next service that still owes files, until the
   * user overrides it. One service means no decision to make. Several means the
   * photographer works them in schedule order, so the picker follows that order
   * and steps forward on its own as each service fills up — an HDR shoot today
   * and vertical video tomorrow lands on HDR first, then on video once the HDR
   * files are in.
   *
   * A manual pick wins from then on (tracked by the ref rather than by comparing
   * against the auto value, so deliberately choosing "General / Unassigned" is
   * not instantly undone). Frozen while uploading so the label cannot change
   * under a batch that is already in flight.
   */
  useEffect(() => {
    if (isUploading) return;

    // While a group is open it owns the selection: the dropdown edits that group,
    // so auto-picking would silently move the user's files to another service.
    if (openGroup) {
      setSelectedServiceId((current) => (current === openGroup.serviceId ? current : openGroup.serviceId));
      return;
    }

    if (serviceSelectionTouchedRef.current) {
      const stillValid = selectedServiceId === ''
        || serviceTargets.some((target) => target.id === selectedServiceId);
      if (stillValid) return;
    }

    const nextServiceId = pickNextUploadServiceId(
      serviceTargets,
      uploadedCountsByServiceId,
      bracketOverrides,
    );
    setSelectedServiceId((currentServiceId) => (
      currentServiceId === nextServiceId ? currentServiceId : nextServiceId
    ));
  }, [bracketOverrides, isUploading, openGroup, selectedServiceId, serviceTargets, uploadedCountsByServiceId]);

  /**
   * Raw staging no longer classifies by filename.
   *
   * This used to auto-tag anything whose name looked like a floor plan, which filed the
   * frame under a service the shoot may never have booked — and floor plans are not a
   * raw capture target at all now. Media kind is derived from the file itself on the
   * server, and a treatment is applied to existing media afterwards.
   */
  const classifyByFilename = undefined;

  /** Files always land in the group currently open, creating one if none is. */
  const mergeSelectedFiles = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;

    const alreadyStaged = groups.flatMap((group) => group.files);
    const validation = validateFilesAgainstUploadLimits(incomingFiles, alreadyStaged);

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

    setGroups((currentGroups) => {
      const targetId = openGroupId && currentGroups.some((group) => group.id === openGroupId)
        ? openGroupId
        : null;

      if (targetId) {
        return currentGroups.map((group) => (
          group.id === targetId
            ? addFilesToStagedGroup(group, validation.acceptedFiles, classifyByFilename)
            : group
        ));
      }

      const created = addFilesToStagedGroup(
        createStagedUploadGroup(selectedServiceId),
        validation.acceptedFiles,
        classifyByFilename,
      );
      setOpenGroupId(created.id);
      return [...currentGroups, created];
    });
  };

  const removeFileFromGroup = (groupId: string, indexToRemove: number) => {
    setGroups((currentGroups) => currentGroups
      .map((group) => (group.id === groupId ? removeFileFromStagedGroup(group, indexToRemove) : group))
      .filter((group) => group.files.length > 0));
  };

  const removeGroup = (groupId: string) => {
    setGroups((currentGroups) => currentGroups.filter((group) => group.id !== groupId));
    setOpenGroupId((current) => (current === groupId ? null : current));
  };

  /** The open group is what the dropdown edits, so switching it moves that group. */
  const changeSelectedService = (nextServiceId: string) => {
    serviceSelectionTouchedRef.current = true;
    setSelectedServiceId(nextServiceId);
    if (openGroupId) {
      setGroups((currentGroups) => currentGroups.map((group) => (
        group.id === openGroupId ? { ...group, serviceId: nextServiceId } : group
      )));
    }
  };

  /**
   * Collapse what is staged and open a fresh group on a service that has no group
   * yet.
   *
   * Deliberately not `pickNextUploadServiceId` here: that answers "which service
   * still owes files", so a half-filled service keeps winning and the button
   * appears to do nothing. The intent of this action is explicitly *another*
   * service, so an unstaged one is what it must offer, in schedule order. Only
   * when every service already has a group does it fall back to the owed-files
   * ordering.
   */
  const addAnotherServiceGroup = () => {
    const stagedServiceIds = new Set(groups.map((group) => group.serviceId));
    const ordered = [...serviceTargets].sort(compareUploadServiceTargets);
    const firstUnstaged = ordered.find((target) => !stagedServiceIds.has(target.id));

    const nextServiceId = firstUnstaged
      ? firstUnstaged.id
      : pickNextUploadServiceId(serviceTargets, uploadedCountsByServiceId, bracketOverrides);
    const created = createStagedUploadGroup(nextServiceId);
    setGroups((currentGroups) => [...currentGroups, created]);
    setOpenGroupId(created.id);
    setSelectedServiceId(nextServiceId);
    serviceSelectionTouchedRef.current = true;
  };

  /**
   * One user action, several isolated batches.
   *
   * Each group is uploaded as its own batch with its own `upload_batch_id`, so
   * the backend's per-batch bracket offset stays coherent and services never
   * interleave inside one stack. The user still presses upload once.
   */
  const startUpload = (override?: { plans: UploadGroupPlan[]; retryOnly: boolean }) => {
    if (isUploading) {
      return;
    }

    const retryOnly = Boolean(override?.retryOnly);
    let plansForUpload: UploadGroupPlan[];

    if (override) {
      plansForUpload = override.plans;
    } else {
      const groupValidation = validateStagedUploadGroups(groups, {
        requireService: requiresServiceSelection,
      });
      if (!groupValidation.ok) {
        toast({
          title: 'Upload blocked',
          description: groupValidation.message,
          variant: 'destructive',
        });
        return;
      }

      plansForUpload = buildUploadGroupPlans(groups, {
        resolveBracketMode: resolveBracketModeForService,
      });
    }

    const filesInPlans = plansForUpload.flatMap((plan) => plan.files);
    if (filesInPlans.length === 0) {
      return;
    }

    const preflightValidation = validateFilesAgainstUploadLimits(filesInPlans);
    if (preflightValidation.rejectedIssues.length > 0) {
      setUploadIssues((currentIssues) => mergeUploadIssueLists(currentIssues, preflightValidation.rejectedIssues));
      toast({
        title: preflightValidation.acceptedFiles.length > 0 ? 'Some files were skipped' : 'Upload blocked',
        description: buildUploadSummary(preflightValidation.rejectedIssues),
        variant: 'destructive',
      });
    }

    if (preflightValidation.acceptedFiles.length === 0) {
      setGroups([]);
      setOpenGroupId(null);
      setIsUploading(false);
      setUploadProgress(0);
      return;
    }

    const acceptedFileSet = new Set(preflightValidation.acceptedFiles);
    const plans = plansForUpload
      .map((plan) => ({ ...plan, files: plan.files.filter((file) => acceptedFileSet.has(file)) }))
      .filter((plan) => plan.files.length > 0);
    const totalFiles = plans.reduce((total, plan) => total + plan.files.length, 0);

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];
    const noteValue = notes.trim();

    toast({
      title: 'Raw upload started',
      description: plans.length > 1
        ? `${totalFiles} files across ${plans.length} services are uploading in background.`
        : `${totalFiles} file${totalFiles !== 1 ? 's are' : ' is'} uploading in background.`,
    });

    setIsUploading(true);
    setUploadProgress(0);
    if (!retryOnly) {
      setUploadIssues([]);
    }

    trackUpload({
      shootId: String(shoot.id),
      shootAddress: shoot.location?.fullAddress || shoot.location?.address || `Shoot #${shoot.id}`,
      fileCount: totalFiles,
      fileNames: plans.flatMap((plan) => plan.files.map((file) => file.name)),
      uploadType: 'raw',
      uploadFn: async (onProgress) => {
        try {
          const uploadOne = (plan: UploadGroupPlan, file: File, index: number): Promise<{ success: boolean; issues: UploadIssue[]; file: File; originalIndex: number; uploadLimits?: UploadLimitsPayload; acceptedFiles: ReturnType<typeof parseCanonicalUploadResponse>['uploadedFiles'] }> =>
            new Promise((resolve) => {
              const formData = new FormData();
              const mediaType = getQueueClassification(file, index, plan.classifications);
              // Replays the original identity for a file that has already been
              // attempted, so a retry reuses its first batch id, index and total
              // and the backend resolves the same bracket offset for it.
              const identity = ensureUploadAttemptIdentity(file, plan.uploadBatchId, index, plan.files.length);
              // Recorded so a retry can repeat this attempt instead of reading a
              // dropdown that has since auto-advanced to another service.
              rememberUploadFileContext(file, {
                serviceId: plan.serviceId,
                bracketMode: plan.bracketMode,
              });
              formData.append('files[]', file);
              formData.append('upload_type', 'raw');
              // This group's own size, omitted entirely when the service does not
              // bracket. The server resolves the divisor from the service item
              // itself and does not trust this value, so it is sent only to keep
              // the request self-describing and part of the idempotency
              // fingerprint.
              if (plan.bracketMode !== null) {
                formData.append('bracket_mode', String(plan.bracketMode));
              }
              formData.append('idempotency_key', identity.idempotencyKey);
              formData.append('upload_batch_id', identity.batchId);
              formData.append('upload_batch_total', String(identity.batchTotal));
              formData.append('upload_batch_index', String(identity.batchIndex));
              if (plan.serviceId) {
                formData.append('shoot_service_id', plan.serviceId);
              }
              if (noteValue) {
                formData.append('photographer_notes', noteValue);
              }
              if (isVideoUpload(file)) {
                formData.append('service_category', 'video');
              }
              // A treatment and a media type are different axes and must not share a
              // field. VS/GG/TW go to `treatment`, which leaves media_type at 'raw' so
              // the frame stays in its service's stacks, in the Photos tab and in
              // delivery. Extra stays a media type because it really does change what
              // the file is: an unplanned frame outside the contracted count.
              Object.entries(resolveClassificationUploadFields(mediaType)).forEach(
                ([field, value]) => formData.append(field, value),
              );

              const xhr = new XMLHttpRequest();
              xhr.addEventListener('load', () => {
                const uploadResult = parseCanonicalUploadResponse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                  const uploadLimits = uploadResult.uploadLimits ?? parseUploadLimitsResponse(xhr.responseText);
                  setUploadLimitHint((currentHint) => buildUploadLimitDescription(uploadLimits) || currentHint);
                  if (uploadResult.successCount > 0) {
                    mergeAcceptedShootFiles(queryClient, shoot.id, 'raw', uploadResult.uploadedFiles);
                    const parsed = uploadResult.errorCount > 0
                      ? parseUploadIssues(file, index, xhr.responseText, 'Upload partially failed')
                      : { issues: [] as UploadIssue[] };
                    resolve({
                      success: true,
                      issues: parsed.issues,
                      file,
                      originalIndex: index,
                      uploadLimits,
                      acceptedFiles: uploadResult.uploadedFiles,
                    });
                    return;
                  }

                  const parsed = parseUploadIssues(file, index, xhr.responseText, uploadResult.message || 'Upload failed');
                  resolve({ success: false, issues: parsed.issues, file, originalIndex: index, uploadLimits, acceptedFiles: [] });
                  return;
                }

                const parsed = parseUploadIssues(file, index, xhr.responseText, 'Upload failed');
                resolve({ success: false, issues: parsed.issues, file, originalIndex: index, uploadLimits: parsed.uploadLimits, acceptedFiles: [] });
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
                acceptedFiles: [],
              }));
              xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
              if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
              if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
              xhr.send(formData);
            });

          let completed = 0;
          const issues: UploadIssue[] = [];
          const failedFiles = new Set<File>();
          const uploadedFileObjects = new Set<File>();
          const acceptedFiles = [] as ReturnType<typeof parseCanonicalUploadResponse>['uploadedFiles'];
          let latestUploadLimits: UploadLimitsPayload | undefined;

          // Sequential across groups and within them. One request at a time is
          // what makes the backend's batch offset deterministic.
          for (const plan of plans) {
            for (let index = 0; index < plan.files.length; index += 1) {
              const result = await uploadOne(plan, plan.files[index], index);
              completed += 1;

              if (result.uploadLimits) {
                latestUploadLimits = result.uploadLimits;
              }
              acceptedFiles.push(...result.acceptedFiles);
              if (result.issues.length > 0) {
                issues.push(...result.issues);
              }
              if (result.success) {
                uploadedFileObjects.add(result.file);
              } else if (result.issues.length > 0) {
                failedFiles.add(result.file);
              }

              const progressValue = Math.round((completed / totalFiles) * 100);
              setUploadProgress(progressValue);
              onProgress(progressValue);
            }
          }

          const limitHint = buildUploadLimitDescription(latestUploadLimits) || uploadLimitHint;
          setUploadLimitHint(limitHint);

          await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'shootFiles' && String(query.queryKey[1]) === String(shoot.id),
          });
          if (acceptedFiles.length > 0) {
            triggerUploadRefreshes(shoot.id);
          }
          // `onUploadComplete` is the parent's "we're done here" hook and it
          // switches the media tab away from Upload, which unmounts this panel.
          // Calling it after a partial failure threw away the re-staged files and
          // the issue list with them, so the retry the results panel offers had
          // nothing left to act on. Landed files are already visible via the
          // cache invalidation above; only a clean batch hands over control.
          if (acceptedFiles.length > 0 && failedFiles.size === 0) {
            onUploadComplete();
          }

          if (failedFiles.size === totalFiles) {
            setUploadIssues((currentIssues) => retryOnly
              ? mergeUploadIssueLists(currentIssues, issues)
              : issues);
            toast({
              title: 'Upload failed',
              description: buildUploadSummary(issues),
              variant: 'destructive',
            });
            throw new Error(issues[0]?.message || 'All files failed to upload');
          }

          if (failedFiles.size > 0) {
            setUploadIssues((currentIssues) => retryOnly
              ? mergeUploadIssueLists(currentIssues, issues)
              : issues);
            toast({
              title: 'Upload needs attention',
              description: buildUploadSummary(issues),
              variant: 'destructive',
            });
            if (!retryOnly) {
              // Failed files go back into the group they were sent under, so their
              // service survives the failure and a retry cannot mis-credit them.
              const restaged = restageFailedUploadGroups(plans, failedFiles);
              setGroups(restaged);
              setOpenGroupId(restaged[0]?.id ?? null);
            }
            return;
          }

          if (retryOnly) {
            setGroups((currentGroups) => removeFilesFromStagedGroups(currentGroups, uploadedFileObjects));
            setUploadIssues((currentIssues) => currentIssues.filter((issue) =>
              !plans.some((plan) => plan.files.some((file) => issue.fileName === file.name)),
            ));
          } else {
            setGroups([]);
            setOpenGroupId(null);
            setUploadIssues([]);
            setNotes('');
          }
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
      <RawUploadSummaryStrip
        primaryStats={primaryStats}
        tagStats={tagStats}
        expectedBreakdown={expectedBreakdown}
      />

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
        : isUploading && stagedFileCount > 0 && (
            <UploadProgressCard
              fileCount={stagedFileCount}
              fileNames={groups.flatMap((group) => group.files.map((file) => file.name))}
              progress={uploadProgress}
              note="Raw uploads continue in the background. You can leave this shoot and keep working elsewhere."
            />
          ))}

      <UploadDropzone
        empty={stagedFileCount === 0}
        accept={FULL_UPLOAD_ACCEPT}
        inputId={inputId}
        inputTestId="raw-upload-input"
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
        onFilesPicked={mergeSelectedFiles}
        sourceImport={{
          shootId: shoot.id,
          uploadType: 'raw',
          getPayload: () => ({
            // The selected service's own size, omitted when it does not bracket.
            bracket_mode: resolveBracketModeForService(selectedServiceId) ?? undefined,
            shoot_service_id: selectedServiceId || undefined,
            photographer_notes: notes.trim() || undefined,
          }),
          onImported: onUploadComplete,
          disabled: isUploading || (requiresServiceSelection && !selectedServiceId),
        }}
      />

      <UploadResultsPanel
        title="Raw upload results"
        issues={uploadIssues}
        onRetryAll={stagedFileCount > 0 ? handleUpload : undefined}
        onRetryIssue={(issueId) => {
          const selectedIssue = uploadIssues.find((candidate) => candidate.id === issueId);

          let match: { group: StagedUploadGroup; file: File; index: number } | null = null;
          for (const group of groups) {
            const index = group.files.findIndex((file, fileIndex) => (
              issueId.startsWith(getQueueFileKey(file, fileIndex))
              || selectedIssue?.fileName === file.name
            ));
            if (index >= 0) {
              match = { group, file: group.files[index], index };
              break;
            }
          }

          if (!match) {
            return;
          }

          // Service comes from the group this file actually sits in — never from a
          // shared picker. Reading a global selection here is what used to credit
          // a retry to whichever service the dropdown had auto-advanced to, which
          // on a multi-service shoot is simply a different service's work.
          // The group is also what the user can see and reassign, so it stays
          // authoritative over the recorded attempt.
          const recorded = getUploadFileContext(match.file);
          const serviceId = match.group.serviceId;
          // Bracket, by contrast, must repeat the original attempt: the divisor
          // decides bracket_group/sequence, and changing it mid-retry would
          // misalign this file against the stack it already belongs to.
          const bracketMode = recorded && recorded.serviceId === serviceId
            ? recorded.bracketMode
            : resolveBracketModeForService(serviceId);

          const classifications: QueueClassificationMap = {};
          const existingClassification = getQueueClassification(
            match.file,
            match.index,
            match.group.classifications,
          );
          if (existingClassification) {
            classifications[getQueueFileKey(match.file, 0)] = existingClassification;
          }

          if (selectedIssue && !['network_failure', 'upload_in_progress'].includes(selectedIssue.errorType)) {
            rotateUploadAttemptKey(match.file);
          }

          startUpload({
            retryOnly: true,
            plans: [{
              groupId: match.group.id,
              serviceId,
              // Ignored for a file that already has an attempt identity, which is
              // the case for anything being retried; present only as a fallback.
              uploadBatchId: createUploadBatchId(),
              bracketMode,
              files: [match.file],
              classifications,
            }],
          });
        }}
      />

      {groups.length > 0 && (
        // Flex column that fills the remaining vertical space inside the upload tab.
        // The staged list is free to grow and scroll with the dialog body, while
        // everything the user touches right before committing the batch — the
        // editor note and the action bar — is pinned to the bottom.
        <div className="flex flex-1 min-h-0 flex-col space-y-2">
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <span>Selected Files ({stagedFileCount})</span>
            {/* Names only the shortcuts that actually render. Kept deliberately light
                so it reads as a footnote to "Selected Files" rather than competing
                with it. */}
            <span className="text-[11px] font-normal text-muted-foreground/80">
              VS = virtual staging · GG = green grass · TW = twilight · EX = extra
            </span>
          </div>
          {/* The list is the only part of the panel that scrolls: it takes every
              pixel left between the pinned summary above and the pinned footer
              below. `flex-1` is what keeps the footer at the bottom on a short
              batch — without it the leftover height collected under the footer
              and left it floating mid-panel with two files staged. The explicit
              `min-h-0` lets it shrink past its content instead of forcing the
              column taller; when the panel is too short for everything, the
              outer scroll and the sticky edges take over. */}
          {/* One card per service. Only the open group lists its files; the rest
              collapse to a one-line summary so a three-service batch stays
              readable. Collapsing is the whole point of grouping: you fill a
              service, fold it away, and move to the next without uploading in
              between. */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border p-2">
            {groups.map((group) => {
              const groupTarget = serviceTargets.find((target) => target.id === group.serviceId) ?? null;
              const groupBracketMode = resolveBracketModeForService(group.serviceId);

              return (
                <StagedGroupCard
                  key={group.id}
                  group={group}
                  isOpen={group.id === openGroupId}
                  label={resolveServiceLabel(group.serviceId)}
                  expectedCount={groupTarget ? resolveUploadServiceExpectedCount(groupTarget, groupBracketMode) : 0}
                  bracketMode={groupBracketMode}
                  bracketOptions={buildBracketOptionsForService(group.serviceId)}
                  onBracketChange={(mode) => setServiceBracketMode(group.serviceId, mode)}
                  isPhotoService={groupTarget ? groupTarget.isPhotoService : true}
                  serviceTargets={serviceTargets}
                  requiresServiceSelection={requiresServiceSelection}
                  normalizedRole={normalizedRole}
                  onToggleOpen={() => setOpenGroupId(group.id === openGroupId ? null : group.id)}
                  onRemoveGroup={() => removeGroup(group.id)}
                  onChangeService={changeSelectedService}
                  onToggleClassification={(targetFile, targetIndex, mediaType) =>
                    setGroups((currentGroups) => currentGroups.map((candidate) => (
                      candidate.id === group.id
                        ? {
                            ...candidate,
                            classifications: setQueueClassification(
                              targetFile,
                              targetIndex,
                              mediaType,
                              candidate.classifications,
                            ),
                          }
                        : candidate
                    )))
                  }
                  onRemoveFile={(index) => removeFileFromGroup(group.id, index)}
                />
              );
            })}

            {serviceTargets.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isUploading}
                onClick={addAnotherServiceGroup}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add another service
              </Button>
            )}
          </div>

          <RawUploadCommitBar
            notes={notes}
            onNotesChange={setNotes}
            stagedFileCount={stagedFileCount}
            stagedGroups={stagedGroups}
            stagedServiceLabel={stagedGroups.length === 1 ? resolveServiceLabel(stagedGroups[0].serviceId) : ''}
            stagedServiceIsPhoto={
              stagedGroups.length === 1
                ? serviceTargets.find((target) => target.id === stagedGroups[0].serviceId)?.isPhotoService !== false
                : true
            }
            expectedCount={expectedCount}
            totalRawCount={totalRawCount}
            missingCount={missingCount}
            isUploading={isUploading}
            canUpload={
              stagedFileCount > 0
              && !(requiresServiceSelection && stagedGroups.some((group) => !group.serviceId))
            }
            onUpload={handleUpload}
          />
        </div>
      )}

      <ChangeRestackDialog
        pendingRestack={pendingRestack}
        setPendingRestack={setPendingRestack}
        isSavingBracketMode={isSavingBracketMode}
        serviceTargets={serviceTargets}
        confirmRestack={confirmRestack}
      />
    </div>
  );
}
