export interface TransferTelemetry {
  direction: 'upload' | 'download';
  mediaType: 'raw' | 'edited' | 'extra';
  bytes: number;
  transferMs: number | null;
  confirmationMs: number | null;
  totalMs: number;
  status: number;
  outcome: 'confirmed' | 'failed' | 'cancelled';
  chunked: boolean;
}

const validDuration = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 86_400_000;

/** Keep transfer measurements outside the arbitrary, redacted event payload. */
export function sanitizeTransferTelemetry(value: TransferTelemetry): TransferTelemetry | undefined {
  if (!['upload', 'download'].includes(value.direction)
    || !['raw', 'edited', 'extra'].includes(value.mediaType)
    || !['confirmed', 'failed', 'cancelled'].includes(value.outcome)
    || !Number.isSafeInteger(value.bytes) || value.bytes < 0 || value.bytes > 1_099_511_627_776
    || !Number.isInteger(value.status) || value.status < 0 || value.status > 599
    || !validDuration(value.totalMs)
    || (value.transferMs !== null && !validDuration(value.transferMs))
    || (value.confirmationMs !== null && !validDuration(value.confirmationMs))
    || typeof value.chunked !== 'boolean') return undefined;

  return {
    direction: value.direction,
    mediaType: value.mediaType,
    bytes: value.bytes,
    transferMs: value.transferMs,
    confirmationMs: value.confirmationMs,
    totalMs: value.totalMs,
    status: value.status,
    outcome: value.outcome,
    chunked: value.chunked,
  };
}
