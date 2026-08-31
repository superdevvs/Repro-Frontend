export const IGUIDE_RESUMABLE_CHUNK_BYTES = 5 * 1024 * 1024;

type JsonRecord = Record<string, unknown>;

export type IguideResumableUploadPhase = 'preparing' | 'uploading' | 'finalizing';

export type IguideResumableUploadProgress = {
  bytesConfirmed: number;
  bytesTransferred: number;
  chunkIndex: number | null;
  percent: number;
  phase: IguideResumableUploadPhase;
  totalBytes: number;
  totalChunks: number;
};

export type IguideReceivedChunk = {
  index: number;
  sha256: string;
  sizeBytes: number;
};

export type IguideUploadSession = {
  chunkSizeBytes: number;
  error: string;
  expiresAt: string;
  filename: string;
  id: string;
  receivedBytes: number;
  receivedChunks: IguideReceivedChunk[];
  receivedChunkIndexes: number[];
  retryable: boolean;
  sizeBytes: number;
  status: string;
  totalChunks: number;
};

export type PersistedIguideUpload = {
  chunkSizeBytes: number;
  expiresAt: string;
  filename: string;
  idempotencyKey: string;
  lastModified: number;
  receivedBytes: number;
  receivedChunkIndexes: number[];
  sessionId: string;
  shootId: string;
  sizeBytes: number;
  totalChunks: number;
};

export type UploadEnvelope = {
  payload: unknown;
  session: IguideUploadSession;
};

type UploadRuntimeOptions = {
  maxPolls?: number;
  pollIntervalMs?: number;
  retryDelaysMs?: number[];
};

export type UploadIguideOfflinePackageOptions = UploadRuntimeOptions & {
  file: File;
  onProgress?: (progress: IguideResumableUploadProgress) => void;
  shootId: number | string;
  signal?: AbortSignal;
};

export class IguideResumableUploadError extends Error {
  readonly errorType: string;
  readonly payload: unknown;
  readonly retryable: boolean;
  readonly session: IguideUploadSession | null;
  readonly sessionId: string;
  readonly status: number | null;

  constructor(message: string, options?: {
    errorType?: string;
    payload?: unknown;
    retryable?: boolean;
    session?: IguideUploadSession | null;
    status?: number | null;
  }) {
    super(message);
    this.name = 'IguideResumableUploadError';
    this.errorType = options?.errorType ?? '';
    this.payload = options?.payload;
    this.retryable = Boolean(options?.retryable);
    this.session = options?.session ?? null;
    this.sessionId = this.session?.id ?? '';
    this.status = options?.status ?? null;
  }
}

export class IguideUploadPausedError extends Error {
  constructor() {
    super('Upload paused.');
    this.name = 'IguideUploadPausedError';
  }
}

export const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' ? value as JsonRecord : {};

export const asFiniteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

const normalizeStatus = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const parseIndexes = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .map((index) => Number(index))
    .filter((index) => Number.isInteger(index) && index >= 0)))
    .sort((left, right) => left - right);
};

const parseReceivedChunks = (value: unknown): IguideReceivedChunk[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const raw = asRecord(entry);
    const index = Number(raw.index);
    const sizeBytes = Number(raw.size_bytes);
    const sha256 = String(raw.sha256 ?? '').toLowerCase();
    if (
      !Number.isInteger(index)
      || index < 0
      || !Number.isInteger(sizeBytes)
      || sizeBytes < 0
      || !/^[a-f0-9]{64}$/.test(sha256)
    ) return [];
    return [{ index, sizeBytes, sha256 }];
  }).sort((left, right) => left.index - right.index);
};

export const parseIguideUploadEnvelope = (payload: unknown): UploadEnvelope => {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const upload = asRecord(root.upload ?? data.upload);
  const id = String(upload.id ?? upload.session_id ?? '');
  const status = normalizeStatus(upload.status);
  const receivedChunks = parseReceivedChunks(upload.received_chunks);
  const receivedChunkIndexes = parseIndexes(upload.received_chunk_indexes);

  if (!id || !status) {
    throw new IguideResumableUploadError(
      'The upload server returned an incomplete session response. Please try again.',
      { retryable: true },
    );
  }

  return {
    payload,
    session: {
      id,
      status,
      filename: String(upload.filename ?? ''),
      sizeBytes: asFiniteNumber(upload.size_bytes),
      chunkSizeBytes: asFiniteNumber(upload.chunk_size_bytes),
      totalChunks: asFiniteNumber(upload.total_chunks),
      receivedBytes: asFiniteNumber(upload.received_bytes),
      receivedChunks,
      receivedChunkIndexes: receivedChunkIndexes.length
        ? receivedChunkIndexes
        : receivedChunks.map((chunk) => chunk.index),
      expiresAt: String(upload.expires_at ?? ''),
      error: String(upload.error ?? ''),
      retryable: upload.retryable === true || upload.retryable === 1,
    },
  };
};
