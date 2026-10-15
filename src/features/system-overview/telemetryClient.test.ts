import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://dashboard.test' }));
vi.mock('@/features/system-overview/catalog', () => ({
  findCatalogPageByRoute: () => undefined,
  flattenCatalogPages: () => [],
}));

type Client = typeof import('./telemetryClient');
let client: Client;
let fetchMock: ReturnType<typeof vi.fn>;
const accepted = () => new Response(JSON.stringify({ stored: 1, telemetryAvailable: true }), {
  status: 200, headers: { 'content-type': 'application/json' },
});
const bodies = () => fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).events);

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('authToken', 'test-token');
  fetchMock = vi.fn().mockImplementation(async () => accepted());
  vi.stubGlobal('fetch', fetchMock);
  client = await import('./telemetryClient');
  client.setTelemetryAuthState({ isAuthenticated: true, userId: 'test-user' });
});

afterEach(() => {
  client.stopTelemetryHeartbeat();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('telemetry heartbeat visibility', () => {
  const setVisibility = (state: DocumentVisibilityState) => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('suspends the recurring signal while hidden and resumes once visible', async () => {
    const intervals = vi.spyOn(window, 'setInterval');
    const clearInterval = vi.spyOn(window, 'clearInterval');
    client.startTelemetryHeartbeat();
    await vi.advanceTimersByTimeAsync(40000);
    expect(bodies().flat().map((event) => event.type)).toEqual(['heartbeat']);

    setVisibility('hidden');
    expect(clearInterval).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(300000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    setVisibility('visible');
    client.startTelemetryHeartbeat();
    expect(intervals).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(40000);
    expect(bodies().flat().map((event) => event.type)).toEqual(['heartbeat', 'heartbeat']);
  });

  it('does not start an interval in a hidden document or restart after stopping', async () => {
    const intervals = vi.spyOn(window, 'setInterval');
    setVisibility('hidden');
    client.startTelemetryHeartbeat();
    expect(intervals).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300000);
    expect(fetchMock).not.toHaveBeenCalled();

    client.stopTelemetryHeartbeat();
    setVisibility('visible');
    expect(intervals).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves hidden transfer, error, and final keepalive delivery', async () => {
    client.startTelemetryHeartbeat();
    client.trackTelemetryAction('upload_started');
    setVisibility('hidden');
    await client.flushTelemetry(true);
    expect(bodies()[0].map((event) => event.type)).toEqual(['action']);

    client.trackTransferTelemetry({ direction: 'upload', mediaType: 'raw', bytes: 1024,
      transferMs: 200, confirmationMs: 50, totalMs: 250, status: 200,
      outcome: 'confirmed', chunked: false });
    await vi.advanceTimersByTimeAsync(10000);
    expect(bodies()[1][0]).toMatchObject({ type: 'transfer', transfer: { bytes: 1024, outcome: 'confirmed' } });

    client.trackTelemetryError('Private error', 'Error');
    await vi.advanceTimersByTimeAsync(0);
    client.trackTelemetrySessionEnd();
    await vi.advanceTimersByTimeAsync(0);
    expect(bodies().flat().map((event) => event.type)).toEqual(['action', 'transfer', 'error', 'session_end']);
    expect(fetchMock.mock.calls.every(([, options]) => options.keepalive)).toBe(true);
  });
});

describe('telemetry transport batching', () => {
  it('combines staggered polling activity without postponing the first batch', async () => {
    client.trackTelemetryAction('api_request', { method: 'GET', status: 200 });
    await vi.advanceTimersByTimeAsync(5000);
    client.trackTelemetryAction('api_request', { method: 'GET', status: 200 });
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodies()[0]).toHaveLength(2);
  });

  it('serializes bursts into bounded batches while retaining every event', async () => {
    let resolveFirst!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; }));
    for (let i = 0; i < 45; i++) client.trackTelemetryAction(`action_${i}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFirst(accepted());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(bodies().map((batch) => batch.length)).toEqual([20, 20, 5]);
    expect(bodies().flat().map((event) => event.actionName)).toEqual(
      Array.from({ length: 45 }, (_, i) => `action_${i}`),
    );
  });

  it('sends errors immediately with queued context', async () => {
    client.trackTelemetryAction('view');
    client.trackTelemetryError('Private error text', 'Error');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodies()[0].map((event) => event.type)).toEqual(['action', 'error']);
    expect(JSON.stringify(bodies())).not.toContain('Private error text');
  });

  it('flushes pending activity on session end without waiting for the batch window', async () => {
    client.trackTelemetryAction('view');
    client.trackTelemetrySessionEnd();
    await vi.advanceTimersByTimeAsync(0);
    expect(bodies()[0].map((event) => event.type)).toEqual(['action', 'session_end']);
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });

  it('retries a failed batch once after a delay and then backs off', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 503 }));
    client.trackTelemetryAction('view');
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    client.trackTelemetryAction('view');
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends a final keepalive even when an earlier request is still pending', async () => {
    let resolveFirst!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; }));
    client.trackTelemetryAction('view');
    const pending = client.flushTelemetry();
    client.trackTelemetrySessionEnd();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodies()[1][0].type).toBe('session_end');
    resolveFirst(accepted());
    await pending;
  });

  it('does not replay one user activity under another user after an in-flight failure', async () => {
    let rejectFirst!: (error: Error) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((_, reject) => { rejectFirst = reject; }));
    client.trackTelemetryAction('old_user_action');
    const pending = client.flushTelemetry();
    client.trackTelemetryAction('old_user_queued');
    client.setTelemetryAuthState({ isAuthenticated: true, userId: 'different-user' });
    client.trackTelemetryAction('new_user_action');
    rejectFirst(new Error('network'));
    await pending;
    await vi.advanceTimersByTimeAsync(10000);
    expect(bodies()[1].map((event) => event.actionName)).toEqual(['new_user_action']);
  });

  it('releases a stalled request and backs off after two timeouts', async () => {
    fetchMock.mockImplementation((_, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    client.trackTelemetryAction('view');
    void client.flushTelemetry();
    await vi.advanceTimersByTimeAsync(14999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(15000);
    client.trackTelemetryAction('view');
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
