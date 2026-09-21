import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { heartbeatVoiceBrowserSession } from './voiceBrowser';

afterEach(() => vi.restoreAllMocks());

describe('browser phone presence API', () => {
  it('sends only a bounded transport hint and uses the server registration result', async () => {
    const session = { id: 'session-1', registered: false, status: 'ready' };
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: session } as never);
    await expect(heartbeatVoiceBrowserSession('session-1', true)).resolves.toEqual(session);
    expect(post).toHaveBeenCalledWith('/voice/browser/sessions/session-1/heartbeat', { transport_connected: true }, { timeout: 5000 });
    await heartbeatVoiceBrowserSession('session-1', false);
    expect(post).toHaveBeenLastCalledWith('/voice/browser/sessions/session-1/heartbeat', { transport_connected: false }, { timeout: 5000 });
  });
});
