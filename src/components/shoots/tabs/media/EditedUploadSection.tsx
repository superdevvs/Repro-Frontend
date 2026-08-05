import { useEffect, useMemo, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useUpload } from '@/context/UploadContext';
import { finalizeEditedUploadQueue, getMediaUploadErrorMessage } from '@/services/dropboxMediaService';
import {
  UploadDropzone,
  UploadProgressCard,
  UploadResultsPanel,
  type UploadIssue,
} from './MediaUploadPanels';
import {
  SummaryBadge,
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
  getExistingMediaTypeCounts,
  getMediaTypeCards,
  getQueueClassification,
  getQueueFileKey,
  getQueueMediaTypeCounts,
  isEditedFloorplanByName,
  isVideoUpload,
  mergeUploadIssueLists,
  parseUploadLimitsResponse,
  parseUploadIssues,
  reindexClassificationMap,
  resolveExpectedFinalCount,
  setQueueClassification,
  triggerUploadRefreshes,
  validateFilesAgainstUploadLimits,
  type QueueClassificationMap,
  type UploadLimitsPayload,
} from './mediaUploadUtils';

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
  const [isSubmittingAfterUpload, setIsSubmittingAfterUpload] = useState(false);
  const [pendingSubmitAfterUpload, setPendingSubmitAfterUpload] = useState(false);
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
    setIsSubmittingAfterUpload(false);
    setPendingSubmitAfterUpload(false);
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

  const startUpload = (
    overrideFiles?: File[],
    overrideClassifications?: QueueClassificationMap,
    options?: { submitAfter?: boolean },
  ) => {
    const submitAfter = Boolean(options?.submitAfter) && Boolean(isEditor);
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
      setPendingSubmitAfterUpload(false);
      return;
    }

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];

    toast({
      title: submitAfter ? 'Upload & submit started' : 'Edited upload started',
      description: submitAfter
        ? `${nextFiles.length} file${nextFiles.length !== 1 ? 's are' : ' is'} uploading; edits will be submitted automatically when complete.`
        : `${nextFiles.length} file${nextFiles.length !== 1 ? 's are' : ' is'} uploading in background.`,
    });

    setIsUploading(true);
    setPendingSubmitAfterUpload(submitAfter);
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
          const uploadOne = (file: File, index: number): Promise<{ success: boolean; issues: UploadIssue[]; file: File; originalIndex: number; uploadLimits?: UploadLimitsPayload }> =>
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
            setPendingSubmitAfterUpload(false);
            return;
          }

          setSelectedFiles([]);
          setQueueClassifications({});
          setUploadIssues([]);
          setNotes('');
          onUploadComplete();

          if (submitAfter) {
            try {
              setIsSubmittingAfterUpload(true);
              const finalizeRes = await finalizeEditedUploadQueue(shoot.id, getApiHeaders());
              const changed = Boolean(finalizeRes.workflow_status_changed);
              toast({
                title: changed ? 'Edited files submitted' : 'Already submitted',
                description: finalizeRes.message
                  || (changed ? 'Shoot moved to Ready for client review.' : 'These edits were already submitted.'),
              });
              triggerUploadRefreshes(shoot.id);
            } catch (submitError: unknown) {
              const description = getMediaUploadErrorMessage(submitError, 'Failed to submit edits.');
              toast({
                title: 'Submit edits failed',
                description,
                variant: 'destructive',
              });
            } finally {
              setIsSubmittingAfterUpload(false);
              setPendingSubmitAfterUpload(false);
            }
          } else {
            setPendingSubmitAfterUpload(false);
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

  const handleUploadAndSubmit = () => {
    startUpload(undefined, undefined, { submitAfter: true });
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
        onFilesPicked={mergeSelectedFiles}
        sourceImport={{
          shootId: shoot.id,
          uploadType: 'edited',
          getPayload: () => ({
            editor_notes: notes.trim() || undefined,
          }),
          onImported: onUploadComplete,
          disabled: isUploading || isSubmittingAfterUpload,
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

          {isEditor ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                onClick={handleUpload}
                disabled={isUploading || isSubmittingAfterUpload || selectedFiles.length === 0}
              >
                {isUploading && !pendingSubmitAfterUpload ? (
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
              <Button
                type="button"
                className="w-full sm:flex-1"
                onClick={handleUploadAndSubmit}
                disabled={isUploading || isSubmittingAfterUpload || selectedFiles.length === 0}
              >
                {isSubmittingAfterUpload ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Edits
                  </>
                ) : isUploading && pendingSubmitAfterUpload ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading & Submitting
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Submit Edits
                  </>
                )}
              </Button>
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
