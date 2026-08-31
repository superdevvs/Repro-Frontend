import { API_ROUTES } from '@/lib/api';
import { getApiHeaders } from '@/services/api';
import type { NormalizedIguideOfflinePackage } from '@/utils/shootTourData';
import { parseIguideOfflinePackageResponse } from './iguideOfflinePackage';
import {
  IGUIDE_RESUMABLE_CHUNK_BYTES,
  IguideResumableUploadError,
  IguideUploadPausedError,
  asFiniteNumber,
  asRecord,
  parseIndexes,
  parseIguideUploadEnvelope,
  type IguideReceivedChunk,
  type IguideResumableUploadPhase,
  type IguideUploadSession,
  type PersistedIguideUpload,
  type UploadEnvelope,
  type UploadIguideOfflinePackageOptions,
} from './iguideResumableUploadContract';

export {
  IGUIDE_RESUMABLE_CHUNK_BYTES,
  IguideResumableUploadError,
  IguideUploadPausedError,
  parseIguideUploadEnvelope,
} from './iguideResumableUploadContract';
export type {
  IguideReceivedChunk,
  IguideResumableUploadPhase,
  IguideResumableUploadProgress,
  IguideUploadSession,
  PersistedIguideUpload,
  UploadIguideOfflinePackageOptions,
} from './iguideResumableUploadContract';

const MAX_REQUEST_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_POLLS = 450;
const STORAGE_PREFIX = 'repro:iguide-offline-upload:v1';
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);
const COMPLETED_STATUSES = new Set(['complete', 'completed', 'ready']);
const FAILED_STATUSES = new Set(['cancelled', 'canceled', 'error', 'expired', 'failed', 'rejected']);

const storageKey = (shootId: number | string, file: Pick<File, 'name' | 'size' | 'lastModified'>) =>
  `${STORAGE_PREFIX}:${String(shootId)}:${encodeURIComponent(file.name)}:${file.size}:${file.lastModified}`;

const readPersisted = (
  shootId: number | string,
  file: Pick<File, 'name' | 'size' | 'lastModified'>,
): PersistedIguideUpload | null => {
  try {
    const raw = window.localStorage.getItem(storageKey(shootId, file));
    if (!raw) return null;
    const parsed = asRecord(JSON.parse(raw));
    if (
      String(parsed.shootId ?? '') !== String(shootId)
      || String(parsed.filename ?? '') !== file.name
      || Number(parsed.sizeBytes) !== file.size
      || Number(parsed.lastModified) !== file.lastModified
    ) {
      window.localStorage.removeItem(storageKey(shootId, file));
      return null;
    }

    return {
      shootId: String(shootId),
      filename: file.name,
      sizeBytes: file.size,
      lastModified: file.lastModified,
      idempotencyKey: String(parsed.idempotencyKey ?? ''),
      sessionId: String(parsed.sessionId ?? ''),
      chunkSizeBytes: asFiniteNumber(parsed.chunkSizeBytes),
      totalChunks: asFiniteNumber(parsed.totalChunks),
      receivedBytes: asFiniteNumber(parsed.receivedBytes),
      receivedChunkIndexes: parseIndexes(parsed.receivedChunkIndexes),
      expiresAt: String(parsed.expiresAt ?? ''),
    };
  } catch {
    return null;
  }
};

const writePersisted = (
  shootId: number | string,
  file: Pick<File, 'name' | 'size' | 'lastModified'>,
  value: PersistedIguideUpload,
) => {
  try {
    window.localStorage.setItem(storageKey(shootId, file), JSON.stringify(value));
  } catch {
    // Uploads still work when storage is unavailable; they simply cannot resume after a refresh.
  }
};

export const clearPersistedIguideUpload = (
  shootId: number | string,
  file: Pick<File, 'name' | 'size' | 'lastModified'>,
) => {
  try {
    window.localStorage.removeItem(storageKey(shootId, file));
  } catch {
    // Ignore restricted storage environments.
  }
};

export const getPersistedIguideUpload = (
  shootId: number | string,
  file: Pick<File, 'name' | 'size' | 'lastModified'>,
) => readPersisted(shootId, file);

export const createIguideUploadIdempotencyKey = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
};

const persistedFromSession = (
  shootId: number | string,
  file: File,
  idempotencyKey: string,
  session: IguideUploadSession,
): PersistedIguideUpload => ({
  shootId: String(shootId),
  filename: file.name,
  sizeBytes: file.size,
  lastModified: file.lastModified,
  idempotencyKey,
  sessionId: session.id,
  chunkSizeBytes: session.chunkSizeBytes,
  totalChunks: session.totalChunks,
  receivedBytes: session.receivedBytes,
  receivedChunkIndexes: session.receivedChunkIndexes,
  expiresAt: session.expiresAt,
});

const throwIfPaused = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new IguideUploadPausedError();
};

const wait = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  throwIfPaused(signal);
  const timer = window.setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, Math.max(0, milliseconds));
  const onAbort = () => {
    window.clearTimeout(timer);
    reject(new IguideUploadPausedError());
  };
  signal?.addEventListener('abort', onAbort, { once: true });
});

const isRetryableStatus = (status: number) =>
  RETRYABLE_STATUS_CODES.has(status) || status >= 500;

const messageFromPayload = (payload: unknown, fallback: string) => {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const errors = asRecord(root.errors);
  const packageErrors = errors.package;
  const firstPackageError = Array.isArray(packageErrors) ? packageErrors[0] : packageErrors;
  return String(
    root.message
      ?? root.error
      ?? data.message
      ?? firstPackageError
      ?? fallback,
  );
};

const parseJsonText = (text: string) => {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
};

const getRetryAfterMs = (value: string | null) => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
};

const requestJsonOnce = async (
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<UploadEnvelope> => {
  throwIfPaused(signal);
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const payload = parseJsonText(text);
    if (!response.ok) {
      const root = asRecord(payload);
      const errorType = String(root.error_type ?? '').trim().toLowerCase();
      let session: IguideUploadSession | null = null;
      if (response.status === 409 && errorType === 'upload_in_progress') {
        try {
          session = parseIguideUploadEnvelope(payload).session;
        } catch {
          // Preserve the original API error when the conflict payload is incomplete.
        }
      }
      const error = new IguideResumableUploadError(
        messageFromPayload(payload, `The upload request failed (${response.status}).`),
        {
          errorType,
          payload,
          retryable: isRetryableStatus(response.status),
          session,
          status: response.status,
        },
      );
      Object.assign(error, { retryAfterMs: getRetryAfterMs(response.headers.get('retry-after')) });
      throw error;
    }
    return parseIguideUploadEnvelope(payload);
  } catch (error) {
    if (signal?.aborted) throw new IguideUploadPausedError();
    if (error instanceof IguideResumableUploadError) throw error;
    throw new IguideResumableUploadError(
      timedOut ? 'The upload request timed out. Retrying…' : 'The upload connection was interrupted.',
      { retryable: true },
    );
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
};

const retryDelay = (error: IguideResumableUploadError, attempt: number, delays: number[]) => {
  const serverDelay = Number((error as IguideResumableUploadError & { retryAfterMs?: number }).retryAfterMs);
  if (Number.isFinite(serverDelay) && serverDelay >= 0) return serverDelay;
  const base = delays[Math.min(attempt, Math.max(0, delays.length - 1))] ?? 0;
  return Math.round(base * (0.85 + Math.random() * 0.3));
};

const requestJsonWithRetry = async (
  url: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  delays: number[],
) => {
  let lastError: IguideResumableUploadError | null = null;
  for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt++) {
    try {
      return await requestJsonOnce(url, init, signal);
    } catch (error) {
      if (error instanceof IguideUploadPausedError) throw error;
      const uploadError = error instanceof IguideResumableUploadError
        ? error
        : new IguideResumableUploadError('The upload request failed.', { retryable: true });
      lastError = uploadError;
      if (!uploadError.retryable || attempt === MAX_REQUEST_ATTEMPTS - 1) throw uploadError;
      await wait(retryDelay(uploadError, attempt, delays), signal);
    }
  }
  throw lastError ?? new IguideResumableUploadError('The upload request failed.');
};

const jsonHeaders = (extra?: Record<string, string>) => ({
  ...getApiHeaders(),
  ...extra,
});

const showSession = (
  shootId: number | string,
  sessionId: string,
  signal: AbortSignal | undefined,
  delays: number[],
) => requestJsonWithRetry(
  API_ROUTES.integrations.iguide.offlinePackageUploads.show(shootId, sessionId),
  { method: 'GET', headers: jsonHeaders() },
  signal,
  delays,
);

export const getIguideChunkRange = (fileSize: number, chunkSize: number, index: number) => {
  const start = index * chunkSize;
  const endExclusive = Math.min(fileSize, start + chunkSize);
  return {
    endExclusive,
    endInclusive: endExclusive - 1,
    size: Math.max(0, endExclusive - start),
    start,
  };
};

export const getConfirmedIguideUploadBytes = (fileSize: number, session: IguideUploadSession) => {
  const byIndexes = session.receivedChunkIndexes.reduce((total, index) => {
    const range = getIguideChunkRange(fileSize, session.chunkSizeBytes, index);
    return total + range.size;
  }, 0);
  return Math.min(fileSize, Math.max(session.receivedBytes, byIndexes));
};

const bytesToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

export const sha256Blob = async (blob: Blob, signal?: AbortSignal) => {
  throwIfPaused(signal);
  if (!globalThis.crypto?.subtle) {
    throw new IguideResumableUploadError(
      'This browser cannot verify upload chunks. Update Microsoft Edge and try again.',
    );
  }
  const bytes = await blob.arrayBuffer();
  throwIfPaused(signal);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  throwIfPaused(signal);
  return bytesToHex(digest);
};

const xhrChunkOnce = ({
  blob,
  checksum,
  fileSize,
  index,
  onLoaded,
  range,
  sessionId,
  shootId,
  signal,
}: {
  blob: Blob;
  checksum: string;
  fileSize: number;
  index: number;
  onLoaded: (loaded: number) => void;
  range: ReturnType<typeof getIguideChunkRange>;
  sessionId: string;
  shootId: number | string;
  signal?: AbortSignal;
}) => new Promise<UploadEnvelope>((resolve, reject) => {
  throwIfPaused(signal);
  const xhr = new XMLHttpRequest();
  let settled = false;
  const settle = (callback: () => void) => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener('abort', onSignalAbort);
    callback();
  };
  const onSignalAbort = () => xhr.abort();

  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) onLoaded(Math.min(range.size, event.loaded));
  });
  xhr.addEventListener('load', () => settle(() => {
    const payload = parseJsonText(xhr.responseText || '');
    if (xhr.status < 200 || xhr.status >= 300) {
      const error = new IguideResumableUploadError(
        messageFromPayload(payload, `Chunk ${index + 1} could not be uploaded (${xhr.status}).`),
        { retryable: isRetryableStatus(xhr.status), status: xhr.status },
      );
      Object.assign(error, { retryAfterMs: getRetryAfterMs(xhr.getResponseHeader('retry-after')) });
      reject(error);
      return;
    }
    try {
      resolve(parseIguideUploadEnvelope(payload));
    } catch (error) {
      reject(error);
    }
  }));
  xhr.addEventListener('error', () => settle(() => reject(new IguideResumableUploadError(
    'The upload connection was interrupted.',
    { retryable: true },
  ))));
  xhr.addEventListener('timeout', () => settle(() => reject(new IguideResumableUploadError(
    `Chunk ${index + 1} timed out.`,
    { retryable: true, status: 408 },
  ))));
  xhr.addEventListener('abort', () => settle(() => reject(
    signal?.aborted
      ? new IguideUploadPausedError()
      : new IguideResumableUploadError('The upload was interrupted.', { retryable: true }),
  )));

  xhr.open('PUT', API_ROUTES.integrations.iguide.offlinePackageUploads.chunk(shootId, sessionId, index));
  xhr.timeout = REQUEST_TIMEOUT_MS;
  Object.entries({
    ...getApiHeaders(),
    'Content-Type': 'application/octet-stream',
    'Content-Range': `bytes ${range.start}-${range.endInclusive}/${fileSize}`,
    'X-Chunk-SHA256': checksum,
  }).forEach(([name, value]) => xhr.setRequestHeader(name, value));
  signal?.addEventListener('abort', onSignalAbort, { once: true });
  xhr.send(blob);
});

const sessionConflict = (message: string, session: IguideUploadSession) =>
  new IguideResumableUploadError(message, {
    errorType: 'resume_integrity_conflict',
    session,
    status: 409,
  });

const reconcileConfirmedChunk = (
  session: IguideUploadSession,
  index: number,
  checksum: string,
  sizeBytes: number,
) => {
  const receivedChunk = session.receivedChunks.find((chunk) => chunk.index === index);
  if (receivedChunk) {
    if (receivedChunk.sha256 === checksum && receivedChunk.sizeBytes === sizeBytes) return true;
    throw sessionConflict(
      `The server confirmed different data for chunk ${index + 1}. Discard the existing upload and start again.`,
      session,
    );
  }
  if (session.receivedChunkIndexes.includes(index)) {
    throw sessionConflict(
      `The server could not verify chunk ${index + 1}. Discard the existing upload and start again.`,
      session,
    );
  }
  return false;
};

const verifyNewSessionChunks = async ({
  attemptedChecksum,
  attemptedIndex,
  file,
  nextSession,
  previousSession,
  signal,
}: {
  attemptedChecksum: string;
  attemptedIndex: number;
  file: File;
  nextSession: IguideUploadSession;
  previousSession: IguideUploadSession;
  signal?: AbortSignal;
}) => {
  const previousIndexes = new Set(previousSession.receivedChunkIndexes);
  const nextIndexes = new Set(nextSession.receivedChunkIndexes);
  const previousByIndex = new Map(previousSession.receivedChunks.map((chunk) => [chunk.index, chunk]));
  const nextByIndex = new Map<number, IguideReceivedChunk>();

  for (const received of nextSession.receivedChunks) {
    if (nextByIndex.has(received.index) || !nextIndexes.has(received.index)) {
      throw sessionConflict(
        'The server returned inconsistent upload progress. Discard the existing upload and start again.',
        nextSession,
      );
    }
    nextByIndex.set(received.index, received);
  }

  for (const index of previousIndexes) {
    const previous = previousByIndex.get(index);
    const next = nextByIndex.get(index);
    if (
      !nextIndexes.has(index)
      || !previous
      || !next
      || previous.sha256 !== next.sha256
      || previous.sizeBytes !== next.sizeBytes
    ) {
      throw sessionConflict(
        'The server changed previously verified upload progress. Discard the existing upload and start again.',
        nextSession,
      );
    }
  }

  for (const index of Array.from(nextIndexes).sort((left, right) => left - right)) {
    if (previousIndexes.has(index)) continue;
    throwIfPaused(signal);
    const received = nextByIndex.get(index);
    const range = getIguideChunkRange(file.size, nextSession.chunkSizeBytes, index);
    if (!received || received.sizeBytes !== range.size) {
      throw sessionConflict(
        `The server could not verify chunk ${index + 1}. Discard the existing upload and start again.`,
        nextSession,
      );
    }
    const checksum = index === attemptedIndex
      ? attemptedChecksum
      : await sha256Blob(file.slice(range.start, range.endExclusive), signal);
    if (received.sha256 !== checksum) {
      throw sessionConflict(
        `The server confirmed different data for chunk ${index + 1}. Discard the existing upload and start again.`,
        nextSession,
      );
    }
  }
};

const uploadChunkWithReconciliation = async ({
  blob,
  checksum,
  file,
  fileSize,
  index,
  onLoaded,
  range,
  retryDelaysMs,
  session,
  shootId,
  signal,
}: {
  blob: Blob;
  checksum: string;
  file: File;
  fileSize: number;
  index: number;
  onLoaded: (loaded: number) => void;
  range: ReturnType<typeof getIguideChunkRange>;
  retryDelaysMs: number[];
  session: IguideUploadSession;
  shootId: number | string;
  signal?: AbortSignal;
}) => {
  let currentSession = session;
  for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt++) {
    try {
      const uploaded = await xhrChunkOnce({
        blob,
        checksum,
        fileSize,
        index,
        onLoaded,
        range,
        sessionId: currentSession.id,
        shootId,
        signal,
      });
      await verifyNewSessionChunks({
        attemptedChecksum: checksum,
        attemptedIndex: index,
        file,
        nextSession: uploaded.session,
        previousSession: currentSession,
        signal,
      });
      if (reconcileConfirmedChunk(uploaded.session, index, checksum, range.size)) return uploaded;
      throw new IguideResumableUploadError(
        `The server did not confirm chunk ${index + 1}.`,
        { retryable: true },
      );
    } catch (error) {
      if (error instanceof IguideUploadPausedError) throw error;
      const uploadError = error instanceof IguideResumableUploadError
        ? error
        : new IguideResumableUploadError('The chunk upload failed.', { retryable: true });
      if (!uploadError.retryable) throw uploadError;

      try {
        const reconciled = await showSession(shootId, currentSession.id, signal, retryDelaysMs);
        await verifyNewSessionChunks({
          attemptedChecksum: checksum,
          attemptedIndex: index,
          file,
          nextSession: reconciled.session,
          previousSession: currentSession,
          signal,
        });
        currentSession = reconciled.session;
        if (reconcileConfirmedChunk(currentSession, index, checksum, range.size)) return reconciled;
      } catch (reconciliationError) {
        if (reconciliationError instanceof IguideUploadPausedError) throw reconciliationError;
        if (
          reconciliationError instanceof IguideResumableUploadError
          && !reconciliationError.retryable
        ) throw reconciliationError;
      }

      if (attempt === MAX_REQUEST_ATTEMPTS - 1) throw uploadError;
      await wait(retryDelay(uploadError, attempt, retryDelaysMs), signal);
    }
  }
  throw new IguideResumableUploadError('The chunk could not be uploaded.', { retryable: true });
};

const isComplete = (session: IguideUploadSession) => COMPLETED_STATUSES.has(session.status);
const isFailed = (session: IguideUploadSession) => FAILED_STATUSES.has(session.status);

const assertUsableSession = (file: File, session: IguideUploadSession) => {
  if (session.filename && session.filename !== file.name) {
    throw sessionConflict('The existing upload belongs to a different file. Discard it and start again.', session);
  }
  if (session.sizeBytes && session.sizeBytes !== file.size) {
    throw sessionConflict('The existing upload belongs to a different file. Discard it and start again.', session);
  }
  if (session.chunkSizeBytes !== IGUIDE_RESUMABLE_CHUNK_BYTES) {
    throw sessionConflict('The existing upload uses an unsupported chunk size. Discard it and start again.', session);
  }
  const expectedChunks = Math.ceil(file.size / session.chunkSizeBytes);
  if (session.totalChunks !== expectedChunks) {
    throw sessionConflict('The existing upload has an inconsistent upload plan. Discard it and start again.', session);
  }
  if (session.receivedChunkIndexes.some((index) => index >= session.totalChunks)) {
    throw sessionConflict('The existing upload has invalid saved progress. Discard it and start again.', session);
  }
  if (isFailed(session)) {
    throw new IguideResumableUploadError(
      session.error || 'The server could not finish this upload.',
      { retryable: session.retryable },
    );
  }
};

const verifyReceivedChunks = async (
  file: File,
  session: IguideUploadSession,
  signal?: AbortSignal,
  requireActiveVerification = false,
) => {
  if (session.status !== 'uploading') {
    if (requireActiveVerification) {
      throw sessionConflict(
        'The existing upload is already being processed and cannot be safely matched to this file.',
        session,
      );
    }
    return;
  }
  const confirmedIndexes = new Set(session.receivedChunkIndexes);
  if (!confirmedIndexes.size) {
    if (session.receivedBytes > 0 || session.receivedChunks.length > 0) {
      throw sessionConflict('The existing upload has unverifiable saved progress. Discard it and start again.', session);
    }
    return;
  }

  const receivedByIndex = new Map<number, IguideReceivedChunk>();
  for (const received of session.receivedChunks) {
    if (receivedByIndex.has(received.index) || !confirmedIndexes.has(received.index)) {
      throw sessionConflict('The existing upload has inconsistent saved progress. Discard it and start again.', session);
    }
    receivedByIndex.set(received.index, received);
  }

  for (const index of confirmedIndexes) {
    throwIfPaused(signal);
    const received = receivedByIndex.get(index);
    const range = getIguideChunkRange(file.size, session.chunkSizeBytes, index);
    if (!received || received.sizeBytes !== range.size) {
      throw sessionConflict('The existing upload cannot be safely matched to this file. Discard it and start again.', session);
    }
    const checksum = await sha256Blob(file.slice(range.start, range.endExclusive), signal);
    if (checksum !== received.sha256) {
      throw sessionConflict('The existing upload contains different file data. Discard it and start again.', session);
    }
  }
};

const completeWithReconciliation = async (
  shootId: number | string,
  session: IguideUploadSession,
  signal: AbortSignal | undefined,
  retryDelaysMs: number[],
) => {
  let current = session;
  let lastError: IguideResumableUploadError | null = null;
  for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt++) {
    try {
      return await requestJsonOnce(
        API_ROUTES.integrations.iguide.offlinePackageUploads.complete(shootId, current.id),
        { method: 'POST', headers: jsonHeaders(), body: '{}' },
        signal,
      );
    } catch (error) {
      if (error instanceof IguideUploadPausedError) throw error;
      const uploadError = error instanceof IguideResumableUploadError
        ? error
        : new IguideResumableUploadError('The package could not be finalized.', { retryable: true });
      lastError = uploadError;
      if (!uploadError.retryable) throw uploadError;

      try {
        const reconciled = await showSession(shootId, current.id, signal, retryDelaysMs);
        current = reconciled.session;
        if (isComplete(current) || isFailed(current) || !['created', 'uploading'].includes(current.status)) {
          return reconciled;
        }
      } catch (reconciliationError) {
        if (reconciliationError instanceof IguideUploadPausedError) throw reconciliationError;
        if (
          reconciliationError instanceof IguideResumableUploadError
          && !reconciliationError.retryable
        ) throw reconciliationError;
      }

      if (attempt === MAX_REQUEST_ATTEMPTS - 1) throw uploadError;
      await wait(retryDelay(uploadError, attempt, retryDelaysMs), signal);
    }
  }
  throw lastError ?? new IguideResumableUploadError('The package could not be finalized.');
};

const waitForCompletion = async ({
  initial,
  maxPolls,
  pollIntervalMs,
  retryDelaysMs,
  shootId,
  signal,
}: {
  initial: UploadEnvelope;
  maxPolls: number;
  pollIntervalMs: number;
  retryDelaysMs: number[];
  shootId: number | string;
  signal?: AbortSignal;
}) => {
  let envelope = initial;
  for (let poll = 0; poll <= maxPolls; poll++) {
    if (isComplete(envelope.session) || isFailed(envelope.session)) return envelope;
    if (poll === maxPolls) break;
    await wait(pollIntervalMs, signal);
    envelope = await showSession(shootId, envelope.session.id, signal, retryDelaysMs);
  }
  throw new IguideResumableUploadError(
    'The server is still preparing this package. You can close this window and resume later.',
    { retryable: true },
  );
};

const lifecycleFromCompletedUpload = (
  payload: unknown,
  file: File,
): NormalizedIguideOfflinePackage => parseIguideOfflinePackageResponse(payload, file);

export const uploadIguideOfflinePackageResumable = async ({
  file,
  maxPolls = DEFAULT_MAX_POLLS,
  onProgress,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  shootId,
  signal,
}: UploadIguideOfflinePackageOptions): Promise<NormalizedIguideOfflinePackage> => {
  throwIfPaused(signal);
  let persisted = readPersisted(shootId, file);
  let idempotencyKey = persisted?.idempotencyKey || createIguideUploadIdempotencyKey();
  let envelope: UploadEnvelope | null = null;
  let adoptedConflict = false;
  let highestTransferred = Math.min(file.size, persisted?.receivedBytes ?? 0);

  const report = (
    phase: IguideResumableUploadPhase,
    session: IguideUploadSession | null,
    currentLoaded = 0,
    chunkIndex: number | null = null,
  ) => {
    const confirmed = session ? getConfirmedIguideUploadBytes(file.size, session) : 0;
    const candidate = Math.min(file.size, confirmed + Math.max(0, currentLoaded));
    highestTransferred = Math.max(highestTransferred, candidate);
    const allChunksConfirmed = Boolean(session && session.receivedChunkIndexes.length >= session.totalChunks);
    const rawPercent = file.size > 0 ? Math.round((highestTransferred / file.size) * 100) : 0;
    const percent = phase === 'finalizing' || allChunksConfirmed ? 100 : Math.min(99, rawPercent);
    onProgress?.({
      phase,
      bytesConfirmed: confirmed,
      bytesTransferred: highestTransferred,
      totalBytes: file.size,
      percent,
      chunkIndex,
      totalChunks: session?.totalChunks ?? Math.ceil(file.size / IGUIDE_RESUMABLE_CHUNK_BYTES),
    });
  };

  report('preparing', null);

  if (persisted?.sessionId) {
    try {
      envelope = await showSession(shootId, persisted.sessionId, signal, retryDelaysMs);
    } catch (error) {
      if (
        error instanceof IguideResumableUploadError
        && (error.status === 404 || error.status === 410)
      ) {
        clearPersistedIguideUpload(shootId, file);
        persisted = null;
        idempotencyKey = createIguideUploadIdempotencyKey();
      } else {
        throw error;
      }
    }
  }

  if (!envelope) {
    writePersisted(shootId, file, {
      shootId: String(shootId),
      filename: file.name,
      sizeBytes: file.size,
      lastModified: file.lastModified,
      idempotencyKey,
      sessionId: '',
      chunkSizeBytes: 0,
      totalChunks: 0,
      receivedBytes: 0,
      receivedChunkIndexes: [],
      expiresAt: '',
    });
    try {
      envelope = await requestJsonWithRetry(
        API_ROUTES.integrations.iguide.offlinePackageUploads.create(shootId),
        {
          method: 'POST',
          headers: jsonHeaders({ 'Idempotency-Key': idempotencyKey }),
          body: JSON.stringify({
            filename: file.name,
            size_bytes: file.size,
            last_modified: file.lastModified,
          }),
        },
        signal,
        retryDelaysMs,
      );
    } catch (error) {
      if (
        error instanceof IguideResumableUploadError
        && error.status === 409
        && error.errorType === 'upload_in_progress'
        && error.session
      ) {
        envelope = { payload: error.payload, session: error.session };
        adoptedConflict = true;
      } else {
        throw error;
      }
    }
  }

  assertUsableSession(file, envelope.session);
  await verifyReceivedChunks(file, envelope.session, signal, adoptedConflict);
  writePersisted(shootId, file, persistedFromSession(shootId, file, idempotencyKey, envelope.session));

  if (isComplete(envelope.session)) {
    clearPersistedIguideUpload(shootId, file);
    return lifecycleFromCompletedUpload(envelope.payload, file);
  }

  const sessionAlreadyFinalizing = !['created', 'uploading'].includes(envelope.session.status);
  if (!sessionAlreadyFinalizing) {
    report('uploading', envelope.session);
    for (let index = 0; index < envelope.session.totalChunks; index++) {
      throwIfPaused(signal);
      if (envelope.session.receivedChunkIndexes.includes(index)) continue;
      const range = getIguideChunkRange(file.size, envelope.session.chunkSizeBytes, index);
      const blob = file.slice(range.start, range.endExclusive);
      const checksum = await sha256Blob(blob, signal);
      const confirmedBeforeChunk = getConfirmedIguideUploadBytes(file.size, envelope.session);
      envelope = await uploadChunkWithReconciliation({
        blob,
        checksum,
        file,
        fileSize: file.size,
        index,
        range,
        retryDelaysMs,
        session: envelope.session,
        shootId,
        signal,
        onLoaded: (loaded) => {
          highestTransferred = Math.max(highestTransferred, confirmedBeforeChunk + loaded);
          report('uploading', envelope?.session ?? null, loaded, index);
        },
      });
      assertUsableSession(file, envelope.session);
      writePersisted(shootId, file, persistedFromSession(shootId, file, idempotencyKey, envelope.session));
      report('uploading', envelope.session, 0, index);
    }

    const confirmed = getConfirmedIguideUploadBytes(file.size, envelope.session);
    if (confirmed !== file.size || envelope.session.receivedChunkIndexes.length !== envelope.session.totalChunks) {
      throw new IguideResumableUploadError(
        'The server did not confirm every upload chunk. Resume the upload to continue.',
        { retryable: true },
      );
    }
  }

  report('finalizing', envelope.session);
  if (!sessionAlreadyFinalizing) {
    envelope = await completeWithReconciliation(
      shootId,
      envelope.session,
      signal,
      retryDelaysMs,
    );
    writePersisted(shootId, file, persistedFromSession(shootId, file, idempotencyKey, envelope.session));
  }

  envelope = await waitForCompletion({
    initial: envelope,
    maxPolls,
    pollIntervalMs,
    retryDelaysMs,
    shootId,
    signal,
  });
  if (isFailed(envelope.session)) {
    throw new IguideResumableUploadError(
      envelope.session.error || 'The server could not finish this upload.',
      { retryable: envelope.session.retryable },
    );
  }

  clearPersistedIguideUpload(shootId, file);
  return lifecycleFromCompletedUpload(envelope.payload, file);
};

export const discardIguideUploadSession = async ({
  file,
  sessionId,
  shootId,
  signal,
}: {
  file: Pick<File, 'name' | 'size' | 'lastModified'>;
  sessionId?: string;
  shootId: number | string;
  signal?: AbortSignal;
}) => {
  const persisted = readPersisted(shootId, file);
  const targetSessionId = sessionId || persisted?.sessionId || '';
  if (!targetSessionId) {
    clearPersistedIguideUpload(shootId, file);
    return;
  }

  try {
    const response = await fetch(
      API_ROUTES.integrations.iguide.offlinePackageUploads.discard(shootId, targetSessionId),
      { method: 'DELETE', headers: jsonHeaders(), signal },
    );
    if (response.ok || response.status === 404 || response.status === 410) {
      clearPersistedIguideUpload(shootId, file);
      return;
    }
    if (!response.ok) {
      const payload = parseJsonText(await response.text());
      throw new IguideResumableUploadError(
        messageFromPayload(payload, 'The saved upload could not be discarded.'),
        { retryable: isRetryableStatus(response.status), status: response.status },
      );
    }
  } catch (error) {
    if (error instanceof IguideResumableUploadError) throw error;
    if (signal?.aborted) throw new IguideUploadPausedError();
    throw new IguideResumableUploadError(
      'The connection was interrupted before the saved upload could be discarded.',
      { retryable: true },
    );
  }
};
