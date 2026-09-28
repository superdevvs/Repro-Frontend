import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { UploadProvider, useUpload } from './UploadContext';
import { hasUploadsProtectedFromNavigation, stopUploadsForAuthChange } from '@/lib/uploadNavigationProtection';

const wrapper = ({ children }: { children: ReactNode }) => (
  <UploadProvider>{children}</UploadProvider>
);

describe('UploadContext lifecycle vocabulary', () => {
  it('stops a queued upload synchronously when the sign-in changes before any request starts', async () => {
    const uploadFn = vi.fn(async () => {});
    const { result } = renderHook(() => useUpload(), { wrapper });
    act(() => {
      result.current.trackUpload({ shootId: '7', shootAddress: 'QA', fileCount: 1, fileNames: ['raw.CR3'], uploadType: 'raw', uploadFn });
      stopUploadsForAuthChange();
    });
    await waitFor(() => expect(hasUploadsProtectedFromNavigation()).toBe(false));
    expect(uploadFn).not.toHaveBeenCalled();
    expect(result.current.uploads[0]?.status).toBe('cancelled');
  });

  it('aborts an active tracked upload and prevents success after a sign-in change', async () => {
    let signal: AbortSignal | undefined;
    const { result } = renderHook(() => useUpload(), { wrapper });
    act(() => {
      result.current.trackUpload({ shootId: '7', shootAddress: 'QA', fileCount: 1, fileNames: ['raw.CR3'], uploadType: 'raw',
        uploadFn: (_progress, uploadSignal) => new Promise((_, reject) => {
          signal = uploadSignal;
          uploadSignal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
        }),
      });
    });
    await waitFor(() => expect(result.current.uploads[0]?.status).toBe('uploading'));
    act(() => stopUploadsForAuthChange());
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(hasUploadsProtectedFromNavigation()).toBe(false));
    expect(result.current.uploads[0]?.status).toBe('cancelled');
    expect(result.current.completedUploadCount).toBe(0);
  });

  it('moves a tracked upload from queued to uploading to succeeded', async () => {
    let resolveUpload!: () => void;
    const uploadFn = vi.fn(() => new Promise<void>((resolve) => { resolveUpload = resolve; }));
    const { result } = renderHook(() => useUpload(), { wrapper });

    act(() => {
      result.current.trackUpload({
        shootId: '7',
        shootAddress: '7 Test Street',
        fileCount: 1,
        fileNames: ['front.jpg'],
        uploadType: 'raw',
        uploadFn,
      });
    });

    expect(result.current.uploads[0]?.status).toBe('queued');
    expect(hasUploadsProtectedFromNavigation()).toBe(true);
    await waitFor(() => expect(result.current.uploads[0]?.status).toBe('uploading'));

    act(() => resolveUpload());
    await waitFor(() => expect(result.current.uploads[0]?.status).toBe('succeeded'));
    expect(result.current.completedUploadCount).toBe(1);
    expect(hasUploadsProtectedFromNavigation()).toBe(false);
  });

  it('cancels only the selected tracked row and never reports it succeeded', async () => {
    let resolveUpload!: () => void;
    const uploadFn = () => new Promise<void>((resolve) => { resolveUpload = resolve; });
    const { result } = renderHook(() => useUpload(), { wrapper });
    let uploadId = '';

    act(() => {
      uploadId = result.current.trackUpload({
        shootId: '8',
        shootAddress: '8 Test Street',
        fileCount: 1,
        fileNames: ['kitchen.jpg'],
        uploadType: 'edited',
        uploadFn,
      });
    });
    await waitFor(() => expect(result.current.uploads[0]?.status).toBe('uploading'));

    act(() => result.current.cancelUpload(uploadId));
    expect(result.current.uploads[0]?.status).toBe('cancelled');
    act(() => resolveUpload());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.uploads[0]?.status).toBe('cancelled');
    expect(result.current.completedUploadCount).toBe(0);
    expect(hasUploadsProtectedFromNavigation()).toBe(false);
  });

  it('releases navigation protection when a tracked upload fails', async () => {
    const { result } = renderHook(() => useUpload(), { wrapper });
    act(() => {
      result.current.trackUpload({
        shootId: '9', shootAddress: '9 Test Street', fileCount: 1,
        fileNames: ['front.cr3'], uploadType: 'raw',
        uploadFn: async () => { throw new Error('Transfer interrupted'); },
      });
    });
    expect(hasUploadsProtectedFromNavigation()).toBe(true);
    await waitFor(() => expect(result.current.uploads[0]?.status).toBe('failed'));
    expect(hasUploadsProtectedFromNavigation()).toBe(false);
  });

  it('protects the bulk uploader and releases protection after a network failure', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Network interrupted'));
    const { result } = renderHook(() => useUpload(), { wrapper });
    try {
      act(() => {
        result.current.startUpload({
          shootId: '10', shootAddress: '10 Test Street',
          files: [new File(['raw'], 'front.cr3')], uploadType: 'raw',
        });
      });
      expect(hasUploadsProtectedFromNavigation()).toBe(true);
      await waitFor(() => expect(result.current.uploads[0]?.status).toBe('failed'));
      expect(hasUploadsProtectedFromNavigation()).toBe(false);
    } finally {
      post.mockRestore();
    }
  });
});
