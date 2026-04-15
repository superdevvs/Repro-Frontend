import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { finalizeRawUploadQueue } from '@/services/dropboxMediaService';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/context/UploadContext';
import { fotelloService } from '@/services/fotelloService';
import {
  triggerDashboardOverviewRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
  triggerShootListRefresh,
} from '@/realtime/realtimeRefreshBus';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import {
  dispatchShootShareLinksUpdated,
  type ShootShareLinkEntry,
} from '../overview/shareLinksEvents';

export type ReclassifyMediaType =
  | 'floorplan'
  | 'raw'
  | 'edited'
  | 'extra'
  | 'virtual_staging'
  | 'green_grass'
  | 'twilight'
  | 'drone';

export const markMenuOptions: Array<{ label: string; value: ReclassifyMediaType }> = [
  { label: 'Floorplan', value: 'floorplan' },
  { label: 'Extra', value: 'extra' },
  { label: 'Virtual Staging', value: 'virtual_staging' },
  { label: 'Green Grass', value: 'green_grass' },
  { label: 'Twilight', value: 'twilight' },
  { label: 'Drone', value: 'drone' },
];

export interface DownloadPopupState {
  visible: boolean;
  status: 'processing' | 'ready' | 'error';
  blobUrl: string | null;
  filename: string;
  fileCount: number;
  sizeLabel: string;
}

interface UseShootMediaActionsParams {
  shoot: ShootData;
  isAdmin: boolean;
  isClient: boolean;
  role: string;
  displayTab: 'uploaded' | 'edited';
  selectedFiles: Set<string>;
  setSelectedFiles: Dispatch<SetStateAction<Set<string>>>;
  selectedEditingType: string;
  setShowAiEditDialog: Dispatch<SetStateAction<boolean>>;
  setSubmittingAiEdit: Dispatch<SetStateAction<boolean>>;
  setDownloading: Dispatch<SetStateAction<boolean>>;
  setDownloadPopup: Dispatch<SetStateAction<DownloadPopupState>>;
  setActiveSubTab: Dispatch<SetStateAction<'uploaded' | 'edited' | 'upload'>>;
  setDisplayTab: Dispatch<SetStateAction<'uploaded' | 'edited'>>;
  rawFiles: MediaFile[];
  editedFiles: MediaFile[];
  setRawFiles: Dispatch<SetStateAction<MediaFile[]>>;
  setEditedFiles: Dispatch<SetStateAction<MediaFile[]>>;
  showUploadTab: boolean;
  onShootUpdate: () => void;
  queryClient: QueryClient;
  toast: ReturnType<typeof useToast>['toast'];
  trackUpload: ReturnType<typeof useUpload>['trackUpload'];
  dragCounterRef: MutableRefObject<number>;
  setDragOverTab: Dispatch<SetStateAction<'uploaded' | 'edited' | null>>;
}

const isVideoUpload = (file: File) =>
  Boolean(file.type && file.type.toLowerCase().startsWith('video/')) ||
  /\.(mp4|mov|m4v|avi|mkv|wmv|webm|mpg|mpeg|3gp)$/i.test(file.name);

const floorplanPatterns = ['floorplan', 'floor-plan', 'floor_plan', 'fp_', 'fp-', 'layout', 'blueprint'];

const isFloorplanUpload = (file: File) => {
  const lower = file.name.toLowerCase();
  return floorplanPatterns.some((pattern) => lower.includes(pattern));
};

const resetDownloadPopup = (): DownloadPopupState => ({
  visible: false,
  status: 'processing',
  blobUrl: null,
  filename: '',
  fileCount: 0,
  sizeLabel: '',
});

const buildUploadWarningDescription = (errors: string[], totalCount: number): string => {
  const failedCount = errors.length;
  const failedNames = errors
    .slice(0, 3)
    .map((error) => error.split(':')[0]?.trim())
    .filter(Boolean);
  const remainingCount = failedCount - failedNames.length;

  return `${failedCount} of ${totalCount} file${failedCount === 1 ? '' : 's'} failed to upload.${failedNames.length > 0 ? ` Failed: ${failedNames.join(', ')}` : ''}${remainingCount > 0 ? `, plus ${remainingCount} more.` : ''}`;
};

export function useShootMediaActions({
  shoot,
  isAdmin,
  displayTab,
  selectedFiles,
  setSelectedFiles,
  selectedEditingType,
  setShowAiEditDialog,
  setSubmittingAiEdit,
  setDownloading,
  setDownloadPopup,
  setActiveSubTab,
  setDisplayTab,
  rawFiles,
  editedFiles,
  setRawFiles,
  setEditedFiles,
  showUploadTab,
  onShootUpdate,
  queryClient,
  toast,
  trackUpload,
  dragCounterRef,
  setDragOverTab,
}: UseShootMediaActionsParams) {
  const handleDirectDrop = async (event: React.DragEvent<HTMLDivElement>, uploadType: 'raw' | 'edited') => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setDragOverTab(null);

    if (!showUploadTab) return;
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];

    toast({
      title: 'Upload Started',
      description: `${files.length} file${files.length !== 1 ? 's' : ''} uploading in background.`,
    });

    trackUpload({
      shootId: String(shoot.id),
      shootAddress: shoot.location?.fullAddress || shoot.location?.address || `Shoot #${shoot.id}`,
      fileCount: files.length,
      fileNames: files.map((file) => file.name),
      uploadType,
      uploadFn: async (onProgress) => {
        const concurrentUploads = 1;
        let completed = 0;
        const errors: string[] = [];

        const uploadOne = (file: File): Promise<{ success: boolean; error?: string }> =>
          new Promise((resolve) => {
            const formData = new FormData();
            const isVideo = isVideoUpload(file);
            formData.append('files[]', file);
            formData.append('upload_type', uploadType);
            if (isVideo) formData.append('service_category', 'video');
            if (!isVideo && isFloorplanUpload(file)) formData.append('media_type', 'floorplan');

            const xhr = new XMLHttpRequest();
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ success: true });
                return;
              }

              let message = 'Upload failed';
              try {
                message = JSON.parse(xhr.responseText).message || message;
              } catch {
                // Fall back to the generic upload error when the response is not JSON.
              }
              resolve({ success: false, error: `${file.name}: ${message}` });
            });
            xhr.addEventListener('error', () => resolve({ success: false, error: `${file.name}: Network error` }));
            xhr.open('POST', `${API_BASE_URL}/api/shoots/${shoot.id}/upload`);
            if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
            if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
            xhr.send(formData);
          });

        for (let index = 0; index < files.length; index += concurrentUploads) {
          const batch = files.slice(index, Math.min(index + concurrentUploads, files.length));
          const results = await Promise.all(batch.map(uploadOne));
          results.forEach((result) => {
            completed += 1;
            if (!result.success && result.error) errors.push(result.error);
          });
          onProgress(Math.round((completed / files.length) * 100));
        }

        if (errors.length === files.length) {
          toast({
            title: 'Upload failed',
            description: buildUploadWarningDescription(errors, files.length),
            variant: 'destructive',
          });
          throw new Error('All files failed to upload');
        }

        if (errors.length > 0) {
          toast({
            title: 'Some files did not upload',
            description: buildUploadWarningDescription(errors, files.length),
            variant: 'destructive',
          });
        }

        if (uploadType === 'raw' && errors.length < files.length && files.length > 0) {
          const finalizeHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (authHeader) finalizeHeaders.Authorization = authHeader;
          if (impersonateHeader) finalizeHeaders['X-Impersonate-User-Id'] = impersonateHeader;
          await finalizeRawUploadQueue(shoot.id, finalizeHeaders);
        }

        queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
        queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
        triggerShootDetailRefresh(shoot.id);
        triggerShootHistoryRefresh();
        triggerShootListRefresh();
        triggerDashboardOverviewRefresh();
        onShootUpdate();
      },
    });
  };

  const handleTabDragEnter = (event: React.DragEvent<HTMLDivElement>, tab: 'uploaded' | 'edited') => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (showUploadTab && event.dataTransfer.types.includes('Files')) {
      setDragOverTab(tab);
    }
  };

  const handleTabDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOverTab(null);
    }
  };

  const handleTabDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleAiEdit = async () => {
    if (!isAdmin) {
      toast({
        title: 'Not authorized',
        description: 'Only admins can submit AI edits at this time.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedFiles.size === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to edit',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedEditingType) {
      toast({
        title: 'No editing type selected',
        description: 'Please select an editing type',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingAiEdit(true);
    try {
      const fileIds = Array.from(selectedFiles).map((id) => parseInt(id, 10));
      await fotelloService.submitEditing({
        shoot_id: Number(shoot.id),
        file_ids: fileIds,
        editing_type: selectedEditingType,
        params: {},
      });

      toast({
        title: 'Success',
        description: `Submitted ${fileIds.length} image(s) for AI editing`,
      });

      setShowAiEditDialog(false);
      setSelectedFiles(new Set());
      onShootUpdate();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to submit editing job';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmittingAiEdit(false);
    }
  };

  const handleDownload = async (size: 'original' | 'small') => {
    if (selectedFiles.size === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to download',
        variant: 'destructive',
      });
      return;
    }

    const fileCount = selectedFiles.size;
    const sizeLabel = size === 'small' ? 'Small (1800x1200)' : 'Full Size';
    const filename = `shoot-${shoot.id}-${size === 'small' ? 'small' : 'full'}-${Date.now()}.zip`;

    setDownloadPopup({
      visible: true,
      status: 'processing',
      blobUrl: null,
      filename,
      fileCount,
      sizeLabel,
    });
    setDownloading(true);

    try {
      const headers = getApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/download`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_ids: Array.from(selectedFiles),
          size: size === 'small' ? 'small' : 'original',
        }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setDownloadPopup((prev) => ({ ...prev, status: 'ready', blobUrl }));

      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setSelectedFiles(new Set());
    } catch {
      setDownloadPopup((prev) => ({ ...prev, status: 'error' }));
      toast({
        title: 'Download failed',
        description: 'Failed to download files. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleManualDownload = (downloadPopup: DownloadPopupState) => {
    if (!downloadPopup.blobUrl) return;
    const anchor = document.createElement('a');
    anchor.href = downloadPopup.blobUrl;
    anchor.download = downloadPopup.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const closeDownloadPopup = (downloadPopup: DownloadPopupState) => {
    if (downloadPopup.blobUrl) {
      window.URL.revokeObjectURL(downloadPopup.blobUrl);
    }
    setDownloadPopup(resetDownloadPopup());
  };

  const handleEditorDownloadRaw = async (downloadAll = true) => {
    const fileIds = downloadAll ? [] : Array.from(selectedFiles);
    if (!downloadAll && fileIds.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to download or use "Download All"',
        variant: 'destructive',
      });
      return;
    }

    setDownloading(true);
    try {
      const headers = getApiHeaders();
      headers.Accept = 'application/json, application/zip';
      delete headers['Content-Type'];

      const queryParams = new URLSearchParams();
      if (!downloadAll && fileIds.length > 0) {
        queryParams.append('file_ids', fileIds.join(','));
      }

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/editor-download-raw?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Download failed');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.type === 'redirect' && data.url) {
          window.open(data.url, '_blank');
          toast({
            title: 'Download started',
            description:
              data.message ||
              `Downloading ${data.file_count || 'all'} raw files. Switch to Edited tab to upload your edits.`,
          });
        }
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `shoot-${shoot.id}-raw-files-${Date.now()}.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Download started',
          description: 'Raw files downloaded. Switch to Edited tab to upload your edits.',
        });
      }

      setSelectedFiles(new Set());
      setActiveSubTab('edited');
      setDisplayTab('edited');
    } catch (error: unknown) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download raw files',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleGenerateShareLink = async (shareAll = true) => {
    const currentTabFiles = displayTab === 'edited' ? editedFiles : rawFiles;
    const currentTabFileIds = new Set(currentTabFiles.map((file) => file.id));
    const fileIds = shareAll
      ? []
      : Array.from(selectedFiles).filter((fileId) => currentTabFileIds.has(fileId));
    const mediaStage = displayTab === 'edited' ? 'edited' : 'raw';

    if (!shareAll && fileIds.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to share or use "Share All"',
        variant: 'destructive',
      });
      return;
    }

    try {
      const headers = getApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/generate-share-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_ids: shareAll ? [] : fileIds,
          media_stage: mediaStage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate share link' }));
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const data = await response.json();
      dispatchShootShareLinksUpdated(
        shoot.id,
        (data.share_link_entry as ShootShareLinkEntry | undefined) ?? null,
      );

      let copiedToClipboard = false;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && document.hasFocus()) {
        try {
          await navigator.clipboard.writeText(data.share_link);
          copiedToClipboard = true;
        } catch {
          copiedToClipboard = false;
        }
      }

      toast({
        title: 'Share link generated!',
        description: copiedToClipboard
          ? 'Link copied to clipboard. Lifetime link.'
          : 'Link created successfully. You can copy it from Media Links.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Failed to generate link',
        description: error instanceof Error ? error.message : 'Failed to generate share link',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteFiles = async () => {
    if (selectedFiles.size === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to delete',
        variant: 'destructive',
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedFiles.size} file(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const headers = getApiHeaders();
      const fileIds = Array.from(selectedFiles).map((id) => parseInt(id, 10));

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/bulk-delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: fileIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete files' }));
        throw new Error(errorData.message || 'Failed to delete files');
      }

      toast({
        title: 'Success',
        description: `Deleted ${selectedFiles.size} file(s) successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'all'] });
      setSelectedFiles(new Set());
      onShootUpdate();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete files',
        variant: 'destructive',
      });
    }
  };

  const handleReclassify = async (mediaType: ReclassifyMediaType) => {
    if (selectedFiles.size === 0) return;

    try {
      const headers = getApiHeaders();
      const fileIds = Array.from(selectedFiles).map((id) => parseInt(id, 10));
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/reclassify`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ file_ids: fileIds, media_type: mediaType }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to reclassify' }));
        throw new Error(errorData.message || 'Failed to reclassify');
      }

      toast({
        title: 'Success',
        description: `Reclassified ${fileIds.length} file(s) as ${mediaType}`,
      });
      await queryClient.refetchQueries({ queryKey: ['shootFiles', shoot.id] });
      setSelectedFiles(new Set());
      onShootUpdate();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reclassify',
        variant: 'destructive',
      });
    }
  };

  const toggleFileHidden = async (fileId: string, hidden: boolean) => {
    const applyHiddenState = (files: MediaFile[]) =>
      files.map((file) => (file.id === fileId ? { ...file, is_hidden: hidden } : file));

    const previousRawFiles = rawFiles;
    const previousEditedFiles = editedFiles;

    setRawFiles((prev) => applyHiddenState(prev));
    setEditedFiles((prev) => applyHiddenState(prev));

    try {
      const headers = getApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/toggle-hidden`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          file_ids: [parseInt(fileId, 10)],
          hidden,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update file visibility' }));
        throw new Error(errorData.message || 'Failed to update file visibility');
      }

      const data = await response.json().catch(() => null);
      toast({
        title: hidden ? 'File hidden' : 'File unhidden',
        description:
          data?.message ||
          (hidden
            ? 'The file is now hidden from tours and portfolio views.'
            : 'The file is visible again.'),
      });

      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'all'] });
      onShootUpdate();
    } catch (error: unknown) {
      setRawFiles(previousRawFiles);
      setEditedFiles(previousEditedFiles);
      toast({
        title: 'Visibility update failed',
        description: error instanceof Error ? error.message : 'Failed to update file visibility',
        variant: 'destructive',
      });
    }
  };

  const updateSingleFile = (fileId: string, updater: (file: MediaFile) => MediaFile) => {
    const apply = (files: MediaFile[]) => files.map((file) => (file.id === fileId ? updater(file) : file));
    setRawFiles((prev) => apply(prev));
    setEditedFiles((prev) => apply(prev));
  };

  const handleToggleFavorite = async (fileId: string) => {
    const targetFile = [...rawFiles, ...editedFiles].find((file) => file.id === fileId);
    if (!targetFile) return;

    const nextFavoriteValue = !targetFile.is_favorite;
    updateSingleFile(fileId, (file) => ({ ...file, is_favorite: nextFavoriteValue }));

    try {
      const headers = getApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/${fileId}/favorite`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update favorite' }));
        throw new Error(errorData.message || 'Failed to update favorite');
      }

      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'all'] });
    } catch (error: unknown) {
      updateSingleFile(fileId, (file) => ({ ...file, is_favorite: !nextFavoriteValue }));
      toast({
        title: 'Favorite update failed',
        description: error instanceof Error ? error.message : 'Failed to update favorite',
        variant: 'destructive',
      });
    }
  };

  const handleAddComment = async (fileId: string, comment: string) => {
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      return;
    }

    const optimisticComment = {
      author: 'You',
      comment: trimmedComment,
      timestamp: new Date().toISOString(),
    };
    const previousFile = [...rawFiles, ...editedFiles].find((file) => file.id === fileId);
    updateSingleFile(fileId, (file) => ({
      ...file,
      comments: [...(file.comments ?? []), optimisticComment],
      comment_count: Number(file.comment_count ?? 0) + 1,
      latest_comment: optimisticComment,
    }));

    try {
      const headers = getApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/${fileId}/comment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ comment: trimmedComment }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add comment' }));
        throw new Error(errorData.message || 'Failed to add comment');
      }

      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'all'] });
      onShootUpdate();
    } catch (error: unknown) {
      if (previousFile) {
        updateSingleFile(fileId, () => previousFile);
      }
      toast({
        title: 'Comment failed',
        description: error instanceof Error ? error.message : 'Failed to add comment',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadSingleFile = async (fileId: string) => {
    try {
      const headers = getApiHeaders();
      delete headers['Content-Type'];
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/${fileId}/download`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to download file' }));
        throw new Error(errorData.message || 'Failed to download file');
      }

      const data = await response.json();
      if (!data?.url) {
        throw new Error('Download link not available');
      }

      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error: unknown) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  return {
    handleDirectDrop,
    handleTabDragEnter,
    handleTabDragLeave,
    handleTabDragOver,
    handleAiEdit,
    handleDownload,
    handleManualDownload,
    closeDownloadPopup,
    handleEditorDownloadRaw,
    handleGenerateShareLink,
    handleDeleteFiles,
    handleReclassify,
    toggleFileHidden,
    handleToggleFavorite,
    handleAddComment,
    handleDownloadSingleFile,
  };
}
