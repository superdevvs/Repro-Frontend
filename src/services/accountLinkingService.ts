import { API_BASE_URL } from '@/config/env';
import type { AccountLinkRecord, SharedDetails } from '@/types/auth';

export interface LinkingAccountOption {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  accountStatus?: string | null;
  company?: string | null;
}

export interface AccountLinksResponse {
  links: AccountLinkRecord[];
  total: number;
  summary?: {
    owners: number;
    linkedClients: number;
    active: number;
    inactive: number;
    suspended: number;
    attention: number;
  };
}

export interface AvailableLinkingAccountsResponse {
  owners: LinkingAccountOption[];
  clientAccounts: LinkingAccountOption[];
  meta?: {
    ownerId?: string | null;
    ownerCount: number;
    clientCount: number;
  };
}

interface BatchMutationSummary {
  total: number;
  created: number;
  reactivated: number;
  skipped: number;
  failed: number;
}

export interface BatchLinkMutationResponse {
  message: string;
  created: AccountLinkRecord[];
  reactivated: AccountLinkRecord[];
  skipped: Array<{
    accountId: string;
    accountName?: string;
    reason: string;
    link?: AccountLinkRecord;
  }>;
  errors: Array<{
    accountId: string;
    message: string;
  }>;
  summary: BatchMutationSummary;
}

const getToken = () =>
  localStorage.getItem('authToken') ||
  localStorage.getItem('token') ||
  localStorage.getItem('access_token');

const createHeaders = () => {
  const token = getToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data as T;
};

export async function fetchAccountLinks(signal?: AbortSignal): Promise<AccountLinksResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/account-links`, {
    headers: createHeaders(),
    signal,
  });

  return parseJson<AccountLinksResponse>(response);
}

export async function fetchAvailableLinkingAccounts(
  options: {
    ownerId?: string | null;
    ownerSearch?: string;
    clientSearch?: string;
    signal?: AbortSignal;
  } = {},
): Promise<AvailableLinkingAccountsResponse> {
  const query = new URLSearchParams();

  if (options.ownerId) {
    query.set('ownerId', options.ownerId);
  }

  if (options.ownerSearch) {
    query.set('ownerSearch', options.ownerSearch);
  }

  if (options.clientSearch) {
    query.set('clientSearch', options.clientSearch);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/admin/account-links/available-accounts${query.size ? `?${query}` : ''}`,
    {
      headers: createHeaders(),
      signal: options.signal,
    },
  );

  return parseJson<AvailableLinkingAccountsResponse>(response);
}

export async function createAccountLinks(payload: {
  mainAccountId: string;
  clientAccountIds: string[];
  sharedDetails: SharedDetails;
  notes?: string;
}): Promise<BatchLinkMutationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/account-links/batch`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(payload),
  });

  return parseJson<BatchLinkMutationResponse>(response);
}

export async function updateAccountLink(
  linkId: string,
  payload: {
    sharedDetails: SharedDetails;
    notes?: string;
    status?: 'active' | 'inactive' | 'suspended';
  },
): Promise<{ link: AccountLinkRecord; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/account-links/${linkId}`, {
    method: 'PATCH',
    headers: createHeaders(),
    body: JSON.stringify(payload),
  });

  return parseJson<{ link: AccountLinkRecord; message: string }>(response);
}

export async function unlinkAccountLink(linkId: string): Promise<{ link: AccountLinkRecord; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/account-links/${linkId}`, {
    method: 'DELETE',
    headers: createHeaders(),
  });

  return parseJson<{ link: AccountLinkRecord; message: string }>(response);
}
