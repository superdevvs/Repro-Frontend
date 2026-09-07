import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArchiveTooLargeForBuffer, DOWNLOAD_URL_REVOKE_DELAY_MS, fetchApiDownload, readArchiveBlob, saveDownloadBlob, validateApiDownloadUrl, validateDownloadUrl, waitForArchive } from './shootDownloadTransfer';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('download transfer lifecycle', () => {
  it('waits for the response body to finish, not just its headers', async () => {
    let finish!: () => void;
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([80, 75]));
      finish = () => { controller.enqueue(new Uint8Array([3, 4])); controller.close(); };
    } });
    let settled = false;
    const pending = readArchiveBlob(new Response(stream)).then((blob) => { settled = true; return blob; });
    await Promise.resolve(); await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    expect((await pending).size).toBe(4);
  });

  it('bounds archives even when Content-Length is missing or false', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(5)); }, cancel });
    await expect(readArchiveBlob(new Response(stream, { headers: { 'Content-Length': '1' } }), 4)).rejects.toBeInstanceOf(ArchiveTooLargeForBuffer);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('does not read an advertised oversized body', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    await expect(readArchiveBlob(new Response(stream, { headers: { 'Content-Length': '100' } }), 4)).rejects.toBeInstanceOf(ArchiveTooLargeForBuffer);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('restricts credential-bearing requests to the API and rejects redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal('fetch', fetchMock);
    await fetchApiDownload('/api/shoots/63/media/download-zip', { Authorization: 'Bearer fixture' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/shoots/63/media/download-zip');
    expect(options.redirect).toBe('error');
    expect(options.headers.get('Accept')).toMatch(/^application\/zip/);
    expect(() => validateApiDownloadUrl('https://external.test/file.zip')).toThrow('invalid');
    expect(() => validateDownloadUrl('javascript:alert(1)')).toThrow('invalid');
    expect(() => validateDownloadUrl('https://user:password@external.test/file.zip')).toThrow('invalid');
  });

  it('keeps object URLs alive for the browser after clicking save', () => {
    vi.useFakeTimers();
    const create = vi.fn().mockReturnValue('blob:fixture');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    let savedName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { savedName = this.download; });
    saveDownloadBlob(new Blob(['zip']), '12-oak-raw-files.zip');
    expect(savedName).toBe('12-oak-raw-files.zip');
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DOWNLOAD_URL_REVOKE_DELAY_MS);
    expect(revoke).toHaveBeenCalledWith('blob:fixture');
  });

  it('cancels archive polling immediately when the page closes', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = waitForArchive(10_000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
