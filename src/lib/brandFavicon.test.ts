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
  for (let n = 0; n < 8; n++) await Promise.resolve();
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

  it('restores the fallback if a preference change reaches a frame before its event', async () => {
    await start();
    frame(2020);
    media.matches = true;
    frame(2050);
    expect(callbacks.size).toBe(0);
    expect(link.type).toBe('image/svg+xml');
  });

  it('restores the static icon while hidden and resumes without another download', async () => {
    await start();
    frame(2020);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(callbacks.size).toBe(0);
    expect(link.type).toBe('image/svg+xml');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(callbacks.size).toBe(1);
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

  it('cleans up on navigation but resumes a page restored from browser cache', async () => {
    await start();
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    expect(callbacks.size).toBe(0);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(callbacks.size).toBe(1);
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    expect(callbacks.size).toBe(0);
    window.dispatchEvent(new Event('pageshow'));
    expect(callbacks.size).toBe(0);
  });
});
