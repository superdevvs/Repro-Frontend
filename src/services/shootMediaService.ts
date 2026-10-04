import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { CLOUDFLARE_SAFE_UPLOAD_BYTES, uploadMediaRequest } from '@/components/shoots/tabs/media/uploadMediaRequest';
import { runUploadConcurrencyPool } from '@/components/shoots/tabs/media/mediaUploadConcurrency';
import { prepareRawUploadBatch } from '@/components/shoots/tabs/media/prepareRawUploadBatch';
import { createUploadBatchId, ensureUploadAttemptIdentity } from '@/components/shoots/tabs/media/uploadAttemptIdentity';
import { resolveUploadLaneForFile } from '@/components/shoots/tabs/media/uploadIntakeLanes';

export interface ShootMediaFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: string | null;
  mime_type: string;
  thumbnail_link: string | null;
}

export interface ShootMediaResponse {
  data: ShootMediaFile[];
  counts: {
    raw_photo_count: number;
    edited_photo_count: number;
    extra_photo_count: number;
    expected_raw_count: number;
    expected_final_count: number;
    raw_missing_count: number;
    edited_missing_count: number;
    bracket_mode: number | null;
  };
}

export interface ZipDownloadResponse {
  type: 'redirect' | 'download';
  url?: string;
}

export interface MediaUploadErrorItem {
  file_name?: string;
  message?: string;
  error_type?: string;
}

export interface MediaUploadResponse {
  message?: string;
  success_count: number;
  error_count?: number;
  partial_success?: boolean;
  errors?: MediaUploadErrorItem[];
  error_type?: string;
  workflow_status?: string;
  workflow_status_changed?: boolean;
  /** Client-local positions acknowledged by the per-file uploader. */
  confirmed_file_indexes?: number[];
}

export interface FinalizeRawUploadResponse {
  message?: string;
  shoot_status?: string;
  workflow_status_changed?: boolean;
  raw_photo_count?: number;
  edited_photo_count?: number;
  raw_missing_count?: number;
  edited_missing_count?: number;
  missing_raw?: boolean;
  missing_final?: boolean;
}

export const getMediaUploadErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const payload = error.response?.data as
    | {
        message?: string;
        error_type?: string;
        errors?: MediaUploadErrorItem[];
        correlation_id?: string;
      }
    | undefined;

  const baseMessage = (payload?.message?.trim() || fallback) + (payload?.correlation_id ? ` Reference: ${payload.correlation_id}` : '');

  if (payload?.error_type === 'invalid_workflow_stage') {
    return `${baseMessage} Please move the shoot into the upload/editing workflow and try again.`;
  }

  if (payload?.error_type === 'forbidden') {
    return `${baseMessage} Your account does not have permission for this upload.`;
  }

  if (payload?.error_type === 'oversize') {
    return `${baseMessage} One or more files are too large for the server upload limit.`;
  }

  if (payload?.errors?.length) {
    const firstError = payload.errors.find((item) => item?.message)?.message?.trim();
    if (firstError) {
      return firstError;
    }
  }

  return baseMessage;
};

export const finalizeRawUploadQueue = async (
  shootId: string | number,
  headers?: Record<string, string>,
): Promise<FinalizeRawUploadResponse> => {
  const response = await axios.post<FinalizeRawUploadResponse>(
    `${API_BASE_URL}/api/shoots/${shootId}/upload/finalize-raw`,
    {},
    headers ? { headers } : undefined,
  );

  return response.data;
};

export interface FinalizeEditedUploadResponse extends FinalizeRawUploadResponse {
  error_type?: string;
  editing_submission_changed?: boolean;
  correlation_id?: string;
  retryable?: boolean;
}

export const finalizeEditedUploadQueue = async (
  shootId: string | number,
  headers?: Record<string, string>,
): Promise<FinalizeEditedUploadResponse> => {
  const response = await axios.post<FinalizeEditedUploadResponse>(
    `${API_BASE_URL}/api/shoots/${shootId}/upload/finalize-edited`,
    {},
    headers ? { headers } : undefined,
  );

  return response.data;
};

export interface ApproveEditingReviewResponse {
  message?: string;
  workflow_status_changed?: boolean;
  shoot_status?: string;
  edited_photo_count?: number;
  error_type?: string;
}

export const approveEditingReview = async (
  shootId: string | number,
  headers?: Record<string, string>,
): Promise<ApproveEditingReviewResponse> => {
  const response = await axios.post<ApproveEditingReviewResponse>(
    `${API_BASE_URL}/api/shoots/${shootId}/approve-editing-review`,
    {},
    headers ? { headers } : undefined,
  );

  return response.data;
};

interface UploadFilesIndividuallyConfig {
  endpoint: string;
  shootId: string;
  uploadType: 'raw' | 'edited' | 'extra';
  files: File[];
  token: string;
  onProgress?: (progress: number) => void;
  appendFields?: (formData: FormData, file: File, index: number) => void;
}

const uploadFilesIndividually = async ({ endpoint, shootId, uploadType, files, token, onProgress, appendFields }: UploadFilesIndividuallyConfig): Promise<MediaUploadResponse> => {
  const totalBytes = files.reduce((sum, file) => sum + Math.max(file.size, 0), 0);
  const transferred = files.map(() => 0);
  const confirmed = new Set<number>();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  let successCount = 0;
  let workflowStatus: string | undefined;
  let workflowStatusChanged = false;
  const errors: MediaUploadErrorItem[] = [];
  const groups = uploadType === 'raw'
    ? [...new Set(files.map(resolveUploadLaneForFile))].map((lane) => files.filter((file) => resolveUploadLaneForFile(file) === lane))
    : [files];
  let stopped = false;
  let stopMessage = 'Not sent because the upload was interrupted. Retry the remaining files.';
  for (const group of groups) {
    const batchId = createUploadBatchId();
    group.forEach((file, index) => ensureUploadAttemptIdentity(file, batchId, index, group.length));
    let concurrency = uploadType === 'edited' ? 3 : 1;
    if (uploadType === 'raw' && !stopped) {
      try { concurrency = await prepareRawUploadBatch({ shootId, files: group, batchId, headers }); }
      catch (error) { stopped = true; stopMessage = error instanceof Error ? error.message : stopMessage; }
    }
    const results = await runUploadConcurrencyPool<File, { stop: boolean; error?: MediaUploadErrorItem; errors?: MediaUploadErrorItem[] }>({
      items: group, concurrency: stopped ? 1 : concurrency,
      exclusive: (file) => file.size > CLOUDFLARE_SAFE_UPLOAD_BYTES,
      stopWhen: (result) => result.stop,
      onSkipped: (file) => ({ stop: true, error: { file_name: file.name, message: 'Not sent because the upload was interrupted. Retry the remaining files.' } }),
      run: async (file, index) => {
        if (stopped) return { stop: true, error: { file_name: file.name, message: stopMessage } };
        const identity = ensureUploadAttemptIdentity(file, batchId, index, group.length);
        const fileIndex = files.indexOf(file);
        const body = new FormData();
        body.append('files[]', file);
        body.append('idempotency_key', identity.idempotencyKey);
        body.append('upload_batch_id', identity.batchId);
        body.append('upload_batch_total', String(identity.batchTotal));
        body.append('upload_batch_index', String(identity.batchIndex));
        if (uploadType === 'raw') body.append('upload_lane', resolveUploadLaneForFile(file));
        appendFields?.(body, file, fileIndex);
        const response = await uploadMediaRequest({ url: endpoint, body, headers, onProgress: ({ phase, loaded, total }) => {
          transferred[fileIndex] = file.size * (phase === 'processing' ? 1 : Math.min(1, loaded / Math.max(total || file.size, 1)));
          onProgress?.(Math.min(99.9, totalBytes > 0 ? transferred.reduce((sum, bytes) => sum + bytes, 0) / totalBytes * 100 : confirmed.size / Math.max(files.length, 1) * 100));
        } });
        if (response.ok === false) return { stop: true, error: { file_name: file.name, message: response.message } };
        let payload: MediaUploadResponse;
        try { payload = JSON.parse(response.responseText); } catch { return { stop: true, error: { file_name: file.name, message: 'The server did not confirm this upload. Retry safely.' } }; }
        if (response.status >= 200 && response.status < 300 && payload.success_count > 0) {
          successCount += payload.success_count;
          confirmed.add(fileIndex);
          transferred[fileIndex] = file.size;
          workflowStatus = payload.workflow_status ?? workflowStatus;
          workflowStatusChanged ||= Boolean(payload.workflow_status_changed);
          return { stop: false, errors: payload.errors };
        }
        return { stop: [401, 403, 409, 429].includes(response.status) || response.status >= 500,
          error: payload.errors?.[0] ?? { file_name: file.name, message: payload.message || 'Upload failed', error_type: payload.error_type } };
      },
    });
    for (const result of results) {
      stopped ||= result.stop;
      if (result.error) errors.push(result.error);
      if (result.errors) errors.push(...result.errors);
    }
  }
  if (successCount === 0 && errors.length) throw new Error(errors[0].message || 'Upload failed');
  if (!errors.length) onProgress?.(100);
  return { message: errors.length ? 'Files processed with some upload errors' : 'Files processed', success_count: successCount,
    confirmed_file_indexes: [...confirmed],
    error_count: errors.length, partial_success: successCount > 0 && errors.length > 0, errors,
    workflow_status: workflowStatus, workflow_status_changed: workflowStatusChanged };
};

/**
 * Fetch media files for a shoot by type
 */
export const fetchShootMedia = async (
  shootId: string,
  type: 'raw' | 'edited' | 'extra',
  token: string
): Promise<ShootMediaResponse> => {
  const response = await axios.get(`${API_BASE_URL}/api/shoots/${shootId}/media`, {
    params: { type },
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
};

/**
 * Upload RAW photos with bracket mode
 */
export const uploadRawPhotos = async (
  shootId: string,
  files: File[],
  bracketMode: 3 | 5 | null,
  token: string,
  onProgress?: (progress: number) => void
): Promise<MediaUploadResponse> => {
  const result = await uploadFilesIndividually({
    endpoint: `${API_BASE_URL}/api/shoots/${shootId}/upload`,
    shootId, uploadType: 'raw',
    files,
    token,
    onProgress,
    appendFields: (formData) => {
      formData.append('upload_type', 'raw');
      if (bracketMode) {
        formData.append('bracket_mode', bracketMode.toString());
      }
    },
  });

  return result;
};

/**
 * Upload extra RAW photos
 */
export const uploadExtraPhotos = async (
  shootId: string,
  files: File[],
  token: string,
  onProgress?: (progress: number) => void
): Promise<MediaUploadResponse> => {
  return uploadFilesIndividually({
    endpoint: `${API_BASE_URL}/api/shoots/${shootId}/upload-extra`,
    shootId, uploadType: 'extra',
    files,
    token,
    onProgress,
  });
};

/**
 * Upload edited photos
 */
export const uploadEditedPhotos = async (
  shootId: string,
  files: File[],
  token: string,
  onProgress?: (progress: number) => void
): Promise<MediaUploadResponse> => {
  return uploadFilesIndividually({
    endpoint: `${API_BASE_URL}/api/shoots/${shootId}/upload`,
    shootId, uploadType: 'edited',
    files,
    token,
    onProgress,
    appendFields: (formData) => {
      formData.append('upload_type', 'edited');
    },
  });
};

/**
 * Download media as ZIP
 */
export const downloadMediaZip = async (
  shootId: string,
  type: 'raw' | 'edited',
  token: string
): Promise<ZipDownloadResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/shoots/${shootId}/media/download-zip`,
    {
      params: { type },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

/**
 * Get an authenticated media download URL for a file thumbnail.
 */
export const getMediaThumbnail = async (
  shootId: string,
  fileId: string,
  token: string
): Promise<string | null> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/shoots/${shootId}/media/${fileId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.url || null;
  } catch (error) {
    console.error('Failed to get media thumbnail:', error);
    return null;
  }
};

export interface RenameMediaFileData {
  id: string | number;
  filename: string;
  stored_filename?: string | null;
}

export interface RenameMediaFileResponse {
  data: RenameMediaFileData;
  message?: string;
  media_revision?: number;
}

/**
 * Rename a shoot media file's display filename.
 * PATCH /api/shoots/{shootId}/media/{fileId}/rename
 * Body: { filename }
 */
export const renameShootMediaFile = async (
  shootId: string | number,
  fileId: string | number,
  filename: string,
  headers?: Record<string, string>,
): Promise<RenameMediaFileResponse> => {
  const response = await retryWhenRenameBusy(() => axios.patch<RenameMediaFileResponse>(
    `${API_BASE_URL}/api/shoots/${shootId}/media/${fileId}/rename`,
    { filename },
    headers ? { headers } : undefined,
  ));
  return response.data;
};

export const RENAME_BUSY_RETRY_DELAYS_MS = [2_000, 4_000];

/** A busy (503) rename response guarantees nothing was renamed, so resending is safe. */
async function retryWhenRenameBusy<T>(send: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      const busy = axios.isAxiosError(error) && error.response?.status === 503 && error.response.data?.retryable === true;
      if (!busy || attempt >= RENAME_BUSY_RETRY_DELAYS_MS.length) throw error;
      await new Promise(resolve => setTimeout(resolve, RENAME_BUSY_RETRY_DELAYS_MS[attempt]));
    }
  }
}


export type BatchRenameMode = 'prefix' | 'suffix' | 'replace' | 'sequence' | 'numbering';

export interface BatchRenameMediaRequest {
  file_ids: Array<string | number>;
  mode: BatchRenameMode;
  value?: string;
  find?: string;
  replace?: string;
  start?: number;
  digits?: number;
  separator?: string;
  number_action?: 'remove' | 'move' | 'renumber';
  number_position?: 'start' | 'end';
}

export interface BatchRenameUpdatedItem {
  id: string | number;
  filename: string;
  stored_filename?: string | null;
}

export interface BatchRenameFailedItem {
  id?: string | number;
  file_id?: string | number;
  message?: string;
  error?: string;
}

export interface BatchRenameMediaResponse {
  data: {
    updated: BatchRenameUpdatedItem[];
    failed: BatchRenameFailedItem[];
  };
  message?: string;
  media_revision?: number;
}

/**
 * Batch-rename shoot media filenames.
 * POST /api/shoots/{shootId}/media/batch-rename
 */
export const batchRenameShootMediaFiles = async (
  shootId: string | number,
  payload: BatchRenameMediaRequest,
  headers?: Record<string, string>,
): Promise<BatchRenameMediaResponse> => {
  const response = await retryWhenRenameBusy(() => axios.post<BatchRenameMediaResponse>(
    `${API_BASE_URL}/api/shoots/${shootId}/media/batch-rename`,
    payload,
    headers ? { headers } : undefined,
  ));
  return response.data;
};


export interface DeleteShootMediaResponse {
  message?: string;
  deleted_id?: string | number;
  deleted_ids?: Array<string | number>;
  failed_ids?: Array<string | number>;
  counts?: {
    raw_photo_count?: number;
    edited_photo_count?: number;
    extra_photo_count?: number;
    raw_missing_count?: number;
    edited_missing_count?: number;
  };
  media_revision?: number;
}

/** DELETE /api/shoots/{shootId}/media/{fileId} */
export const deleteShootMediaFile = async (
  shootId: string | number,
  fileId: string | number,
  headers?: Record<string, string>,
): Promise<DeleteShootMediaResponse> => {
  const response = await axios.delete<DeleteShootMediaResponse>(
    `${API_BASE_URL}/api/shoots/${shootId}/media/${fileId}`,
    headers ? { headers } : undefined,
  );
  return response.data;
};
