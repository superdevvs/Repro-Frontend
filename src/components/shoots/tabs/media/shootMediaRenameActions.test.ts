import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import { createShootMediaRenameActions } from './shootMediaRenameActions';

const api = vi.hoisted(() => ({ single: vi.fn(), batch: vi.fn() }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({}) }));
vi.mock('@/services/shootMediaService', () => ({ renameShootMediaFile: api.single, batchRenameShootMediaFiles: api.batch }));
vi.mock('@/features/media-filename-rename/featureFlag', () => ({ MEDIA_BATCH_RENAME_API_ENABLED: true, MEDIA_FILENAME_RENAME_API_ENABLED: true }));

const unassigned: MediaFile = { id: '90', filename: 'front.jpg', stored_filename: 'immutable.jpg', can_interact: true };
const scoped: MediaFile = { id: '1', filename: 'room.jpg', can_interact: true };

function setup(files = [scoped, unassigned], selected = ['90']) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['shootFiles', 5933, 'raw'], files);
  queryClient.setQueryData(['shootFiles', '5933', 'all'], files);
  const setSelectedFiles = vi.fn();
  const onShootUpdate = vi.fn();
  const toast = vi.fn();
  const actions = createShootMediaRenameActions({
    shoot: { id: '5933' } as ShootData,
    rawFiles: [scoped], editedFiles: [], renameFiles: files, selectedFiles: new Set(selected),
    setRawFiles: vi.fn(), setEditedFiles: vi.fn(), setSelectedFiles, queryClient, onShootUpdate, toast,
    updateSingleFile: vi.fn(),
  });
  return { ...actions, queryClient, setSelectedFiles, onShootUpdate, toast };
}

beforeEach(() => vi.clearAllMocks());

describe('rename actions for scoped and Unassigned media', () => {
  it('renames an Unassigned viewer file outside the active unit and refreshes both cache key forms', async () => {
    api.single.mockResolvedValue({ data: { filename: 'Front entry.jpg', stored_filename: 'immutable.jpg' } });
    const view = setup();
    await expect(view.handleRenameFilename('90', 'Front entry')).resolves.toMatchObject({ ok: true, fileId: '90', nextFilename: 'Front entry.jpg' });
    expect(api.single).toHaveBeenCalledExactlyOnceWith('5933', '90', 'Front entry.jpg', {});
    for (const shootId of [5933, '5933']) {
      const lane = typeof shootId === 'number' ? 'raw' : 'all';
      expect(view.queryClient.getQueryData<MediaFile[]>(['shootFiles', shootId, lane])?.find(file => file.id === '90'))
        .toMatchObject({ filename: 'Front entry.jpg', stored_filename: 'immutable.jpg' });
    }
    expect(view.onShootUpdate).toHaveBeenCalledOnce();
  });

  it.each(['single', 'batch'] as const)('rejects a forbidden Unassigned file before the %s API request', async kind => {
    const view = setup([scoped, { ...unassigned, can_interact: false }]);
    if (kind === 'single') await expect(view.handleRenameFilename('90', 'Changed')).resolves.toEqual({ ok: false });
    else await expect(view.handleBatchRenameFilenames({ mode: 'prefix', value: 'Entry-' })).rejects.toThrow('no longer available');
    expect(api.single).not.toHaveBeenCalled();
    expect(api.batch).not.toHaveBeenCalled();
    expect(view.onShootUpdate).not.toHaveBeenCalled();
  });

  it('does not resolve assigned sibling-unit files that are outside the rename pool', async () => {
    const view = setup([scoped, unassigned], ['999']);
    await expect(view.handleRenameFilename('999', 'Changed')).resolves.toEqual({ ok: false });
    await expect(view.handleBatchRenameFilenames({ mode: 'prefix', value: 'Entry-' })).rejects.toThrow('no longer available');
    expect(api.single).not.toHaveBeenCalled();
    expect(api.batch).not.toHaveBeenCalled();
  });

  it('sends the selected Unassigned IDs and refreshes their confirmed names after batch save', async () => {
    api.batch.mockResolvedValue({ data: { updated: [{ id: 90, filename: 'Entry-front.jpg', stored_filename: 'immutable.jpg' }], failed: [] } });
    const view = setup();
    await view.handleBatchRenameFilenames({ mode: 'prefix', value: 'Entry-' });
    expect(api.batch).toHaveBeenCalledExactlyOnceWith('5933', expect.objectContaining({ file_ids: [90], mode: 'prefix', value: 'Entry-' }), {});
    expect(view.queryClient.getQueryData<MediaFile[]>(['shootFiles', '5933', 'all'])?.find(file => file.id === '90'))
      .toMatchObject({ filename: 'Entry-front.jpg', stored_filename: 'immutable.jpg' });
    expect(view.setSelectedFiles).toHaveBeenCalledWith(new Set());
  });

  it('keeps selection and confirmed filenames when a batch request fails, allowing retry', async () => {
    api.batch.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ data: { updated: [{ id: 90, filename: 'Entry-front.jpg', stored_filename: 'immutable.jpg' }], failed: [] } });
    const view = setup();
    await expect(view.handleBatchRenameFilenames({ mode: 'prefix', value: 'Entry-' })).rejects.toThrow('Offline');
    expect(view.setSelectedFiles).not.toHaveBeenCalled();
    expect(view.queryClient.getQueryData<MediaFile[]>(['shootFiles', '5933', 'all'])?.find(file => file.id === '90')?.filename).toBe('front.jpg');
    await view.handleBatchRenameFilenames({ mode: 'prefix', value: 'Entry-' });
    expect(api.batch).toHaveBeenCalledTimes(2);
    expect(view.setSelectedFiles).toHaveBeenCalledWith(new Set());
  });
});
