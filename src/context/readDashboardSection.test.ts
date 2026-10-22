import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardSectionError, readDashboardSection } from './readDashboardSection';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe('dashboard section refresh', () => {
  it('retries only the failed page with bounded attempts and preserves earlier records', async () => {
    let laterAttempts = 0;
    const read = vi.fn(async (page: number) => page === 1 ? response({ data: [1], meta: { last_page: 2 } })
      : ++laterAttempts < 3 ? response({}, 503) : response({ data: [2] }));
    expect(await readDashboardSection('completed', read, { page: 1, allPages: true })).toMatchObject({ data: [1, 2] });
    expect(read.mock.calls.map(([page]) => page)).toEqual([1, 2, 2, 2]);
  });
  it('identifies exhausted section and page without exposing server errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn(async () => response({ error: 'private database details' }, 500));
    const failure = await readDashboardSection('scheduled', read, { page: 3, allPages: true }).catch(error => error);
    expect(failure).toBeInstanceOf(DashboardSectionError);
    expect(failure).toMatchObject({ section: 'scheduled', page: 3, status: 500 });
    expect(failure.message).not.toContain('database');
    expect(read).toHaveBeenCalledTimes(3);
  });
  it('never retries cancellation or expired authentication', async () => {
    const controller = new AbortController();
    const read = vi.fn(async () => { controller.abort(); return response({ data: [1] }); });
    await expect(readDashboardSection('completed', read, { page: 1, allPages: true, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(read).toHaveBeenCalledOnce();
    const unauthorized = vi.fn(async () => response({}, 401));
    await expect(readDashboardSection('completed', unauthorized, { page: 1, allPages: true })).rejects.toThrow('Unauthorized');
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it('accepts valid empty sections', async () => {
    expect(await readDashboardSection('delivered', async () => response({ data: [] }), { page: 1, allPages: false }))
      .toEqual({ data: [] });
  });

  it('gives the body its own transfer budget after a slow successful server response', async () => {
    vi.useFakeTimers();
    const read = vi.fn((_page: number, signal?: AbortSignal) => new Promise<Response>((resolve, reject) => {
      const abortHeaders = () => { clearTimeout(headerTimer); reject(new DOMException('Aborted', 'AbortError')); };
      const headerTimer = setTimeout(() => {
        signal?.removeEventListener('abort', abortHeaders);
        resolve({
          status: 200, ok: true, headers: new Headers({ 'X-Request-ID': 'slow-mobile-response' }),
          text: () => new Promise<string>((resolveBody, rejectBody) => {
            const timer = setTimeout(() => resolveBody(JSON.stringify({ data: [1] })), 20000);
            signal?.addEventListener('abort', () => { clearTimeout(timer); rejectBody(new DOMException('Aborted', 'AbortError')); }, { once: true });
          }),
        } as Response);
      }, 16000);
      signal?.addEventListener('abort', abortHeaders, { once: true });
    }));
    const pending = readDashboardSection('scheduled', read, { page: 1, allPages: true });
    await vi.advanceTimersByTimeAsync(36000);
    expect(await pending).toEqual({ data: [1] });
    expect(read).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still bounds a stalled body and reports the phase and successful response reference', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn(async (_page: number, signal?: AbortSignal) => ({
      status: 200, ok: true, headers: new Headers({ 'X-Request-ID': 'stalled-mobile-response' }),
      text: () => new Promise<string>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    }) as Response);
    const pending = readDashboardSection('delivered', read, { page: 1, allPages: false }).catch(error => error);
    await vi.advanceTimersByTimeAsync(90450);
    expect(await pending).toMatchObject({ name: 'DashboardSectionError', status: 200,
      reference: 'stalled-mobile-response', phase: 'body', timedOut: true });
    expect(read).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a body transfer without retrying when its parent request is cancelled', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const read = vi.fn(async (_page: number, signal?: AbortSignal) => ({
      status: 200, ok: true, headers: new Headers(),
      text: () => new Promise<string>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    }) as Response);
    const pending = readDashboardSection('completed', read, { page: 1, allPages: true, signal: controller.signal }).catch(error => error);
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    expect(await pending).toMatchObject({ name: 'AbortError' });
    expect(read).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts unread failed responses before starting the next attempt', async () => {
    vi.useFakeTimers();
    let firstSignal: AbortSignal | undefined;
    const read = vi.fn(async (_page: number, signal?: AbortSignal) => {
      if (!firstSignal) {
        firstSignal = signal;
        return response({}, 500);
      }
      expect(firstSignal.aborted).toBe(true);
      return response({ data: [1] });
    });
    const pending = readDashboardSection('scheduled', read, { page: 1, allPages: true });
    await vi.advanceTimersByTimeAsync(150);
    expect(await pending).toEqual({ data: [1] });
    expect(read).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
