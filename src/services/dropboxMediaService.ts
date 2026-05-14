import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

export interface DropboxMediaFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: string | null;
  mime_type: string;
  thumbnail_link: string | null;
}

export interface DropboxMediaResponse {
  data: DropboxMediaFile[];
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
      }
    | undefined;

  const baseMessage = payload?.message?.trim() || fallback;

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
  files: File[];
  token: string;
  onProgress?: (progress: number) => void;
  appendFields?: (formData: FormData, file: File, index: number) => void;
}

const createUploadBatchId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const uploadFilesIndividually = async ({
  endpoint,
  files,
  token,
  onProgress,
  appendFields,
}: UploadFilesIndividuallyConfig): Promise<MediaUploadResponse> => {
  const totalBytes = files.reduce((sum, file) => sum + Math.max(file.size, 0), 0);
  const inFlightBytes = new Map<number, number>();
  let processedFiles = 0;
  let processedBytes = 0;
  let successCount = 0;
  let workflowStatus: string | undefined;
  let workflowStatusChanged = false;
  const errors: MediaUploadErrorItem[] = [];
  const uploadBatchId = files.length > 1 ? createUploadBatchId() : null;

  const updateProgress = () => {
    const uploadedBytes = processedBytes + Array.from(inFlightBytes.values()).reduce((sum, value) => sum + value, 0);
    const progress = totalBytes > 0
      ? Math.round((Math.min(uploadedBytes, totalBytes) * 100) / totalBytes)
      : Math.round((processedFiles * 100) / Math.max(files.length, 1));
    onProgress?.(progress);
  };

  const concurrentUploads = 1;

  for (let index = 0; index < files.length; index += concurrentUploads) {
    const batch = files.slice(index, index + concurrentUploads);

    await Promise.all(batch.map(async (file, batchIndex) => {
      const fileIndex = index + batchIndex;
      const formData = new FormData();
      formData.append('files[]', file);
      if (uploadBatchId) {
        formData.append('upload_batch_id', uploadBatchId);
        formData.append('upload_batch_total', files.length.toString());
        formData.append('upload_batch_index', fileIndex.toString());
      }
      appendFields?.(formData, file, fileIndex);

      try {
        const response = await axios.post<MediaUploadResponse>(endpoint, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const loadedBytes = file.size > 0
              ? Math.min(progressEvent.loaded, file.size)
              : Math.min(progressEvent.loaded, progressEvent.total || progressEvent.loaded || 0);
            inFlightBytes.set(fileIndex, loadedBytes);
            updateProgress();
          },
        });

        const payload = response.data;
        successCount += payload.success_count ?? 0;
        workflowStatus = payload.workflow_status ?? workflowStatus;
        workflowStatusChanged = workflowStatusChanged || Boolean(payload.workflow_status_changed);

        if (Array.isArray(payload.errors) && payload.errors.length > 0) {
          errors.push(...payload.errors);
        } else if ((payload.success_count ?? 0) === 0) {
          errors.push({
            file_name: file.name,
            message: payload.message || 'Upload failed',
            error_type: payload.error_type,
          });
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const payload = error.response?.data as MediaUploadResponse | undefined;
          if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
            errors.push(...payload.errors);
          } else {
            errors.push({
              file_name: file.name,
              message: payload?.message || error.message || 'Upload failed',
              error_type: payload?.error_type,
            });
          }
        } else {
          errors.push({
            file_name: file.name,
            message: error instanceof Error ? error.message : 'Upload failed',
          });
        }
      } finally {
        inFlightBytes.delete(fileIndex);
        processedFiles += 1;
        processedBytes += Math.max(file.size, 0);
        updateProgress();
      }
    }));
  }

  if (successCount === 0 && errors.length > 0) {
    throw new Error(errors[0].message || 'Upload failed');
  }

  return {
    message: errors.length > 0 ? 'Files processed with some upload errors' : 'Files processed',
    success_count: successCount,
    error_count: errors.length,
    partial_success: successCount > 0 && errors.length > 0,
    errors,
    workflow_status: workflowStatus,
    workflow_status_changed: workflowStatusChanged,
  };
};

/**
 * Fetch media files for a shoot by type
 */
export const fetchShootMedia = async (
  shootId: string,
  type: 'raw' | 'edited' | 'extra',
  token: string
): Promise<DropboxMediaResponse> => {
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
 * Get temporary Dropbox link for a media file thumbnail
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

/**
 * Archive a shoot manually (admin only)
 */
export const archiveShoot = async (
  shootId: string,
  token: string
): Promise<any> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/shoots/${shootId}/archive`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

