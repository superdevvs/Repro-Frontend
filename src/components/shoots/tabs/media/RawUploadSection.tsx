import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useUpload } from '@/context/UploadContext';
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
  buildUploadLimitDescription,
  buildUploadSummary,
  createUploadBatchId,
  createEmptyMediaTypeCounts,
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
  reindexClassificationMap,
  resolveExpectedRawCount,
  resolveExpectedFinalCount,
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
  const shootServices = useMemo(() => (Array.isArray(shoot.services) ? shoot.services : []), [shoot.services]);
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
          const uploadOne = (file: File, index: number): Promise<{ success: boolean; issues: UploadIssue[]; file: File; originalIndex: number; uploadLimits?: UploadLimitsPayload }> =>
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
                  const uploadLimits = parseUploadLimitsResponse(xhr.responseText);
                  setUploadLimitHint((currentHint) => buildUploadLimitDescription(uploadLimits) || currentHint);
                  resolve({ success: true, issues: [], file, originalIndex: index, uploadLimits });
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
          let latestUploadLimits: UploadLimitsPayload | undefined;

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
            photographer_notes: notes.trim() || undefined,
          }),
          onImported: onUploadComplete,
          disabled: isUploading,
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
