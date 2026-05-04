import { API_BASE_URL } from '@/config/env';
import type {
  AccountLinkRecord,
  ClientSharedDataResponse,
  LinkedClientSummary,
  LinkedOwnerSummary,
  LinkedSharedVisibilityResponse,
  OwnerSharedClientDataResponse,
  SharedDetails,
} from '@/types/auth';

export interface LinkingOwnerConflict {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  accountStatus?: string | null;
}

export interface LinkingAccountOption {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  accountStatus?: string | null;
  company?: string | null;
  isLinkedToOtherOwners?: boolean;
  activeOwnerLinkCount?: number;
  activeOwnerLinks?: LinkingOwnerConflict[];
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

export async function deleteAccountLink(linkId: string): Promise<{ link: AccountLinkRecord; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/account-links/${linkId}/permanent`, {
    method: 'DELETE',
    headers: createHeaders(),
  });

  return parseJson<{ link: AccountLinkRecord; message: string }>(response);
}

export async function fetchLinkedSharedVisibility(signal?: AbortSignal): Promise<LinkedSharedVisibilityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/account-links/has-linked`, {
    headers: createHeaders(),
    signal,
  });

  return parseJson<LinkedSharedVisibilityResponse>(response);
}

export async function fetchMyLinkedClients(signal?: AbortSignal): Promise<{ linkedAccounts: LinkedClientSummary[]; total: number }> {
  const response = await fetch(`${API_BASE_URL}/api/account-links/my-linked-accounts`, {
    headers: createHeaders(),
    signal,
  });

  return parseJson<{ linkedAccounts: LinkedClientSummary[]; total: number }>(response);
}

export async function fetchMyLinkedOwners(signal?: AbortSignal): Promise<{ linkedAccounts: LinkedOwnerSummary[]; total: number }> {
  return fetchMyLinkedClients(signal);
}

export async function fetchMyLinkedClientSharedData(
  clientId: string,
  signal?: AbortSignal,
): Promise<OwnerSharedClientDataResponse> {
  const query = new URLSearchParams({ clientId });
  const response = await fetch(`${API_BASE_URL}/api/account-links/my-shared-data?${query}`, {
    headers: createHeaders(),
    signal,
  });

  return parseJson<OwnerSharedClientDataResponse>(response);
}

export async function fetchMySharedData(
  ownerId: string,
  signal?: AbortSignal,
): Promise<ClientSharedDataResponse> {
  return fetchMyLinkedClientSharedData(ownerId, signal) as Promise<ClientSharedDataResponse>;
}
