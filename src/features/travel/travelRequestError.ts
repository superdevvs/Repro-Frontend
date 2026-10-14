const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

/** Distinguish request failures from a successfully evaluated scheduling warning. */
export function travelRequestError(response: Pick<Response, 'status' | 'headers'>, data: unknown): string {
  const body = record(data);
  const status = response.status;
  const retryValue = body.retry_after ?? response.headers?.get('Retry-After');
  const retrySeconds = retryValue == null ? NaN : Number(retryValue);
  const retry = Number.isFinite(retrySeconds) && retrySeconds > 0
    ? `Try again in ${Math.ceil(retrySeconds)} ${Math.ceil(retrySeconds) === 1 ? 'second' : 'seconds'}.`
    : 'Retry before confirming the schedule.';
  if (status === 401) return 'Your session has expired. Sign in again to check travel.';
  if (status === 403) return 'Your account does not have permission to check this schedule.';
  if (status === 429) return `Too many travel checks. ${retry}`;
  if (status === 422) {
    const messages = Object.entries(record(body.errors)).flatMap(([field, value]) => {
      const label = field.replace(/\.\d+(?=\.|$)/g, '').replace(/[._]/g, ' ');
      return (Array.isArray(value) ? value : [value]).filter(item => typeof item === 'string').map(message => `${label}: ${message}`);
    });
    if (messages.length) return `Travel check needs corrected booking details. ${messages.slice(0, 3).join(' ')}`;
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  }
  if (status >= 500) return `Travel check is temporarily unavailable (server error ${status}). ${retry}`;
  if (status === 409) return 'The schedule changed. Recheck travel before confirming.';
  return 'Travel check returned an incomplete response. Retry before confirming the schedule.';
}
