import { asRecord } from './bookShootModel';

/** Keep server scheduling details available while presenting a retryable failure. */
export function bookingSubmissionFailure(error: unknown) {
  const details = asRecord(error);
  const response = asRecord(details.response);
  const data = asRecord(response.data ?? details.data);
  const validation = asRecord(data.errors);
  const validationMessage = Object.values(validation)
    .flatMap(value => Array.isArray(value) ? value.map(String) : [String(value)]).join('. ');
  const fallback = error instanceof Error ? error.message
    : `Failed to save shoot (${String(response.status || 'Unknown error')}). Please try again.`;
  const message = validationMessage || (typeof data.message === 'string' && data.message) || fallback;
  return { data, message, notice: {
    title: Object.keys(validation).length ? 'Validation Error' : 'Error',
    description: message,
    variant: 'destructive' as const,
  } };
}
