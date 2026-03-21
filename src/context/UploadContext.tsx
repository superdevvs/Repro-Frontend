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
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UploadContextType {
  uploads: ShootUpload[];
  activeUploadCount: number;
  startUpload: (params: StartUploadParams) => string;
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

    // Build FormData exactly like FileUploader.performUpload
    const formData = new FormData();
    params.files.forEach((file, idx) => {
      formData.append(`files[${idx}]`, file);
    });
    formData.append('service_category', params.serviceCategory || 'P');
    formData.append('upload_type', params.uploadType);

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    axios.post(
      `${API_BASE_URL}/api/shoots/${params.shootId}/upload-from-pc`,
      formData,
      {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: abortController.signal,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploads(prev =>
            prev.map(u => u.id === uploadId ? { ...u, progress: percentCompleted } : u)
          );
        },
      }
    ).then(() => {
      setUploads(prev =>
        prev.map(u => u.id === uploadId ? { ...u, status: 'completed', progress: 100 } : u)
      );
      // Fire completion callback
      const cb = completionCallbacks.current.get(uploadId);
      if (cb) {
        cb();
        completionCallbacks.current.delete(uploadId);
      }
      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== uploadId));
      }, 10000);
    }).catch((error) => {
      if (axios.isCancel(error)) {
        setUploads(prev => prev.filter(u => u.id !== uploadId));
      } else {
        setUploads(prev =>
          prev.map(u => u.id === uploadId
            ? { ...u, status: 'failed', error: error?.response?.data?.message || 'Upload failed' }
            : u
          )
        );
        params.onError?.(error?.response?.data?.message || 'Upload failed');
      }
    }).finally(() => {
      abortControllers.current.delete(uploadId);
    });

    return uploadId;
  }, []);

  const cancelUpload = useCallback((uploadId: string) => {
    const controller = abortControllers.current.get(uploadId);
    if (controller) {
      controller.abort();
    }
    completionCallbacks.current.delete(uploadId);
  }, []);

  const dismissUpload = useCallback((uploadId: string) => {
    // Cancel if still uploading
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
