import { apiClient } from '@/services/api';
import type { ApiError } from './types';

type Params = Record<string, string | number | boolean | null | undefined>;

const clean = (params?: Params) => {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
};

/** Turn an axios failure into a message people can read, keeping validation and duplicate details. */
export function toApiError(error: unknown): ApiError {
  const response = (error as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
  const data = response?.data ?? {};
  const errors = data.errors as Record<string, string[]> | undefined;
  const first = errors ? Object.values(errors).flat()[0] : undefined;
  return {
    message: (first as string | undefined) ?? (data.message as string | undefined) ?? 'Something went wrong. Try again.',
    status: response?.status,
    errors,
    duplicate: data.duplicate as ApiError['duplicate'],
    reason: data.reason as string | undefined,
    content_check: data.content_check as ApiError['content_check'],
  };
}

export const crmApi = {
  async get<T>(path: string, params?: Params): Promise<T> {
    const { data } = await apiClient.get<T>(`/crm${path}`, { params: clean(params) });
    return data;
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    const { data } = await apiClient.post<T>(`/crm${path}`, body ?? {});
    return data;
  },
  async patch<T>(path: string, body?: unknown): Promise<T> {
    const { data } = await apiClient.patch<T>(`/crm${path}`, body ?? {});
    return data;
  },
  async put<T>(path: string, body?: unknown): Promise<T> {
    const { data } = await apiClient.put<T>(`/crm${path}`, body ?? {});
    return data;
  },
  async upload<T>(path: string, form: FormData): Promise<T> {
    const { data } = await apiClient.post<T>(`/crm${path}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  },
};

/** Public endpoints (no sign-in): careers, quotes, unsubscribe. */
export const publicCrmApi = {
  async get<T>(path: string): Promise<T> {
    const { data } = await apiClient.get<T>(`/public/crm${path}`);
    return data;
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const { data } = await apiClient.post<T>(`/public/crm${path}`, body ?? {}, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    return data;
  },
};
