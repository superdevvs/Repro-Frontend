import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';
import { DOWNLOAD_URL_REVOKE_DELAY_MS } from '@/utils/shootDownloadTransfer';
import { useShootMediaActions, type DownloadPopupState } from './useShootMediaActions';

const downloads = vi.hoisted(() => ({ single: vi.fn(), recovery: vi.fn(), raw: vi.fn() }));
vi.mock('@/utils/shootMediaDownload', () => ({
  downloadShootMediaFile: downloads.single,
  downloadScanFailedShootFile: downloads.recovery,
  downloadShootRawFiles: downloads.raw,
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 1, role: 'admin' } }) }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer test-token' }) }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const initialPopup: DownloadPopupState = {
  visible: false, status: 'processing', blobUrl: null, filename: '', fileCount: 0, sizeLabel: '',
};
const toast = vi.fn();
const setSelectedFiles = vi.fn();
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

function useHarness(role = 'admin') {
  const [downloading, setDownloading] = useState(false);
  const [popup, setDownloadPopup] = useState(initialPopup);
  const actions = useShootMediaActions({
    shoot: { id: 42, location: { address: '12 Oak Street', city: 'Fairfax' } } as unknown as ShootData,
    role, displayTab: 'uploaded', selectedFiles: new Set(['a', 'b']), setSelectedFiles,
    selectedEditingType: '', setShowAiEditDialog: vi.fn(), setSubmittingAiEdit: vi.fn(),
    setDownloading, setDownloadPopup, setActiveSubTab: vi.fn(), setDisplayTab: vi.fn(),
    rawFiles: [
      { id: 'a', filename: 'a.jpg', scan_status: 'clean' },
      { id: 'b', filename: 'b.jpg', scan_status: 'clean' },
    ] as MediaFile[],
    editedFiles: [], setRawFiles: vi.fn(), setEditedFiles: vi.fn(), showUploadTab: false,
    onShootUpdate: vi.fn(), queryClient: {} as Parameters<typeof useShootMediaActions>[0]['queryClient'],
    toast, trackUpload: vi.fn(), dragCounterRef: { current: 0 }, setDragOverTab: vi.fn(),
  });
  return { ...actions, downloading, popup };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  downloads.single.mockReset();
  downloads.raw.mockReset();
  createObjectURL.mockReset().mockReturnValueOnce('blob:first').mockReturnValue('blob:second');
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('media download lifetime', () => {
  it('locks each file immediately, preserves another pending file and clears a failed file for retry', async () => {
    const first = deferred<{ mode: string; filename: string }>();
    const second = deferred<{ mode: string; filename: string }>();
    downloads.single.mockImplementation(({ fileId }) => fileId === 'a' ? first.promise : second.promise);
    const { result } = renderHook(() => useHarness());
    let a!: Promise<void>;
    let b!: Promise<void>;
    act(() => {
      a = result.current.handleDownloadSingleFile('a');
      void result.current.handleDownloadSingleFile('a');
      b = result.current.handleDownloadSingleFile('b');
    });
    expect(downloads.single).toHaveBeenCalledTimes(2);
    expect([...result.current.downloadingFileIds]).toEqual(['a', 'b']);
    await act(async () => { first.reject(new Error('Transfer interrupted')); await a; });
    expect([...result.current.downloadingFileIds]).toEqual(['b']);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Transfer interrupted' }));
    downloads.single.mockResolvedValue({ mode: 'blob', filename: 'a.jpg' });
    await act(async () => { await result.current.handleDownloadSingleFile('a'); });
    expect(downloads.single).toHaveBeenCalledTimes(3);
    expect([...result.current.downloadingFileIds]).toEqual(['b']);
    await act(async () => { second.resolve({ mode: 'blob', filename: 'b.jpg' }); await b; });
    expect(result.current.downloadingFileIds.size).toBe(0);
  });

  it('keeps selected ZIP busy until the body finishes and uses the safe server attachment name', async () => {
    const body = deferred<Blob>();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, headers: new Headers({ 'Content-Disposition': 'attachment; filename="../12 Oak Street-selected.zip"' }),
      blob: () => body.promise,
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useHarness());
    let transfer!: Promise<void>;
    await act(async () => {
      transfer = result.current.handleDownload('small');
      void result.current.handleDownload('small');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.downloading).toBe(true);
    expect(result.current.popup.filename).toBe('12-oak-street-fairfax-selected-mls.zip');
    expect(createObjectURL).not.toHaveBeenCalled();
    await act(async () => { body.resolve(new Blob(['zip bytes'])); await transfer; });
    expect(result.current.downloading).toBe(false);
    expect(result.current.popup).toMatchObject({ status: 'ready', filename: '12 Oak Street-selected.zip', blobUrl: 'blob:first' });
    expect(revokeObjectURL).not.toHaveBeenCalled();
    act(() => result.current.handleManualDownload(result.current.popup));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(2);
    act(() => result.current.closeDownloadPopup(result.current.popup));
    expect(revokeObjectURL).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(DOWNLOAD_URL_REVOKE_DELAY_MS));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first');
  });

  it('reclaims the previous popup on replacement and the latest on unmount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, headers: new Headers(), blob: async () => new Blob(['zip bytes']),
    }));
    const { result, unmount } = renderHook(() => useHarness());
    await act(async () => { await result.current.handleDownload('original'); });
    expect(result.current.popup.filename).toBe('12-oak-street-fairfax-selected-print.zip');
    await act(async () => { await result.current.handleDownload('small'); });
    expect(revokeObjectURL).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(DOWNLOAD_URL_REVOKE_DELAY_MS));
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first');
    expect(result.current.popup.blobUrl).toBe('blob:second');
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(DOWNLOAD_URL_REVOKE_DELAY_MS));
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenLastCalledWith('blob:second');
  });

  it('reclaims a ZIP body that completes after unmount without starting a download', async () => {
    const body = deferred<Blob>();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers(), blob: () => body.promise }));
    const { result, unmount } = renderHook(() => useHarness());
    let transfer!: Promise<void>;
    await act(async () => { transfer = result.current.handleDownload('small'); });
    unmount();
    await act(async () => { body.resolve(new Blob(['late bytes'])); await transfer; });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('clears a failed batch lock and passes the property address to editor raw downloads', async () => {
    const first = deferred<{ mode: string; filename: string }>();
    downloads.raw.mockReturnValueOnce(first.promise).mockResolvedValue({ mode: 'blob', filename: 'raw.zip' });
    const { result } = renderHook(() => useHarness('editor'));
    let transfer!: Promise<void>;
    act(() => {
      transfer = result.current.handleEditorDownloadRaw(false);
      void result.current.handleEditorDownloadRaw(false);
    });
    expect(downloads.raw).toHaveBeenCalledTimes(1);
    expect(downloads.raw).toHaveBeenCalledWith({ shootId: 42, fileIds: ['a', 'b'], address: '12 Oak Street, Fairfax' });
    expect(result.current.downloading).toBe(true);
    await act(async () => { first.reject(new Error('Download failed')); await transfer; });
    expect(result.current.downloading).toBe(false);
    await act(async () => { await result.current.handleEditorDownloadRaw(false); });
    expect(downloads.raw).toHaveBeenCalledTimes(2);
    expect(result.current.downloading).toBe(false);
  });
});
