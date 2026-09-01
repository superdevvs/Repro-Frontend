import {
  IguideResumableUploadError,
  type IguideUploadSession,
} from './iguideResumableUploadContract';

type ConcurrentUploadPoolOptions<T> = {
  concurrency: number;
  items: T[];
  run: (item: T, signal: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
};

/**
 * Runs a small rolling pool and aborts every sibling request after the first
 * failure. The original failure is preserved after the other workers settle.
 */
export const runIguideConcurrentUploadPool = async <T>({
  concurrency,
  items,
  run,
  signal,
}: ConcurrentUploadPoolOptions<T>) => {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (signal?.aborted) controller.abort();

  let cursor = 0;
  let firstError: unknown;
  const worker = async () => {
    while (!controller.signal.aborted) {
      const position = cursor;
      cursor += 1;
      if (position >= items.length) return;

      try {
        await run(items[position], controller.signal);
      } catch (error) {
        if (firstError === undefined) firstError = error;
        controller.abort();
        return;
      }
    }
  };

  try {
    const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    if (firstError !== undefined) throw firstError;
  } finally {
    signal?.removeEventListener('abort', abortFromCaller);
  }
};

export const mergeVerifiedIguideSessionProgress = (
  fileSize: number,
  current: IguideUploadSession,
  incoming: IguideUploadSession,
) => {
  if (incoming.id !== current.id || !['created', 'uploading'].includes(incoming.status)) {
    throw new IguideResumableUploadError('The server returned an unexpected upload session.', {
      errorType: 'resume_integrity_conflict', session: incoming, status: 409,
    });
  }
  const chunks = new Map(current.receivedChunks.map((chunk) => [chunk.index, chunk]));
  for (const chunk of incoming.receivedChunks) {
    const existing = chunks.get(chunk.index);
    if (existing && (existing.sha256 !== chunk.sha256 || existing.sizeBytes !== chunk.sizeBytes)) {
      throw new IguideResumableUploadError(
        `The server changed previously verified chunk ${chunk.index + 1}. Discard the existing upload and start again.`,
        { errorType: 'resume_integrity_conflict', session: incoming, status: 409 },
      );
    }
    chunks.set(chunk.index, chunk);
  }
  const receivedChunks = Array.from(chunks.values()).sort((left, right) => left.index - right.index);
  const receivedBytes = receivedChunks.reduce((total, chunk) => {
    const start = chunk.index * current.chunkSizeBytes;
    return total + Math.max(0, Math.min(fileSize, start + current.chunkSizeBytes) - start);
  }, 0);
  return {
    ...current,
    error: incoming.error,
    expiresAt: incoming.expiresAt || current.expiresAt,
    receivedBytes,
    receivedChunkIndexes: receivedChunks.map((chunk) => chunk.index),
    receivedChunks,
    retryable: incoming.retryable,
  };
};
