import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Camera, ChevronDown, Loader2, Upload, Video, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
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
  SummaryCard,
  UploadClassificationButtons,
} from './MediaUploadSharedComponents';
import {
  FULL_UPLOAD_ACCEPT,
  TRACKED_MEDIA_TYPES,
  addFilesToClassificationMap,
  bracketAppliesToUploadService,
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
  getQueueMediaTypeCounts,
  isHdrShoot,
  isEditedFloorplanByName,
  isVideoUpload,
  mergeUploadIssueLists,
  parseUploadLimitsResponse,
  parseUploadIssues,
  parseCanonicalUploadResponse,
  pickNextUploadServiceId,
  reindexClassificationMap,
  resolveExpectedRawCount,
  resolveExpectedFinalCount,
  resolveUploadServiceTargets,
  rotateUploadAttemptKey,
  setQueueClassification,
  toPositiveCount,
  triggerUploadRefreshes,
  validateFilesAgainstUploadLimits,
  type QueueClassificationMap,
  type UploadLimitsPayload,
} from './mediaUploadUtils';

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
  const serviceTargets = useMemo(
    () => resolveUploadServiceTargets(shoot, user, 'raw'),
    [shoot, user],
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
  /**
   * Brackets are a photo concept. On a shoot that mixes HDR photos with video or
   * a floor plan, the picker is only relevant while a photo-delivering service is
   * the upload target. With no service selected at all (admin uploading against
   * the shoot as a whole) fall back to the shoot's own HDR flag.
   *
   * This controls *visibility only*: `bracketMultiplier` is still submitted
   * unchanged, because the upload endpoint writes `bracket_mode` straight onto
   * the shoot and recomputes `expected_raw_count` from it — sending 1 for a video
   * batch would wipe a real HDR setting.
   */
  const bracketApplies = shootRequiresBrackets
    && (selectedTarget ? bracketAppliesToUploadService(selectedTarget) : true);

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

  const existingCounts = useMemo(() => getExistingMediaTypeCounts(rawFiles), [rawFiles]);
  const queueCounts = useMemo(
    () => getQueueMediaTypeCounts(selectedFiles, queueClassifications),
    [queueClassifications, selectedFiles],
  );
  const expectedCount = useMemo(
    () => resolveExpectedRawCount(shoot, bracketMultiplier),
    [bracketMultiplier, shoot],
  );
  const uploadedCount = selectedFiles.length;
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
   * Bracket options with the total each one implies, so the choice shows its
   * consequence instead of being an abstract multiplier.
   */
  const bracketOptions = useMemo(
    () => [3, 5].map((value) => ({ value, expected: resolveExpectedRawCount(shoot, value) })),
    [shoot],
  );

  /**
   * The per-service make-up of `Expected` on one line instead of one line per
   * service. Full text stays available via the title attribute when it has to
   * truncate.
   */
  const expectedBreakdown = useMemo(() => {
    if (photoServices.length === 0) {
      return '';
    }

    const parts = photoServices.map((service) => {
      const count = shootRequiresBrackets ? service.count * bracketMultiplier : service.count;
      return `${service.name} ${count}`;
    });

    if (shootRequiresBrackets) {
      parts.push(`${resolveExpectedFinalCount(shoot)} final x ${bracketMultiplier} brackets`);
    }

    return parts.join(' · ');
  }, [bracketMultiplier, photoServices, shoot, shootRequiresBrackets]);

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
    setSelectedServiceId('');
    serviceSelectionTouchedRef.current = false;
    setUploadLimitHint(buildUploadLimitDescription({
      per_file: '2GB',
      total_request: '2.2GB',
    }));
    setBracketMultiplier(Math.max(1, defaultBracketMultiplierRef.current));
    // Only reset queue when the user switches to a different shoot.
    // Re-fetches of the same shoot (background refreshes) must NOT wipe the
    // in-progress upload queue – that was causing the "first drag/drop does
    // nothing, second time works" bug when bracketMode/services flipped.
  }, [shoot.id, user?.id]);

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

    if (serviceSelectionTouchedRef.current) {
      const stillValid = selectedServiceId === ''
        || serviceTargets.some((target) => target.id === selectedServiceId);
      if (stillValid) return;
    }

    const nextServiceId = pickNextUploadServiceId(
      serviceTargets,
      uploadedCountsByServiceId,
      bracketMultiplier,
    );
    setSelectedServiceId((currentServiceId) => (
      currentServiceId === nextServiceId ? currentServiceId : nextServiceId
    ));
  }, [bracketMultiplier, isUploading, selectedServiceId, serviceTargets, uploadedCountsByServiceId]);

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

  const startUpload = (
    overrideFiles?: File[],
    overrideClassifications?: QueueClassificationMap,
    options?: { retryOnly?: boolean },
  ) => {
    const retryOnly = Boolean(options?.retryOnly);
    const nextFiles = overrideFiles ?? selectedFiles;
    if (nextFiles.length === 0 || isUploading) {
      return;
    }

    if (requiresServiceSelection && !selectedServiceId) {
      toast({
        title: 'Choose a service',
        description: 'Select the assigned service item for this upload batch.',
        variant: 'destructive',
      });
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
    // Pinned for the whole batch. The picker can advance to the next service as
    // soon as these files land, and every file in this batch must still carry the
    // service that was on screen when the user pressed upload.
    const serviceIdForUpload = selectedServiceId;
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
    if (!retryOnly) {
      setUploadIssues([]);
    }

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
          const uploadOne = (file: File, index: number): Promise<{ success: boolean; issues: UploadIssue[]; file: File; originalIndex: number; uploadLimits?: UploadLimitsPayload; acceptedFiles: ReturnType<typeof parseCanonicalUploadResponse>['uploadedFiles'] }> =>
            new Promise((resolve) => {
              const formData = new FormData();
              const mediaType = getQueueClassification(file, index, classificationsForUpload);
              const identity = ensureUploadAttemptIdentity(file, uploadBatchId, index, filesForUpload.length);
              formData.append('files[]', file);
              formData.append('upload_type', 'raw');
              formData.append('bracket_mode', String(bracketMultiplier));
              formData.append('idempotency_key', identity.idempotencyKey);
              formData.append('upload_batch_id', identity.batchId);
              formData.append('upload_batch_total', String(identity.batchTotal));
              formData.append('upload_batch_index', String(identity.batchIndex));
              if (serviceIdForUpload) {
                formData.append('shoot_service_id', serviceIdForUpload);
              }
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

          const concurrentUploads = 1;
          let completed = 0;
          const issues: UploadIssue[] = [];
          const failedFileEntries: Array<{ file: File; originalIndex: number }> = [];
          const acceptedFiles = [] as ReturnType<typeof parseCanonicalUploadResponse>['uploadedFiles'];
          let latestUploadLimits: UploadLimitsPayload | undefined;

          for (let index = 0; index < filesForUpload.length; index += concurrentUploads) {
            const batch = filesForUpload.slice(index, index + concurrentUploads);
            const results = await Promise.all(batch.map((file, batchIndex) => uploadOne(file, index + batchIndex)));
            results.forEach((result) => {
              completed += 1;
              if (result.uploadLimits) {
                latestUploadLimits = result.uploadLimits;
              }
              acceptedFiles.push(...result.acceptedFiles);
              if (result.issues.length > 0) {
                issues.push(...result.issues);
              }
              if (!result.success && result.issues.length > 0) {
                failedFileEntries.push({ file: result.file, originalIndex: result.originalIndex });
              }
            });

            const progressValue = Math.round((completed / filesForUpload.length) * 100);
            setUploadProgress(progressValue);
            onProgress(progressValue);
          }

          const limitHint = buildUploadLimitDescription(latestUploadLimits) || uploadLimitHint;
          setUploadLimitHint(limitHint);

          await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'shootFiles' && String(query.queryKey[1]) === String(shoot.id),
          });
          if (acceptedFiles.length > 0) {
            triggerUploadRefreshes(shoot.id);
            onUploadComplete();
          }

          if (failedFileEntries.length === filesForUpload.length) {
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

          if (failedFileEntries.length > 0) {
            setUploadIssues((currentIssues) => retryOnly
              ? mergeUploadIssueLists(currentIssues, issues)
              : issues);
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
            if (!retryOnly) {
              setSelectedFiles(failedFiles);
              setQueueClassifications(failedClassificationMap);
            }
            return;
          }

          if (retryOnly) {
            const retried = new Set(filesForUpload);
            setSelectedFiles((currentFiles) => {
              const remaining = currentFiles.filter((file) => !retried.has(file));
              setQueueClassifications((currentMap) => reindexClassificationMap(remaining, currentMap));
              return remaining;
            });
            setUploadIssues((currentIssues) => currentIssues.filter((issue) =>
              !filesForUpload.some((file) => issue.fileName === file.name),
            ));
          } else {
            setSelectedFiles([]);
            setQueueClassifications({});
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
      {/* One counter strip for the whole batch.
          Every counter — Expected / Existing / Selected / Extras, any tagged
          media type, and the shortfall — shares a single divided row with its
          label and value on the same baseline, and the per-service make-up of
          Expected sits underneath on one line.
          This replaced two stacked full-width rows (label above value) plus a
          separate warning banner, where the Expected tile also printed one line
          per service. A routine two-service shoot spent 165px to show four
          numbers, and a shoot with no tagged media still paid for an entire
          second row just to render "Extras 0". */}
      {/* Pinned to the top of the panel. These are the numbers the user checks
          while working through the batch, so they stay put and the file list
          scrolls underneath instead of carrying them off screen. `bg-card`
          matches the panel this renders inside, so scrolled rows disappear
          behind it cleanly. The negative top with matching top padding pins it
          slightly above the scroll edge, so the band of card padding above it
          is covered too — otherwise a sliver of the list showed through there. */}
      <div
        className="sticky -top-3 z-10 -mt-3 flex-shrink-0 space-y-1 bg-card pb-2 pt-3"
        data-testid="raw-upload-summary"
      >
        {/* Progress counters. auto-fit tracks rather than flex-wrap: a wrapping
            flex row grows each line independently, which produced ragged
            columns (125px on the first line, 187px on the second) and truncated
            the longer labels. auto-fit keeps every column the same width, and
            because it measures the container it stays correct inside the narrow
            dialog column where viewport breakpoints would misjudge the space. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] overflow-hidden rounded-md border bg-muted/50 text-xs">
          {primaryStats.map((stat) => (
            <div
              key={stat.key}
              className={`flex min-w-0 items-baseline justify-between gap-2 border-b border-r border-border/60 px-3 py-1.5 ${
                stat.alert ? 'bg-orange-500/10' : ''
              }`}
            >
              <span
                className={`truncate text-[11px] uppercase tracking-wide ${
                  stat.alert ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground'
                }`}
                title={stat.label}
              >
                {stat.label}
              </span>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  stat.alert ? 'text-orange-700 dark:text-orange-200' : 'text-foreground'
                }`}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Per-service tags on their own row, tinted to separate them from the
            progress block above. Emerald is already this codebase's colour for
            tagged media counts (see EditedUploadSection). */}
        {tagStats.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] overflow-hidden rounded-md border border-emerald-500/25 bg-emerald-500/[0.06] text-xs">
            {tagStats.map((stat) => (
              <div
                key={stat.key}
                className="flex min-w-0 items-baseline justify-between gap-2 border-b border-r border-emerald-500/20 px-3 py-1.5"
              >
                <span className="truncate text-emerald-700 dark:text-emerald-300" title={stat.label}>
                  {stat.label}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {expectedBreakdown && (
          <p className="truncate px-1 text-[11px] leading-4 text-muted-foreground" title={expectedBreakdown}>
            {expectedBreakdown}
          </p>
        )}
      </div>

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
            bracket_mode: bracketMultiplier,
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
        onRetryAll={selectedFiles.length > 0 ? handleUpload : undefined}
        onRetryIssue={(issueId) => {
          const selectedIssue = uploadIssues.find((candidate) => candidate.id === issueId);
          const matchingEntry = selectedFiles
            .map((file, index) => ({ file, index, key: getQueueFileKey(file, index) }))
            .find((entry) => issueId.startsWith(entry.key) || selectedIssue?.fileName === entry.file.name);

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

          if (selectedIssue && !['network_failure', 'upload_in_progress'].includes(selectedIssue.errorType)) {
            rotateUploadAttemptKey(matchingEntry.file);
          }
          startUpload(singleFile, nextMap, { retryOnly: true });
        }}
      />

      {selectedFiles.length > 0 && (
        // Flex column that fills the remaining vertical space inside the upload tab.
        // The selected-files list is free to grow and scroll with the dialog body,
        // while everything the user touches right before committing the batch — the
        // editor note and the action bar — is pinned to the bottom.
        <div className="flex flex-1 min-h-0 flex-col space-y-2">
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <span>Selected Files ({selectedFiles.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              (FP = floorplan, VS = virtual staging, GG = green grass, TW = twilight, DR = drone, EX = extra)
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
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-md border p-2">
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

          {/* Pinned footer. The editor note and the action bar are one unit: both
              belong to the moment of committing the batch, so they stay on screen
              together while the file list scrolls behind them. The note used to
              scroll away with the list, so adding a note to a large batch meant
              scrolling back up past every file to find the box. Opaque background
              because sticky content sits over the list. */}
          <div className="sticky bottom-0 z-10 flex-shrink-0 space-y-2 bg-card pt-2">
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-foreground">Notes for Editor (Optional)</div>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add any notes for the editor..."
                className="min-h-[60px] max-h-[84px] resize-none"
              />
            </div>

            {/* Bottom action bar: what is being sent, where it is going, and the
                commit action, all on one line at the point of decision.
                The service picker used to sit at the very top of the panel, a full
                scroll away from the button that acts on it, and the bracket picker
                took a whole bordered row of its own. Both now live next to the
                action they qualify.
                Slots wrap on a minimum width rather than on viewport breakpoints:
                this panel renders inside a narrow dialog column, so the reflow has
                to follow the container's own width. Each slot keeps a floor of
                190px and grows to share whatever is left, so a wide bar puts all
                three side by side and a narrow one stacks them full width — and
                the primary action never has to truncate its label to fit. */}
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
              <div className="flex min-w-[190px] flex-1 flex-col gap-1">
                <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{selectedFiles.length}</span>
                  {selectedFiles.length === 1 ? 'file' : 'files'}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
                {serviceTargets.length > 0 ? (
                  <div className="relative">
                    {selectedTarget && !selectedTarget.isPhotoService ? (
                      <Video className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Camera className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    )}
                    <select
                      value={selectedServiceId}
                      onChange={(event) => {
                        serviceSelectionTouchedRef.current = true;
                        setSelectedServiceId(event.target.value);
                      }}
                      className="h-9 w-full appearance-none truncate rounded-md border border-input bg-background pl-8 pr-9 text-sm font-medium text-foreground"
                      aria-label="Service for raw upload batch"
                    >
                      <option value="">
                        {normalizedRole === 'photographer' ? 'Select assigned service' : 'General / Unassigned'}
                      </option>
                      {serviceTargets.map((target) => (
                        <option key={target.id} value={target.id}>{target.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  </div>
                ) : (
                  <span className="flex h-9 items-center text-sm text-muted-foreground">
                    Ready to upload
                  </span>
                )}
              </div>

              {/* Middle slot. Brackets take priority over the progress read-out
                  because they are an input the user can still change, while the
                  counters are also printed in the summary strip at the top of the
                  panel — nothing is lost by handing this space to the picker. */}
              {bracketApplies ? (
                <div className="flex min-w-[190px] flex-1 flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Bracket
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Bracket type"
                    className="flex h-9 items-center gap-1 rounded-md border bg-muted/40 p-1"
                  >
                    {bracketOptions.map((option) => {
                      const isSelected = bracketMultiplier === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          title={`${option.value} exposures per final photo · ${option.expected} raw files expected`}
                          className={`flex min-w-0 flex-1 items-baseline justify-center gap-1 rounded px-1.5 py-1 text-xs transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          onClick={() => setBracketMultiplier(option.value)}
                        >
                          <span className="font-medium">{option.value}x</span>
                          <span
                            className={`tabular-nums ${
                              isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground/70'
                            }`}
                          >
                            {option.expected}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : expectedCount > 0 && (
                <div className="flex min-w-[190px] flex-1 flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Progress
                  </span>
                  <div className="flex h-9 flex-col justify-center gap-1">
                    <Progress
                      value={Math.min(100, Math.round((totalRawCount / expectedCount) * 100))}
                      className="h-1.5"
                    />
                    <span className="truncate text-[11px] leading-none text-muted-foreground">
                      <span className="font-medium tabular-nums text-foreground">
                        {totalRawCount} / {expectedCount}
                      </span>
                      {missingCount > 0 && (
                        <>
                          {' · '}
                          <span className="tabular-nums text-orange-700 dark:text-orange-300">
                            {missingCount} missing
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              <Button
                type="button"
                className="h-9 min-w-[190px] flex-1 shadow-sm"
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0 || (requiresServiceSelection && !selectedServiceId)}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="truncate">Uploading</span>
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">Confirm &amp; upload</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
