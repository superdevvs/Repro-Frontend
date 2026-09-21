import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallLiveStream } from './useCallLiveStream';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://test.example' }));
vi.mock('@/utils/authToken', () => ({ getStoredAuthToken: () => 'test-token' }));

const streamResponse = (text: string) => ({
  ok: true,
  body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } }),
});

describe('useCallLiveStream reconnects', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('reconnects after a normal stream EOF and parses CRLF events', async () => {
    const fetcher = vi.fn().mockResolvedValue(streamResponse('event: transcript\r\ndata: {"chunks":[{"seq":1,"text":"Hello","speaker":"caller","ts":"2026-09-21T10:00:00Z"}]}\r\n\r\n'));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useCallLiveStream(4));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.transcript[0].text).toBe('Hello');
    expect(result.current.connected).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not reconnect after the server closes a completed call', async () => {
    const fetcher = vi.fn().mockResolvedValue(streamResponse('event: closed\ndata: {}\n\n'));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useCallLiveStream(4));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.closed).toBe(true);
    expect(result.current.connected).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
