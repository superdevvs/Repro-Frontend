import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOUDFLARE_SAFE_UPLOAD_BYTES, formatUploadPercent, uploadMediaRequest, UPLOAD_IDLE_TIMEOUT_MS, UPLOAD_RESPONSE_TIMEOUT_MS } from './uploadMediaRequest';

class FakeXHR extends EventTarget {
  static current: FakeXHR;
  upload = new EventTarget();
  status = 200;
  responseText = '{"success_count":1}';
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.dispatchEvent(new Event('abort')));
  constructor() { super(); FakeXHR.current = this; }
  progress(loaded: number, total = 100) {
    this.upload.dispatchEvent(new ProgressEvent('progress', { loaded, total, lengthComputable: total > 0 }));
  }
}

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('XMLHttpRequest', FakeXHR); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const start = (onProgress = vi.fn()) => uploadMediaRequest({ url: '/upload', body: new FormData(), headers: {}, onProgress });

describe('media upload transport', () => {
  it('ends a silent transfer and aborts its request after two idle minutes', async () => {
    const result = start();
    await vi.advanceTimersByTimeAsync(UPLOAD_IDLE_TIMEOUT_MS);
    expect(await result).toMatchObject({ ok: false, message: expect.stringContaining('No upload data') });
    expect(FakeXHR.current.abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows a healthy large transfer to run past the idle deadline and reports real bytes', async () => {
    const progress = vi.fn();
    const result = start(progress);
    for (let step = 1; step <= 10; step++) {
      await vi.advanceTimersByTimeAsync(UPLOAD_IDLE_TIMEOUT_MS - 1);
      FakeXHR.current.progress(step, 100);
    }
    expect(FakeXHR.current.abort).not.toHaveBeenCalled();
    expect(progress).toHaveBeenLastCalledWith({ phase: 'transferring', loaded: 10, total: 100 });
    FakeXHR.current.dispatchEvent(new Event('load'));
    expect(await result).toMatchObject({ ok: true, status: 200 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not prolong a stalled transfer when repeated progress events contain no new bytes', async () => {
    const result = start();
    FakeXHR.current.progress(10);
    await vi.advanceTimersByTimeAsync(UPLOAD_IDLE_TIMEOUT_MS - 1);
    FakeXHR.current.progress(10);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ ok: false });
  });

  it('gives a fully transferred file a separate server-confirmation deadline', async () => {
    const progress = vi.fn();
    const result = start(progress);
    FakeXHR.current.progress(100);
    FakeXHR.current.upload.dispatchEvent(new Event('load'));
    expect(progress).toHaveBeenLastCalledWith({ phase: 'processing', loaded: 100, total: 100 });
    await vi.advanceTimersByTimeAsync(UPLOAD_RESPONSE_TIMEOUT_MS - 1);
    expect(FakeXHR.current.abort).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ ok: false, message: expect.stringContaining('without creating a duplicate') });
    expect(FakeXHR.current.abort).toHaveBeenCalledOnce();
  });

  it.each(['error', 'abort', 'timeout'])('settles and cleans up on %s', async (event) => {
    const result = start();
    FakeXHR.current.dispatchEvent(new Event(event));
    expect(await result).toMatchObject({ ok: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers from a synchronous browser/file send error', async () => {
    vi.stubGlobal('XMLHttpRequest', class extends FakeXHR {
      send = vi.fn(() => { throw new DOMException('File unavailable', 'NotReadableError'); });
    });
    expect(await start()).toMatchObject({ ok: false, message: expect.stringContaining('available on this device') });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts the active request on cancellation and never sends a cancelled continuation', async () => {
    const controller = new AbortController();
    const options = { url: '/upload', body: new FormData(), headers: {}, onProgress: vi.fn(), signal: controller.signal };
    const result = uploadMediaRequest(options);
    const request = FakeXHR.current;
    controller.abort();
    expect(await result).toMatchObject({ ok: false, message: expect.stringContaining('cancelled') });
    expect(request.abort).toHaveBeenCalledOnce();
    expect(await uploadMediaRequest(options)).toMatchObject({ ok: false });
    expect(FakeXHR.current).toBe(request);
    expect(request.send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows visible fractional progress for the first file in a 190-file batch', () => {
    expect(formatUploadPercent(50 / 190)).toBe('0.3');
    expect(formatUploadPercent(5 / 190)).toBe('<0.1');
    expect(formatUploadPercent(0)).toBe('0');
    expect(formatUploadPercent(100)).toBe('100');
  });
});


describe('CDN-oversized media uploads', () => {
  it('surfaces a clear message when Cloudflare returns 413 HTML for a single-request body', async () => {
    const body = new FormData();
    body.append('files[]', new File(['small'], 'clip.mp4', { type: 'video/mp4' }));
    const result = uploadMediaRequest({
      url: '/api/shoots/160/upload',
      body,
      headers: {},
      onProgress: vi.fn(),
    });
    FakeXHR.current.status = 413;
    FakeXHR.current.responseText = '<html><center>cloudflare</center></html>';
    FakeXHR.current.dispatchEvent(new Event('load'));
    await expect(result).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('100MB'),
    });
  });

  it('uses the chunked path for CDN-oversized videos and reports byte progress across chunks', async () => {
    vi.useRealTimers();
    const progress = vi.fn();
    const largeSize = CLOUDFLARE_SAFE_UPLOAD_BYTES + 1;
    const large = new File([new Uint8Array(1024)], 'walkthrough.mp4', { type: 'video/mp4' });
    Object.defineProperty(large, 'size', { value: largeSize });
    const body = new FormData();
    body.append('files[]', large);
    body.append('upload_type', 'edited');

    const queue: FakeXHR[] = [];
    vi.stubGlobal('XMLHttpRequest', class extends FakeXHR {
      constructor() {
        super();
        queue.push(this);
      }
    });

    const resultPromise = uploadMediaRequest({
      url: '/api/shoots/160/upload',
      body,
      headers: { Authorization: 'Bearer test' },
      onProgress: progress,
    });

    const settle = async (predicate: () => boolean) => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (predicate()) return;
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('timed out waiting for xhr step');
    };

    await settle(() => queue.length >= 1);
    queue[0].status = 201;
    queue[0].responseText = JSON.stringify({
      session_id: '11111111-1111-4111-8111-111111111111',
      chunk_size_bytes: largeSize,
      total_chunks: 1,
    });
    queue[0].dispatchEvent(new Event('load'));

    await settle(() => queue.length >= 2);
    expect(queue[1].open).toHaveBeenCalledWith('PUT', expect.stringContaining('/chunks/0'));
    queue[1].status = 200;
    queue[1].responseText = '{"received_chunks":1,"total_chunks":1}';
    queue[1].progress(largeSize, largeSize);
    queue[1].upload.dispatchEvent(new Event('load'));
    queue[1].dispatchEvent(new Event('load'));

    await settle(() => queue.length >= 3);
    expect(queue[2].open).toHaveBeenCalledWith('POST', expect.stringContaining('/complete'));
    queue[2].status = 200;
    queue[2].responseText = JSON.stringify({
      success_count: 1,
      uploaded_files: [{ id: 99, filename: 'walkthrough.mp4', upload_type: 'edited' }],
    });
    queue[2].dispatchEvent(new Event('load'));

    await expect(resultPromise).resolves.toMatchObject({ ok: true, status: 200 });
    expect(queue[0].open).toHaveBeenCalledWith('POST', '/api/shoots/160/upload-sessions');
    expect(progress.mock.calls.some(([value]) => value.phase === 'transferring' && value.loaded > 0)).toBe(true);
    expect(progress).toHaveBeenCalledWith({ phase: 'processing', loaded: largeSize, total: largeSize });
  });

  it('surfaces backend finalize errors from /complete instead of treating them as success', async () => {
    vi.useRealTimers();
    const progress = vi.fn();
    const largeSize = CLOUDFLARE_SAFE_UPLOAD_BYTES + 1;
    const large = new File([new Uint8Array(1024)], 'walkthrough.mp4', { type: 'video/mp4' });
    Object.defineProperty(large, 'size', { value: largeSize });
    const body = new FormData();
    body.append('files[]', large);
    body.append('upload_type', 'edited');

    const queue: FakeXHR[] = [];
    vi.stubGlobal('XMLHttpRequest', class extends FakeXHR {
      constructor() {
        super();
        queue.push(this);
      }
    });

    const resultPromise = uploadMediaRequest({
      url: '/api/shoots/160/upload',
      body,
      headers: { Authorization: 'Bearer test' },
      onProgress: progress,
    });

    const settle = async (predicate: () => boolean) => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (predicate()) return;
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('timed out waiting for xhr step');
    };

    await settle(() => queue.length >= 1);
    queue[0].status = 201;
    queue[0].responseText = JSON.stringify({
      session_id: '11111111-1111-4111-8111-111111111111',
      chunk_size_bytes: largeSize,
      total_chunks: 1,
    });
    queue[0].dispatchEvent(new Event('load'));

    await settle(() => queue.length >= 2);
    queue[1].status = 200;
    queue[1].responseText = '{"received_chunks":1,"total_chunks":1}';
    queue[1].progress(largeSize, largeSize);
    queue[1].upload.dispatchEvent(new Event('load'));
    queue[1].dispatchEvent(new Event('load'));

    await settle(() => queue.length >= 3);
    expect(queue[2].open).toHaveBeenCalledWith('POST', expect.stringContaining('/complete'));
    queue[2].status = 422;
    queue[2].responseText = JSON.stringify({
      message: 'Video editor is not allowed to finalize this shoot media.',
      error_type: 'forbidden',
    });
    queue[2].dispatchEvent(new Event('load'));

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      message: 'Video editor is not allowed to finalize this shoot media.',
    });
    expect(progress).toHaveBeenCalledWith({ phase: 'processing', loaded: largeSize, total: largeSize });
  });

  it('times out a hung /complete so progress cannot sit at 99.9% forever', async () => {
    vi.useFakeTimers();
    const largeSize = CLOUDFLARE_SAFE_UPLOAD_BYTES + 1;
    const large = new File([new Uint8Array(1024)], 'walkthrough.mp4', { type: 'video/mp4' });
    Object.defineProperty(large, 'size', { value: largeSize });
    const body = new FormData();
    body.append('files[]', large);
    body.append('upload_type', 'edited');

    const queue: FakeXHR[] = [];
    vi.stubGlobal('XMLHttpRequest', class extends FakeXHR {
      constructor() {
        super();
        queue.push(this);
      }
    });

    const resultPromise = uploadMediaRequest({
      url: '/api/shoots/160/upload',
      body,
      headers: {},
      onProgress: vi.fn(),
    });

    // Flush microtasks between stepped XHR replies under fake timers.
    const flush = async () => {
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
    };

    await flush();
    expect(queue.length).toBeGreaterThanOrEqual(1);
    queue[0].status = 201;
    queue[0].responseText = JSON.stringify({
      session_id: '11111111-1111-4111-8111-111111111111',
      chunk_size_bytes: largeSize,
      total_chunks: 1,
    });
    queue[0].dispatchEvent(new Event('load'));
    await flush();

    expect(queue.length).toBeGreaterThanOrEqual(2);
    queue[1].status = 200;
    queue[1].responseText = '{"received_chunks":1,"total_chunks":1}';
    queue[1].progress(largeSize, largeSize);
    queue[1].upload.dispatchEvent(new Event('load'));
    queue[1].dispatchEvent(new Event('load'));
    await flush();

    expect(queue.length).toBeGreaterThanOrEqual(3);
    expect(queue[2].open).toHaveBeenCalledWith('POST', expect.stringContaining('/complete'));

    await vi.advanceTimersByTimeAsync(UPLOAD_RESPONSE_TIMEOUT_MS - 1);
    expect(queue[2].abort).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('without creating a duplicate'),
    });
    expect(queue[2].abort).toHaveBeenCalledOnce();
  });
});
