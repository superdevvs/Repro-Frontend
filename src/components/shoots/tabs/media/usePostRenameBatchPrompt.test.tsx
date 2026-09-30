import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { usePostRenameBatchPrompt } from './usePostRenameBatchPrompt';

vi.mock('@/features/media-filename-rename/featureFlag', () => ({
  MEDIA_BATCH_RENAME_API_ENABLED: true,
  MEDIA_FILENAME_RENAME_API_ENABLED: true,
}));

const file = (id: string, filename: string) => ({ id, filename }) as MediaFile;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('usePostRenameBatchPrompt', () => {
  it('sets prompt after ok:true even when eligible lists are empty so dialog would open', async () => {
    const handleRenameFilename = vi.fn(async () => ({
      ok: true as const,
      fileId: '1',
      previousFilename: 'a.jpg',
      nextFilename: 'b.jpg',
    }));
    const handleBatchRenameFilenames = vi.fn();

    const { result } = renderHook(() =>
      usePostRenameBatchPrompt({
        enabled: true,
        selectedFiles: [file('1', 'a.jpg')],
        viewFiles: [file('1', 'a.jpg')],
        handleRenameFilename,
        handleBatchRenameFilenames,
      }),
    );

    expect(result.current.prompt).toBeNull();
    expect(result.current.plan).toBeNull();

    await act(async () => {
      await result.current.onRenameFilename('1', 'b.jpg');
    });

    expect(handleRenameFilename).toHaveBeenCalledWith('1', 'b.jpg');
    expect(result.current.prompt).toEqual({
      fileId: '1',
      previousFilename: 'a.jpg',
      nextFilename: 'b.jpg',
    });
    // Plan always present once prompt is set (empty eligible lists OK).
    expect(result.current.plan).toEqual({
      find: 'a',
      replace: 'b',
      selectedFileIds: [],
      allFileIds: [],
      matchingSelectedFileIds: [],
      matchingAllFileIds: [],
    });
    // Dialog open condition: prompt alone.
    expect(Boolean(result.current.prompt)).toBe(true);
  });

  it('still sets prompt when basename is unchanged (empty find/replace plan)', async () => {
    const handleRenameFilename = vi.fn(async () => ({
      ok: true as const,
      fileId: '1',
      previousFilename: 'same.jpg',
      nextFilename: 'same.jpg',
    }));

    const { result } = renderHook(() =>
      usePostRenameBatchPrompt({
        enabled: true,
        selectedFiles: [file('1', 'same.jpg'), file('2', 'other.jpg')],
        viewFiles: [file('1', 'same.jpg'), file('2', 'other.jpg')],
        handleRenameFilename,
        handleBatchRenameFilenames: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.onRenameFilename('1', 'same.jpg');
    });

    expect(result.current.prompt).not.toBeNull();
    expect(result.current.plan).toEqual({
      find: '',
      replace: '',
      selectedFileIds: ['2'],
      allFileIds: ['2'],
      matchingSelectedFileIds: [],
      matchingAllFileIds: [],
    });
  });

  it('does not set prompt when rename returns ok:false', async () => {
    const handleRenameFilename = vi.fn(async () => ({ ok: false as const }));

    const { result } = renderHook(() =>
      usePostRenameBatchPrompt({
        enabled: true,
        selectedFiles: [file('1', 'a.jpg')],
        viewFiles: [file('1', 'a.jpg'), file('2', 'b.jpg')],
        handleRenameFilename,
        handleBatchRenameFilenames: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.onRenameFilename('1', 'b.jpg');
    });

    expect(result.current.prompt).toBeNull();
    expect(result.current.plan).toBeNull();
  });
});
