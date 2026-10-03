/** RAW concurrency is granted only after durable server-side batch preparation. */
export const EDITED_UPLOAD_CONCURRENCY = 3;

export async function runUploadConcurrencyPool<T, R>({
  items,
  concurrency,
  signal,
  run,
  exclusive,
  stopWhen,
  onSkipped,
}: {
  items: T[];
  concurrency: number;
  signal?: AbortSignal;
  run: (item: T, index: number) => Promise<R>;
  exclusive?: (item: T) => boolean;
  stopWhen?: (result: NoInfer<R>) => boolean;
  onSkipped?: (item: T, index: number) => NoInfer<R>;
}): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let stopped = false;
  let failure: unknown;
  const execute = async (index: number) => {
    try {
      results[index] = await run(items[index], index);
      if (stopWhen?.(results[index])) stopped = true;
    } catch (error) {
      failure ??= error;
      stopped = true;
    }
  };
  while (cursor < items.length && !stopped && !signal?.aborted) {
    if (exclusive?.(items[cursor])) {
      await execute(cursor++);
      continue;
    }
    let end = cursor;
    while (end < items.length && !exclusive?.(items[end])) end += 1;
    const worker = async () => {
      while (cursor < end && !stopped && !signal?.aborted) await execute(cursor++);
    };
    const workerCount = Math.min(end - cursor, Math.max(1, Math.floor(concurrency)));
    // Every worker settles before the caller can finalize, retry or change UI.
    await Promise.all(Array.from({ length: workerCount }, worker));
  }
  if (onSkipped) {
    items.forEach((item, index) => {
      if (!(index in results)) results[index] = onSkipped(item, index);
    });
  }
  if (failure) throw failure;
  if (signal?.aborted && !onSkipped) throw new Error('Upload cancelled. The remaining files are still selected for retry.');
  return results;
}
