import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOWNLOAD_CHUNK_BYTES as CHUNK, ParallelDownload, type DownloadWriter } from './parallelDownload';

const url = 'https://downloads.reprodashboard.com/api/public/shoot-media/file/shoots/1/all.zip?signature=test';
function fixture(size = CHUNK + 10) {
  const writes: Array<{ position: number; data: Uint8Array }> = [];
  const writer: DownloadWriter = { write: vi.fn(async data => { writes.push(data); }), truncate: vi.fn(async () => {}), close: vi.fn(async () => {}), abort: vi.fn(async () => {}) };
  const file = { createWritable: vi.fn(async () => writer) };
  let version = '"v1"';
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    const headers = new Headers({ 'Content-Length': String(size), ETag: version, 'Accept-Ranges': 'bytes' });
    if (init.method === 'HEAD') return new Response(null, { headers });
    const range = new Headers(init.headers).get('Range')!.match(/bytes=(\d+)-(\d+)/)!;
    const start = Number(range[1]), end = Number(range[2]);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    return new Response(new Uint8Array(end - start + 1).fill(start === 0 ? 17 : 29), { status: 206, headers });
  });
  vi.stubGlobal('fetch', fetcher);
  return { file, writer, writes, fetcher, changeVersion: () => { version = '"v2"'; } };
}
afterEach(() => vi.unstubAllGlobals());

describe('parallel downloads', () => {
  it('writes exact file positions without forwarding account credentials', async () => {
    const { file, writes, writer, fetcher } = fixture();
    const progress = vi.fn();
    expect(await new ParallelDownload(file, progress).start(url)).toBe(true);
    expect(writes.map(write => [write.position, write.data.length, write.data[0]]).sort((a, b) => a[0] - b[0])).toEqual([[0, CHUNK, 17], [CHUNK, 10, 29]]);
    expect(writer.close).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(CHUNK + 10, CHUNK + 10);
    for (const [, options] of fetcher.mock.calls) {
      expect(options.credentials).toBe('omit'); expect(options.redirect).toBe('error');
      expect(new Headers(options.headers).has('Authorization')).toBe(false);
      expect(new Headers(options.headers).has('If-Range')).toBe(false);
    }
  });

  it('pauses and resumes without fetching saved parts again', async () => {
    const { file, fetcher } = fixture(CHUNK * 5);
    const normalFetch = fetcher.getMockImplementation()!;
    let firstRun = true;
    fetcher.mockImplementation(async (target, options) => {
      if (firstRun && options.method !== 'HEAD' && !new Headers(options.headers).get('Range')!.startsWith('bytes=0-')) {
        return new Promise<Response>((_, reject) => options.signal!.addEventListener('abort', () => reject(new DOMException('paused', 'AbortError')), { once: true }));
      }
      return normalFetch(target, options);
    });
    const download = new ParallelDownload(file, bytes => { if (firstRun && bytes > 0) download.pause(); });
    expect(await download.start(url)).toBe(false);
    firstRun = false;
    expect(await download.start(url)).toBe(true);
    expect(fetcher.mock.calls.filter(([, options]) => new Headers(options.headers).get('Range')?.startsWith('bytes=0-'))).toHaveLength(1);
    expect(file.createWritable).toHaveBeenLastCalledWith({ keepExistingData: true });
  });

  it('rejects a replaced archive before touching the saved file', async () => {
    const { file, changeVersion } = fixture(1024);
    const download = new ParallelDownload(file, vi.fn());
    await download.start(url); changeVersion();
    await expect(download.start(url)).rejects.toThrow('files changed');
    expect(file.createWritable).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized files without allocating the file in memory', async () => {
    const { file } = fixture(51 * 1024 ** 3);
    await expect(new ParallelDownload(file, vi.fn()).start(url)).rejects.toThrow('50 GB');
    expect(file.createWritable).not.toHaveBeenCalled();
  });

  it('rejects replacement bytes when the archive changes after HEAD', async () => {
    const { file, fetcher, writer, changeVersion } = fixture(1024);
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (target, options) => {
      if (options.method !== 'HEAD') changeVersion();
      return original(target, options);
    });
    await expect(new ParallelDownload(file, vi.fn()).start(url)).rejects.toThrow('file or download link changed');
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('rejects a full-body response to a range request without reading it', async () => {
    const { file, fetcher, writer } = fixture(1024);
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (target, options) => options.method === 'HEAD' ? original(target, options) : new Response('wrong', { status: 200 }));
    await expect(new ParallelDownload(file, vi.fn()).start(url)).rejects.toThrow('file or download link changed');
    expect(writer.write).not.toHaveBeenCalled();
  });
});
