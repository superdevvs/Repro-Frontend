export interface PublicApiError {
  message: string;
  code: string;
  status?: number;
  requestId?: string;
  errors?: Record<string, string[]>;
}

type ErrorLike = {
  message?: string;
  code?: string;
  response?: { status?: number; data?: unknown; headers?: Record<string, unknown> };
  publicError?: PublicApiError;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requestId = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value : undefined;

/** Normalize only the error envelope; original response/domain metadata stays intact. */
export function normalizeApiError(value: unknown): PublicApiError {
  const error = (isRecord(value) ? value : {}) as ErrorLike;
  const data = isRecord(error.response?.data) ? error.response.data : {};
  const status = error.response?.status;
  const code = typeof data.code === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(data.code)
    ? data.code : status ? (status >= 500 ? 'internal_error' : 'request_failed') : 'network_error';
  const fallback = status === 401 ? 'Please sign in to continue.'
    : status === 403 ? 'You do not have permission to perform this action.'
    : status === 422 ? 'Please check the information you entered.'
    : status === 429 ? 'Too many attempts. Please wait and try again.'
    : status ? 'The request could not be completed. Please try again.'
    : 'Could not connect. Check your connection and try again.';
  // Reject embedded control bytes while allowing normal whitespace.
  // eslint-disable-next-line no-control-regex
  const unsafeControlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
  const message = typeof data.message === 'string' && data.message.length > 0 && data.message.length <= 1000
    && !unsafeControlCharacters.test(data.message) ? data.message : fallback;

  return {
    message, code, status,
    requestId: requestId(error.response?.headers?.['x-request-id'])
      ?? requestId(error.response?.headers?.['x-trace-id']) ?? requestId(data.request_id),
    errors: isRecord(data.errors) && Object.values(data.errors).every((messages) =>
      Array.isArray(messages) && messages.every((message) => typeof message === 'string'))
      ? data.errors as Record<string, string[]> : undefined,
  };
}

export function attachPublicApiError(value: unknown): PublicApiError {
  const normalized = normalizeApiError(value);
  if (isRecord(value)) {
    value.publicError = normalized;
    value.message = normalized.message;
  }
  return normalized;
}
