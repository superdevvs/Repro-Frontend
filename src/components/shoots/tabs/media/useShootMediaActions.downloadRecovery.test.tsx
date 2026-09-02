import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';

import { useShootMediaActions } from './useShootMediaActions';

const downloadMocks = vi.hoisted(() => ({
  recovery: vi.fn().mockResolvedValue({ filename: 'recovered.cr3' }),
  single: vi.fn().mockResolvedValue({ mode: 'blob', filename: 'image.jpg' }),
  raw: vi.fn(),
}));

vi.mock('@/utils/shootMediaDownload', () => ({
  downloadScanFailedShootFile: downloadMocks.recovery,
  downloadShootMediaFile: downloadMocks.single,
  downloadShootRawFiles: downloadMocks.raw,
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 1, role: 'superadmin' } }),
}));

const buildHookProps = (role: string, file: MediaFile) => ({
  shoot: { id: 42, location: { fullAddress: '124 Main Street' } } as unknown as ShootData,
  role,
  displayTab: 'uploaded' as const,
  selectedFiles: new Set<string>(),
  setSelectedFiles: vi.fn(),
  selectedEditingType: '',
  setShowAiEditDialog: vi.fn(),
  setSubmittingAiEdit: vi.fn(),
  setDownloading: vi.fn(),
  setDownloadPopup: vi.fn(),
  setActiveSubTab: vi.fn(),
  setDisplayTab: vi.fn(),
  rawFiles: [file],
  editedFiles: [],
  setRawFiles: vi.fn(),
  setEditedFiles: vi.fn(),
  showUploadTab: false,
  onShootUpdate: vi.fn(),
  queryClient: {} as Parameters<typeof useShootMediaActions>[0]['queryClient'],
  toast: vi.fn(),
  trackUpload: vi.fn(),
  dragCounterRef: { current: 0 },
  setDragOverTab: vi.fn(),
});

describe('existing media download controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses the restricted recovery endpoint for a superadmin downloading a scan-failed file', async () => {
    const file = { id: 'raw-1', filename: 'failed.cr3', scan_status: 'failed' } as MediaFile;
    const { result } = renderHook(() => useShootMediaActions(buildHookProps('superadmin', file)));

    await act(async () => {
      await result.current.handleDownloadSingleFile('raw-1');
    });

    expect(downloadMocks.recovery).toHaveBeenCalledWith({ shootId: 42, fileId: 'raw-1' });
    expect(downloadMocks.single).not.toHaveBeenCalled();
  });

  it('keeps the existing download endpoint for clean files', async () => {
    const file = { id: 'raw-2', filename: 'clean.cr3', scan_status: 'clean' } as MediaFile;
    const { result } = renderHook(() => useShootMediaActions(buildHookProps('superadmin', file)));

    await act(async () => {
      await result.current.handleDownloadSingleFile('raw-2');
    });

    expect(downloadMocks.single).toHaveBeenCalledWith({ shootId: 42, fileId: 'raw-2' });
    expect(downloadMocks.recovery).not.toHaveBeenCalled();
  });

  it('never exposes the superadmin recovery endpoint to other roles', async () => {
    const file = { id: 'raw-3', filename: 'failed.cr3', scan_status: 'failed' } as MediaFile;
    const { result } = renderHook(() => useShootMediaActions(buildHookProps('admin', file)));

    await act(async () => {
      await result.current.handleDownloadSingleFile('raw-3');
    });

    expect(downloadMocks.recovery).not.toHaveBeenCalled();
    expect(downloadMocks.single).toHaveBeenCalledWith({ shootId: 42, fileId: 'raw-3' });
  });
});
