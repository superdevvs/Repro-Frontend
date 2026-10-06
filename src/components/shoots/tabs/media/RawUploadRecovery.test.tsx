import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import { RawUploadSection } from './RawUploadSection';
import { uploadMediaRequest } from './uploadMediaRequest';
import { prepareRawUploadBatch } from './prepareRawUploadBatch';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), trackUpload: vi.fn(), uploads: [] }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ trackUpload: mocks.trackUpload, uploads: mocks.uploads }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '989', role: 'photographer' } }) }));
vi.mock('./uploadMediaRequest', async (original) => ({ ...await original<typeof import('./uploadMediaRequest')>(), uploadMediaRequest: vi.fn() }));
vi.mock('./prepareRawUploadBatch', () => ({ prepareRawUploadBatch: vi.fn(async () => 1) }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const accepted = (name: string, id: number) => ({ ok: true as const, status: 200, responseText: JSON.stringify({ success_count: 1, uploaded_files: [{ id, filename: name, upload_type: 'raw' }] }) });

describe('raw batch interruption recovery', () => {
  it('counts only confirmed files in this batch, independently of saved media and refreshes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const shoot = { id: '98', services: [] } as ShootData;
    const saved = Array.from({ length: 100 }, (_, id) => ({ id: String(id), filename: `saved-${id}.CR3` } as MediaFile));
    const panel = (rawFiles: MediaFile[]) => <QueryClientProvider client={client}><RawUploadSection shoot={shoot} rawFiles={rawFiles} onUploadComplete={vi.fn()} /></QueryClientProvider>;
    const { rerender } = render(panel(saved));
    const files = ['first.CR3', 'second.CR3', 'third.CR3'].map((name) => new File(['raw'], name));
    fireEvent.change(screen.getByTestId('raw-upload-input'), { target: { files } });
    expect(screen.getByText('0 / 3 uploaded')).toBeVisible();
    const resolvers: Array<(result: Awaited<ReturnType<typeof uploadMediaRequest>>) => void> = [];
    vi.mocked(uploadMediaRequest).mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve); }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & upload' }));
    let finished!: Promise<unknown>;
    await act(async () => { finished = mocks.trackUpload.mock.calls[0][0].uploadFn(vi.fn(), new AbortController().signal).catch(() => undefined); });
    expect(screen.getByText('0 / 3 uploaded')).toBeVisible();
    await act(async () => { resolvers[0](accepted('first.CR3', 101)); });
    rerender(panel([...saved, { id: '101', filename: 'first.CR3' } as MediaFile]));
    expect(screen.getByText('1 / 3 uploaded')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Batch upload progress' })).toHaveAttribute('aria-valuenow', '33');
    await act(async () => { resolvers[1]({ ok: false, message: 'Connection lost' }); await finished; });
    expect(screen.getByText('0 / 2 uploaded')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry Failed' }));
    await act(async () => { finished = mocks.trackUpload.mock.calls[1][0].uploadFn(vi.fn(), new AbortController().signal).catch(() => undefined); });
    expect(screen.getByText('0 / 2 uploaded')).toBeVisible();
    await act(async () => { resolvers[2](accepted('second.CR3', 102)); });
    expect(screen.getByText('1 / 2 uploaded')).toBeVisible();
    await act(async () => { resolvers[3](accepted('third.CR3', 103)); await finished; });
    expect(screen.queryByText('Selected Files (2)')).not.toBeInTheDocument();
  });

  it('waits for an in-flight confirmation after a parallel failure and retains unsent work', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const complete = vi.fn();
    render(<QueryClientProvider client={client}><RawUploadSection shoot={{ id: '98', services: [] } as ShootData} onUploadComplete={complete} /></QueryClientProvider>);
    const files = [1, 2, 3, 4].map((id) => new File(['1234567890'], `${id}.CR3`));
    fireEvent.change(screen.getByTestId('raw-upload-input'), { target: { files } });
    vi.mocked(prepareRawUploadBatch).mockResolvedValueOnce(2);
    const resolvers: Array<(result: Awaited<ReturnType<typeof uploadMediaRequest>>) => void> = [];
    vi.mocked(uploadMediaRequest).mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve); }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & upload' }));
    let finished!: Promise<unknown>;
    await act(async () => { finished = mocks.trackUpload.mock.calls[0][0].uploadFn(vi.fn(), new AbortController().signal).catch(() => undefined); });
    expect(resolvers).toHaveLength(2);
    await act(async () => { resolvers[0]({ ok: false, message: 'Connection lost' }); });
    expect(complete).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Remove this service group' })).not.toBeInTheDocument();
    await act(async () => { resolvers[1](accepted('2.CR3', 2)); await finished; });
    expect(uploadMediaRequest).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Selected Files (3)')).toBeVisible();
    expect(complete).not.toHaveBeenCalled();
  });

  it('prepares separate photo and video reservations within one staged service', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><RawUploadSection shoot={{ id: '98', services: [] } as ShootData} onUploadComplete={vi.fn()} /></QueryClientProvider>);
    const files = [new File(['raw'], '1.CR3'), new File(['video'], '2.mp4', { type: 'video/mp4' }), new File(['raw'], '3.CR3')];
    fireEvent.change(screen.getByTestId('raw-upload-input'), { target: { files } });
    vi.mocked(uploadMediaRequest).mockImplementation(async ({ body }) => accepted((body.get('files[]') as File).name, 1));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & upload' }));
    await act(async () => { await mocks.trackUpload.mock.calls[0][0].uploadFn(vi.fn(), new AbortController().signal); });
    const batches = vi.mocked(prepareRawUploadBatch).mock.calls.map(([options]) => options);
    expect(batches.map((batch) => batch.files.map((file) => file.name))).toEqual([['1.CR3', '3.CR3'], ['2.mp4']]);
    expect(batches[0].batchId).not.toBe(batches[1].batchId);
    expect(vi.mocked(uploadMediaRequest).mock.calls.map(([{ body }]) => body.get('upload_batch_index'))).toEqual(['0', '1', '0']);
  });

  it('keeps the running selection compact and restores file controls after an interruption', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const shoot = { id: '98', services: [], location: { address: 'Upload QA' } } as ShootData;
    render(<QueryClientProvider client={client}><RawUploadSection shoot={shoot} onUploadComplete={vi.fn()} /></QueryClientProvider>);
    fireEvent.change(screen.getByTestId('raw-upload-input'), { target: { files: [new File(['raw'], 'pending.CR3')] } });
    expect(screen.getByRole('button', { name: 'Remove this service group' })).toBeVisible();
    let interrupt: (result: { ok: false; message: string }) => void;
    vi.mocked(uploadMediaRequest).mockImplementationOnce(() => new Promise((resolve) => { interrupt = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & upload' }));
    let completed: Promise<unknown>;
    await act(async () => {
      completed = mocks.trackUpload.mock.calls[0][0].uploadFn(vi.fn(), new AbortController().signal).catch(() => undefined);
    });
    expect(screen.getByText(/selected files are being uploaded/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Remove this service group' })).not.toBeInTheDocument();
    await act(async () => {
      interrupt!({ ok: false, message: 'Upload interrupted.' });
      await completed;
    });
    expect(screen.getByRole('button', { name: 'Remove this service group' })).toBeVisible();
    expect(screen.getByText('Selected Files (1)')).toBeVisible();
  });

  it('stops the remaining files, retains only unfinished selection, and retries original positions/keys', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // An offline cache refresh must not hold the failure UI open forever.
    vi.spyOn(client, 'invalidateQueries').mockReturnValue(new Promise(() => {}));
    const complete = vi.fn();
    const shoot = { id: '98', services: [], location: { address: 'Upload QA' } } as ShootData;
    render(<QueryClientProvider client={client}><RawUploadSection shoot={shoot} onUploadComplete={complete} /></QueryClientProvider>);
    const files = ['first.CR3', 'second.CR3', 'third.CR3'].map((name) => new File(['1234567890'], name));
    fireEvent.change(screen.getByTestId('raw-upload-input'), { target: { files } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & upload' }));

    const request = vi.mocked(uploadMediaRequest);
    request.mockImplementationOnce(async (options) => {
      options.onProgress({ phase: 'transferring', loaded: 5, total: 10 });
      return accepted('first.CR3', 1);
    }).mockResolvedValueOnce({ ok: false, message: 'No upload data transferred for 2 minutes.' });
    const onProgress = vi.fn();
    const controller = new AbortController();
    await act(async () => {
      await expect(mocks.trackUpload.mock.calls[0][0].uploadFn(onProgress, controller.signal)).rejects.toThrow('2 files still need uploading');
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByText('Selected Files (2)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm & upload' })).toBeEnabled();
    expect(screen.getByText(/Not sent because the upload was interrupted/)).toBeVisible();
    expect(onProgress).toHaveBeenCalledWith(expect.closeTo(100 / 6), expect.objectContaining({ fileName: 'first.CR3', fileProgress: 50, completedFileIndexes: [] }));

    const initialBodies = request.mock.calls.map(([options]) => options.body);
    request.mockResolvedValueOnce(accepted('second.CR3', 2)).mockResolvedValueOnce(accepted('third.CR3', 3));
    fireEvent.click(screen.getByRole('button', { name: 'Retry Failed' }));
    await act(async () => { await mocks.trackUpload.mock.calls[1][0].uploadFn(vi.fn(), new AbortController().signal); });
    const retryBodies = request.mock.calls.slice(2).map(([options]) => options.body);
    expect(retryBodies.map((body) => body.get('upload_batch_index'))).toEqual(['1', '2']);
    expect(retryBodies.map((body) => body.get('upload_batch_total'))).toEqual(['3', '3']);
    expect(retryBodies.map((body) => body.get('upload_batch_id'))).toEqual([initialBodies[0].get('upload_batch_id'), initialBodies[0].get('upload_batch_id')]);
    expect(retryBodies[0].get('idempotency_key')).toBe(initialBodies[1].get('idempotency_key'));
    expect(complete).toHaveBeenCalledOnce();
    expect(screen.queryByText('Selected Files (2)')).not.toBeInTheDocument();
  });
});
