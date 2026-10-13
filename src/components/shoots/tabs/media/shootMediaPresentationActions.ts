import type { MediaFile } from '@/hooks/useShootFiles';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { invalidateShootMediaQueries } from './mediaMutationResult';
import { canManageMediaVisibility, canSetMediaHero } from './mediaPresentationPermissions';
import type { UseShootMediaActionsParams } from './shootMediaActionTypes';

type PresentationParams = Pick<UseShootMediaActionsParams,
  'shoot' | 'role' | 'rawFiles' | 'editedFiles' | 'setRawFiles' | 'setEditedFiles' | 'queryClient' | 'onShootUpdate' | 'toast'>;

export async function setShootMediaHero(shootId: string | number, file: MediaFile, role: string) {
  if (!canSetMediaHero(file, role)) return false;
  const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/media/${file.id}/cover`, {
    method: 'POST', headers: getApiHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || 'Failed to set hero image');
  }
  return true;
}

export function createShootMediaPresentationActions({
  shoot, role, rawFiles, editedFiles, setRawFiles, setEditedFiles, queryClient, onShootUpdate, toast,
}: PresentationParams) {
  const pool = new Map([...rawFiles, ...editedFiles].map(file => [String(file.id), file]));
  const toggleFilesHidden = async (fileIds: string[], hidden: boolean) => {
    const ids = new Set(fileIds.map(String));
    if (!ids.size || [...ids].some(id => !pool.has(id) || !canManageMediaVisibility(pool.get(id)!, role))) return;
    const apply = (files: MediaFile[]) => files.map(file => ids.has(String(file.id))
      ? { ...file, is_hidden: hidden, is_cover: hidden ? false : file.is_cover } : file);
    setRawFiles(apply);
    setEditedFiles(apply);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/toggle-hidden`, {
        method: 'PATCH', headers: getApiHeaders(), body: JSON.stringify({ file_ids: [...ids].map(Number), hidden }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Failed to update file visibility');
      await invalidateShootMediaQueries(queryClient, shoot.id);
      onShootUpdate();
      toast({ title: hidden ? 'Files hidden' : 'Files unhidden', description: data?.message || (hidden ? 'Hidden from tours and downloads.' : 'Visible again.') });
    } catch (error: unknown) {
      // Restore only the affected files so concurrent likes/comments are preserved.
      const restore = (files: MediaFile[]) => files.map(file => ids.has(String(file.id))
        ? { ...file, is_hidden: pool.get(String(file.id))!.is_hidden, is_cover: pool.get(String(file.id))!.is_cover } : file);
      setRawFiles(restore);
      setEditedFiles(restore);
      toast({ title: 'Visibility update failed', description: error instanceof Error ? error.message : 'Failed to update file visibility', variant: 'destructive' });
    }
  };
  const handleSetHeroImage = async (fileId: string) => {
    const file = pool.get(String(fileId));
    if (!file || !canSetMediaHero(file, role)) return;
    try {
      if (!await setShootMediaHero(shoot.id, file, role)) return;
      const apply = (files: MediaFile[]) => files.map(item => ({ ...item, is_cover: String(item.id) === String(fileId) }));
      setRawFiles(apply);
      setEditedFiles(apply);
      await invalidateShootMediaQueries(queryClient, shoot.id);
      onShootUpdate();
      toast({ title: 'Hero image updated' });
    } catch (error: unknown) {
      toast({ title: 'Hero update failed', description: error instanceof Error ? error.message : 'Failed to set hero image', variant: 'destructive' });
    }
  };
  return { toggleFileHidden: (fileId: string, hidden: boolean) => toggleFilesHidden([fileId], hidden), toggleFilesHidden, handleSetHeroImage };
}
