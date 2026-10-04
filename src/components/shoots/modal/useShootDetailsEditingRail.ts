import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { ShootData } from '@/types/shoots';
import { sendShootToEditing } from '@/services/shootEditingDispatch';

type ToastFn = (options: {
  title: string;
  description: string;
  variant?: 'destructive';
}) => void;

interface UseShootDetailsEditingRailOptions {
  shoot: ShootData | null;
  toast: ToastFn;
  canOpenAiEdit: boolean;
  isEditMode: boolean;
  imageStudioHref: string | null;
  opensEditingDialog: boolean;
  isClient: boolean;
  refreshShootAndParent: () => Promise<ShootData | null>;
  onClose: () => void;
  navigate: NavigateFunction;
}

/** Bottom-rail Editing and Rename actions for the shoot details modal. */
export function useShootDetailsEditingRail({
  shoot,
  toast,
  canOpenAiEdit,
  isEditMode,
  imageStudioHref,
  opensEditingDialog,
  isClient,
  refreshShootAndParent,
  onClose,
  navigate,
}: UseShootDetailsEditingRailOptions) {
  const handleRenameMedia = useCallback(() => {
    if (!shoot) return;
    // The media tab claims this when files are selected and opens rename for them.
    const claimed = !window.dispatchEvent(new CustomEvent('shoot-media-rename-open', {
      detail: { shootId: shoot.id },
      cancelable: true,
    }));
    if (!claimed) {
      toast({
        title: 'Select files to rename',
        description: 'Select photos or videos in the media tab, then press Rename.',
      });
    }
  }, [shoot, toast]);

  const handleOpenAiEdit = useCallback(() => {
    if (!canOpenAiEdit || isEditMode || !imageStudioHref || !shoot) {
      return;
    }
    if (opensEditingDialog) {
      // The media tab claims this when files are selected and opens the dialog for them.
      const claimed = !window.dispatchEvent(new CustomEvent('shoot-ai-edit-open', {
        detail: { shootId: shoot.id },
        cancelable: true,
      }));
      if (!claimed) {
        void sendShootToEditing(shoot.id)
          .then((sent) => {
            if (sent) void refreshShootAndParent();
          })
          .catch((error: unknown) => toast({
            title: 'Editing could not open',
            description: error instanceof Error ? error.message : String(error),
            variant: 'destructive',
          }));
      }
      return;
    }
    onClose();
    navigate(imageStudioHref);
  }, [
    canOpenAiEdit,
    imageStudioHref,
    isEditMode,
    navigate,
    onClose,
    opensEditingDialog,
    refreshShootAndParent,
    shoot,
    toast,
  ]);

  return {
    handleOpenAiEdit,
    aiEditLabel: opensEditingDialog ? 'Editing' : 'AI Studio',
    onRenameMedia: isClient ? undefined : handleRenameMedia,
  };
}
