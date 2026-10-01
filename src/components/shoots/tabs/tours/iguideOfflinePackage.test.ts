import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNormalizedIguideSync } from '@/utils/shootTourData';
import {
  downloadIguideOfflinePackage,
  formatFileSize,
  IGUIDE_OFFLINE_PACKAGE_MAX_BYTES,
  parseIguideOfflinePackageResponse,
  validateIguideOfflineZip,
} from './iguideOfflinePackage';

const makeFile = (name: string, type = 'application/zip', size = 128) => {
  const file = new File(['zip'], name, { type });
  Object.defineProperty(file, 'size', { configurable: true, value: size });
  return file;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('iGUIDE offline package helpers', () => {
  it('accepts browser ZIP MIME variants and rejects non-ZIP files', () => {
    expect(validateIguideOfflineZip(makeFile('tour.zip', 'application/octet-stream'))).toBeNull();
    expect(validateIguideOfflineZip(makeFile('tour.ZIP', ''))).toBeNull();
    expect(validateIguideOfflineZip(makeFile('tour.txt'))).toMatch(/ending in \.zip/i);
    expect(validateIguideOfflineZip(makeFile('tour.zip', 'text/plain'))).toMatch(/not recognized/i);
  });

  it('accepts the reported 868,999,851-byte export and ZIPs through exactly 1 GiB', () => {
    expect(validateIguideOfflineZip(makeFile('tour.zip', 'application/zip', 868_999_851))).toBeNull();
    expect(validateIguideOfflineZip(makeFile('tour.zip', 'application/zip', 1_073_741_824))).toBeNull();
    expect(IGUIDE_OFFLINE_PACKAGE_MAX_BYTES).toBe(1_073_741_824);
    expect(validateIguideOfflineZip(makeFile('tour.zip', 'application/zip', 1_073_741_825)))
      .toBe('The ZIP is larger than the 1.0 GB upload limit.');
    expect(validateIguideOfflineZip(makeFile('tour.zip', 'application/zip', 0)))
      .toBe('The selected ZIP is empty.');
  });

  it('formats the reported export and upload limit in readable units', () => {
    expect(formatFileSize(868_999_851)).toBe('828.7 MB');
    expect(formatFileSize(IGUIDE_OFFLINE_PACKAGE_MAX_BYTES)).toBe('1.0 GB');
  });

  it('keeps the package lifecycle UUID separate from the numeric media file id', () => {
    const sync = getNormalizedIguideSync({
      iguide_data: {
        manual_offline_package: {
          id: '8a5fe186-aec0-405e-aa71-fd999be41c95',
          file_id: 412,
          status: 'ready',
          original_filename: 'offline.zip',
        },
      },
    });

    expect(sync.offlinePackage.id).toBe('8a5fe186-aec0-405e-aa71-fd999be41c95');
    expect(sync.offlinePackage.fileId).toBe('412');
    expect(sync.offlinePackage.status).toBe('ready');
  });

  it('normalizes the previous ready package while a replacement is scanning', () => {
    const sync = getNormalizedIguideSync({
      iguide_data: {
        manual_offline_package: {
          id: 'replacement',
          status: 'scanning',
          original_filename: 'new.zip',
          previous_ready: {
            id: 'previous',
            file_id: 71,
            status: 'ready',
            original_filename: 'old.zip',
          },
        },
      },
    });

    expect(sync.offlinePackage.status).toBe('scanning');
    expect(sync.offlinePackage.previousReady).toMatchObject({
      id: 'previous',
      fileId: '71',
      originalFilename: 'old.zip',
      status: 'ready',
    });
    expect(sync.offlinePackage.previousReady?.previousReady).toBeNull();
  });

  it('reads packages nested in an updated shoot response', () => {
    const parsed = parseIguideOfflinePackageResponse({
      data: {
        shoot: {
          iguide_data: {
            manual_offline_package: {
              id: 'package-1',
              file_id: 92,
              status: 'scanning',
              original_filename: 'tour.zip',
            },
          },
        },
      },
    });

    expect(parsed.id).toBe('package-1');
    expect(parsed.fileId).toBe('92');
    expect(parsed.status).toBe('scanning');
  });

  it('downloads the private media file as an authenticated blob using file_id', async () => {
    window.localStorage.setItem('authToken', 'token-123');
    const blob = new Blob(['zip'], { type: 'application/zip' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(blob, {
      status: 200,
      headers: { 'content-disposition': 'attachment; filename="offline.zip"' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const createObjectUrl = vi.fn(() => 'blob:offline');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await downloadIguideOfflinePackage({ shootId: 9, fileId: 412, filename: 'fallback.zip' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/shoots/9/media/412/download'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/octet-stream',
          Authorization: 'Bearer token-123',
        }),
      }),
    );
    const request = fetchMock.mock.calls[0][1];
    expect(request.headers).not.toHaveProperty('Content-Type');
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
