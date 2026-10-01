import { describe, expect, it } from 'vitest';
import { normalizeShootMediaFile, type MediaFile } from '@/hooks/useShootFiles';
import { canDeleteMediaFile, canDeleteMediaSelection } from './mediaDeletePermissions';

const context = {
  role: 'editor', isAdmin: false, isPhotographer: false, isEditor: true,
  isVideoEditor: true, isDelivered: false, isSubmittedForReview: true,
  displayTab: 'edited' as const,
};
const file = (id: string, permission?: boolean): MediaFile => ({
  id, filename: `${id}.mp4`, workflowStage: 'completed', can_delete: permission,
});

describe('edited video deletion permissions', () => {
  it('uses the server permission even when photos have put the shoot into review or delivery', () => {
    expect(canDeleteMediaFile(file('own', true), context)).toBe(true);
    expect(canDeleteMediaFile(file('own', true), { ...context, isDelivered: true })).toBe(true);
  });

  it.each([false, undefined])('does not offer deletion when server permission is %s', (permission) => {
    expect(canDeleteMediaFile(file('protected', permission), { ...context, isSubmittedForReview: false })).toBe(false);
  });

  it('never permits an editor to delete from Raw Uploads', () => {
    expect(canDeleteMediaFile(file('raw', true), { ...context, displayTab: 'uploaded' })).toBe(false);
  });

  it('preserves photo editor review restrictions and other role behavior', () => {
    expect(canDeleteMediaFile(file('photo', true), { ...context, isVideoEditor: false })).toBe(false);
    expect(canDeleteMediaFile(file('photo'), { ...context, isVideoEditor: false, isSubmittedForReview: false })).toBe(true);
    const staff = { ...context, isEditor: false, isVideoEditor: false, isDelivered: true };
    expect(canDeleteMediaFile(file('video'), { ...staff, role: 'superadmin', isAdmin: true })).toBe(true);
    expect(canDeleteMediaFile(file('video'), { ...staff, role: 'admin', isAdmin: true })).toBe(false);
    expect(canDeleteMediaFile(file('video', true), { ...staff, role: 'client' })).toBe(false);
    expect(canDeleteMediaFile(file('video', true), { ...staff, role: 'salesRep' })).toBe(false);
  });

  it('rejects mixed, stale and empty selections rather than authorizing the whole batch', () => {
    const files = [file('own', true), file('other', false)];
    const allowed = (item: MediaFile) => canDeleteMediaFile(item, context);
    expect(canDeleteMediaSelection(new Set(['own']), files, allowed)).toBe(true);
    expect(canDeleteMediaSelection(new Set(['own', 'other']), files, allowed)).toBe(false);
    expect(canDeleteMediaSelection(new Set(['missing']), files, allowed)).toBe(false);
    expect(canDeleteMediaSelection(new Set(), files, allowed)).toBe(false);
  });

  it('preserves explicit API permissions and fails closed on malformed values', () => {
    expect(normalizeShootMediaFile({ id: 1, can_delete: true }).can_delete).toBe(true);
    expect(normalizeShootMediaFile({ id: 1, can_delete: false }).can_delete).toBe(false);
    expect(normalizeShootMediaFile({ id: 1, can_delete: 'false' }).can_delete).toBeUndefined();
    expect(normalizeShootMediaFile({ id: 1 }).can_delete).toBeUndefined();
  });
});
