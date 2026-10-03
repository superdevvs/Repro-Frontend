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

  const toggleSelection = useCallback((fileId: string | string[]) => {
    const ids = (Array.isArray(fileId) ? fileId : [fileId]).map(String).filter(Boolean);
    if (ids.length === 0) return;

    setSelectedFiles((prev) => {
      const next = new Set(prev);
      // Stacks toggle as a unit: if every frame is selected, clear the stack;
      // otherwise select every frame so "delete 10 HDR photos" removes all brackets.
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
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
