import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadShootSelectedMedia } from './shootSelectedMediaDownload';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer fixture' }) }));

const options = { shootId: 2434, fileIds: ['229089', '229090', '229091', '229093'], size: 'original' as const, address: '5822 Barnwood Pl' };
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:fixture') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = ''; });

describe('selected final image download', () => {
  it.each(['original', 'small'] as const)('posts exactly the selected IDs for %s and downloads the returned ZIP', async (size) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['zip']), { headers: { 'Content-Type': 'application/zip' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await downloadShootSelectedMedia({ ...options, size })).toMatchObject({ mode: 'blob', waited: false });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://api.example.test/api/shoots/2434/files/download', expect.objectContaining({
      method: 'POST', redirect: 'error', body: JSON.stringify({ file_ids: options.fileIds, size }),
      headers: expect.objectContaining({ Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }),
    }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it('shows assignment denials without falling back to raw files or a whole-shoot archive', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: 'Forbidden' }, { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(downloadShootSelectedMedia(options)).rejects.toThrow('Forbidden');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
