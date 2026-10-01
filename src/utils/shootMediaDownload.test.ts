import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadShootMediaArchive, downloadShootMediaFile, downloadShootRawFiles, resolveShootMediaArchiveRequest } from './shootMediaDownload';
import { MAX_BUFFERED_ARCHIVE_BYTES } from './shootDownloadTransfer';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }) }));

const archiveOptions = { requestUrl: 'https://api.example.test/api/shoots/63/media/download-zip?signature=fixture', address: '12 Oak Street', type: 'edited' as const, size: 'small' as const };
let savedName = '';
beforeEach(() => {
  vi.useFakeTimers();
  savedName = '';
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:fixture') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { savedName = this.download; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = ''; });

describe('shoot archive requests', () => {
  it('retains photo-only, unit and booked-service filters on the archive request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ type: 'redirect', url: 'https://assets.example.test/archive.zip' }));
    vi.stubGlobal('fetch', fetchMock);
    await downloadShootMediaArchive({ shootId: 63, type: 'edited', size: 'original', assetType: 'photos', shootUnitId: 21, shootServiceId: 92 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(Object.fromEntries(url.searchParams)).toEqual({ type: 'edited', asset_type: 'photos', shoot_unit_id: '21', size: 'original', shoot_service_id: '92' });
  });

  it('requests the selected PDF page as a JPG through the authenticated file route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([255, 216, 255]), { headers: {
      'Content-Type': 'image/jpeg', 'Content-Disposition': 'attachment; filename="floorplan-page-2.jpg"',
    } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await downloadShootMediaFile({ shootId: 63, fileId: 17, format: 'jpg', page: 2 }))
      .toMatchObject({ filename: 'floorplan-page-2.jpg', mode: 'blob' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/api/shoots/63/media/17/download?format=jpg&page=2');
    expect(savedName).toBe('floorplan-page-2.jpg');
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer fixture');
  });

  it('polls preparing responses then hands the ready archive URL to the browser without buffering', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ type: 'preparing', poll_after_ms: 1000 }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ type: 'redirect', url: 'https://assets.example.test/12-oak-street-edited-small.zip' }));
    vi.stubGlobal('fetch', fetchMock);
    const onDownloading = vi.fn();
    const createObjectURL = vi.mocked(URL.createObjectURL);
    const pending = resolveShootMediaArchiveRequest({ ...archiveOptions, onDownloading });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => url === archiveOptions.requestUrl)).toBe(true);
    expect(await pending).toEqual({
      mode: 'redirect',
      url: 'https://assets.example.test/12-oak-street-edited-small.zip',
      waited: true,
    });
    expect(onDownloading).toHaveBeenCalledOnce();
    expect(document.querySelector('iframe')?.src).toBe('https://assets.example.test/12-oak-street-edited-small.zip');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(savedName).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not forward credentials to a provider link or external status URL', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ type: 'redirect', url: 'https://assets.example.test/12-oak.zip' }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await resolveShootMediaArchiveRequest({ ...archiveOptions, headers: { Authorization: 'Bearer fixture' } });
    expect(result.mode).toBe('redirect');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(document.querySelector('iframe')?.src).toBe('https://assets.example.test/12-oak.zip');
    fetchMock.mockResolvedValueOnce(Response.json({ type: 'preparing', status_url: 'https://external.test/collect' }, { status: 202 }));
    await expect(resolveShootMediaArchiveRequest(archiveOptions)).rejects.toThrow('invalid');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('hands same-origin ready archive URLs to the browser without fetch→blob buffering', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({
      type: 'redirect',
      url: 'https://api.example.test/storage/12-oak-edited-original.zip',
    }));
    vi.stubGlobal('fetch', fetchMock);
    const createObjectURL = vi.mocked(URL.createObjectURL);
    expect(await resolveShootMediaArchiveRequest(archiveOptions)).toMatchObject({
      mode: 'redirect',
      url: 'https://api.example.test/storage/12-oak-edited-original.zip',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(document.querySelector('iframe')?.src).toContain('12-oak-edited-original.zip');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(savedName).toBe('');
  });

  it('prefers X-Archive-Download-Url native handoff over buffering authenticated ZIP bodies', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(MAX_BUFFERED_ARCHIVE_BYTES + 1),
      'X-Archive-Download-Url': 'https://api.example.test/storage/12-oak-edited-small.zip',
    } })));
    const createObjectURL = vi.mocked(URL.createObjectURL);
    expect(await resolveShootMediaArchiveRequest(archiveOptions)).toMatchObject({ mode: 'redirect' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(savedName).toBe('');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector('iframe')?.src).toContain('12-oak-edited-small.zip');
  });

  it('uses the property address for raw ZIPs returned by an older server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('zip', { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename=shoot-63-raw-files.zip' } })));
    expect(await downloadShootRawFiles({ shootId: 63, address: '12 Oak Street' })).toMatchObject({ filename: '12-oak-street-raw-files.zip' });
    expect(savedName).toBe('12-oak-street-raw-files.zip');
  });

  it('surfaces a transfer failure instead of claiming a download started', async () => {
    const body = new ReadableStream({ start(controller) { controller.error(new Error('Connection interrupted')); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'application/zip', 'Content-Length': '16' } })));
    await expect(resolveShootMediaArchiveRequest(archiveOptions)).rejects.toThrow('Connection interrupted');
    expect(savedName).toBe('');
  });
});
