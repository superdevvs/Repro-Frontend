import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import { createShootMediaPresentationActions } from './shootMediaPresentationActions';

vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer fixture' }) }));
const image: MediaFile = { id: '11', filename: 'final.jpg', media_type: 'edited', workflowStage: 'verified', can_manage_visibility: true, can_set_hero: true, is_cover: true };
const fetchMock = vi.fn(), toast = vi.fn(), onShootUpdate = vi.fn(), invalidateQueries = vi.fn();
function useHarness(role: string, initial = [image]) {
  const [editedFiles, setEditedFiles] = useState(initial);
  const [rawFiles, setRawFiles] = useState<MediaFile[]>([]);
  const actions = createShootMediaPresentationActions({ shoot: { id: 156 } as unknown as ShootData, role, rawFiles, editedFiles, setRawFiles, setEditedFiles,
    queryClient: { invalidateQueries } as never, toast, onShootUpdate });
  return { ...actions, editedFiles };
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockResolvedValue({ ok: true, json: async () => ({ message: 'Updated' }) }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('scoped presentation mutations', () => {
  it.each(['client', 'salesRep'])('%s hide clears local cover, keeps restore row and refreshes caches; unhide then hero works', async role => {
    const { result } = renderHook(() => useHarness(role));
    await act(async () => { await result.current.toggleFileHidden('11', true); });
    expect(result.current.editedFiles).toHaveLength(1);
    expect(result.current.editedFiles[0]).toMatchObject({ is_hidden: true, is_cover: false });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ file_ids: [11], hidden: true });
    await act(async () => { await result.current.handleSetHeroImage('11'); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.toggleFileHidden('11', false); });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ file_ids: [11], hidden: false });
    await act(async () => { await result.current.handleSetHeroImage('11'); });
    expect(fetchMock.mock.calls[2][0]).toContain('/shoots/156/media/11/cover');
    expect(fetchMock.mock.calls[2][1].method).toBe('POST');
    expect(result.current.editedFiles[0].is_cover).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledTimes(9);
    expect(onShootUpdate).toHaveBeenCalledTimes(3);
  });
  it('bulk sends an explicit desired state for authorized files and rejects a mixed read-only selection', async () => {
    const { result } = renderHook(() => useHarness('client', [image, { ...image, id: '12' }, { ...image, id: '13', can_manage_visibility: false }]));
    await act(async () => { await result.current.toggleFilesHidden(['11', '13'], true); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await result.current.toggleFilesHidden(['11', '12'], true); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ file_ids: [11, 12], hidden: true });
  });
  it('rolls back a rejected visibility update and never mutates denied hero permission', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: 'Permission revoked' }) });
    const { result } = renderHook(() => useHarness('salesRep', [{ ...image, can_set_hero: false }]));
    await act(async () => { await result.current.toggleFileHidden('11', true); });
    expect(result.current.editedFiles[0]).toMatchObject({ is_cover: true, is_hidden: undefined });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Permission revoked', variant: 'destructive' }));
    await act(async () => { await result.current.handleSetHeroImage('11'); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
