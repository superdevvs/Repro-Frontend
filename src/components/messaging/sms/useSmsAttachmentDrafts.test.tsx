import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageMediaFile } from '@/services/messageMedia';
import { useSmsAttachmentDrafts } from './useSmsAttachmentDrafts';

vi.mock('@/services/messageMedia', () => ({
  createMessageUpload: vi.fn(), putMessageUploadChunk: vi.fn(), completeMessageUpload: vi.fn(),
  getMessageUpload: vi.fn(), deleteMessageUpload: vi.fn(),
}));
import { completeMessageUpload, createMessageUpload, deleteMessageUpload, getMessageUpload, putMessageUploadChunk } from '@/services/messageMedia';

const info = (change: Partial<MessageMediaFile>): MessageMediaFile => ({
  id: 'server', name: 'photo.jpg', size: 10, type: 'application/octet-stream', status: 'uploading',
  received_bytes: 0, chunk_bytes: 4, download_url: '/api/messaging/media/files/server', ...change,
});
const photo = () => new File(['0123456789'], 'photo.jpg', { type: 'image/jpeg' });
const DRAFT = '7:admin:thread-1';

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
  vi.mocked(createMessageUpload).mockReset().mockResolvedValue(info({}));
  vi.mocked(putMessageUploadChunk).mockReset().mockImplementation(async (_id, index) => info({ received_bytes: Math.min(10, (index + 1) * 4) }));
  vi.mocked(completeMessageUpload).mockReset().mockResolvedValue(info({ status: 'scanning', received_bytes: 10 }));
  vi.mocked(getMessageUpload).mockReset().mockResolvedValue(info({ status: 'ready', received_bytes: 10 }));
  vi.mocked(deleteMessageUpload).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SMS attachment uploads', () => {
  it('uploads a file in server-sized chunks, waits for the virus scan, then marks it ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useSmsAttachmentDrafts());

    act(() => { expect(result.current.add(DRAFT, [photo()])).toEqual([]); });
    expect(result.current.itemsFor(DRAFT)[0]).toMatchObject({ name: 'photo.jpg', size: 10, status: 'uploading', previewUrl: 'blob:preview' });

    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0].status).toBe('scanning'));
    const id = result.current.itemsFor(DRAFT)[0].id;
    expect(createMessageUpload).toHaveBeenCalledWith({ id, name: 'photo.jpg', size: 10 }, expect.any(AbortSignal));
    expect(vi.mocked(putMessageUploadChunk).mock.calls.map(([uploadId, index, chunk]) => [uploadId, index, (chunk as Blob).size]))
      .toEqual([[id, 0, 4], [id, 1, 4], [id, 2, 2]]);
    expect(completeMessageUpload).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0].status).toBe('ready'));
    expect(result.current.itemsFor('7:admin:other-thread')).toEqual([]);
  });

  it('marks a file the scanner rejects as blocked and never ready', async () => {
    vi.mocked(completeMessageUpload).mockResolvedValue(info({ status: 'rejected' }));
    const { result } = renderHook(() => useSmsAttachmentDrafts());

    act(() => { result.current.add(DRAFT, [photo()]); });

    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0]).toMatchObject({ status: 'blocked', error: 'Blocked by the virus scan. Remove it.' }));
  });

  it('keeps a dropped upload with a retry that resumes at the acknowledged position', async () => {
    vi.mocked(putMessageUploadChunk).mockImplementationOnce(async () => info({ received_bytes: 4 })).mockRejectedValueOnce(new Error('Network Error'));
    const { result } = renderHook(() => useSmsAttachmentDrafts());
    act(() => { result.current.add(DRAFT, [photo()]); });
    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0]).toMatchObject({ status: 'failed', error: 'Upload interrupted. Retry when you are online.' }));
    const { id, key } = result.current.itemsFor(DRAFT)[0];

    vi.mocked(createMessageUpload).mockResolvedValue(info({ received_bytes: 4 }));
    vi.mocked(putMessageUploadChunk).mockClear();
    vi.mocked(completeMessageUpload).mockResolvedValue(info({ status: 'ready', received_bytes: 10 }));
    act(() => { result.current.retry(DRAFT, key); });

    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0].status).toBe('ready'));
    expect(vi.mocked(createMessageUpload).mock.calls.at(-1)?.[0]).toMatchObject({ id });
    expect(vi.mocked(putMessageUploadChunk).mock.calls.map(([, index]) => index)).toEqual([1, 2]);
  });

  it('shows the API wording when it refuses an upload', async () => {
    vi.mocked(createMessageUpload).mockRejectedValue({ response: { status: 422, data: { message: 'Finish or remove pending uploads first.' } } });
    const { result } = renderHook(() => useSmsAttachmentDrafts());

    act(() => { result.current.add(DRAFT, [photo()]); });

    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0]).toMatchObject({ status: 'failed', error: 'Finish or remove pending uploads first.' }));
  });

  it('removes a file locally, stops its upload and frees it on the server', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(createMessageUpload).mockImplementation((_data, given) => { signal = given; return new Promise(() => undefined); });
    const { result } = renderHook(() => useSmsAttachmentDrafts());
    act(() => { result.current.add(DRAFT, [photo()]); });
    const { id, key } = result.current.itemsFor(DRAFT)[0];

    act(() => { result.current.remove(DRAFT, key); });

    expect(result.current.itemsFor(DRAFT)).toEqual([]);
    expect(signal?.aborted).toBe(true);
    expect(deleteMessageUpload).toHaveBeenCalledWith(id);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('refuses an eleventh file and reports it without uploading', () => {
    vi.mocked(createMessageUpload).mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(() => useSmsAttachmentDrafts());
    act(() => { result.current.add(DRAFT, Array.from({ length: 10 }, photo)); });

    let refused: string[] = [];
    act(() => { refused = result.current.add(DRAFT, [photo()]); });

    expect(refused).toEqual(['A message can carry up to 10 attachments. 1 file was left out.']);
    expect(result.current.itemsFor(DRAFT)).toHaveLength(10);
    expect(createMessageUpload).toHaveBeenCalledTimes(10);
  });

  it('uploads the same file again under a new id after the server kept the first upload with an unsent message', async () => {
    vi.mocked(completeMessageUpload).mockResolvedValue(info({ status: 'ready', received_bytes: 10 }));
    const { result } = renderHook(() => useSmsAttachmentDrafts());
    act(() => { result.current.add(DRAFT, [photo()]); });
    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0].status).toBe('ready'));
    const first = result.current.itemsFor(DRAFT)[0];

    act(() => { result.current.uploadAgain(DRAFT, [first.id]); });

    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0].status).toBe('ready'));
    const again = result.current.itemsFor(DRAFT)[0];
    expect(again.key).toBe(first.key);
    expect(again.id).not.toBe(first.id);
    expect(vi.mocked(createMessageUpload).mock.calls.at(-1)?.[0]).toMatchObject({ id: again.id, name: 'photo.jpg' });
  });

  it('drops sent files from the tray without deleting them on the server', async () => {
    vi.mocked(completeMessageUpload).mockResolvedValue(info({ status: 'ready', received_bytes: 10 }));
    const { result } = renderHook(() => useSmsAttachmentDrafts());
    act(() => { result.current.add(DRAFT, [photo()]); });
    await waitFor(() => expect(result.current.itemsFor(DRAFT)[0].status).toBe('ready'));

    act(() => { result.current.clearSent(DRAFT, [result.current.itemsFor(DRAFT)[0].id]); });

    expect(result.current.itemsFor(DRAFT)).toEqual([]);
    expect(deleteMessageUpload).not.toHaveBeenCalled();
  });
});
