/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

export interface ShootUpload {
  id: string;
  shootId: string;
  shootAddress: string;
  fileCount: number;
  fileNames: string[];
  uploadType: 'raw' | 'edited';
  status: 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
  startedAt: Date;
}

interface StartUploadParams {
  shootId: string;
  shootAddress: string;
  files: File[];
  uploadType: 'raw' | 'edited';
  serviceCategory?: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onWarning?: (warning: string) => void;
}

interface TrackUploadParams {
  shootId: string;
  shootAddress: string;
  fileCount: number;
  fileNames: string[];
  uploadType: 'raw' | 'edited';
  uploadFn: (onProgress: (progress: number) => void) => Promise<void>;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UploadRequestError {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface UploadContextType {
  uploads: ShootUpload[];
  activeUploadCount: number;
  startUpload: (params: StartUploadParams) => string;
  trackUpload: (params: TrackUploadParams) => string;
  cancelUpload: (uploadId: string) => void;
  dismissUpload: (uploadId: string) => void;
  clearCompleted: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<ShootUpload[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const completionCallbacks = useRef<Map<string, () => void>>(new Map());

  const activeUploadCount = uploads.filter(u => u.status === 'uploading').length;

  // Warn user before leaving page if uploads are active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploads.some(u => u.status === 'uploading')) {
        e.preventDefault();
        e.returnValue = 'You have uploads in progress. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploads]);

  const autoCleanup = useCallback((uploadId: string) => {
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.id !== uploadId));
    }, 10000);
  }, []);

  // Bulk upload via axios (used by FileUploader)
  const startUpload = useCallback((params: StartUploadParams): string => {
    const uploadId = crypto.randomUUID();
    const abortController = new AbortController();
    abortControllers.current.set(uploadId, abortController);

    if (params.onComplete) {
      completionCallbacks.current.set(uploadId, params.onComplete);
    }

    const newUpload: ShootUpload = {
      id: uploadId,
      shootId: params.shootId,
      shootAddress: params.shootAddress,
      fileCount: params.files.length,
      fileNames: params.files.map(f => f.name),
      uploadType: params.uploadType,
      status: 'uploading',
      progress: 0,
      startedAt: new Date(),
    };

    setUploads(prev => [...prev, newUpload]);

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const totalBytes = params.files.reduce((sum, file) => sum + Math.max(file.size, 0), 0);
    let processedFiles = 0;
    let processedBytes = 0;
    const inFlightBytes = new Map<number, number>();

    const updateProgress = () => {
      const uploadedBytes = processedBytes + Array.from(inFlightBytes.values()).reduce((sum, value) => sum + value, 0);
      const percentCompleted = totalBytes > 0
        ? Math.round((Math.min(uploadedBytes, totalBytes) * 100) / totalBytes)
        : Math.round((processedFiles * 100) / Math.max(params.files.length, 1));

      setUploads(prev =>
        prev.map(u => u.id === uploadId ? { ...u, progress: percentCompleted } : u)
      );
      params.onProgress?.(percentCompleted);
    };

    const uploadSingleFile = async (file: File, fileIndex: number) => {
      const formData = new FormData();
      formData.append('files[]', file);
      formData.append('service_category', params.serviceCategory || 'P');
      formData.append('upload_type', params.uploadType);

      await axios.post(
        `${API_BASE_URL}/api/shoots/${params.shootId}/upload`,
        formData,
        {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: abortController.signal,
          onUploadProgress: (progressEvent) => {
            const loadedBytes = file.size > 0
              ? Math.min(progressEvent.loaded, file.size)
              : Math.min(progressEvent.loaded, progressEvent.total || progressEvent.loaded || 0);
            inFlightBytes.set(fileIndex, loadedBytes);
            updateProgress();
          },
        }
      );
    };

    const runUpload = async () => {
      const concurrentUploads = 1;
      const errors: string[] = [];

      for (let index = 0; index < params.files.length; index += concurrentUploads) {
        const batch = params.files.slice(index, index + concurrentUploads);

        await Promise.all(batch.map(async (file, batchIndex) => {
          const fileIndex = index + batchIndex;

          try {
            await uploadSingleFile(file, fileIndex);
          } catch (error) {
            if (axios.isCancel(error)) {
              throw error;
            }

            const message = (error as UploadRequestError)?.response?.data?.message || (error as UploadRequestError)?.message || 'Upload failed';
            errors.push(`${file.name}: ${message}`);
          } finally {
            inFlightBytes.delete(fileIndex);
            processedFiles += 1;
            processedBytes += Math.max(file.size, 0);
            updateProgress();
          }
        }));
      }

      if (errors.length === params.files.length) {
        throw new Error(errors[0] || 'Upload failed');
      }

      if (errors.length > 0) {
        const failedCount = errors.length;
        const failedFileDetails = errors.slice(0, 3).join(', ');
        const remainingCount = failedCount - Math.min(failedCount, 3);
        params.onWarning?.(
          `${failedCount} of ${params.files.length} file${failedCount === 1 ? '' : 's'} failed to upload.${failedFileDetails ? ` ${failedFileDetails}` : ''}${remainingCount > 0 ? `, plus ${remainingCount} more.` : ''}`
        );
      }
    };

    void runUpload()
      .then(() => {
        setUploads(prev =>
          prev.map(u => u.id === uploadId ? { ...u, status: 'completed', progress: 100 } : u)
        );
        const cb = completionCallbacks.current.get(uploadId);
        if (cb) { cb(); completionCallbacks.current.delete(uploadId); }
        autoCleanup(uploadId);
      }).catch((error) => {
        if (axios.isCancel(error)) {
          setUploads(prev => prev.filter(u => u.id !== uploadId));
        } else {
          const message = (error as UploadRequestError)?.response?.data?.message || (error as UploadRequestError)?.message || 'Upload failed';
          setUploads(prev =>
            prev.map(u => u.id === uploadId
              ? { ...u, status: 'failed', error: message }
              : u
            )
          );
          params.onError?.(message);
        }
      }).finally(() => {
        abortControllers.current.delete(uploadId);
      });

    return uploadId;
  }, [autoCleanup]);

  // Track a custom upload function (used by ShootDetailsMediaTab's per-file XHR uploads)
  const trackUpload = useCallback((params: TrackUploadParams): string => {
    const uploadId = crypto.randomUUID();

    const newUpload: ShootUpload = {
      id: uploadId,
      shootId: params.shootId,
      shootAddress: params.shootAddress,
      fileCount: params.fileCount,
      fileNames: params.fileNames,
      uploadType: params.uploadType,
      status: 'uploading',
      progress: 0,
      startedAt: new Date(),
    };

    setUploads(prev => [...prev, newUpload]);

    // The caller provides the upload logic; we just track progress
    const onProgress = (progress: number) => {
      setUploads(prev =>
        prev.map(u => u.id === uploadId ? { ...u, progress } : u)
      );
    };

    params.uploadFn(onProgress)
      .then(() => {
        setUploads(prev =>
          prev.map(u => u.id === uploadId ? { ...u, status: 'completed', progress: 100 } : u)
        );
        params.onComplete?.();
        autoCleanup(uploadId);
      })
      .catch((error: unknown) => {
        setUploads(prev =>
          prev.map(u => u.id === uploadId
            ? { ...u, status: 'failed', error: (error as UploadRequestError)?.message || 'Upload failed' }
            : u
          )
        );
        params.onError?.((error as UploadRequestError)?.message || 'Upload failed');
      });

    return uploadId;
  }, [autoCleanup]);

  const cancelUpload = useCallback((uploadId: string) => {
    const controller = abortControllers.current.get(uploadId);
    if (controller) {
      controller.abort();
    }
    completionCallbacks.current.delete(uploadId);
  }, []);

  const dismissUpload = useCallback((uploadId: string) => {
    const controller = abortControllers.current.get(uploadId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(uploadId);
    }
    completionCallbacks.current.delete(uploadId);
    setUploads(prev => prev.filter(u => u.id !== uploadId));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status === 'uploading'));
  }, []);

  return (
    <UploadContext.Provider
      value={{
        uploads,
        activeUploadCount,
        startUpload,
        trackUpload,
        cancelUpload,
        dismissUpload,
        clearCompleted,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};
