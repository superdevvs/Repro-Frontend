import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { UploadProvider, useUpload } from './UploadContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <UploadProvider>{children}</UploadProvider>
);

describe('UploadContext lifecycle vocabulary', () => {
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
    await waitFor(() => expect(result.current.uploads[0]?.status).toBe('uploading'));

    act(() => resolveUpload());
    await waitFor(() => expect(result.current.uploads[0]?.status).toBe('succeeded'));
    expect(result.current.completedUploadCount).toBe(1);
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
  });
});
