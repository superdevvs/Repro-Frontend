import { useCallback, useEffect, useState } from 'react';
import type { MediaFile } from '@/hooks/useShootFiles';

interface UseShootMediaSelectionStateOptions {
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function useShootMediaSelectionState({ onSelectionChange }: UseShootMediaSelectionStateOptions = {}) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerFiles, setViewerFiles] = useState<MediaFile[]>([]);

  const openViewer = useCallback((index: number, files: MediaFile[]) => {
    setViewerIndex(index);
    setViewerFiles(files);
    setViewerOpen(true);
  }, []);

  const toggleSelection = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedFiles));
    }
  }, [onSelectionChange, selectedFiles]);

  return {
    selectedFiles,
    setSelectedFiles,
    viewerOpen,
    setViewerOpen,
    viewerIndex,
    setViewerIndex,
    viewerFiles,
    setViewerFiles,
    openViewer,
    toggleSelection,
    clearSelection,
  };
}
