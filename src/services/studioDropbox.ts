import { apiClient } from '@/services/api';

export interface StudioDropboxStatus {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  storage_mode: string | null;
  account_label: string | null;
  connection_version: string | null;
  revocation_pending: boolean;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

export const parseStudioDropboxStatus = (payload: unknown): StudioDropboxStatus => {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  return {
    configured: data.configured === true,
    connected: data.connected === true,
    enabled: data.enabled === true,
    storage_mode: typeof data.storage_mode === 'string' ? data.storage_mode : null,
    account_label: typeof data.account_label === 'string' ? data.account_label : null,
    connection_version: typeof data.connection_version === 'string' && data.connection_version
      ? data.connection_version : null,
    revocation_pending: data.revocation_pending === true,
  };
};

export const getDropboxAuthorizationUrl = (payload: unknown): string => {
  const value = asRecord(payload).authorization_url;
  if (typeof value !== 'string') throw new Error('Dropbox connection could not be started.');
  const url = new URL(value);
  if (url.origin !== 'https://www.dropbox.com' || url.pathname !== '/oauth2/authorize'
    || url.username || url.password || url.hash) {
    throw new Error('Dropbox connection could not be started.');
  }
  return url.toString();
};

export async function readStudioDropboxStatus(): Promise<StudioDropboxStatus> {
  const response = await apiClient.get('/integrations/dropbox/status', { withCredentials: true });
  return parseStudioDropboxStatus(response.data);
}

export async function startStudioDropboxConnection(): Promise<string> {
  // The response establishes an HttpOnly browser-binding cookie for the callback.
  const response = await apiClient.post('/dropbox/connect', {}, { withCredentials: true });
  return getDropboxAuthorizationUrl(response.data);
}

export async function disconnectStudioDropbox(connectionVersion: string): Promise<boolean> {
  if (!connectionVersion) throw new Error('Refresh the connection before disconnecting.');
  const response = await apiClient.post('/dropbox/disconnect', {
    connection_version: connectionVersion,
  }, { withCredentials: true });
  const root = asRecord(response.data);
  return asRecord(root.data ?? root).revocation_pending === true;
}

export const integrationsReturnPath = (search: string): string => {
  const result = new URLSearchParams(search).get('dropbox');
  const params = new URLSearchParams({ tab: 'integrations' });
  if (result === 'connected' || result === 'error') params.set('dropbox', result);
  return `/settings?${params.toString()}`;
};
