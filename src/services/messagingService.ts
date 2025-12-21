import { API_BASE_URL } from '@/config/env';

const authHeaders = (token?: string) =>
  ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }) as HeadersInit;

const handleResponse = async <T>(res: Response) => {
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.message || 'Messaging request failed');
  }
  return (await res.json()) as T;
};

export const fetchMessagingOverview = async <T = any>(token?: string) => {
  const res = await fetch(`${API_BASE_URL}/api/messaging/overview`, {
    headers: authHeaders(token),
  });
  return handleResponse<T>(res);
};

export const fetchMessagingTemplates = async <T = any>(token?: string, channel = 'EMAIL') => {
  const res = await fetch(`${API_BASE_URL}/api/messaging/templates?channel=${channel}`, {
    headers: authHeaders(token),
  });
  return handleResponse<T>(res);
};

export const fetchEmailMessages = async <T = any>(
  token?: string,
  params: Record<string, string> = {},
) => {
  const search = new URLSearchParams(params).toString();
  const res = await fetch(
    `${API_BASE_URL}/api/messaging/email/messages${search ? `?${search}` : ''}`,
    {
      headers: authHeaders(token),
    },
  );
  return handleResponse<T>(res);
};

export const sendEmailMessage = async <T = any>(
  payload: Record<string, any>,
  token?: string,
) => {
  const res = await fetch(`${API_BASE_URL}/api/messaging/email/compose`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<T>(res);
};

export const fetchSmsThreads = async <T = any>(token?: string) => {
  const res = await fetch(`${API_BASE_URL}/api/messaging/sms/threads`, {
    headers: authHeaders(token),
  });
  return handleResponse<T>(res);
};

export const fetchSmsThread = async <T = any>(threadId: number, token?: string) => {
  const res = await fetch(`${API_BASE_URL}/api/messaging/sms/threads/${threadId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<T>(res);
};

export const sendSmsMessage = async <T = any>(
  payload: Record<string, any>,
  token?: string,
) => {
  const res = await fetch(`${API_BASE_URL}/api/messaging/sms/send`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<T>(res);
};

export const fetchMessagingSettings = async <T = any>(token?: string) => {
  const [emailRes, smsRes] = await Promise.all([
    fetch(`${API_BASE_URL}/api/messaging/settings/email`, {
      headers: authHeaders(token),
    }),
    fetch(`${API_BASE_URL}/api/messaging/settings/sms`, {
      headers: authHeaders(token),
    }),
  ]);

  const email = await handleResponse<T>(emailRes);
  const sms = await handleResponse<T>(smsRes);

  return { email, sms };
};

export const saveEmailSettings = async (channels: Record<string, any>[], token?: string) => {
  const res = await fetch(`${API_BASE_URL}/api/messaging/settings/email`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ channels }),
  });
  return handleResponse(res);
};

export const saveSmsSettings = async (numbers: Record<string, any>[], token?: string) => {
  const res = await fetch(`${API_BASE_URL}/api/messaging/settings/sms`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ numbers }),
  });
  return handleResponse(res);
};

