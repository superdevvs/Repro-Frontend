import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatUploadPercent, uploadMediaRequest, UPLOAD_IDLE_TIMEOUT_MS, UPLOAD_RESPONSE_TIMEOUT_MS } from './uploadMediaRequest';

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
