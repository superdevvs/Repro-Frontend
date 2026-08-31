import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNormalizedIguideSync } from '@/utils/shootTourData';
import {
  downloadIguideOfflinePackage,
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
  it('accepts browser ZIP MIME variants and enforces the 256 MB limit', () => {
    expect(validateIguideOfflineZip(makeFile('tour.zip', 'application/octet-stream'))).toBeNull();
    expect(validateIguideOfflineZip(makeFile('tour.ZIP', ''))).toBeNull();
    expect(validateIguideOfflineZip(makeFile('tour.txt'))).toMatch(/ending in \.zip/i);
    expect(validateIguideOfflineZip(makeFile('tour.zip', 'text/plain'))).toMatch(/not recognized/i);
    expect(validateIguideOfflineZip(
      makeFile('tour.zip', 'application/zip', IGUIDE_OFFLINE_PACKAGE_MAX_BYTES + 1),
    )).toMatch(/256 MB/i);
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
