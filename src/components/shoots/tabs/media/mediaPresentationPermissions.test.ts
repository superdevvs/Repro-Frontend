import { describe, expect, it } from 'vitest';
import { normalizeShootMediaFile, type MediaFile } from '@/hooks/useShootFiles';
import { buildMediaFilesFingerprint } from './mediaPreviewUtils';
import { canInteractWithMediaFile, canManageMediaVisibility, canReorderMediaFile, canSetMediaHero, canUseMediaDownload } from './mediaPresentationPermissions';

const image: MediaFile = { id: '11', filename: 'final.jpg', media_type: 'edited', workflowStage: 'verified', scan_status: 'clean', can_manage_visibility: true, can_set_hero: true };
describe('scoped media presentation permissions', () => {
  it.each(['client', 'salesRep', 'sales_rep', 'rep', 'representative'])('allows server-authorized %s curation and keeps hidden files restorable', role => {
    expect(canManageMediaVisibility(image, role)).toBe(true);
    expect(canSetMediaHero(image, role)).toBe(true);
    const hidden = { ...image, is_hidden: true };
    expect(canManageMediaVisibility(hidden, role)).toBe(true);
    expect(canSetMediaHero(hidden, role)).toBe(false);
    expect(canUseMediaDownload(hidden, role)).toBe(false);
  });
  it.each(['client', 'salesRep'])('denies unrelated/read-shared %s shoots without explicit server permission', role => {
    for (const permission of [false, undefined]) {
      const file = { ...image, can_manage_visibility: permission, can_set_hero: permission };
      expect(canManageMediaVisibility(file, role)).toBe(false);
      expect(canSetMediaHero(file, role)).toBe(false);
    }
  });
  it.each(['quarantined', 'infected', 'failed'] as const)('never grants %s output through forged capabilities', scan_status => {
    expect(canManageMediaVisibility({ ...image, scan_status }, 'client')).toBe(false);
    expect(canSetMediaHero({ ...image, scan_status }, 'salesRep')).toBe(false);
  });
  it('keeps raw/pending files out of client controls and allows only visibility for floorplans/video', () => {
    for (const file of [{ ...image, media_type: 'raw' }, { ...image, workflowStage: 'todo' }]) {
      expect(canManageMediaVisibility(file, 'client')).toBe(false);
      expect(canSetMediaHero(file, 'salesRep')).toBe(false);
    }
    for (const file of [{ ...image, media_type: 'floorplan' }, { ...image, filename: 'video.mp4', media_type: 'video' }, { ...image, isExtra: true }]) {
      expect(canManageMediaVisibility(file, 'client')).toBe(true);
      expect(canSetMediaHero(file, 'client')).toBe(false);
    }
    expect(canSetMediaHero({ ...image, can_set_hero: false }, 'photographer')).toBe(false);
    expect(canManageMediaVisibility(image, 'unknown')).toBe(false);
  });
  it('preserves staff legacy permissions and respects explicit denial', () => {
    const legacy = { ...image, can_manage_visibility: undefined, can_set_hero: undefined };
    expect(canSetMediaHero(legacy, 'admin')).toBe(true);
    expect(canManageMediaVisibility(legacy, 'editor')).toBe(true);
    expect(canSetMediaHero({ ...legacy, can_set_hero: false }, 'admin')).toBe(false);
    expect(canManageMediaVisibility({ ...legacy, can_manage_visibility: false }, 'editor')).toBe(false);
    expect(canSetMediaHero({ ...legacy, media_type: 'raw', thumb: '/raw-preview.jpg' }, 'admin')).toBe(true);
  });
  it('retains contractor capabilities from additive secondary roles while respecting per-file download denial', () => {
    expect(canSetMediaHero(image, 'photographer')).toBe(true);
    expect(canManageMediaVisibility({ ...image, media_type: 'raw' }, 'photographer')).toBe(true);
    expect(canUseMediaDownload({ ...image, is_hidden: true, can_download: false }, 'photographer')).toBe(false);
    expect(canUseMediaDownload({ ...image, is_hidden: true, can_download: true }, 'photographer')).toBe(true);
    const customerRaw = { ...image, media_type: 'raw', media_curation_scope: 'customer' as const };
    expect(canSetMediaHero(customerRaw, 'photographer')).toBe(false);
    expect(canManageMediaVisibility(customerRaw, 'photographer')).toBe(false);
    expect(canSetMediaHero({ ...customerRaw, media_curation_scope: 'contractor', thumb: '/raw.jpg' }, 'photographer')).toBe(true);
    expect(canUseMediaDownload({ ...image, is_hidden: true, media_curation_scope: 'customer', can_download: false }, 'photographer')).toBe(false);
  });
  it('keeps unpaid visible watermarked client photos sortable and interactive without granting downloads', () => {
    const unpaid: MediaFile = { ...image, can_download: false, uses_watermark: true, media_curation_scope: 'customer' };
    expect(canUseMediaDownload(unpaid, 'client')).toBe(false);
    expect(canInteractWithMediaFile(unpaid, 'client')).toBe(true);
    expect(canReorderMediaFile(unpaid, 'client')).toBe(true);
    expect(canSetMediaHero(unpaid, 'client')).toBe(true);
    expect(canInteractWithMediaFile({ ...unpaid, is_hidden: true }, 'client')).toBe(false);
    expect(canReorderMediaFile({ ...unpaid, is_hidden: true }, 'client')).toBe(false);
    expect(canInteractWithMediaFile({ ...unpaid, is_hidden: true, media_curation_scope: 'contractor' }, 'editor')).toBe(true);
  });
  it('normalizes authoritative true/false without coercing strings and fingerprints visibility/hero changes', () => {
    expect(normalizeShootMediaFile({ id: 1, can_manage_visibility: true, can_set_hero: false, can_download: false, media_curation_scope: 'contractor' })).toMatchObject({ can_manage_visibility: true, can_set_hero: false, can_download: false, media_curation_scope: 'contractor' });
    expect(normalizeShootMediaFile({ id: 1, can_manage_visibility: 'false' }).can_manage_visibility).toBeUndefined();
    for (const change of [{ is_hidden: true }, { is_cover: true }, { can_set_hero: false }, { can_manage_visibility: false }]) {
      expect(buildMediaFilesFingerprint([image])).not.toBe(buildMediaFilesFingerprint([{ ...image, ...change }]));
    }
  });
});
