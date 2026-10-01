export interface ShootActionRequestFields {
  status?: string | null;
  workflowStatus?: string | null;
  workflow_status?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationReason?: string | null;
  holdRequestedAt?: string | null;
  holdRequestedBy?: string | number | null;
  holdReason?: string | null;
  cancellation_requested_at?: string | null;
  cancellation_reason?: string | null;
  hold_requested_at?: string | null;
  hold_requested_by?: string | number | null;
  hold_reason?: string | null;
}

export interface PendingShootActionRequest {
  type: 'cancellation' | 'hold';
  label: string;
  requestedAt: string;
  reason?: string;
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

// An explicit null means the request was resolved. Do not resurrect an older
// snake_case timestamp when a refreshed camelCase field has been cleared.
const field = (camel: unknown, snake: unknown) => camel !== undefined ? camel : snake;

export function normalizeShootActionRequests(source: ShootActionRequestFields | Record<string, unknown>) {
  // Cancel/decline can retain request timestamps for history, but those requests
  // are no longer actionable and are excluded from the review queues.
  const terminal = [source.status, field(source.workflowStatus, source.workflow_status)]
    .some((status) => ['cancelled', 'canceled', 'declined'].includes(optionalText(status)?.toLowerCase() ?? ''));
  return {
    cancellationRequestedAt: terminal ? undefined : optionalText(field(source.cancellationRequestedAt, source.cancellation_requested_at)),
    cancellationReason: optionalText(field(source.cancellationReason, source.cancellation_reason)),
    holdRequestedAt: terminal ? undefined : optionalText(field(source.holdRequestedAt, source.hold_requested_at)),
    holdRequestedBy: (field(source.holdRequestedBy, source.hold_requested_by) ?? undefined) as string | number | undefined,
    holdReason: optionalText(field(source.holdReason, source.hold_reason)),
  };
}

export function getPendingShootActionRequests(source: ShootActionRequestFields): PendingShootActionRequest[] {
  const requests = normalizeShootActionRequests(source);
  const pending: PendingShootActionRequest[] = [];
  if (requests.cancellationRequestedAt) {
    pending.push({ type: 'cancellation', label: 'Cancellation requested', requestedAt: requests.cancellationRequestedAt, reason: requests.cancellationReason });
  }
  if (requests.holdRequestedAt) {
    pending.push({ type: 'hold', label: 'Hold requested', requestedAt: requests.holdRequestedAt, reason: requests.holdReason });
  }
  return pending;
}
