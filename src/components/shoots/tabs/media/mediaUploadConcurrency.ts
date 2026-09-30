/**
 * Soft FE concurrency for edited shoot media uploads.
 * Raw stays serial (bracket batch offsets). Edited files each carry their own
 * idempotency/batch index, so a small pool is safe and reduces wall-clock time.
 */
export const EDITED_UPLOAD_CONCURRENCY = 3;

export async function runUploadConcurrencyPool<T, R>({
  items,
  concurrency,
  signal,
  run,
}: {
  items: T[];
  concurrency: number;
  signal?: AbortSignal;
  run: (item: T, index: number) => Promise<R>;
}): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      if (signal?.aborted) {
        throw new Error('Upload cancelled. The remaining files are still selected for retry.');
      }
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await run(items[index], index);
    }
  };

  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
