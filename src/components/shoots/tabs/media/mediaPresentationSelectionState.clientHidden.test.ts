import { describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { normalizeShootMediaFile } from '@/hooks/useShootFiles';
import { getMediaPresentationSelectionState } from './mediaPresentationSelectionState';

const file = (id: string, extra: Partial<MediaFile> = {}) => ({ id, filename: `${id}.jpg`, workflowStage: 'verified', can_manage_visibility: true, media_curation_scope: 'staff', ...extra }) as MediaFile;

describe('client-hidden media in the tour visibility controls', () => {
  it('reads the staff Hidden marking from either payload casing', () => {
    expect(normalizeShootMediaFile({ id: 1, is_client_hidden: true }).is_client_hidden).toBe(true);
    expect(normalizeShootMediaFile({ id: 2, isClientHidden: true }).is_client_hidden).toBe(true);
    expect(normalizeShootMediaFile({ id: 3 }).is_client_hidden).toBe(false);
  });

  it('never offers the tour "Unhide" for media staff hid from the client', () => {
    const onToggleHidden = vi.fn();
    const files = [file('1', { is_hidden: true, is_client_hidden: true }), file('2', { is_hidden: true })];
    const onlyClientHidden = getMediaPresentationSelectionState({ files, selectedFiles: new Set(['1']), role: 'admin', onToggleHidden });
    expect(onlyClientHidden.canUnhide).toBe(false);
    const curated = getMediaPresentationSelectionState({ files, selectedFiles: new Set(['2']), role: 'admin', onToggleHidden });
    expect(curated.canUnhide).toBe(true);
  });
});
