import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api';
import {
  disconnectStudioDropbox, getDropboxAuthorizationUrl, integrationsReturnPath,
  parseStudioDropboxStatus, readStudioDropboxStatus, startStudioDropboxConnection,
} from './studioDropbox';

vi.mock('@/services/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

describe('studio Dropbox connection boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts authenticated server OAuth with the browser-binding cookie enabled', async () => {
    const url = 'https://www.dropbox.com/oauth2/authorize?client_id=studio&state=one-time';
    vi.mocked(apiClient.post).mockResolvedValue({ data: { authorization_url: url } });
    expect(await startStudioDropboxConnection()).toBe(url);
    expect(apiClient.post).toHaveBeenCalledWith('/dropbox/connect', {}, { withCredentials: true });
  });

  it.each([
    'https://evil.example/oauth2/authorize',
    'https://www.dropbox.com.evil.example/oauth2/authorize',
    'http://www.dropbox.com/oauth2/authorize',
    'https://attacker@www.dropbox.com/oauth2/authorize',
    'https://www.dropbox.com/oauth2/authorize#access_token=unsafe',
    'https://www.dropbox.com/other',
    'javascript:alert(1)',
    '//www.dropbox.com/oauth2/authorize',
  ])('rejects an untrusted authorization destination %s', (authorization_url) => {
    expect(() => getDropboxAuthorizationUrl({ authorization_url })).toThrow();
  });

  it('retains only safe status fields', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: {
      configured: true, connected: true, enabled: true, connection_version: 'v1',
      account_label: 'Studio account', access_token: 'must-not-retain', refresh_token: 'must-not-retain',
    } } });
    const status = await readStudioDropboxStatus();
    expect(status.connected).toBe(true);
    expect(status.connection_version).toBe('v1');
    expect(status).not.toHaveProperty('access_token');
    expect(status).not.toHaveProperty('refresh_token');
    expect(parseStudioDropboxStatus({ data: { connected: 'true' } }).connected).toBe(false);
  });

  it('disconnects only the exact connection displayed to the administrator', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { connected: false, revocation_pending: true } });
    expect(await disconnectStudioDropbox('v1')).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/dropbox/disconnect', { connection_version: 'v1' }, { withCredentials: true });
    await expect(disconnectStudioDropbox('')).rejects.toThrow();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('preserves only allowed callback status through the integrations redirect', () => {
    expect(integrationsReturnPath('?dropbox=connected&access_token=secret&redirect=https://evil.example'))
      .toBe('/settings?tab=integrations&dropbox=connected');
    expect(integrationsReturnPath('?dropbox=error&error_description=secret'))
      .toBe('/settings?tab=integrations&dropbox=error');
    expect(integrationsReturnPath('?dropbox=anything')).toBe('/settings?tab=integrations');
  });
});
