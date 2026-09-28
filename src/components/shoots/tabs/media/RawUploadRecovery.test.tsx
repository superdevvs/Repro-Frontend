import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { RawUploadSection } from './RawUploadSection';
import { uploadMediaRequest } from './uploadMediaRequest';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), trackUpload: vi.fn(), uploads: [] }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ trackUpload: mocks.trackUpload, uploads: mocks.uploads }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '989', role: 'photographer' } }) }));
vi.mock('./uploadMediaRequest', async (original) => ({ ...await original<typeof import('./uploadMediaRequest')>(), uploadMediaRequest: vi.fn() }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const accepted = (name: string, id: number) => ({ ok: true as const, status: 200, responseText: JSON.stringify({ success_count: 1, uploaded_files: [{ id, filename: name, upload_type: 'raw' }] }) });

describe('raw batch interruption recovery', () => {
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
