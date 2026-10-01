import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import { useShootMediaActions } from './useShootMediaActions';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 22, role: 'editor', editing_capabilities: ['video'] } }),
}));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer test-token' }) }));

const fetchMock = vi.fn<typeof fetch>();
const toast = vi.fn();
const invalidateQueries = vi.fn();
const onShootUpdate = vi.fn();
const video = (id: string, canDelete: boolean | undefined = true) => ({
  id, filename: `edited-${id}.mp4`, file_type: 'video/mp4', can_delete: canDelete,
} as MediaFile);
const response = (status: number, payload: unknown) => ({
  ok: status >= 200 && status < 300, status, json: async () => payload,
} as Response);

function useHarness(options: {
  selectedIds?: string[];
  displayTab?: 'uploaded' | 'edited';
  editedFiles?: MediaFile[];
} = {}) {
  const [selectedFiles, setSelectedFiles] = useState(() => new Set(options.selectedIds ?? ['11', '12']));
  const actions = useShootMediaActions({
    shoot: {
      id: 42, serviceObjects: [{ id: '1', name: 'Photos & Video', editor_id: '10', video_editor_id: '22' }],
    } as unknown as ShootData,
    role: 'editor', displayTab: options.displayTab ?? 'edited', selectedFiles, setSelectedFiles,
    editedFiles: options.editedFiles ?? [video('11'), video('12'), video('13')], rawFiles: [],
    selectedEditingType: '', setShowAiEditDialog: vi.fn(), setSubmittingAiEdit: vi.fn(),
    setDownloading: vi.fn(), setDownloadPopup: vi.fn(), setActiveSubTab: vi.fn(), setDisplayTab: vi.fn(),
    setRawFiles: vi.fn(), setEditedFiles: vi.fn(), showUploadTab: false, onShootUpdate,
    queryClient: { invalidateQueries } as unknown as Parameters<typeof useShootMediaActions>[0]['queryClient'],
    toast, trackUpload: vi.fn(), dragCounterRef: { current: 0 }, setDragOverTab: vi.fn(),
  });
  return { ...actions, selectedFiles, setSelectedFiles };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset().mockResolvedValue(response(200, { message: 'Files deleted', failed_ids: [] }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const expectRefreshed = () => {
  for (const tab of ['raw', 'edited', 'all']) {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['shootFiles', 42, tab] });
  }
  expect(onShootUpdate).toHaveBeenCalledTimes(1);
};

describe('bulk deletion of edited video', () => {
  it('sends only selected IDs and clears them after confirmed full success', async () => {
    const { result } = renderHook(() => useHarness());
    await act(async () => { await result.current.handleDeleteFiles(); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/shoots/42/media/bulk-delete'), {
      method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: JSON.stringify({ ids: [11, 12] }),
    });
    expect([...result.current.selectedFiles]).toEqual([]);
    expect(toast).toHaveBeenCalledWith({ title: 'Success', description: 'Deleted 2 file(s) successfully' });
    expectRefreshed();
  });

  it('retains failed IDs on 207 and reports the number actually deleted', async () => {
    fetchMock.mockResolvedValue(response(207, { message: 'Some files failed to delete', failed_ids: [12] }));
    const { result } = renderHook(() => useHarness());
    await act(async () => { await result.current.handleDeleteFiles(); });

    expect([...result.current.selectedFiles]).toEqual(['12']);
    expect(toast).toHaveBeenCalledWith({
      title: 'Some files could not be deleted',
      description: 'Deleted 1 of 2 file(s). 1 failed and remain selected.', variant: 'destructive',
    });
    expectRefreshed();
  });

  it('does not announce success when every file failed', async () => {
    fetchMock.mockResolvedValue(response(207, { failed_ids: [11, 12] }));
    const { result } = renderHook(() => useHarness());
    await act(async () => { await result.current.handleDeleteFiles(); });

    expect([...result.current.selectedFiles]).toEqual(['11', '12']);
    expect(toast).toHaveBeenCalledWith({
      title: 'Deletion failed', description: 'Deleted 0 of 2 file(s). 2 failed and remain selected.', variant: 'destructive',
    });
  });

  it.each([
    { failed_ids: undefined }, { failed_ids: [] }, { failed_ids: [999] }, { failed_ids: [[12]] },
  ])('keeps selection and refreshes when a 207 result cannot be reconciled: %j', async (payload) => {
    fetchMock.mockResolvedValue(response(207, payload));
    const { result } = renderHook(() => useHarness());
    await act(async () => { await result.current.handleDeleteFiles(); });

    expect([...result.current.selectedFiles]).toEqual(['11', '12']);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Error', description: 'Deletion result could not be confirmed. Refresh the list before retrying.',
    }));
    expectRefreshed();
  });

  it('does not clear selections added while the deletion is pending', async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useHarness());
    let deleting!: Promise<void>;
    act(() => { deleting = result.current.handleDeleteFiles(); });
    act(() => result.current.setSelectedFiles(new Set(['11', '12', '13'])));
    await act(async () => { finish(response(207, { failed_ids: [12] })); await deleting; });

    expect([...result.current.selectedFiles]).toEqual(['12', '13']);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ ids: [11, 12] });
  });

  it.each(['network', 'forbidden', 'unreadable'])('preserves selection after %s failure', async (kind) => {
    if (kind === 'network') fetchMock.mockRejectedValue(new Error('Connection interrupted'));
    if (kind === 'forbidden') fetchMock.mockResolvedValue(response(403, { message: 'Forbidden' }));
    if (kind === 'unreadable') fetchMock.mockResolvedValue({
      ok: true, status: 200, json: async () => { throw new Error('Invalid JSON'); },
    } as unknown as Response);
    const { result } = renderHook(() => useHarness());
    await act(async () => { await result.current.handleDeleteFiles(); });

    expect([...result.current.selectedFiles]).toEqual(['11', '12']);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', variant: 'destructive' }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }));
    if (kind !== 'unreadable') expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('sends nothing when confirmation is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const { result } = renderHook(() => useHarness());
    await act(async () => { await result.current.handleDeleteFiles(); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect([...result.current.selectedFiles]).toEqual(['11', '12']);
  });

  it.each([
    { displayTab: 'uploaded' as const },
    { editedFiles: [video('11'), video('12', false)] },
    { editedFiles: [video('11'), { ...video('12'), can_delete: undefined }] },
    { editedFiles: [video('11')] },
  ])('blocks a video editor denied selection before confirmation: %j', async (options) => {
    const { result } = renderHook(() => useHarness(options));
    await act(async () => { await result.current.handleDeleteFiles(); });
    expect(window.confirm).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cannot delete selected files' }));
  });

  it('does not send an empty selection', async () => {
    const { result } = renderHook(() => useHarness({ selectedIds: [] }));
    await act(async () => { await result.current.handleDeleteFiles(); });
    expect(window.confirm).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
