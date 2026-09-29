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
    expect(onProgress).toHaveBeenCalledWith(25);
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });
});
