import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadShootRawFiles, resolveShootMediaArchiveRequest } from './shootMediaDownload';
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
  it('polls preparing responses then waits for all ZIP bytes while preserving the signed URL', async () => {
    let finish!: () => void;
    const body = new ReadableStream<Uint8Array>({ start(controller) { finish = () => { controller.enqueue(new Uint8Array([80, 75, 3, 4])); controller.close(); }; } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ type: 'preparing', poll_after_ms: 1000 }, { status: 202 }))
      .mockResolvedValueOnce(new Response(body, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="12-oak-street-edited-small.zip"' } }));
    vi.stubGlobal('fetch', fetchMock);
    const onDownloading = vi.fn();
    let settled = false;
    const pending = resolveShootMediaArchiveRequest({ ...archiveOptions, onDownloading }).then((result) => { settled = true; return result; });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => url === archiveOptions.requestUrl)).toBe(true);
    expect(onDownloading).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    expect(savedName).toBe('');
    finish();
    expect(await pending).toEqual({ mode: 'blob', filename: '12-oak-street-edited-small.zip', waited: true });
    expect(savedName).toBe('12-oak-street-edited-small.zip');
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

  it('hands large cached archives to the browser without buffering their contents', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: {
      'Content-Type': 'application/zip', 'Content-Length': String(MAX_BUFFERED_ARCHIVE_BYTES + 1),
      'X-Archive-Download-Url': 'https://api.example.test/storage/12-oak-edited-small.zip',
    } })));
    expect(await resolveShootMediaArchiveRequest(archiveOptions)).toMatchObject({ mode: 'redirect' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(savedName).toBe('');
    expect(document.querySelector('iframe')?.src).toContain('12-oak-edited-small.zip');
  });

  it('retains native downloads for legacy static links without CORS', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ type: 'redirect', url: 'https://api.example.test/storage/12-oak.zip' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveShootMediaArchiveRequest({ ...archiveOptions, headers: { Authorization: 'Bearer fixture' } })).toMatchObject({ mode: 'redirect' });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'omit', redirect: 'error' });
    expect(fetchMock.mock.calls[1][1].headers).toBeUndefined();
    expect(document.querySelector('iframe')?.src).toContain('12-oak.zip');
  });

  it('uses the property address for raw ZIPs returned by an older server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('zip', { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename=shoot-63-raw-files.zip' } })));
    expect(await downloadShootRawFiles({ shootId: 63, address: '12 Oak Street' })).toMatchObject({ filename: '12-oak-street-raw-files.zip' });
    expect(savedName).toBe('12-oak-street-raw-files.zip');
  });

  it('surfaces a transfer failure instead of claiming a download started', async () => {
    const body = new ReadableStream({ start(controller) { controller.error(new Error('Connection interrupted')); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'application/zip' } })));
    await expect(resolveShootMediaArchiveRequest(archiveOptions)).rejects.toThrow('Connection interrupted');
    expect(savedName).toBe('');
  });
});
