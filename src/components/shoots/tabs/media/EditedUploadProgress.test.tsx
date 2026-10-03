import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { EditedUploadSection } from './EditedUploadSection';
import { uploadMediaRequest } from './uploadMediaRequest';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), trackUpload: vi.fn(), uploads: [] }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ trackUpload: mocks.trackUpload, uploads: mocks.uploads }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '1001', role: 'editing_manager' } }) }));
vi.mock('./uploadMediaRequest', async (original) => ({
  ...await original<typeof import('./uploadMediaRequest')>(),
  uploadMediaRequest: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('edited upload transfer progress', () => {
  it('reports byte-level progress while a video is still transferring (not stuck at 0%)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
    const shoot = { id: '160', services: [], location: { address: 'Edited Video QA' } } as ShootData;
    render(
      <QueryClientProvider client={client}>
        <EditedUploadSection shoot={shoot} onUploadComplete={vi.fn()} />
      </QueryClientProvider>,
    );

    const video = new File(['x'.repeat(1000)], 'walkthrough.mp4', { type: 'video/mp4' });
    Object.defineProperty(video, 'size', { value: 1000 });
    fireEvent.change(screen.getByTestId('edited-upload-input'), { target: { files: [video] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Edited Files' }));

    vi.mocked(uploadMediaRequest).mockImplementationOnce(async (options) => {
      options.onProgress({ phase: 'transferring', loaded: 250, total: 1000 });
      options.onProgress({ phase: 'transferring', loaded: 500, total: 1000 });
      options.onProgress({ phase: 'processing', loaded: 1000, total: 1000 });
      return {
        ok: true as const,
        status: 200,
        responseText: JSON.stringify({
          success_count: 1,
          uploaded_files: [{ id: 42, filename: 'walkthrough.mp4', upload_type: 'edited' }],
        }),
      };
    });

    const onProgress = vi.fn();
    await act(async () => {
      await mocks.trackUpload.mock.calls[0][0].uploadFn(onProgress, new AbortController().signal);
    });

    expect(uploadMediaRequest).toHaveBeenCalledOnce();
    expect(onProgress.mock.calls.some(([value]) => value > 0 && value < 100)).toBe(true);
    expect(onProgress.mock.calls.some(([value, detail]) => value === 25 && detail?.fileProgresses?.[0] === 25)).toBe(true);
    expect(onProgress.mock.calls.some(([value, detail]) => value === 50 && detail?.fileProgresses?.[0] === 50)).toBe(true);
    const lastCall = onProgress.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(100);
    expect(lastCall?.[1]?.fileSizes).toEqual([1000]);
    expect(lastCall?.[1]?.fileProgresses?.[0]).toBe(100);
    expect(lastCall?.[1]?.completedFileIndexes).toEqual([0]);
  });

  it('emits per-file size and progress for concurrent edited uploads', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
    const shoot = { id: '161', services: [], location: { address: 'Edited Multi QA' } } as ShootData;
    render(
      <QueryClientProvider client={client}>
        <EditedUploadSection shoot={shoot} onUploadComplete={vi.fn()} />
      </QueryClientProvider>,
    );

    const fileA = new File(['a'.repeat(400)], 'a.jpg', { type: 'image/jpeg' });
    const fileB = new File(['b'.repeat(600)], 'b.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileA, 'size', { value: 400 });
    Object.defineProperty(fileB, 'size', { value: 600 });
    fireEvent.change(screen.getByTestId('edited-upload-input'), { target: { files: [fileA, fileB] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Edited Files' }));

    vi.mocked(uploadMediaRequest).mockImplementation(async (options) => {
      const body = options.body as FormData;
      const file = body.get('files[]') as File;
      options.onProgress({ phase: 'transferring', loaded: file.size / 2, total: file.size });
      options.onProgress({ phase: 'processing', loaded: file.size, total: file.size });
      return {
        ok: true as const,
        status: 200,
        responseText: JSON.stringify({
          success_count: 1,
          uploaded_files: [{ id: file.name === 'a.jpg' ? 1 : 2, filename: file.name, upload_type: 'edited' }],
        }),
      };
    });

    const onProgress = vi.fn();
    await act(async () => {
      await mocks.trackUpload.mock.calls[0][0].uploadFn(onProgress, new AbortController().signal);
    });

    expect(uploadMediaRequest).toHaveBeenCalledTimes(2);
    const mid = onProgress.mock.calls.find(([, detail]) => (
      Array.isArray(detail?.fileProgresses)
      && detail.fileProgresses.some((pct: number) => pct > 0 && pct < 100)
    ));
    expect(mid?.[1]?.fileSizes).toEqual([400, 600]);
    const lastCall = onProgress.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(100);
    expect(lastCall?.[1]?.completedFileIndexes.sort()).toEqual([0, 1]);
    expect(lastCall?.[1]?.fileProgresses).toEqual([100, 100]);
  });
  it('retains only failed files and rejects global completion after a partial save', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
    const onComplete = vi.fn();
    const onConsumed = vi.fn();
    const files = ['saved.jpg', 'retry.jpg'].map((name) => new File(['abc'], name, { type: 'image/jpeg' }));
    render(<QueryClientProvider client={client}>
      <EditedUploadSection shoot={{ id: '162', services: [] } as unknown as ShootData}
        stagedDrop={{ files, type: 'edited' }} onStagedDropConsumed={onConsumed} onUploadComplete={onComplete} />
    </QueryClientProvider>);
    expect(onConsumed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Upload Edited Files' }));
    vi.mocked(uploadMediaRequest).mockImplementation(async (options) => {
      const file = (options.body as FormData).get('files[]') as File;
      options.onProgress({ phase: 'processing', loaded: file.size, total: file.size });
      return { ok: true, status: 200, responseText: JSON.stringify(file.name === 'saved.jpg'
        ? { success_count: 1, uploaded_files: [{ id: 1, filename: file.name, upload_type: 'edited' }] }
        : { success_count: 0, error_count: 1, errors: [{ file_name: file.name, message: 'Storage busy', retryable: true }] }) };
    });
    const progress = vi.fn();
    await act(async () => {
      await expect(mocks.trackUpload.mock.calls[0][0].uploadFn(progress, new AbortController().signal)).rejects.toThrow();
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(progress.mock.calls.at(-1)?.[0]).toBeLessThan(100);
    fireEvent.click(screen.getByRole('button', { name: 'Upload Edited Files' }));
    expect(mocks.trackUpload.mock.calls.at(-1)?.[0].fileNames).toEqual(['retry.jpg']);
  });

});
