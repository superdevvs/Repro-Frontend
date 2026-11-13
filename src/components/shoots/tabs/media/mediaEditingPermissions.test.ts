import { describe, expect, it } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { canShowMediaEditingActions } from './mediaEditingPermissions';

const video: MediaFile = { id: '12', filename: 'Listing.mp4', media_type: 'video', workflowStage: 'verified' };

describe('staff media version actions', () => {
  it.each(['admin', 'superadmin', 'editing_manager'])('allows %s to review completed video replacements', role => {
    expect(canShowMediaEditingActions(video, 8, role)).toBe(true);
    expect(canShowMediaEditingActions({ ...video, workflowStage: 'completed' }, 8, role)).toBe(true);
    expect(canShowMediaEditingActions({ ...video, workflowStage: 'todo' }, 8, role)).toBe(false);
    expect(canShowMediaEditingActions({ ...video, is_hidden: true }, 8, role)).toBe(false);
  });
  it.each(['client', 'salesRep', 'editor', 'photographer', undefined])('does not offer staff video review to %s', role => {
    expect(canShowMediaEditingActions(video, 8, role)).toBe(false);
  });
  it('preserves raw-photo editing while requiring a shoot for every action', () => {
    const raw = { ...video, filename: 'Image.nef', media_type: 'raw', workflowStage: 'todo' };
    expect(canShowMediaEditingActions(raw, 8, 'admin')).toBe(true);
    expect(canShowMediaEditingActions(video, undefined, 'admin')).toBe(false);
  });
});
