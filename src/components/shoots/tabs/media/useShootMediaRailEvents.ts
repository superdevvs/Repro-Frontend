import { useEffect } from 'react';

interface UseShootMediaRailEventsOptions {
  shootId: string | number;
  selectedCount: number;
  canRename: boolean;
  setShowAiEditDialog: (open: boolean) => void;
  setBatchRenameOpen: (open: boolean) => void;
}

/**
 * Desktop and mobile layouts can both mount the media tab. The first listener
 * claims the rail event so only one dialog opens.
 */
export function useShootMediaRailEvents({
  shootId,
  selectedCount,
  canRename,
  setShowAiEditDialog,
  setBatchRenameOpen,
}: UseShootMediaRailEventsOptions) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const matchesShoot = (event: Event) => {
      const targetShootId = (event as CustomEvent<{ shootId?: string | number }>).detail?.shootId;
      return targetShootId !== undefined && String(targetShootId) === String(shootId);
    };

    const handleOpenAiEdit = (event: Event) => {
      if (event.defaultPrevented || !matchesShoot(event) || selectedCount === 0) return;
      event.preventDefault();
      setShowAiEditDialog(true);
    };

    const handleOpenRename = (event: Event) => {
      if (event.defaultPrevented || !matchesShoot(event) || !canRename || selectedCount === 0) return;
      event.preventDefault();
      setBatchRenameOpen(true);
    };

    window.addEventListener('shoot-ai-edit-open', handleOpenAiEdit);
    window.addEventListener('shoot-media-rename-open', handleOpenRename);
    return () => {
      window.removeEventListener('shoot-ai-edit-open', handleOpenAiEdit);
      window.removeEventListener('shoot-media-rename-open', handleOpenRename);
    };
  }, [canRename, selectedCount, setBatchRenameOpen, setShowAiEditDialog, shootId]);
}
