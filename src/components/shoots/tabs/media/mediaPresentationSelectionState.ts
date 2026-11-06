import type { MediaFile } from '@/hooks/useShootFiles';
import { canManageMediaVisibility, canSetMediaHero } from './mediaPresentationPermissions';

export interface MediaPresentationSelectionOptions {
  files: MediaFile[];
  selectedFiles: Set<string>;
  role?: string;
  onToggleHidden?: (ids: string[], hidden: boolean) => void;
  onSetHero?: (id: string) => void;
}

export function getMediaPresentationSelectionState({ files, selectedFiles, role, onToggleHidden, onSetHero }: MediaPresentationSelectionOptions) {
  const matched = files.filter(file => selectedFiles.has(String(file.id)));
  const selected = matched.length === selectedFiles.size ? matched : [];
  const canManageAll = selected.every(file => canManageMediaVisibility(file, role));
  return {
    selected,
    canHide: Boolean(onToggleHidden && canManageAll && selected.some(file => !file.is_hidden)),
    canUnhide: Boolean(onToggleHidden && canManageAll && selected.some(file => file.is_hidden)),
    canSetHero: Boolean(onSetHero && selected.length === 1 && canSetMediaHero(selected[0], role)),
  };
}

export function hasMediaPresentationSelectionActions(options: MediaPresentationSelectionOptions) {
  const state = getMediaPresentationSelectionState(options);
  return state.canHide || state.canUnhide || state.canSetHero;
}
