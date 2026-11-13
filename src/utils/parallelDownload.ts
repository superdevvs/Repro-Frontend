import { validateDownloadUrl } from './shootDownloadTransfer';

export const DOWNLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
export const DOWNLOAD_CONNECTIONS = 4;
export const MAX_DOWNLOAD_BYTES = 50 * 1024 ** 3;
export interface DownloadWriter {
  write(data: { type: 'write'; position: number; data: Uint8Array }): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
export interface DownloadFileHandle {
  createWritable(options: { keepExistingData: boolean }): Promise<DownloadWriter>;
}
type SaveWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<DownloadFileHandle> };
export const supportsParallelDownload = () => typeof window !== 'undefined' && typeof (window as SaveWindow).showSaveFilePicker === 'function';
export const chooseDownloadFile = (name: string) => (window as SaveWindow).showSaveFilePicker!({ suggestedName: name });

async function fetchAsset(url: string, init: RequestInit) {
  const timeout = AbortSignal.timeout(120_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(validateDownloadUrl(url), { ...init, signal, credentials: 'omit', redirect: 'error', cache: 'no-store' });
}

async function identity(url: string, signal: AbortSignal) {
  const response = await fetchAsset(url, { method: 'HEAD', signal });
  if (!response.ok) throw new Error('The download link is unavailable. Prepare the download again.');
  const size = Number(response.headers.get('Content-Length'));
  const etag = response.headers.get('ETag');
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_DOWNLOAD_BYTES) throw new Error('Parallel downloads support files up to 50 GB with a known size. Use the browser download for this file.');
  if (!etag || etag.startsWith('W/') || response.headers.get('Accept-Ranges') !== 'bytes') throw new Error('This server does not support safe parallel downloads. Use the browser download.');
  return { size, etag };
}

/** A range response is bounded even if a server ignores or misreports its range. */
async function readChunk(response: Response, length: number) {
  if (!response.body) throw new Error('Empty download response.');
  const reader = response.body.getReader();
  const bytes = new Uint8Array(length);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > length) throw new Error('The server returned an unexpected file range.');
      bytes.set(value, offset); offset += value.length;
    }
    if (offset !== length) throw new Error('The transfer stopped before this part finished.');
    return bytes;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** Keeps only four 8 MiB parts in memory. Resume is supported while this tab stays open. */
export class ParallelDownload {
  private source: { size: number; etag: string } | null = null;
  private completed = new Set<number>();
  private active: AbortController | null = null;
  private initialized = false;
  constructor(private file: DownloadFileHandle, private progress: (bytes: number, total: number) => void) {}
  pause() { this.active?.abort(); }

  async start(url: string): Promise<boolean> {
    if (this.active) throw new Error('This download is already running.');
    const controller = new AbortController(); this.active = controller;
    let writer: DownloadWriter | null = null;
    let writes = Promise.resolve();
    const before = new Set(this.completed);
    try {
      const source = await identity(url, controller.signal);
      if (this.source && (source.size !== this.source.size || source.etag !== this.source.etag)) throw new Error('These files changed. Close this download and prepare a new one.');
      this.source = source;
      writer = await this.file.createWritable({ keepExistingData: this.initialized });
      if (!this.initialized) await writer.truncate(source.size);
      let next = 0;
      const count = Math.ceil(source.size / DOWNLOAD_CHUNK_BYTES);
      const report = () => this.progress([...this.completed].reduce((sum, index) => sum + Math.min(DOWNLOAD_CHUNK_BYTES, source.size - index * DOWNLOAD_CHUNK_BYTES), 0), source.size);
      report();
      const worker = async () => {
        while (!controller.signal.aborted) {
          while (this.completed.has(next)) next++;
          const index = next++;
          if (index >= count) return;
          const start = index * DOWNLOAD_CHUNK_BYTES;
          const end = Math.min(source.size - 1, start + DOWNLOAD_CHUNK_BYTES - 1);
          for (let attempt = 0; ; attempt++) {
            try {
              const response = await fetchAsset(url, { signal: controller.signal, headers: { Range: `bytes=${start}-${end}`, 'If-Range': source.etag } });
              if (response.status !== 206 || response.headers.get('Content-Range') !== `bytes ${start}-${end}/${source.size}` || response.headers.get('ETag') !== source.etag) {
                await response.body?.cancel();
                throw new Error('The file or download link changed. Pause and resume to refresh the link.');
              }
              const bytes = await readChunk(response, end - start + 1);
              if (controller.signal.aborted) return;
              writes = writes.then(() => writer!.write({ type: 'write', position: start, data: bytes }));
              await writes;
              this.completed.add(index); report(); break;
            } catch (error) {
              if (controller.signal.aborted) return;
              if (attempt >= 2) throw error;
              await new Promise<void>(resolve => {
                const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve(); };
                const timer = setTimeout(done, 500 * 2 ** attempt);
                controller.signal.addEventListener('abort', done, { once: true });
              });
            }
          }
        }
      };
      const workers = Array.from({ length: Math.min(DOWNLOAD_CONNECTIONS, count) }, worker);
      const outcomes = await Promise.all(workers.map(job => job.catch(error => { controller.abort(); return error as Error; })));
      await writes;
      await writer.close(); writer = null; this.initialized = true;
      const failure = outcomes.find(result => result instanceof Error);
      if (failure) throw failure;
      return this.completed.size === count;
    } catch (error) {
      // A failed close/write discards that writable transaction; its parts must be retried.
      if (writer) { await writer.abort().catch(() => undefined); this.completed = before; }
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      throw error;
    } finally { this.active = null; }
  }
}
