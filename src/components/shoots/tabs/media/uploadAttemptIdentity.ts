import type { UploadIssue } from './MediaUploadPanels';

interface UploadAttemptIdentity {
  idempotencyKey: string;
  batchId: string;
  batchIndex: number;
  batchTotal: number;
}

const uploadAttemptIdentities = new WeakMap<File, UploadAttemptIdentity>();

export const createUploadBatchId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function ensureUploadAttemptIdentity(
  file: File,
  batchId: string,
  batchIndex: number,
  batchTotal: number,
): UploadAttemptIdentity {
  const existing = uploadAttemptIdentities.get(file);
  if (existing) return existing;

  const identity = {
    idempotencyKey: createUploadBatchId(),
    batchId,
    batchIndex,
    batchTotal,
  };
  uploadAttemptIdentities.set(file, identity);
  return identity;
}

export function rotateUploadAttemptKey(file: File): void {
  const existing = uploadAttemptIdentities.get(file);
  if (!existing) return;
  uploadAttemptIdentities.set(file, {
    ...existing,
    idempotencyKey: createUploadBatchId(),
  });
}

// A server-confirmed failure is cached under its old key. Explicit retries need
// a fresh attempt, while uncertain network/server outcomes must replay safely.
export function prepareUploadRetries(files: File[], issues: UploadIssue[]): void {
  for (const file of files) {
    const issue = issues.find((candidate) => candidate.fileName === file.name);
    if (issue?.retryable && !['network_failure', 'server_error', 'upload_in_progress'].includes(issue.errorType)) {
      rotateUploadAttemptKey(file);
    }
  }
}
