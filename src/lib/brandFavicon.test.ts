import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = readFileSync(resolve(process.cwd(), 'public/brand/favicon-runtime.js'), 'utf8');
const metadata = { frameSize: 64, count: 64, columns: 8, durationMs: 2040 };
let media: EventTarget & { matches: boolean };
let callbacks: Map<number, FrameRequestCallback>;
let draw: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let link: HTMLLinkElement;

async function start() {
  new Function(runtime)();
  await settle();
}

async function settle() {
  for (let n = 0; n < 8; n++) await Promise.resolve();
}

function visibility(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

function frame(time: number) {
  const pending = [...callbacks.values()];
  callbacks.clear();
  pending.forEach(callback => callback(time));
}

describe('Option 18 favicon', () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/brand/re/favicon-static.svg" data-re-favicon>';
    link = document.querySelector('link')!;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    media = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    callbacks = new Map();
    let sequence = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { callbacks.set(++sequence, callback); return sequence; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn(id => callbacks.delete(id)));
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage: draw } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,RE');
    class Sprite {
      naturalWidth = 512;
      naturalHeight = 512;
      onload?: () => void;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', Sprite);
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => metadata });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.head.innerHTML = '';
  });

  it('uses saved timing and sprite coordinates without creating extra icon links', async () => {
    await start();
    frame(2020);
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 256, 64, 64, 0, 0, 64, 64);
    expect(link.type).toBe('image/png');
    expect(link.href).toBe('data:image/png;base64,RE');
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    frame(2021);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a static icon without fetching animation for reduced motion', async () => {
    media.matches = true;
    await start();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(0);
    expect(link.href).toContain('/brand/re/favicon-static.svg');
  });

  it('finishes one intro cycle and leaves no animation work after repeated page events', async () => {
    await start();
    for (let time = 1000; time < 3040; time += 16) frame(time);
    frame(3040);
    expect(draw).toHaveBeenCalledTimes(64);
    expect(callbacks.size).toBe(0);
    expect(link.type).toBe('image/svg+xml');
    expect(link.href).toContain('/brand/re/favicon-static.svg');

    for (let n = 0; n < 3; n++) {
      visibility(true);
      visibility(false);
      media.matches = true;
      media.dispatchEvent(new Event('change'));
      media.matches = false;
      media.dispatchEvent(new Event('change'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    }
    frame(20000);
    expect(callbacks.size).toBe(0);
    expect(draw).toHaveBeenCalledTimes(64);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not reset the intro clock when pageshow fires during playback', async () => {
    await start();
    frame(2020);
    vi.mocked(performance.now).mockReturnValue(2020);
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    frame(3040);
    expect(callbacks.size).toBe(0);
    expect(link.type).toBe('image/svg+xml');
  });

  it.each(['hidden', 'reduced motion'])('waits without fetching when initially %s, then plays only once', async reason => {
    if (reason === 'hidden') visibility(true);
    else media.matches = true;
    await start();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(0);

    if (reason === 'hidden') visibility(false);
    else {
      media.matches = false;
      media.dispatchEvent(new Event('change'));
    }
    await settle();
    expect(callbacks.size).toBe(1);
    frame(1000);
    frame(3040);
    expect(callbacks.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restores the fallback if a preference change reaches a frame before its event', async () => {
    await start();
    frame(2020);
    media.matches = true;
    frame(2050);
    expect(callbacks.size).toBe(0);
    expect(link.type).toBe('image/svg+xml');
    media.matches = false;
    media.dispatchEvent(new Event('change'));
    expect(callbacks.size).toBe(0);
  });

  it('consumes an interrupted intro instead of replaying it when the tab becomes visible', async () => {
    await start();
    frame(2020);
    visibility(true);
    expect(callbacks.size).toBe(0);
    expect(link.type).toBe('image/svg+xml');
    visibility(false);
    expect(callbacks.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    media.matches = true;
    media.dispatchEvent(new Event('change'));
    expect(callbacks.size).toBe(0);
  });

  it.each([false, true])('keeps the fallback if assets fail or metadata is invalid (%s)', async invalid => {
    fetchMock.mockResolvedValue(invalid
      ? { ok: true, json: async () => ({ ...metadata, count: 0 }) }
      : { ok: false });
    await start();
    expect(callbacks.size).toBe(0);
    expect(link.href).toContain('/brand/re/favicon-static.svg');
  });

  it('does not replay an intro after restoring the page from browser cache', async () => {
    await start();
    frame(2020);
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    expect(callbacks.size).toBe(0);
    expect(link.type).toBe('image/svg+xml');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(callbacks.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('defers playback if the page enters the browser cache while assets are loading', async () => {
    let resolveFetch!: (response: unknown) => void;
    fetchMock.mockImplementation(() => new Promise(resolve => { resolveFetch = resolve; }));
    await start();
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    resolveFetch({ ok: true, json: async () => metadata });
    await settle();
    expect(callbacks.size).toBe(0);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(callbacks.size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    frame(3040);
    expect(callbacks.size).toBe(0);
  });

  it('cleans up permanently on navigation, including an in-flight download', async () => {
    let resolveFetch!: (response: unknown) => void;
    fetchMock.mockImplementation(() => new Promise(resolve => { resolveFetch = resolve; }));
    await start();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    expect(signal.aborted).toBe(true);
    resolveFetch({ ok: true, json: async () => metadata });
    await settle();
    expect(callbacks.size).toBe(0);
    window.dispatchEvent(new Event('pageshow'));
    expect(callbacks.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the static fallback when generating a PNG fails', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockImplementation(() => { throw new Error('Canvas unavailable'); });
    await start();
    frame(1000);
    expect(callbacks.size).toBe(0);
    expect(link.type).toBe('image/svg+xml');
    expect(link.href).toContain('/brand/re/favicon-static.svg');
  });
});
