import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserPhonePresence, PHONE_PRESENCE_TIMEOUT_MS } from './browserPhonePresence';
import type { VoiceBrowserSession } from '@/types/voiceBrowser';

const session = (registered: boolean): VoiceBrowserSession => ({ id: 'session-a', device_id: 'device-a', status: 'ready', registered, expires_at: '2026-09-21T23:00:00Z', offers: [] });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function fixture() {
  const isCurrent = vi.fn(() => true);
  const getIsRegistered = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const heartbeat = vi.fn<(registered: boolean) => Promise<VoiceBrowserSession>>().mockImplementation(async (registered) => session(registered));
  const onSession = vi.fn(), onReady = vi.fn(), onUnavailable = vi.fn();
  const monitor = createBrowserPhonePresence({ isCurrent, getIsRegistered, heartbeat, onSession, onReady, onUnavailable });
  return { monitor, isCurrent, getIsRegistered, heartbeat, onSession, onReady, onUnavailable };
}

describe('browser phone presence', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shares one registration check across ready, timer and visibility callers', async () => {
    const f = fixture(), registration = deferred<boolean>();
    f.getIsRegistered.mockReturnValue(registration.promise);
    const first = f.monitor.check(), second = f.monitor.check(), third = f.monitor.check();
    expect(second).toBe(first); expect(third).toBe(first);
    expect(f.getIsRegistered).toHaveBeenCalledOnce();
    registration.resolve(true); await first;
    expect(f.heartbeat).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.onReady).toHaveBeenCalledOnce();
  });

  it('times out a never-resolving SDK request, reports unavailable, then recovers on the next poll', async () => {
    const f = fixture();
    f.getIsRegistered.mockReturnValueOnce(new Promise(() => undefined));
    const pending = f.monitor.check();
    await vi.advanceTimersByTimeAsync(PHONE_PRESENCE_TIMEOUT_MS);
    await pending;
    expect(f.onUnavailable).toHaveBeenCalled();
    expect(f.heartbeat).toHaveBeenCalledExactlyOnceWith(false);
    expect(f.onReady).not.toHaveBeenCalled();
    await f.monitor.check();
    expect(f.heartbeat).toHaveBeenLastCalledWith(true);
    expect(f.onReady).toHaveBeenCalledOnce();
  });

  it('bounds a failed heartbeat and the unavailable report without overlapping either', async () => {
    const f = fixture();
    f.heartbeat.mockReturnValue(new Promise(() => undefined));
    const pending = f.monitor.check();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.heartbeat).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.monitor.check()).toBe(pending);
    await vi.advanceTimersByTimeAsync(PHONE_PRESENCE_TIMEOUT_MS);
    expect(f.heartbeat).toHaveBeenCalledTimes(2);
    expect(f.heartbeat).toHaveBeenLastCalledWith(false);
    expect(f.monitor.check()).toBe(pending);
    await vi.advanceTimersByTimeAsync(PHONE_PRESENCE_TIMEOUT_MS);
    await pending;
    expect(f.onReady).not.toHaveBeenCalled();
    f.heartbeat.mockImplementation(async (registered) => session(registered));
    await f.monitor.check();
    expect(f.onReady).toHaveBeenCalledOnce();
  });

  it('ignores a stale SDK result after the connection epoch changes', async () => {
    const f = fixture(), registration = deferred<boolean>();
    f.getIsRegistered.mockReturnValue(registration.promise);
    const pending = f.monitor.check();
    f.isCurrent.mockReturnValue(false);
    registration.resolve(true); await pending;
    expect(f.heartbeat).not.toHaveBeenCalled();
    expect(f.onReady).not.toHaveBeenCalled(); expect(f.onSession).not.toHaveBeenCalled();
  });

  it('does not call a registered session ready when the server rejects its lifecycle state', async () => {
    const f = fixture();
    f.heartbeat.mockResolvedValue({ ...session(true), status: 'revocation_pending' });
    await f.monitor.check();
    expect(f.onReady).not.toHaveBeenCalled();
    expect(f.onUnavailable).toHaveBeenCalled();
  });

  it('ignores a stale heartbeat response after its session is replaced', async () => {
    const f = fixture(), response = deferred<VoiceBrowserSession>();
    f.heartbeat.mockReturnValue(response.promise);
    const pending = f.monitor.check(); await vi.advanceTimersByTimeAsync(0);
    f.isCurrent.mockReturnValue(false);
    response.resolve(session(true)); await pending;
    expect(f.onReady).not.toHaveBeenCalled(); expect(f.onSession).not.toHaveBeenCalled();
  });

  it('serializes a socket-loss report after an in-flight positive heartbeat', async () => {
    const f = fixture(), response = deferred<VoiceBrowserSession>();
    f.heartbeat.mockReturnValueOnce(response.promise);
    const pending = f.monitor.check(); await vi.advanceTimersByTimeAsync(0);
    void f.monitor.lost('Connection lost');
    expect(f.onUnavailable).toHaveBeenLastCalledWith('Connection lost');
    expect(f.heartbeat).toHaveBeenCalledTimes(1);
    response.resolve(session(true)); await pending; await vi.advanceTimersByTimeAsync(0);
    expect(f.heartbeat).toHaveBeenLastCalledWith(false);
    expect(f.onReady).not.toHaveBeenCalled();
    expect(f.onSession).toHaveBeenLastCalledWith(session(false));
    await f.monitor.check(); expect(f.onReady).toHaveBeenCalledOnce();
  });
});
