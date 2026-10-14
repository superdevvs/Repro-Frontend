import { describe, expect, it } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { getMediaDownloadPermissions } from './mediaDownloadPermissions';
import { canInteractWithMediaFile, canManageMediaVisibility, canReorderMediaFile, canSetMediaHero } from './mediaPresentationPermissions';

const editor = {
  role: 'editor', isAdmin: false, isPhotographer: false, isEditor: true, isClient: false,
  releaseLocked: false, displayTab: 'edited', viewerSourceTab: 'edited',
};
const image: MediaFile = {
  id: '7', filename: 'Final.jpg', fileType: 'image/jpeg', workflowStage: 'completed',
  can_download: true, can_interact: false, can_delete: false, can_manage_visibility: false, can_set_hero: false,
};

describe('video editor reference images', () => {
  it('permits grid and viewer downloads without photo editing controls', () => {
    const access = getMediaDownloadPermissions({ ...editor, viewerFile: image });
    expect(access.canDownloadFile(image)).toBe(true);
    expect(access.canDownloadViewer).toBe(true);
    expect(access.canViewFullSize).toBe(true);
    expect(canInteractWithMediaFile(image, 'editor')).toBe(false);
    expect(canManageMediaVisibility(image, 'editor')).toBe(false);
    expect(canSetMediaHero(image, 'editor')).toBe(false);
    expect(canReorderMediaFile(image, 'editor')).toBe(false);
  });
  it('requires explicit server permission for final downloads and revokes it on refresh', () => {
    for (const can_download of [false, undefined]) {
      const file = { ...image, can_download };
      const access = getMediaDownloadPermissions({ ...editor, viewerFile: file });
      expect(access.canDownloadFile(file)).toBe(false);
      expect(access.canDownloadViewer).toBe(false);
    }
  });
  it('preserves raw download behavior', () => {
    const raw = { id: '8', filename: 'raw.mp4' };
    const access = getMediaDownloadPermissions({ ...editor, displayTab: 'uploaded', viewerSourceTab: 'uploaded', viewerFile: raw });
    expect(access.canDownloadFile(raw)).toBe(true);
    expect(access.canDownloadViewer).toBe(true);
  });
  it('preserves full-size review for photo editors without enabling final downloads', () => {
    const photo = { ...image, can_interact: true, can_download: false };
    const access = getMediaDownloadPermissions({ ...editor, viewerFile: photo });
    expect(access.canViewFullSize).toBe(true);
    expect(access.canDownloadViewer).toBe(false);
  });
});
